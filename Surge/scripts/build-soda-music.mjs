#!/usr/bin/env node
// Node.js 20+、jq。把墨鱼汽水音乐配置转换成 Surge 原生 Map Local 和 JQ Body Rewrite。
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/refs/heads/master/AdBlock/QiShuiMusicAds.conf';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/SodaMusic.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/QiShuiMusicAds.conf');
const CHECK_ONLY = process.argv.includes('--check');

if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-soda-music.mjs [--check]');
}

async function fetchSource() {
  const response = await fetch(SOURCE_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'SodaMusic-Surge-native-builder/1.0' },
  });
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status} ${SOURCE_URL}`);
  if (Number(response.headers.get('content-length')) > 1024 * 1024) throw new Error('上游配置过大；保留旧成品。');
  const source = await response.text();
  if (!source.trim() || Buffer.byteLength(source, 'utf8') > 1024 * 1024 || /^\s*(?:<!doctype\s+html|<html\b)/i.test(source)) {
    throw new Error('上游配置为空、过大或返回网页；保留旧成品。');
  }
  return source;
}

function fail(lineNumber, message) {
  throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`);
}

function quoteJq(raw, lineNumber) {
  let expression = raw.trim();
  if (!expression.startsWith("'") || !expression.endsWith("'") || expression.length < 3) fail(lineNumber, 'JQ 表达式缺少完整单引号');
  expression = expression.slice(1, -1);
  if (!expression.trim() || expression.includes("'") || /[\r\n]/.test(expression)) fail(lineNumber, 'JQ 表达式不能无损转换为 Surge 单行参数');
  // false and 避免实际读取/修改数据，仅让 jq 编译表达式。
  const result = spawnSync('jq', ['-n', `false and (${expression})`], { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error || result.status !== 0) fail(lineNumber, `JQ 编译失败（需安装 jq）：${result.error?.message || result.stderr.trim()}`);
  return `'${expression}'`;
}

function parseSource(source) {
  const sections = { 'Map Local': [], 'Body Rewrite': [] };
  const counts = { 'reject-200': 0, 'jsonjq-response-body': 0 };
  let hostnames;
  let previousComment;
  let version = '';
  let author = '';
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = original.trim();
    const lineNumber = index + 1;
    if (!line) continue;
    if (line.startsWith('//')) {
      const metadata = line.match(/^\/\/\s*@(Version|Author)\s+(.+)$/);
      if (metadata?.[1] === 'Version') version = metadata[2].trim();
      if (metadata?.[1] === 'Author') author = metadata[2].trim().replace(/^@/, '');
      continue;
    }
    if (line.startsWith('#')) { previousComment = line; continue; }
    if (/^hostname\s*=/.test(line)) {
      if (hostnames) fail(lineNumber, '出现了多份 hostname 声明');
      hostnames = line.replace(/^hostname\s*=\s*/, '').split(',').map((host) => host.trim());
      if (!hostnames.length || new Set(hostnames).size !== hostnames.length || hostnames.some((host) => !/^(?:[a-z0-9*-]+\.)+(?:douyin|qishui|zijieapi)\.com$/i.test(host))) {
        fail(lineNumber, 'MITM 主机不是支持的汽水音乐域名');
      }
      previousComment = undefined;
      continue;
    }
    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(lineNumber, `不认识的配置语法：${line}`);
    const [, pattern, action, argument = ''] = match;
    if (!Object.hasOwn(counts, action)) fail(lineNumber, `不支持的命令 ${action}`);
    try { new RegExp(pattern); } catch (error) { fail(lineNumber, `无法编译正则：${error.message}`); }
    if (!pattern.startsWith('^https:\\/\\/')) fail(lineNumber, '规则不再以 HTTPS 开头，需人工核对');
    let section;
    let converted;
    if (action === 'reject-200') {
      if (argument) fail(lineNumber, 'reject-200 不应携带参数');
      section = 'Map Local';
      converted = `${pattern} data-type=text data="" status-code=200`;
    } else {
      section = 'Body Rewrite';
      converted = `http-response-jq ${pattern} ${quoteJq(argument, lineNumber)}`;
    }
    if (previousComment) sections[section].push(previousComment);
    sections[section].push(converted);
    previousComment = undefined;
    counts[action] += 1;
  }
  if (!hostnames || !counts['reject-200'] || !counts['jsonjq-response-body'] || author !== 'ddgksf2013') {
    throw new Error('上游缺少 hostname、有效规则或作者声明；保留旧成品。');
  }
  return { sections, counts, hostnames, version, author };
}

function renderModule(source, parsed) {
  const lines = [
    '#!name=汽水音乐',
    '#!desc=从墨鱼官方汽水音乐规则转换为 Surge 原生模块；每 6 小时检查上游更新。需要 Surge iOS 5.14+ 或 Mac 5.9+，启用重写和 MITM 并信任证书；仅广告及推广净化，不解锁会员或音乐版权。',
    `#!author=${parsed.author}`,
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/SodaMusic.sgmodule',
    '',
    `# 上游：${SOURCE_URL}`,
    `# 上游版本：${parsed.version || '未声明'}`,
    `# 上游规则 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    '# 自动生成，请修改 Surge/scripts/build-soda-music.mjs；未知语法停止更新并保留旧版。',
    '# 按上游 @Attention 保留原作者出处；配置不包含远程 JavaScript。',
    '# 原作者使用提示：使用前请卸载汽水音乐，挂载模块后再安装使用；重装前请确认需要保留的下载与数据。',
    '# JQ Body Rewrite 需要 Surge iOS 5.14+ 或 Surge Mac 5.9+。',
    '# 上游规则保留位置隐私、TAGS/搜索推荐和推广界面净化，未添加会员或版权解锁。',
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
  const source = await fetchSource();
  const parsed = parseSource(source);
  const module = renderModule(source, parsed);
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；仅使用 Surge 原生 Map Local/JQ，无远程脚本。`);
  if (CHECK_ONLY) { console.log('只校验，不写入成品。'); return; }
  // 解析、正则和全部 jq 编译通过后才写入；未知命令不会覆盖旧模块。
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；上游快照${changedSource ? '已更新' : '无变化'}。`);
}

await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
