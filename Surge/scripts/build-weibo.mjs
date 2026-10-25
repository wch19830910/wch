#!/usr/bin/env node
// Node.js 20+、jq。转换墨鱼微博规则；构建仅检查 JavaScript 语法，不运行下载的脚本。
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/WeiboAds.conf';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/Weibo.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/WeiboAds.conf');
const CHECK_ONLY = process.argv.includes('--check');
const SCRIPT_URLS = new Set([
  'https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/weibo_json.js',
  'https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/weibo_search_info.json',
  'https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/weibo_search_topic.json',
]);
const ALLOWED_MITM_HOSTS = new Set([
  'api.weibo.*', '*.api.weibo.*', 'mapi.weibo.*', '*.uve.weibo.com', 'new.vip.weibo.cn', 'boot.biz.weibo.com',
]);
const ALLOWED_PATTERN_PREFIXES = [
  String.raw`^https?:\/\/api\.weibo\.cn\/`,
  String.raw`^https?:\/\/boot.*weibo\.com\/`,
  String.raw`^https?:\/\/m?api\.weibo\.c(n|om)\/`,
  String.raw`^https?:\/\/(preload-click|preload-impression)\.uve\.weibo\.com\/`,
  String.raw`^https?:\/\/sdkapp\.uve\.weibo\.com\/`,
  String.raw`^https?:\/\/weibointl\.api\.weibo\.cn\/`,
  String.raw`^https?:\/\/weibointl\.api\.weibo\.c(n|om)\/`,
  String.raw`^https?://(sdk|wb)app\.uve\.weibo\.com(/`,
  '^https://api.weibo.cn/2/!/client/light_skin',
  '^https://new.vip.weibo.cn/littleskin/preview',
];

if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-weibo.mjs [--check]');
}

async function fetchText(url, maxBytes) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Surge' } });
  if (!response.ok || response.url !== url) throw new Error(`下载失败或出现未审核跳转：HTTP ${response.status} ${url}`);
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
  const sections = { Rule: [], 'URL Rewrite': [], 'Map Local': [], 'Body Rewrite': [], Script: [] };
  const counts = { host: 0, 'host-suffix': 0, reject: 0, 'reject-200': 0, 'reject-dict': 0, 'jsonjq-response-body': 0, 'script-response-body': 0 };
  const scriptUrls = new Set();
  const metadata = {};
  let hostnames, previousComment;
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = original.trim();
    if (!line) continue;
    if (line.startsWith('//')) {
      const match = line.match(/^\/\/\s*@(Version|Author|Contributors|ScriptName)\s+(.+)$/);
      if (match) metadata[match[1]] = match[2].trim();
      continue;
    }
    if (line.startsWith('#')) { previousComment = line; continue; }
    if (/^hostname\s*=/.test(line)) {
      if (hostnames) fail(lineNumber, '重复 hostname 声明');
      hostnames = line.replace(/^hostname\s*=\s*/, '').split(',').map((host) => host.trim());
      if (!hostnames.length || new Set(hostnames).size !== hostnames.length || hostnames.some((host) => !ALLOWED_MITM_HOSTS.has(host))) {
        fail(lineNumber, 'MITM 主机超出已审核微博范围');
      }
      previousComment = undefined;
      continue;
    }
    if (/^host(?:-suffix)?\s*,/.test(line)) {
      const match = line.match(/^(host(?:-suffix)?)\s*,\s*([a-z0-9.-]+)\s*,\s*(direct|reject)\s*$/i);
      if (!match) fail(lineNumber, `不支持的分流规则：${line}`);
      const [, type, hostname, policy] = match;
      const allowed = type === 'host' && (hostname === 'sdkapp.uve.weibo.com' && policy === 'direct' || hostname === 'adstrategy.biz.weibo.com' && policy === 'reject')
        || type === 'host-suffix' && hostname === 'api.touch-moblie.com' && policy === 'reject';
      if (!allowed) fail(lineNumber, '分流主机/策略发生未审核变化');
      if (previousComment) sections.Rule.push(previousComment);
      sections.Rule.push(`${type === 'host' ? 'DOMAIN' : 'DOMAIN-SUFFIX'},${hostname},${policy.toUpperCase()}`);
      previousComment = undefined;
      counts[type] += 1;
      continue;
    }
    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(lineNumber, `不认识的配置语法：${line}`);
    const [, pattern, action, argument = ''] = match;
    if (!Object.hasOwn(counts, action) || action === 'host' || action === 'host-suffix') fail(lineNumber, `不支持的命令：${action}`);
    try { new RegExp(pattern); } catch (error) { fail(lineNumber, `正则无法编译：${error.message}`); }
    if (!ALLOWED_PATTERN_PREFIXES.some((prefix) => pattern.startsWith(prefix)) || /["\r\n]/.test(pattern)) fail(lineNumber, '正则超出已审核微博 HTTP 主机范围或不能安全序列化');
    let section, converted;
    if (action === 'reject') {
      if (argument) fail(lineNumber, 'reject 不应携带参数');
      section = 'URL Rewrite';
      converted = `${pattern} - reject`;
    } else if (action === 'reject-200' || action === 'reject-dict') {
      if (argument) fail(lineNumber, `${action} 不应携带参数`);
      section = 'Map Local';
      converted = action === 'reject-200' ? `${pattern} data-type=text data="" status-code=200`
        : `${pattern} data-type=text data="{}" status-code=200 header="Content-Type:application/json"`;
    } else if (action === 'jsonjq-response-body') {
      section = 'Body Rewrite';
      converted = `http-response-jq ${pattern} ${quoteJq(argument, lineNumber)}`;
    } else {
      if (!SCRIPT_URLS.has(argument)) fail(lineNumber, `脚本地址发生未审核变化：${argument}`);
      const encodedPattern = pattern.includes(',') ? `"${pattern}"` : pattern;
      scriptUrls.add(argument);
      section = 'Script';
      converted = `weibo_response_${String(counts[action] + 1).padStart(2, '0')} = type=http-response,pattern=${encodedPattern},requires-body=true,max-size=-1,timeout=60,script-update-interval=86400,script-path=${argument}`;
    }
    if (previousComment) sections[section].push(previousComment);
    sections[section].push(converted);
    previousComment = undefined;
    counts[action] += 1;
  }
  if (!hostnames?.length || !counts.host || !counts['host-suffix'] || !counts['jsonjq-response-body'] || !counts['reject-dict'] || scriptUrls.size !== 3 || metadata.Author !== '@ddgksf2013' || metadata.Contributors !== '@zmqcherish' || !metadata.ScriptName?.includes('微博')) {
    throw new Error('上游缺少预期的微博规则、作者、hostname 或远程脚本；保留旧成品。');
  }
  return { sections, scriptUrls, counts, hostnames, metadata };
}

