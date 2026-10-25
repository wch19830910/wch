#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Upstream author: zirawell; modified 2026-10-25 for validated remote publishing.
// License: Surge/licenses/zirawell-GPL-3.0.txt. Provided without warranty.
// Node.js 20+。同步原生 Surge 盒马完整净化规则；构建仅编译检查远程 JS，不执行它。
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SOURCE_URL = 'https://raw.githubusercontent.com/zirawell/R-Store/main/Rule/Surge/Adblock/App/H/%E7%9B%92%E9%A9%AC/freshippo.sgmodule';
const SCRIPT_URL = 'https://raw.githubusercontent.com/zirawell/R-Store/main/Res/Scripts/AntiAd/freshippo.js';
const RAW_URL = 'https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Freshippo.sgmodule';
const LICENSE_URL = 'https://github.com/wch19830910/wch/blob/main/Surge/licenses/zirawell-GPL-3.0.txt';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/Freshippo.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/freshippo.sgmodule');
const CHECK_ONLY = process.argv.includes('--check');
const SECTION_NAMES = new Set(['Rule', 'URL Rewrite', 'Map Local', 'Script', 'MITM']);
const HEADER_NAMES = new Set(['name', 'desc', 'openUrl', 'bundleId', 'author', 'tag', 'basedOn', 'surge_version', 'homepage', 'icon', 'date', 'raw-url']);
const ALLOWED_IPS = new Set([
  '59.82.14.1', '59.82.14.161', '59.82.34.147', '59.82.34.255',
  '59.82.113.219', '59.82.113.10', '139.95.0.151', '139.95.4.98',
  '47.246.103.9', '47.246.103.10', '203.119.238.164', '203.119.238.63',
]);
const ALLOWED_HOSTS = new Set(['amdc.m.taobao.com', 'acs.m.taobao.com', 'acs-m.freshippo.com']);
const ACS_PREFIX = String.raw`^https?:\/\/acs(\.|-)m\.(taobao|freshippo)\.com\/gw\/`;
const ALLOWED_PATTERNS = {
  'URL Rewrite': new Set([
    String.raw`^https?:\/\/amdc\.m\.taobao\.com\/amdc\/mobileDispatch\?appkey=23230111`,
    `${ACS_PREFIX}${String.raw`mtop\.wdk\.hippotown\.tabbar\.info`}`,
  ]),
  'Map Local': new Set([
    `${ACS_PREFIX}${String.raw`mtop\.alibaba\.emas\.publish\.update\.get`}`,
    `${ACS_PREFIX}${String.raw`mtop\.wdk\.sg\.querysinglescene`}`,
    `${ACS_PREFIX}${String.raw`mtop\.wdk\.render\.querysinglepage`}`,
    `${ACS_PREFIX}${String.raw`mtop\.wdk\.fc\.recommend\.feedscommondservice`}`,
    `${ACS_PREFIX}${String.raw`mtop\.wdk\.crm\.platform\.ma\.recommend`}`,
    `${ACS_PREFIX}${String.raw`mtop\.wdk\.mimir\.recommend(?!\.hgitems)`}`,
  ]),
  Script: new Set([
    `${ACS_PREFIX}${String.raw`mtop\.wdk\.render\.query(?>indexpage|mypage|tabfeedstream)`}`,
  ]),
};

if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-freshippo.mjs [--check]');
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

function checkPattern(section, pattern, lineNumber) {
  if (!ALLOWED_PATTERNS[section]?.has(pattern)) fail(lineNumber, '正则超出已审核盒马接口范围');
  // Surge 使用 ICU 正则，支持原子组；仅将这个已审核组换成非捕获副本做 Node 语法检查。
  // 输出保持原子组原文，不全局改写或削弱任意上游正则。
  const checkCopy = pattern.replace('(?>indexpage|mypage|tabfeedstream)', '(?:indexpage|mypage|tabfeedstream)');
  try { new RegExp(checkCopy); } catch (error) { fail(lineNumber, `正则无法编译：${error.message}`); }
}

