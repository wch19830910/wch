#!/usr/bin/env node
// Node.js 20+。从墨鱼站点 data.json 所列的官方源构建；下载的 JavaScript 仅编译，不执行。
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/CainiaoAds.conf';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/Cainiao.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/CainiaoAds.conf');
const CHECK_ONLY = process.argv.includes('--check');
const SCRIPT_URLS = new Set([
  'https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/amdc.js',
  'https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/cainiao_json.js',
]);
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-cainiao.mjs [--check]');
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
function fail(lineNumber, message) {
  throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`);
}
function parseSource(source) {
  const sections = { 'Map Local': [], Script: [] };
  const scriptUrls = new Set();
  const counts = { 'reject-200': 0, 'script-response-body': 0 };
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
      if (!hostnames.length || hostnames.some((host) => !/^(?:\*\.)?(?:[a-z0-9-]+\.)*(?:cainiao|taobao)\.com$/i.test(host))) {
        fail(lineNumber, 'hostname 为空或超出菜鸟/淘宝域名范围');
      }
      previousComment = undefined;
      continue;
    }
    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(lineNumber, `不认识的配置语法：${line}`);
    const [, pattern, action, argument = ''] = match;
    if (!Object.hasOwn(counts, action)) fail(lineNumber, `不支持的命令：${action}`);
    try { new RegExp(pattern); } catch (error) { fail(lineNumber, `正则无法编译：${error.message}`); }
    let section, converted;
    if (action === 'reject-200') {
      if (argument) fail(lineNumber, 'reject-200 不应携带参数');
      section = 'Map Local';
      converted = `${pattern} data-type=text data="" status-code=200`;
    } else {
      if (!SCRIPT_URLS.has(argument)) fail(lineNumber, `脚本地址发生未审核变化：${argument}`);
      if (/[,"\r\n]/.test(pattern)) fail(lineNumber, '脚本正则不能安全序列化为参数');
      scriptUrls.add(argument);
      section = 'Script';
      converted = `cainiao_response_${String(counts[action] + 1).padStart(2, '0')} = type=http-response,pattern=${pattern},requires-body=true,max-size=-1,timeout=60,script-update-interval=86400,script-path=${argument}`;
    }
    if (previousComment) sections[section].push(previousComment);
    sections[section].push(converted);
    previousComment = undefined;
    counts[action] += 1;
  }
  if (!hostnames || !counts['reject-200'] || scriptUrls.size !== 2 || metadata.Author !== '@ddgksf2013' || !metadata.ScriptName?.includes('菜鸟')) {
    throw new Error('上游缺少预期的菜鸟规则、作者、hostname 或官方脚本；保留旧成品。');
  }
  return { sections, scriptUrls, counts, hostnames, metadata };
}
function renderModule(source, parsed) {
  const lines = [
    '#!name=菜鸟（去广告与页面净化）',
    '#!desc=基于墨鱼菜鸟规则，覆盖菜鸟 App 与支付宝小程序：拦截通用广告、底部商品和角标推广，清理首页“问邻居”“惊喜福利”及搜索框下“今日好物”推荐；精简“我的”页横幅、活动、会员、资产和钱包组件，并保留上游 AMDC 处理。不是仅去开屏，部分正常入口可能隐藏，AMDC 处理可能同时影响其他阿里系 App；不解锁会员。每 6 小时检查上游规则，Surge 每 24 小时检查原作者远程脚本更新。需 Surge iOS 5.9.1+ / Mac 5.5.1+，启用重写、脚本与 MITM 并信任证书。广告缓存可先重开或清理；上游另有重装提示，重装前请备份。异常时请停用，未在最新版 App 实机验证。',
    '#!author=ddgksf2013',
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Cainiao.sgmodule',
    '',
    `# 上游：${SOURCE_URL}`,
    `# 上游版本：${parsed.metadata.Version || '未声明'}`,
    `# 上游规则 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    '# 自动生成，请修改 Surge/scripts/build-cainiao.mjs；遇到不支持的语法时停止更新并保留旧版。',
    '# 原作者提示：使用前请卸载菜鸟 APP，挂载脚本然后使用；我的页面推广可能需要重新安装。',
    '# Map Local 的 text 需要 Surge iOS 5.9.1+ 或 Surge Mac 5.5.1+。',
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
