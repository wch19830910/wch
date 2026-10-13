#!/usr/bin/env node
// Node.js 20+。只转换墨鱼什么值得买配置，不在构建中执行下载的脚本。
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/SmzdmAds.conf';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/Smzdm.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/SmzdmAds.conf');
const CHECK_ONLY = process.argv.includes('--check');

if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-smzdm.mjs [--check]');
}

async function fetchText(url, maxBytes) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'Smzdm-Surge-native-builder/1.0' },
  });
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status} ${url}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error(`远程文件过大：${url}`);
  const body = await response.text();
  if (!body.trim() || Buffer.byteLength(body, 'utf8') > maxBytes) throw new Error(`远程文件为空或过大：${url}`);
  if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(body)) throw new Error(`远程地址返回了网页：${url}`);
  return body;
}

function fail(lineNumber, message) {
  throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`);
}

function scriptUrl(raw, lineNumber) {
  // 保留配置中的实际地址，只接受原作者官方持续更新分支。
  if (!/^https:\/\/raw\.githubusercontent\.com\/ddgksf2013\/Scripts\/(?:refs\/heads\/)?(?:master|main)\/[A-Za-z0-9_./-]+\.js$/.test(raw) || raw.split('/').includes('..')) {
    fail(lineNumber, `不支持的脚本来源：${raw}`);
  }
  return new URL(raw).href;
}

function parseSource(source) {
  const sections = { 'Map Local': [], Script: [] };
  const counts = { 'reject-200': 0, 'script-response-body': 0 };
  const scriptUrls = new Set();
  let hostnames;
  let previousComment;
  let version = '';
  let authors = [];
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = original.trim();
    const lineNumber = index + 1;
    if (!line) continue;
    if (line.startsWith('//')) {
      const metadata = line.match(/^\/\/\s*@(Version|Author)\s+(.+)$/);
      if (metadata?.[1] === 'Version') version = metadata[2].trim();
      if (metadata?.[1] === 'Author') authors = metadata[2].split(',').map((author) => author.trim().replace(/^@/, ''));
      continue;
    }
    if (line.startsWith('#')) { previousComment = line; continue; }
    if (/^hostname\s*=/.test(line)) {
      if (hostnames) fail(lineNumber, '出现了多份 hostname 声明');
      hostnames = line.replace(/^hostname\s*=\s*/, '').split(',').map((host) => host.trim());
      if (!hostnames.length || new Set(hostnames).size !== hostnames.length || hostnames.some((host) => !/^(?:\*\.|[a-z0-9-]+\.)+(?:smzdm|zdmimg)\.com$/i.test(host))) {
        fail(lineNumber, 'MITM 主机不是支持的什么值得买子域名');
      }
      previousComment = undefined;
      continue;
    }
    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(lineNumber, `不认识的配置语法：${line}`);
    const [, pattern, action, argument = ''] = match;
    if (!Object.hasOwn(counts, action)) fail(lineNumber, `不支持的命令 ${action}`);
    try { new RegExp(pattern); } catch (error) { fail(lineNumber, `无法编译正则：${error.message}`); }
    if (!pattern.startsWith('^https?:\\/\\/') || !/(?:smzdm|zdmimg)\\\.com/.test(pattern)) fail(lineNumber, '规则范围离开什么值得买接口，需人工核对');
    let section;
    let converted;
    if (action === 'reject-200') {
      if (argument) fail(lineNumber, 'reject-200 不应携带参数');
      section = 'Map Local';
      converted = `${pattern} data-type=text data="" status-code=200`;
    } else {
      if (pattern.includes(',')) fail(lineNumber, '脚本正则含逗号，不能安全转换为参数列表');
      const remote = scriptUrl(argument, lineNumber);
      scriptUrls.add(remote);
      section = 'Script';
      const name = `smzdm_response_${String(counts[action] + 1).padStart(2, '0')}`;
      converted = `${name} = type=http-response,pattern=${pattern},requires-body=true,max-size=-1,timeout=60,script-update-interval=86400,script-path=${remote}`;
    }
    if (previousComment) sections[section].push(previousComment);
    sections[section].push(converted);
    previousComment = undefined;
    counts[action] += 1;
  }
  if (!hostnames || !counts['reject-200'] || !counts['script-response-body'] || authors.length !== 2 || !authors.includes('blackmatrix7') || !authors.includes('ddgksf2013')) {
    throw new Error('上游缺少 hostname、有效规则或双作者声明；保留旧成品。');
  }
  return { sections, counts, scriptUrls, hostnames, version, authors };
}

function renderModule(source, parsed) {
  const lines = [
    '#!name=什么值得买',
    '#!desc=从墨鱼官方什么值得买规则自动转换；每 6 小时检查上游规则，响应脚本每 24 小时检查原作者分支更新。需启用重写、脚本及 MITM，并信任 MITM 证书；仅广告净化，不解锁会员。',
    `#!author=${parsed.authors.join(', ')}`,
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Smzdm.sgmodule',
    '',
    `# 上游：${SOURCE_URL}`,
    `# 上游版本：${parsed.version || '未声明'}`,
    `# 上游规则 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    '# 自动生成，请修改 Surge/scripts/build-smzdm.mjs；未知语法停止更新并保留旧版。',
    '# 按原作者 @Attention 保留出处；JavaScript 仅远程引用，不复制脚本正文。',
    '# Map Local 的 text 需要 Surge iOS 5.9.1+ 或 Surge Mac 5.5.1+。',
  ];
  for (const [section, rules] of Object.entries(parsed.sections)) if (rules.length) lines.push('', `[${section}]`, ...rules);
  lines.push('', '[MITM]', `hostname = %APPEND% ${parsed.hostnames.join(', ')}`, '');
  return lines.join('\n');
}

async function readExisting(path) {
  try { return await readFile(path, 'utf8'); } catch (error) {
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
  const source = await fetchText(SOURCE_URL, 1024 * 1024);
  const parsed = parseSource(source);
  for (const url of parsed.scriptUrls) {
    const javascript = await fetchText(url, 5 * 1024 * 1024);
    try { new Script(javascript, { filename: url }); } catch (error) {
      throw new Error(`上游 JavaScript 语法检查失败，保留旧成品：${error.message}`);
    }
  }
  const module = renderModule(source, parsed);
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；远程脚本 ${parsed.scriptUrls.size} 个。`);
  if (CHECK_ONLY) { console.log('只校验，不写入成品。'); return; }
  // 全部解析、正则和 JavaScript 编译通过后才写入；不运行远程脚本。
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；上游快照${changedSource ? '已更新' : '无变化'}。`);
}

await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
