#!/usr/bin/env node
// Node.js 20+、jq。完整转换墨鱼官方索引推荐的 ZenmoFeiShi 滴滴规则；不请求滴滴业务接口。
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://raw.githubusercontent.com/ZenmoFeiShi/Qx/main/Didichuxing.snippet';
const INDEX_URL = 'https://github.com/ddgksf2013';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/DiDi.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/Didichuxing.snippet');
const ALLOWED_DOMAINS = new Set([
  'common.diditaxi.com.cn', 'freight.xiaojukeji.com', 'daijia.kuaidadi.com',
  'ct.xiaojukeji.com', 'res.xiaojukeji.com', 'conf.diditaxi.com.cn', 'api.udache.com',
  'mapi.xiaojukeji.com', 'manhattan.webapp.xiaojukeji.com', 'ddpay.xiaojukeji.com',
]);
// 上游 IP 分流与 IP MITM 范围需人工审核；新增地址不自动扩大接管范围。
const ALLOWED_CIDRS = new Set([
  '139.199.244.6/32', '113.46.225.9/32', '139.199.244.7/32', '113.46.225.8/32',
  '123.207.209.39/32', '123.207.209.60/32', '139.199.240.15/32', '139.199.240.12/32',
  '116.85.3.37/32', '162.14.157.2/32', '162.14.157.24/32', '116.85.1.0/32',
  '116.85.1.17/32', '116.85.1.22/32', '116.85.3.25/32',
]);
const ALLOWED_IP_HOSTS = new Set([
  '117.51.168.*', '113.46.225.*', '162.14.157.*', '123.207.209.*', '112.53.55.225',
  '120.241.142.*', '120.241.143.*', '116.85.*', '139.199.240.84',
]);

