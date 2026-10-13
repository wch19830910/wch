#!/usr/bin/env node
// Node.js 20+。只从墨鱼站点所列的官方源构建，不执行下载的脚本。
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/Ximalaya.conf';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/Ximalaya.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/Ximalaya.conf');
const CHECK_ONLY = process.argv.includes('--check');
const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_SCRIPT_BYTES = 5 * 1024 * 1024;

if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-ximalaya.mjs [--check]');
}

async function fetchText(url, maxBytes) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'Ximalaya-Surge-native-builder/1.0' },
  });
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status} ${url}`);
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
  // 只跟随原作者 Scripts 仓库的 master 分支，避免意外引入其他脚本来源。
  if (!/^https:\/\/raw\.githubusercontent\.com\/ddgksf2013\/Scripts\/(?:refs\/heads\/)?master\/[A-Za-z0-9_./-]+\.js$/.test(raw)) {
    fail(lineNumber, `脚本不属于支持的墨鱼官方 master 地址：${raw}`);
  }
  const url = new URL(raw);
  if (url.pathname.split('/').includes('..')) fail(lineNumber, '脚本地址包含异常路径');
  return url.href;
}

function quoteJq(raw, lineNumber) {
  let expression = raw.trim();
  if (!expression) fail(lineNumber, '缺少 JQ 表达式');
  if (expression.startsWith("'")) {
    if (!expression.endsWith("'") || expression.length < 3) {
      fail(lineNumber, 'JQ 表达式的单引号不完整');
    }
    expression = expression.slice(1, -1);
  }
  // Surge 的表达式用单引号包裹；遇到不能无损序列化的输入则停止更新。
  if (typeof expression !== 'string' || !expression.trim() || expression.includes("'") || /[\r\n]/.test(expression)) {
    fail(lineNumber, 'JQ 表达式不能无损转换为 Surge 的单行参数');
  }
  const result = spawnSync('jq', ['-n', `false and (${expression})`], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    const reason = result.error?.message || result.stderr.trim() || '未知编译错误';
    fail(lineNumber, `JQ 编译检查失败（需安装 jq）：${reason}`);
  }
  return `'${expression}'`;
}

function parseSource(source) {
  const sections = {
    'URL Rewrite': [],
    'Map Local': [],
    'Body Rewrite': [],
    Script: [],
  };
  const scriptUrls = new Set();
  const counts = { reject: 0, 'reject-200': 0, 'jsonjq-response-body': 0, 'script-response-body': 0 };
  let hostnames;
  let previousComment;
  let version = '';
  let totalRules = 0;

  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = original.trim();
    if (!line) continue;
    if (line.startsWith('//')) {
      const match = line.match(/^\/\/\s*@Version\s+(.+)$/);
      if (match) version = match[1].trim();
      continue;
    }
    if (line.startsWith('#')) {
      previousComment = line;
      continue;
    }
    if (/^hostname\s*=/.test(line)) {
      if (hostnames) fail(lineNumber, '出现了多份 hostname 声明');
      hostnames = line.replace(/^hostname\s*=\s*/, '').split(',').map((host) => host.trim());
      if (!hostnames.length || hostnames.some((host) => !/^-?[A-Za-z0-9*_.-]+$/.test(host))) {
        fail(lineNumber, 'hostname 为空或含不支持的字符');
      }
      previousComment = undefined;
      continue;
    }

    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(lineNumber, `不认识的配置语法：${line}`);
    const [, pattern, action, argument = ''] = match;
    if (!(action in counts)) fail(lineNumber, `不支持的命令 ${action}`);
    validatePattern(pattern, lineNumber);

    let section;
    let converted;
    switch (action) {
      case 'reject':
        if (argument) fail(lineNumber, 'reject 不应携带参数');
        section = 'URL Rewrite';
        converted = `${pattern} - reject`;
        break;
      case 'reject-200':
        if (argument) fail(lineNumber, 'reject-200 不应携带参数');
        section = 'Map Local';
        converted = `${pattern} data-type=text data="" status-code=200`;
        break;
      case 'jsonjq-response-body':
        section = 'Body Rewrite';
        converted = `http-response-jq ${pattern} ${quoteJq(argument, lineNumber)}`;
        break;
      case 'script-response-body': {
        if (pattern.includes(',')) fail(lineNumber, '脚本正则含逗号，不能安全转换为参数列表');
        const scriptUrl = validateScriptUrl(argument, lineNumber);
        const name = `ximalaya_response_${String(counts[action] + 1).padStart(2, '0')}`;
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

  if (!hostnames || totalRules === 0 || scriptUrls.size === 0) {
    throw new Error('上游缺少 hostname、有效规则或响应脚本；保留旧成品。');
  }
  return { sections, scriptUrls, hostnames, version, counts };
}

function renderModule(source, parsed) {
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const lines = [
    '#!name=喜马拉雅',
    '#!desc=从墨鱼官方喜马拉雅规则自动转换；模块跟随上游规则，响应脚本每 24 小时检查原作者 master 更新。需启用重写、脚本及 MITM，并信任 MITM 证书。如果广告仍然存在，请清除缓存或卸载应用重新安装。',
    '#!author=ddgksf2013',
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Ximalaya.sgmodule',
    '',
    `# 上游：${SOURCE_URL}`,
    `# 上游版本：${parsed.version || '未声明'}`,
    `# 上游规则 SHA256：${sourceHash}`,
    '# 自动生成，请修改 Surge/scripts/build-ximalaya.mjs；遇到不支持的上游语法时停止更新并保留旧版。',
  ];
  if (parsed.counts['jsonjq-response-body'] > 0) {
    lines.push('# JQ Body Rewrite 需要 Surge iOS 5.14+ 或 Surge Mac 5.9+。');
  }
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
  const source = await fetchText(SOURCE_URL, MAX_SOURCE_BYTES);
  const parsed = parseSource(source);
  // 仅检查语法；下载的 JavaScript 不会被运行。
  for (const url of parsed.scriptUrls) {
    const javascript = await fetchText(url, MAX_SCRIPT_BYTES);
    try {
      new Script(javascript, { filename: url });
    } catch (error) {
      throw new Error(`上游 JavaScript 语法检查失败，保留旧成品：${error.message}`);
    }
  }
  const module = renderModule(source, parsed);
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；远程脚本 ${parsed.scriptUrls.size} 个。`);
  if (CHECK_ONLY) {
    console.log('只校验，不写入成品。');
    return;
  }
  // 所有解析、正则/JQ/脚本检查通过后才写文件，未知命令不会覆盖旧模块。
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；上游快照${changedSource ? '已更新' : '无变化'}。`);
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
