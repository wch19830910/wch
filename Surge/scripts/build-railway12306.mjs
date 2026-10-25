#!/usr/bin/env node
// Node.js 20+。读取墨鱼 12306 脚本注释中的配置，不执行下载的脚本。
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Scripts/master/12306.js';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/Railway12306.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/12306.js');
const CHECK_ONLY = process.argv.includes('--check');
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-railway12306.mjs [--check]');
}

async function fetchText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'Railway12306-Surge-native-builder/1.0' },
  });
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status} ${url}`);
  if (Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) {
    throw new Error(`远程脚本过大：${url}`);
  }
  const source = await response.text();
  if (!source.trim() || Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    throw new Error(`远程脚本为空或过大：${url}`);
  }
  if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(source)) {
    throw new Error(`远程地址返回了网页而非脚本：${url}`);
  }
  return source;
}

function fail(lineNumber, message) {
  throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`);
}

function validateHostname(host, lineNumber) {
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+12306\.cn$/i.test(host)) {
    fail(lineNumber, `hostname 不是支持的 12306 子域名：${host}`);
  }
  return host.toLowerCase();
}

function normalizeScriptUrl(raw, lineNumber) {
  // 原配置使用 github.com/raw，成品使用相同原作者 master 的 raw 直链。
  if (raw === 'https://github.com/ddgksf2013/Scripts/raw/master/12306.js' || raw === SOURCE_URL) {
    return SOURCE_URL;
  }
  fail(lineNumber, `脚本地址不属于支持的墨鱼官方 12306 master 源：${raw}`);
}

function parseSource(source) {
  const header = source.replace(/^\uFEFF/, '').match(/^\s*\/\*([\s\S]*?)\*\//);
  if (!header) throw new Error('上游缺少开头配置注释；保留旧成品。');

  const scripts = [];
  const directHosts = new Set();
  let section;
  let seenRewrite = false;
  let seenMitm = false;
  let hostnames;
  let author = '';
  let version = '';

  for (const [index, original] of header[0].split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = original.trim();
    if (!line || /^[/*]+$/.test(line)) continue;
    if (line.startsWith('>')) {
      if (section) fail(lineNumber, '配置段中出现了不支持的说明文本');
      const authorMatch = line.match(/^>\s*脚本作者\s*[:：]\s*@?([A-Za-z0-9_-]+)\s*$/);
      const versionMatch = line.match(/^>\s*更新时间\s*[:：]\s*(.+)$/);
      if (authorMatch) author = authorMatch[1];
      if (versionMatch) version = versionMatch[1].trim();
      if (/^>\s*使用说明\s*[:：]/.test(line)) {
        const directMatch = line.match(/\bhost\s*,\s*([A-Za-z0-9.-]+)\s*,\s*direct\s*$/i);
        if (!directMatch) fail(lineNumber, '使用说明中缺少支持的 host, 域名, direct 配置');
        directHosts.add(validateHostname(directMatch[1], lineNumber));
      }
      continue;
    }
    if (line === '[rewrite_local]') {
      if (seenRewrite) fail(lineNumber, '出现了多份 rewrite_local 配置');
      section = 'rewrite_local';
      seenRewrite = true;
      continue;
    }
    if (line === '[mitm]') {
      if (seenMitm) fail(lineNumber, '出现了多份 mitm 配置');
      section = 'mitm';
      seenMitm = true;
      continue;
    }
    if (line.startsWith('#') || line.startsWith('//')) continue;
    if (section === 'rewrite_local') {
      const match = line.match(/^(\S+)\s+url\s+(\S+)\s+(\S+)$/);
      if (!match) fail(lineNumber, `不认识的重写配置：${line}`);
      const [, pattern, action, rawUrl] = match;
      if (action !== 'script-analyze-echo-response') fail(lineNumber, `不支持的命令 ${action}`);
      if (pattern.includes(',')) fail(lineNumber, '脚本正则含逗号，不能安全转换为参数列表');
      try {
        new RegExp(pattern);
      } catch (error) {
        fail(lineNumber, `无法编译正则：${error.message}`);
      }
      const scriptUrl = normalizeScriptUrl(rawUrl, lineNumber);
      const name = `railway12306_request_${String(scripts.length + 1).padStart(2, '0')}`;
      scripts.push(`${name} = type=http-request,pattern=${pattern},requires-body=true,max-size=-1,timeout=60,script-update-interval=86400,script-path=${scriptUrl}`);
      continue;
    }
    if (section === 'mitm') {
      const match = line.match(/^hostname\s*=\s*(.+)$/);
      if (!match || hostnames) fail(lineNumber, `不支持或重复的 MITM 配置：${line}`);
      hostnames = match[1].split(',').map((host) => validateHostname(host.trim(), lineNumber));
      if (new Set(hostnames).size !== hostnames.length) fail(lineNumber, 'hostname 中有重复域名');
      continue;
    }
    fail(lineNumber, `不认识的头部配置：${line}`);
  }

  if (!seenRewrite || !seenMitm || !scripts.length || !hostnames?.length || author !== 'ddgksf2013' || !directHosts.size) {
    throw new Error('上游缺少有效重写、MITM、原作者声明或 DIRECT 使用说明；保留旧成品。');
  }
  if ([...directHosts].some((host) => !hostnames.includes(host))) {
    throw new Error('上游 DIRECT 域名不在 MITM 配置中；保留旧成品。');
  }
  return { scripts, directHosts, hostnames, author, version };
}

function renderModule(source, parsed) {
  return [
    '#!name=铁路12306（开屏去广告）',
    '#!desc=铁路12306开屏及广告接口专用版：仅处理 ad.12306.cn/ad/ser/getAdList，在请求阶段按上游脚本返回开屏广告占位或空广告结果，并保留该广告域名 DIRECT 分流；不改写其他购票、订单或支付接口。原作者 ddgksf2013；规则每 6 小时检查上游，请求脚本每 24 小时检查原作者分支更新。建议使用最新版 Surge；需开启脚本、MITM，并安装及信任 MITM 证书。不代表所有版本的全部广告都能去除；若影响使用请停用，尚未在最新版 App 实机验证。',
    `#!author=${parsed.author}`,
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Railway12306.sgmodule',
    '',
    `# 上游：${SOURCE_URL}`,
    `# 上游版本：${parsed.version || '未声明'}`,
    `# 上游规则 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    '# 自动生成，请修改 Surge/scripts/build-railway12306.mjs；遇到不支持的上游语法时停止更新并保留旧版。',
    '# 上游 script-analyze-echo-response 在请求阶段直接返回广告占位响应，故转换为 http-request。',
    '',
    '[Rule]',
    ...[...parsed.directHosts].map((host) => `DOMAIN,${host},DIRECT`),
    '',
    '[Script]',
    ...parsed.scripts,
    '',
    '[MITM]',
    `hostname = %APPEND% ${parsed.hostnames.join(', ')}`,
    '',
  ].join('\n');
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
  const source = await fetchText(SOURCE_URL);
  const parsed = parseSource(source);
  // 仅编译检查语法，不运行上游 JavaScript。
  try {
    new Script(source, { filename: SOURCE_URL });
  } catch (error) {
    throw new Error(`上游 JavaScript 语法检查失败，保留旧成品：${error.message}`);
  }
  const module = renderModule(source, parsed);
  console.log(`校验通过：请求脚本 ${parsed.scripts.length} 个；MITM 域名 ${parsed.hostnames.length} 个。`);
  if (CHECK_ONLY) {
    console.log('只校验，不写入成品。');
    return;
  }
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；上游快照${changedSource ? '已更新' : '无变化'}。`);
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