async function fetchText(url, maxBytes) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'DiDi-Surge-native-builder/1.0' },
  });
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
  // 只编译表达式；false and 会短路，构建中不执行上游 JQ 对实际数据的变换。
  const check = spawnSync('jq', ['-n', `false and (${expression})`], { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 });
  if (check.error || check.status !== 0) fail(lineNumber, `JQ 编译失败：${check.error?.message || check.stderr.trim()}`);
  return `'${expression}'`;
}
function validatePattern(pattern, lineNumber) {
  try { new RegExp(pattern); } catch (error) { fail(lineNumber, `正则无法编译：${error.message}`); }
  const match = pattern.match(/^\^https:\\\/\\\/((?:[a-z0-9-]+\\\.)+[a-z0-9-]+)(?::443)?\\\//);
  // 当前源没有正则分支。未经审核的 | 可能绕过已验证的域名前缀；路径也必须从字母开始。
  if (!match || pattern.includes('|') || !/^[a-z]/.test(pattern.slice(match[0].length)) ||
      !ALLOWED_DOMAINS.has(match[1].replaceAll('\\.', '.'))) {
    fail(lineNumber, '规则范围超出已审核的滴滴接口域名');
  }
}
export function parseSource(source) {
  const sections = { Rule: [], 'Map Local': [], 'Body Rewrite': [] };
  const counts = { host: 0, 'ip-cidr': 0, 'reject-dict': 0, 'jsonjq-response-body': 0 };
  const metadata = {};
  const seenRules = new Set();
  let hostnames, previousComment;
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = original.trim();
    if (!line) continue;
    if (line.startsWith('#!')) {
      const match = line.match(/^#!(name|author|update)\s*=\s*(.+)$/);
      if (!match || Object.hasOwn(metadata, match[1])) fail(lineNumber, '未知或重复元数据');
      metadata[match[1]] = match[2].trim();
      continue;
    }
    if (line.startsWith('#') || line.startsWith('//')) {
      previousComment = line.startsWith('//') ? `# ${line.slice(2).trim()}` : line;
      continue;
    }
    if (/^hostname\s*=/.test(line)) {
      if (hostnames) fail(lineNumber, '重复 hostname 声明');
      hostnames = line.replace(/^hostname\s*=\s*/, '').split(',').map((host) => host.trim());
      if (!hostnames.length || new Set(hostnames).size !== hostnames.length ||
          hostnames.some((host) => !ALLOWED_DOMAINS.has(host) && !ALLOWED_IP_HOSTS.has(host))) {
        fail(lineNumber, 'hostname 为空、重复或超出已审核范围');
      }
      previousComment = undefined;
      continue;
    }
    if (/^(?:host|ip-cidr)\s*,/.test(line)) {
      const match = line.match(/^(host|ip-cidr)\s*,\s*([^,\s]+)\s*,\s*reject\s*$/);
      if (!match) fail(lineNumber, `不支持的分流规则：${line}`);
      const [, kind, target] = match;
      if (kind === 'host' ? target !== 'gwp.xiaojukeji.com' : !ALLOWED_CIDRS.has(target)) {
        fail(lineNumber, '分流主机或 CIDR 发生未审核变化');
      }
      const nativeRule = `${kind === 'host' ? 'DOMAIN' : 'IP-CIDR'},${target},REJECT`;
      if (seenRules.has(nativeRule)) fail(lineNumber, '重复分流规则');
      seenRules.add(nativeRule);
      if (previousComment) sections.Rule.push(previousComment);
      sections.Rule.push(nativeRule);
      previousComment = undefined;
      counts[kind] += 1;
      continue;
    }
    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(lineNumber, `不认识的配置语法：${line}`);
    const [, pattern, action, argument = ''] = match;
    if (action !== 'reject-dict' && action !== 'jsonjq-response-body') fail(lineNumber, `不支持的命令：${action}`);
    validatePattern(pattern, lineNumber);
    const key = `${pattern} ${action}`;
    if (seenRules.has(key)) fail(lineNumber, '重复重写规则');
    seenRules.add(key);
    let section, converted;
    if (action === 'reject-dict') {
      if (argument) fail(lineNumber, 'reject-dict 不应携带参数');
      section = 'Map Local';
      converted = `${pattern} data-type=text data="{}" status-code=200 header="Content-Type:application/json"`;
    } else {
      section = 'Body Rewrite';
      converted = `http-response-jq ${pattern} ${quoteJq(argument, lineNumber)}`;
    }
    if (previousComment) sections[section].push(previousComment);
    sections[section].push(converted);
    previousComment = undefined;
    counts[action] += 1;
  }
  if (metadata.name !== '滴滴出行' || metadata.author !== '怎么肥事' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(metadata.update || '')) {
    throw new Error('上游应用、作者或更新元数据不符合预期；保留旧成品。');
  }
  if (!hostnames || hostnames.length !== ALLOWED_DOMAINS.size + ALLOWED_IP_HOSTS.size ||
      counts.host !== 1 || counts['ip-cidr'] !== ALLOWED_CIDRS.size || counts['reject-dict'] < 12 || counts['jsonjq-response-body'] < 12) {
    throw new Error('上游缺少预期的完整分流、重写或 MITM 配置；保留旧成品。');
  }
  return { sections, counts, hostnames, metadata };
}
export function renderModule(source, parsed) {
  const lines = [
    '#!name=滴滴出行',
    '#!desc=墨鱼官方索引推荐的 ZenmoFeiShi 完整上游精简版；会隐藏安全中心，并改变钱包与行程组件，不是仅去广告。每 6 小时检查上游；需要 Surge iOS 5.14+ 或 Mac 5.9+（原生 JQ），开启重写及 MITM 并信任证书。',
    '#!author=ZenmoFeiShi（怎么肥事）',
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/DiDi.sgmodule',
    '',
    `# 墨鱼官方推荐索引：${INDEX_URL}`,
    `# 上游作者：ZenmoFeiShi（怎么肥事）；原始配置：${SOURCE_URL}`,
    `# 上游更新：${parsed.metadata.update}`,
    `# 上游规则 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    '# 自动生成，请修改 Surge/scripts/build-didi.mjs；未知语法或范围变化停止更新并保留旧版。',
    '# 用户选择完整上游精简版：逐条保留上游行为，未额外添加、删减或修复上游功能。',
    '# 重要：上游会隐藏“安全中心”，缩减钱包内容、修改出行导航及行程组件；需要这些入口时请停用本模块。',
    '# 保留上游的域名/IP 分流及 IP MITM 通配范围；未在手机实机验证，不保证当前 App 业务功能不受影响。',
    '# 原生 JQ Body Rewrite 需要 Surge iOS 5.14.0+ 或 Surge Mac 5.9.0+。',
    '# 原作者声明：仅供学习与自用，请勿用于商业或传播破解用途。',
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
export async function main(checkOnly = false) {
  const source = await fetchText(SOURCE_URL, 1024 * 1024);
  const parsed = parseSource(source);
  const module = renderModule(source, parsed);
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；MITM 主机 ${parsed.hostnames.length} 个；完整精简版，无远程 JS。`);
  if (checkOnly) { console.log('只校验，不写入成品。'); return; }
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；上游快照${changedSource ? '已更新' : '无变化'}。`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some((argument) => argument !== '--check')) throw new Error('用法：node Surge/scripts/build-didi.mjs [--check]');
  await main(process.argv.includes('--check')).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
