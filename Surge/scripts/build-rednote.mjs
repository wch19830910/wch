#!/usr/bin/env node
// Node.js 20+。从墨鱼站点 data.json 的“小红书·去广告去水印”条目构建；不执行下载的脚本。
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SOURCE_URL = 'https://ddgksf2013.top/rewrite/XiaoHongShuAds.conf';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/RedNote.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/XiaoHongShuAds.conf');
const CHECK_ONLY = process.argv.includes('--check');
const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_SCRIPT_BYTES = 5 * 1024 * 1024;

if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-rednote.mjs [--check]');
}

async function fetchText(url, maxBytes, userAgent) {
  // 作者站点根据 UA 提供配置/脚本；普通浏览器和 curl UA 会被导向首页。
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': userAgent },
  });
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status} ${url}`);
  if (response.url !== url) throw new Error(`远程地址发生未审核的跳转：${url} → ${response.url}`);
  const declaredSize = Number(response.headers.get('content-length'));
  if (declaredSize > maxBytes) throw new Error(`远程文件过大：${url}`);
  const body = await response.text();
  if (!body.trim() || Buffer.byteLength(body, 'utf8') > maxBytes) {
    throw new Error(`远程文件为空或过大：${url}`);
  }
  if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(body)) {
    throw new Error(`远程地址返回了网页而非配置/脚本：${url}`);
  }
  return body;
}

function fail(lineNumber, message) {
  throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`);
}

function validatePattern(pattern, lineNumber) {
  try {
    new RegExp(pattern);
  } catch (error) {
    fail(lineNumber, `无法编译正则：${error.message}`);
  }
}

function validateScriptUrl(raw, lineNumber) {
  // 此条目的实际官方脚本在作者站点，并不存在同名 Scripts/master 文件。
  // 保留作者实际发布地址，不能猜测 GitHub 分支或引入第三方脚本。
  if (raw !== 'https://ddgksf2013.top/scripts/redbook.ads.js') {
    fail(lineNumber, `脚本地址发生未审核的变化：${raw}`);
  }
  return raw;
}

function parseSource(source) {
  const sections = { 'Map Local': [], Script: [] };
  const scriptUrls = new Set();
  const counts = { 'reject-200': 0, 'script-response-body': 0 };
  let hostnames;
  let previousComment;
  let updateTime = '';
  let author = '';
  let scriptName = '';
  let totalRules = 0;

  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = original.trim();
    if (!line) continue;
    if (line.startsWith('//')) {
      const metadata = line.match(/^\/\/\s*@(UpdateTime|Author|ScriptName)\s+(.+)$/);
      if (metadata?.[1] === 'UpdateTime') updateTime = metadata[2].trim();
      if (metadata?.[1] === 'Author') author = metadata[2].trim().replace(/^@/, '');
      if (metadata?.[1] === 'ScriptName') scriptName = metadata[2].trim();
      continue;
    }
    // 圈 X 以分号禁用的行仍然保持禁用，不把它转换成生效的脚本。
    if (line.startsWith('#') || line.startsWith(';')) {
      previousComment = line.startsWith(';') ? `# 上游禁用：${line.slice(1)}` : line;
      continue;
    }
    if (/^hostname\s*=/.test(line)) {
      if (hostnames) fail(lineNumber, '出现了多份 hostname 声明');
      hostnames = line.replace(/^hostname\s*=\s*/, '').split(',').map((host) => host.trim());
      if (!hostnames.length || hostnames.some((host) => !/^(?:\*\.)?(?:[a-z0-9-]+\.)*xiaohongshu\.com$/i.test(host))) {
        fail(lineNumber, 'hostname 为空或超出小红书域名范围');
      }
      previousComment = undefined;
      continue;
    }
    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(lineNumber, `不认识的配置语法：${line}`);
    const [, pattern, action, argument = ''] = match;
    if (!Object.hasOwn(counts, action)) fail(lineNumber, `不支持的命令 ${action}`);
    validatePattern(pattern, lineNumber);

    let section;
    let converted;
    switch (action) {
      case 'reject-200':
        if (argument) fail(lineNumber, 'reject-200 不应携带参数');
        section = 'Map Local';
        converted = `${pattern} data-type=text data="" status-code=200`;
        break;
      case 'script-response-body': {
        if (pattern.includes(',')) fail(lineNumber, '脚本正则含逗号，不能安全转换为参数列表');
        const scriptUrl = validateScriptUrl(argument, lineNumber);
        const name = `rednote_response_${String(counts[action] + 1).padStart(2, '0')}`;
        scriptUrls.add(scriptUrl);
        section = 'Script';
        converted = `${name} = type=http-response,pattern=${pattern},requires-body=true,max-size=-1,timeout=60,script-update-interval=86400,script-path=${scriptUrl}`;
        break;
      }
      default:
        fail(lineNumber, `不支持的命令 ${action}`);
    }
    if (previousComment) sections[section].push(previousComment);
    sections[section].push(converted);
    previousComment = undefined;
    counts[action] += 1;
    totalRules += 1;
  }

  if (!hostnames || totalRules === 0 || scriptUrls.size === 0 || author !== 'ddgksf2013' || !scriptName.includes('小红书')) {
    throw new Error('上游缺少有效规则、hostname、脚本或预期的小红书/作者声明；保留旧成品。');
  }
  return { sections, scriptUrls, hostnames, updateTime, author, counts };
}