function parseSource(source) {
  const metadata = {};
  const body = [];
  const seenSections = new Set();
  const seenRules = new Set();
  const counts = { 'Rule': 0, 'URL Rewrite': 0, 'Map Local': 0, 'Script': 0, 'MITM': 0, jsonCompatibility: 0, sizeCompatibility: 0 };
  let section;
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = original.trim();
    if (!line) { if (section) body.push(''); continue; }
    if (line.startsWith('#!')) {
      if (section) fail(lineNumber, '元信息出现在规则段内');
      const match = line.match(/^#!([A-Za-z_-]+)=(.*)$/);
      if (!match || !HEADER_NAMES.has(match[1]) || Object.hasOwn(metadata, match[1])) fail(lineNumber, '未知或重复元信息');
      metadata[match[1]] = match[2];
      continue;
    }
    if (line.startsWith('#') || line.startsWith('//')) { if (section) body.push(original); continue; }
    if (line.startsWith('[')) {
      const match = line.match(/^\[([^\]]+)\]$/);
      if (!match || !SECTION_NAMES.has(match[1]) || seenSections.has(match[1])) fail(lineNumber, '未知或重复配置段');
      section = match[1];
      seenSections.add(section);
      body.push(line);
      continue;
    }
    if (!section) fail(lineNumber, '配置不属于已知规则段');
    if (seenRules.has(`${section}:${line}`)) fail(lineNumber, '重复规则');
    seenRules.add(`${section}:${line}`);
    let rendered = original;
    if (section === 'Rule') {
      const fields = line.split(',').map((field) => field.trim());
      if (fields.length !== 5 || fields[0] !== 'IP-CIDR' || fields[2] !== 'REJECT' || fields[3] !== 'no-resolve' || fields[4] !== 'pre-matching'
        || !fields[1].endsWith('/32') || !ALLOWED_IPS.has(fields[1].slice(0, -3))) fail(lineNumber, '分流类型、IP 或选项超出已审核范围');
    } else if (section === 'URL Rewrite') {
      const match = line.match(/^(\S+)\s+-\s+reject$/);
      if (!match) fail(lineNumber, '不支持的 URL Rewrite 语法');
      checkPattern(section, match[1], lineNumber);
    } else if (section === 'Map Local') {
      const match = line.match(/^(\S+)\s+data-type=(json|text)\s+data="([^"\r\n]*)"\s+status-code=200$/);
      if (!match) fail(lineNumber, '不支持的 Map Local 语法');
      checkPattern(section, match[1], lineNumber);
      if (match[2] === 'json') {
        try { JSON.parse(match[3]); } catch { fail(lineNumber, 'JSON 响应体无效'); }
        rendered = `${match[1]} data-type=text data="${match[3]}" status-code=200 header="Content-Type:application/json"`;
        counts.jsonCompatibility += 1;
      }
    } else if (section === 'Script') {
      const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.+)$/);
      if (!match || match[1] !== 'freshippo') fail(lineNumber, '不支持的脚本声明');
      const parameters = {};
      for (const field of match[2].split(',')) {
        const pair = field.trim().match(/^([a-z-]+)=(.*)$/);
        if (!pair || !new Set(['type', 'pattern', 'requires-body', 'max-size', 'script-path']).has(pair[1]) || Object.hasOwn(parameters, pair[1])) fail(lineNumber, '未知或重复脚本参数');
        parameters[pair[1]] = pair[2];
      }
      if (Object.keys(parameters).length !== 5 || parameters.type !== 'http-response' || !['1', 'true'].includes(parameters['requires-body'])
        || !/^(?:-1|0|[1-9]\d*)$/.test(parameters['max-size']) || parameters['script-path'] !== SCRIPT_URL) fail(lineNumber, '响应脚本类型、大小或地址发生未审核变化');
      checkPattern(section, parameters.pattern, lineNumber);
      const maximumSize = parameters['max-size'] === '0' ? '-1' : parameters['max-size'];
      if (maximumSize !== parameters['max-size']) counts.sizeCompatibility += 1;
      rendered = `freshippo = type=http-response,pattern=${parameters.pattern},requires-body=true,max-size=${maximumSize},script-update-interval=86400,script-path=${SCRIPT_URL}`;
    } else {
      const match = line.match(/^hostname\s*=\s*%APPEND%\s+(.+)$/);
      if (!match || counts.MITM) fail(lineNumber, '未知或重复 MITM 配置');
      const hosts = match[1].split(',').map((host) => host.trim());
      if (!hosts.length || hosts.some((host) => !ALLOWED_HOSTS.has(host)) || new Set(hosts).size !== hosts.length) fail(lineNumber, 'MITM 主机超出已审核盒马范围');
    }
    body.push(rendered);
    counts[section] += 1;
  }
  if (metadata.bundleId !== 'com.wdk.hmxs' || metadata.author !== 'zirawell[https://github.com/zirawell]' || !metadata.name?.includes('盒马')
    || seenSections.size !== SECTION_NAMES.size || counts.Rule < 1 || counts['URL Rewrite'] < 1 || counts['Map Local'] < 1 || counts.Script !== 1 || counts.MITM !== 1) {
    throw new Error('上游缺少预期盒马规则、作者或配置段；保留旧成品。');
  }
  return { metadata, body, counts };
}

