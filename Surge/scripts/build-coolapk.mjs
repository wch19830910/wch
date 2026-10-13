#!/usr/bin/env node
// Node.js 20+。读取墨鱼酷安脚本注释中的配置，不执行或转载下载的脚本。
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Scripts/master/coolapk.js';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/Coolapk.sgmodule');
const OUTPUT_METADATA = resolve(SURGE_ROOT, 'upstream/Coolapk.source.json');
const CHECK_ONLY = process.argv.includes('--check');
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-coolapk.mjs [--check]');
}

async function fetchText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'Coolapk-Surge-native-builder/1.0' },
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
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+coolapk\.com$/i.test(host)) {
    fail(lineNumber, `hostname 不是支持的酷安子域名：${host}`);
  }
  return host.toLowerCase();
}

function normalizeScriptUrl(raw, lineNumber) {
  // 原配置的 github.com/raw 与下列 raw 直链指向同一作者 master 脚本。
  if (raw === 'https://github.com/ddgksf2013/Scripts/raw/master/coolapk.js' || raw === SOURCE_URL) {
    return SOURCE_URL;
  }
  fail(lineNumber, `脚本地址不属于支持的墨鱼官方酷安 master 源：${raw}`);
}

function parseSource(source) {
  const header = source.replace(/^\uFEFF/, '').match(/^\s*\/\*([\s\S]*?)\*\//);
  if (!header) throw new Error('上游缺少开头配置注释；保留旧成品。');

  const scripts = [];
  const mapLocal = [];
  const counts = { 'script-response-body': 0, 'reject-200': 0 };
  let section;
  let seenRewrite = false;
  let seenMitm = false;
  let hostnames;
  let author = '';
  let updated = '';
  let previousComment;

  for (const [index, original] of header[0].split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = original.trim();
    if (!line || /^[/*]+$/.test(line)) continue;
    if (line.startsWith('>')) {
      if (section) fail(lineNumber, '配置段中出现了不支持的说明文本');
      const authorMatch = line.match(/^>\s*脚本作者\s*[:：]\s*@?([A-Za-z0-9_-]+)\s*$/);
      const updatedMatch = line.match(/^>\s*更新时间\s*[:：]\s*(.+)$/);
      if (authorMatch) author = authorMatch[1];
      if (updatedMatch) updated = updatedMatch[1].trim();
      continue;
    }
    if (line === '[rewrite_local]') {
      if (seenRewrite || seenMitm) fail(lineNumber, '出现了重复或错序的 rewrite_local 配置');
      section = 'rewrite_local';
      seenRewrite = true;
      continue;
    }
    if (line === '[mitm]') {
      if (seenMitm || !seenRewrite) fail(lineNumber, '出现了重复或错序的 mitm 配置');
      section = 'mitm';
      seenMitm = true;
      previousComment = undefined;
      continue;
    }
    if (line.startsWith('[')) fail(lineNumber, `不支持的配置段：${line}`);
    if (!section) {
      // 头部的多行使用限制不属于配置；不复制长段说明或脚本正文。
      continue;
    }
    if (line.startsWith('#') || line.startsWith('//')) {
      previousComment = line.startsWith('//') ? `# ${line.slice(2).trim()}` : line;
      continue;
    }
    if (section === 'rewrite_local') {
      const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(\S+))?$/);
      if (!match) fail(lineNumber, `不认识的重写配置：${line}`);
      const [, pattern, action, rawUrl] = match;
      if (!Object.hasOwn(counts, action)) fail(lineNumber, `不支持的命令 ${action}`);
      try {
        new RegExp(pattern);
      } catch (error) {
        fail(lineNumber, `无法编译正则：${error.message}`);
      }
      if (action === 'script-response-body') {
        if (!rawUrl) fail(lineNumber, '响应脚本缺少地址');
        if (pattern.includes(',')) fail(lineNumber, '脚本正则含逗号，不能安全转换为参数列表');
        const scriptUrl = normalizeScriptUrl(rawUrl, lineNumber);
        const name = `coolapk_response_${String(counts[action] + 1).padStart(2, '0')}`;
        if (previousComment) scripts.push(previousComment);
        scripts.push(`${name} = type=http-response,pattern=${pattern},requires-body=true,max-size=-1,timeout=60,script-update-interval=86400,script-path=${scriptUrl}`);
      } else {
        if (rawUrl) fail(lineNumber, 'reject-200 不应携带参数');
        if (previousComment) mapLocal.push(previousComment);
        mapLocal.push(`${pattern} data-type=text data="" status-code=200`);
      }
      counts[action] += 1;
      previousComment = undefined;
      continue;
    }
    if (section === 'mitm') {
      const match = line.match(/^hostname\s*=\s*(.+)$/);
      if (!match || hostnames) fail(lineNumber, `不支持或重复的 MITM 配置：${line}`);
      hostnames = match[1].split(',').map((host) => validateHostname(host.trim(), lineNumber));
      if (new Set(hostnames).size !== hostnames.length) fail(lineNumber, 'hostname 中有重复域名');
      continue;
    }
    fail(lineNumber, `不认识的配置：${line}`);
  }

  if (!seenRewrite || !seenMitm || !scripts.length || !hostnames?.length || author !== 'ddgksf2013') {
    throw new Error('上游缺少有效重写、MITM 或原作者声明；保留旧成品。');
  }
  const version = source.match(/^const\s+version\s*=\s*['"]([^'"]+)['"]\s*;/m)?.[1] || '';
  return { scripts, mapLocal, hostnames, author, updated, version, counts };
}

function renderModule(sourceHash, parsed) {
  const lines = [
    '#!name=酷安',
    '#!desc=从墨鱼官方酷安配置转换为原生 Surge 模块；模块跟随上游，响应脚本每 24 小时检查原作者 master 更新。需启用重写、脚本及 MITM，并信任 MITM 证书。',
    `#!author=${parsed.author}`,
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Coolapk.sgmodule',
    '',
    `# 上游：${SOURCE_URL}`,
    `# 上游版本：${parsed.version || '未声明'}；更新时间：${parsed.updated || '未声明'}`,
    `# 上游脚本 SHA256：${sourceHash}`,
    '# 自动生成，请修改 Surge/scripts/build-coolapk.mjs；遇到不支持的上游语法时停止更新并保留旧版。',
    '# 本文件仅转换原生配置，原作者 JavaScript 仅远程引用，不复制或转载脚本正文。',
    '# 遵守原作者使用限制：仅供学习交流，禁止转载、售卖。',
    '# Map Local 的 text 需要 Surge iOS 5.9.1+ 或 Surge Mac 5.5.1+。',
  ];
  if (parsed.mapLocal.length) lines.push('', '[Map Local]', ...parsed.mapLocal);
  lines.push('', '[Script]', ...parsed.scripts, '', '[MITM]', `hostname = %APPEND% ${parsed.hostnames.join(', ')}`, '');
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
  const source = await fetchText(SOURCE_URL);
  const parsed = parseSource(source);
  // 仅编译检查语法；上游混淆 JavaScript 不会被运行。
  try {
    new Script(source, { filename: SOURCE_URL });
  } catch (error) {
    throw new Error(`上游 JavaScript 语法检查失败，保留旧成品：${error.message}`);
  }
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const module = renderModule(sourceHash, parsed);
  const metadata = `${JSON.stringify({
    source: SOURCE_URL,
    sha256: sourceHash,
    author: parsed.author,
    version: parsed.version,
    updated: parsed.updated,
    counts: parsed.counts,
    note: '仅记录来源元信息；原作者 JavaScript 不复制、不转载，仅通过模块远程引用。',
  }, null, 2)}\n`;
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；MITM 域名 ${parsed.hostnames.length} 个。`);
  if (CHECK_ONLY) {
    console.log('只校验，不写入成品。');
    return;
  }
  // 所有校验通过才写入模块与来源元信息，不保存上游 JavaScript 正文。
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedMetadata = await writeIfChanged(OUTPUT_METADATA, metadata);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；来源元信息${changedMetadata ? '已更新' : '无变化'}。`);
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