function renderModule(source, parsed) {
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const lines = [
    '#!name=小红书（去广告与去水印）',
    '#!desc=小红书上游净化与功能增强版：处理开屏、首页/视频/搜索等信息流广告、热搜热词及部分推广，按上游提供帖子图片、Live 图片和短视频保存去水印等功能；同时屏蔽部分统计、隐私及青少年状态请求，可能改变页面或相关功能，不合入另一个“屏蔽首页视频”条目。原作者 ddgksf2013；规则每 6 小时检查上游，远程脚本每 24 小时检查原作者站点更新，依赖作者站点继续提供脚本。需 Surge iOS 5.9.1+ / Mac 5.5.1+（Map Local），开启重写、脚本、MITM，安装及信任 MITM 证书，并保持 MITM auto-quic-block 默认开启。功能异常请停用；不保证清除所有广告或所有内容均可无水印保存，尚未在最新版 App 实机验证。',
    `#!author=${parsed.author}`,
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/RedNote.sgmodule',
    '',
    `# 上游：${SOURCE_URL}`,
    `# 上游更新时间：${parsed.updateTime || '未声明'}`,
    `# 上游规则 SHA256：${sourceHash}`,
    '# 自动生成，请修改 Surge/scripts/build-rednote.mjs；遇到不支持的上游语法时停止更新并保留旧版。',
    '# 仅使用去广告去水印条目，不合入单独的首页视频屏蔽条目。',
    '# Surge 保持 MITM auto-quic-block 默认开启；本模块不全局丢弃 UDP 443。',
    '# 原作者脚本由其站点直接提供（需支持 Surge UA），不是 GitHub master 同名文件。',
    '# Map Local 的 text 需要 Surge iOS 5.9.1+ 或 Surge Mac 5.5.1+。',
  ];
  for (const [section, rules] of Object.entries(parsed.sections)) {
    if (rules.length) lines.push('', `[${section}]`, ...rules);
  }
  lines.push('', '[MITM]', `hostname = %APPEND% ${parsed.hostnames.join(', ')}`, '');
  return lines.join('\n');
}

async function readExisting(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeIfChanged(path, content) {
  if (await readExisting(path) === content) return false;
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, content, 'utf8');
  await rename(temporaryPath, path);
  return true;
}

async function main() {
  const source = await fetchText(SOURCE_URL, MAX_SOURCE_BYTES, 'Quantumult X');
  const parsed = parseSource(source);
  // 以 Surge UA 确认实际使用环境能下载脚本；只编译检查，不执行下载的 JavaScript。
  for (const url of parsed.scriptUrls) {
    const javascript = await fetchText(url, MAX_SCRIPT_BYTES, 'Surge');
    try {
      new Script(javascript, { filename: url });
    } catch (error) {
      throw new Error(`上游 JavaScript 语法检查失败，保留旧成品：${error.message}`);
    }
    if (!javascript.includes('isSurge()') || !javascript.includes('$response')) {
      throw new Error('上游脚本缺少预期的 Surge/响应体兼容声明；保留旧成品。');
    }
  }
  const module = renderModule(source, parsed);
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；远程脚本 ${parsed.scriptUrls.size} 个。`);
  if (CHECK_ONLY) {
    console.log('只校验，不写入成品。');
    return;
  }
  // 解析、正则及脚本语法检查全部通过后才写文件。
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；上游快照${changedSource ? '已更新' : '无变化'}。`);
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