function renderModule(source, parsed) {
  const metadata = {
    ...parsed.metadata,
    name: '盒马',
    desc: 'zirawell 完整净化版：包含开屏、首页、我的及购物车推荐精简，并保留上游 IP 预匹配拦截。非仅开屏，可能影响其他阿里请求；异常时请停用。每 6 小时检查规则，远程脚本每 24 小时检查更新。需启用重写、脚本与 MITM 并信任证书。',
    'raw-url': RAW_URL,
  };
  return [
    ...Object.entries(metadata).map(([key, value]) => `#!${key}=${value}`),
    '',
    '# SPDX-License-Identifier: GPL-3.0-only',
    '# 原作者：zirawell；本地兼容与远程同步修改日期：2026-10-25。',
    `# 许可证：${LICENSE_URL}（仓库内 Surge/licenses/zirawell-GPL-3.0.txt）。`,
    '# 无任何保证；配置检查不等于已在最新版盒马实机验证。',
    `# 上游：${SOURCE_URL}`,
    `# 上游规则 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    '# 自动生成；名称和描述请修改 Surge/scripts/build-freshippo.mjs，直接改成品会被同步覆盖。',
    '# 完整保留上游分流、URL Rewrite、Map Local、Script 与 MITM；远程 JS 直引原作者，构建时不复制或执行正文，Surge 客户端会按规则运行远程脚本。',
    '# Surge 兼容：data-type=json 改为 text + application/json；max-size=0 按官方不限响应大小写法规范为 -1。',
    '# IP pre-matching 可能在普通分流前生效；如其他阿里 App 或购物功能异常，请停用模块。',
    '# 上游标注测试 Surge iOS 5.14.2；建议 iOS 5.14.2+ / Mac 5.9+。不添加整域拒绝规则。',
    '',
    ...parsed.body,
    '',
  ].join('\n');
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
  const javascript = await fetchText(SCRIPT_URL, 5 * 1024 * 1024);
  try { new Script(javascript, { filename: SCRIPT_URL }); } catch (error) { throw new Error(`上游 JavaScript 编译失败，保留旧成品：${error.message}`); }
  const module = renderModule(source, parsed);
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；完整保留上游规则，远程脚本 1 个。`);
  if (CHECK_ONLY) { console.log('只校验，不写入成品。'); return; }
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；上游快照${changedSource ? '已更新' : '无变化'}。`);
}

await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
