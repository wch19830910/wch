#!/usr/bin/env node
// Node.js 20+、jq。只转换墨鱼站点实际官方源；JQ 原样映射原生 Body Rewrite，远程 JS 仅编译不执行。
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/refs/heads/master/AdBlock/GoofishAds.conf';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/Goofish.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/GoofishAds.conf');
const CHECK_ONLY = process.argv.includes('--check');
const AMDC_URL = 'https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/amdc.js';
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-goofish.mjs [--check]');
}
async function fetchText(url, maxBytes) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Surge' } });
  if (!response.ok || response.url !== url) throw new Error(`下载失败或地址发生未审核跳转：HTTP ${response.status} ${url}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error(`远程文件过大：${url}`);
  const body = await response.text();
  if (!body.trim() || Buffer.byteLength(body) > maxBytes || /^\s*(?:<!doctype\s+html|<html\b)/i.test(body)) {
    throw new Error(`远程文件为空、过大或返回网页：${url}`);
  }
  return body;
}
function fail(lineNumber, message) { throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`); }
function quoteJq(argument, lineNumber) {
  if (!argument.startsWith("'") || !argument.endsWith("'")) fail(lineNumber, 'JQ 表达式引号不完整');
  const expression = argument.slice(1, -1);
  if (!expression.trim() || /['\r\n]/.test(expression)) fail(lineNumber, 'JQ 表达式不能无损序列化');
  const check = spawnSync('jq', ['-n', `false and (${expression})`], { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 });
  if (check.error || check.status !== 0) fail(lineNumber, `JQ 编译失败：${check.error?.message || check.stderr.trim()}`);
  return `'${expression}'`;
}
function parseSource(source) {
  const sections = { Rule: [], 'Map Local': [], 'Body Rewrite': [], Script: [] };
  const scriptUrls = new Set();
  const counts = { 'host-suffix': 0, 'reject-200': 0, 'jsonjq-response-body': 0, 'script-response-body': 0 };
  let hostnames, previousComment;
  const metadata = {};
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = original.trim();
    if (!line) continue;
    if (line.startsWith('//')) {
      const match = line.match(/^\/\/\s*@(Version|Author|ScriptName)\s+(.+)$/);
      if (match) metadata[match[1]] = match[2].trim();
      continue;
    }
    if (line.startsWith('#') || line.startsWith(';')) {
      previousComment = line.startsWith(';') ? `# 上游禁用：${line.slice(1)}` : line;
      continue;
    }
    if (/^hostname\s*=/.test(line)) {
      if (hostnames) fail(lineNumber, '重复 hostname 声明');
      hostnames = line.replace(/^hostname\s*=\s*/, '').split(',').map((host) => host.trim());
      if (!hostnames.length || hostnames.some((host) => !/^(?:\*\.)?(?:[a-z0-9-]+\.)*goofish\.com$/i.test(host))) fail(lineNumber, 'hostname 为空或超出闲鱼域名范围');
      previousComment = undefined;
      continue;
    }
    if (/^host-suffix\s*,/.test(line)) {
      const match = line.match(/^host-suffix\s*,\s*([a-z0-9.-]+)\s*,\s*reject\s*$/i);
      if (!match) fail(lineNumber, `不支持的分流规则：${line}`);
      if (previousComment) sections.Rule.push(previousComment);
      sections.Rule.push(`DOMAIN-SUFFIX,${match[1]},REJECT`);
      previousComment = undefined;
      counts['host-suffix'] += 1;
      continue;
    }
    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(lineNumber, `不认识的配置语法：${line}`);
    const [, pattern, action, argument = ''] = match;
    if (!Object.hasOwn(counts, action) || action === 'host-suffix') fail(lineNumber, `不支持的命令：${action}`);
    try { new RegExp(pattern); } catch (error) { fail(lineNumber, `正则无法编译：${error.message}`); }
    let section, converted;
    if (action === 'reject-200') {
      if (argument) fail(lineNumber, 'reject-200 不应携带参数');
      section = 'Map Local';
      converted = `${pattern} data-type=text data="" status-code=200`;
    } else if (action === 'jsonjq-response-body') {
      section = 'Body Rewrite';
      converted = `http-response-jq ${pattern} ${quoteJq(argument, lineNumber)}`;
    } else {
      if (argument !== AMDC_URL) fail(lineNumber, `脚本地址发生未审核变化：${argument}`);
      if (/["\r\n]/.test(pattern)) fail(lineNumber, '脚本正则不能安全序列化');
      // AMDC 的 {1,4} 含逗号：按 Surge 参数语法包裹双引号，保留原始反斜杠和正则语义。
      const encodedPattern = pattern.includes(',') ? `"${pattern}"` : pattern;
      scriptUrls.add(argument);
      section = 'Script';
      converted = `goofish_response_${String(counts[action] + 1).padStart(2, '0')} = type=http-response,pattern=${encodedPattern},requires-body=true,max-size=-1,timeout=60,script-update-interval=86400,script-path=${argument}`;
    }
    if (previousComment) sections[section].push(previousComment);
    sections[section].push(converted);
    previousComment = undefined;
    counts[action] += 1;
  }
  if (!hostnames || !counts['jsonjq-response-body'] || !counts['reject-200'] || scriptUrls.size !== 1 || metadata.Author !== '@ddgksf2013' || !metadata.ScriptName?.includes('小黄鱼')) {
    throw new Error('上游缺少预期的闲鱼规则、作者、hostname 或官方脚本；保留旧成品。');
  }
  return { sections, scriptUrls, counts, hostnames, metadata };
}
function renderModule(source, parsed) {
  const lines = [
    '#!name=闲鱼（全净化）',
    '#!desc=闲鱼完整上游净化版：处理开屏广告、首页悬浮球与顶部 Tab，净化首页、本地、搜索结果及商品底部推荐流，清理搜索填词、“猜你可能找”、搜索发现、我的页面及推荐信息流；保留上游域名拦截与 AMDC 处理。原作者 ddgksf2013；规则每 6 小时检查上游，AMDC 脚本每 24 小时检查更新。需 Surge iOS 5.14+ / Mac 5.9+（原生 JQ）；开启重写、脚本、MITM，并安装及信任 MITM 证书。会隐藏部分非广告栏目；AMDC 处理也可能影响其他阿里系 App 的网络调度，异常时请停用。全净化指保留完整上游功能，不保证移除所有广告；尚未在最新版闲鱼实机验证。',
    '#!author=ddgksf2013',
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Goofish.sgmodule',
    '',
    `# 上游：${SOURCE_URL}`,
    `# 上游版本：${parsed.metadata.Version || '未声明'}`,
    `# 上游规则 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    '# 自动生成，请修改 Surge/scripts/build-goofish.mjs；遇到不支持的语法时停止更新并保留旧版。',
    '# 原作者提示：使用前请卸载闲鱼，挂载脚本然后使用。',
    '# 原生 JQ Body Rewrite 需要 Surge iOS 5.14+ 或 Surge Mac 5.9+。',
  ];
  for (const [section, rules] of Object.entries(parsed.sections)) if (rules.length) lines.push('', `[${section}]`, ...rules);
  lines.push('', '[MITM]', `hostname = %APPEND% ${parsed.hostnames.join(', ')}`, '');
  return lines.join('\n');
}
async function writeIfChanged(path, content) {
  let existing;
  try { existing = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing === content) return false;
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
    try { new Script(javascript, { filename: url }); } catch (error) { throw new Error(`上游 JavaScript 编译失败，保留旧成品：${error.message}`); }
  }
  const module = renderModule(source, parsed);
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；远程脚本 ${parsed.scriptUrls.size} 个。`);
  if (CHECK_ONLY) { console.log('只校验，不写入成品。'); return; }
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；上游快照${changedSource ? '已更新' : '无变化'}。`);
}
await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