function renderModule(source, parsed) {
  const lines = [
    '#!name=微博（全净化）',
    '#!desc=微博及国际版/轻享版完整上游净化版：处理开屏、信息流和评论区广告，精简发现页与热搜、推荐、个人页、直播签到、打赏及部分评论提示，移除部分 AI 总结并调整菜单；保留皮肤状态和视频预览限制相关响应修改，不是账号会员开通。作者 ddgksf2013，贡献者 zmqcherish、shiro；规则每 6 小时检查上游，远程脚本每 24 小时检查更新。需 Surge iOS 5.14+ / Mac 5.9+（原生 JQ）；开启重写、脚本、MITM，并安装及信任 MITM 证书。会隐藏非广告内容或改变页面功能；上游选项固定，不能用其他版本的配置脚本调整，异常时请停用。全净化指保留完整上游功能，不保证移除所有广告；尚未在最新版微博实机验证。',
    '#!author=ddgksf2013, zmqcherish, shiro',
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Weibo.sgmodule',
    '',
    `# 上游：${SOURCE_URL}`,
    `# 上游版本：${parsed.metadata.Version || '未声明'}`,
    `# 上游规则 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    '# 自动生成，请修改 Surge/scripts/build-weibo.mjs；未知语法或范围变化停止更新并保留旧版。',
    '# 作者署名和引用出处按原作者声明保留；远程脚本直接引用原作者 master 分支，不复制正文。',
    '# 忠实完整转换：保留原上游全部规则和 MITM；不额外制作或修改 JavaScript，不扩大原规则功能。',
    '# 上游净化可能改变发现页、热搜/推荐流、个人页组件；包含皮肤状态及视频预览相关响应修改，不是账号会员开通。',
    '# 原生 JQ Body Rewrite 需要 Surge iOS 5.14+ 或 Surge Mac 5.9+；未在手机实机验证。',
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
    // 两个 .json 后缀文件实际也是 $done(...) JavaScript，不是纯 JSON。
    const javascript = await fetchText(url, 5 * 1024 * 1024);
    try { new Script(javascript, { filename: url }); } catch (error) { throw new Error(`上游 JavaScript 编译失败，保留旧成品：${error.message}`); }
  }
  const module = renderModule(source, parsed);
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；远程脚本 ${parsed.scriptUrls.size} 个；完整保留上游规则。`);
  if (CHECK_ONLY) { console.log('只校验，不写入成品。'); return; }
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；上游快照${changedSource ? '已更新' : '无变化'}。`);
}

await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
