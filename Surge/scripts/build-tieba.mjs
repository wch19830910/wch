#!/usr/bin/env node
// Node.js 20+、jq。合并 app2smile 原生规则与墨鱼五类页面净化；不执行下载的 JavaScript。
// app2smile 相关内容遵循 MIT，许可证：Surge/licenses/app2smile-MIT.txt。
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const APP2_URL = 'https://raw.githubusercontent.com/app2smile/rules/master/module/tieba.sgmodule';
const DDG_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/TieBaAds.conf';
const AD_LIST_URL = 'https://raw.githubusercontent.com/app2smile/rules/master/rule/tieba-ad.list';
const JSON_URL = 'https://raw.githubusercontent.com/app2smile/rules/master/js/tieba-json.js';
const PROTO_URL = 'https://raw.githubusercontent.com/app2smile/rules/master/js/tieba-proto.js';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUTS = [
  'AdBlock/Tieba.sgmodule', 'upstream/Tieba.app2smile.sgmodule',
  'upstream/Tieba.ddgksf2013.conf', 'upstream/Tieba.ad.list',
].map((path) => resolve(SURGE_ROOT, path));
const JSON_PATTERN = String.raw`^https?:\/\/(tiebac|c\.tieba)\.baidu\.com\/(c\/(s\/sync|f\/(ad\/getSplashAd|frs\/(page|threadlist|generalTabList)|pb\/(pic)?page|excellent\/personalized))$|tiebaads\/commonbatch\?)`;
const PROTO_PATTERN = String.raw`^https?:\/\/(tiebac|c\.tieba)\.baidu\.com\/c\/(b\/ad\/adBid|f\/(frs\/(page|threadlist|generalTabList)|ad\/getFeedAd|pb\/page|excellent\/personalized))\?cmd`;
const DDG_PREFIX = String.raw`^https?:\/\/tieba(c)?\.baidu\.com\/`;
const DDG_LEGACY_PROTO = String.raw`^http(s:\/\/tiebac|:\/\/c\.tieba)\.baidu\.com\/c\/f\/(frs\/(page|threadlist|generalTabList)|pb\/page|excellent\/personalized)\?cmd`;
const DDG_EXPRESSIONS = new Map([
  [String.raw`c\/f\/search\/discover`, '.data.discover_list = []'],
  [String.raw`c\/f\/sidebar\/home`, 'del(.game_center, .tools, .vip_banner, .task_list)'],
  [String.raw`c\/u\/user\/profile`, 'del(.duxiaoman, .namoaixud, .namoaixud_entry, .recom_naws_list, .duxiaoman_entry, .vip_banner) | .zone_info |= map(select(.type == "common_func" or .type == "auxiliary_func"))'],
  [String.raw`c\/f\/forum\/forumGuide`, '.hot_search = []'],
  [String.raw`mo\/q\/search\/startPage`, 'del(.data)'],
]);
const SAFE_PROFILE_EXPRESSION = 'del(.duxiaoman, .namoaixud, .namoaixud_entry, .recom_naws_list, .duxiaoman_entry, .vip_banner) | if (.zone_info | type) == "array" then .zone_info |= map(select(.type == "common_func" or .type == "auxiliary_func")) else . end';
const MIT_NOTICE = `MIT License

Copyright (c) 2023 app2smile

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

function fail(lineNumber, message) { throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`); }
function patternCheck(pattern, expected, lineNumber) {
  if (pattern !== expected) fail(lineNumber, '接口正则发生未审核变化');
  try { new RegExp(pattern); } catch (error) { fail(lineNumber, `正则无法编译：${error.message}`); }
}
function jqCheck(expression, lineNumber) {
  if (!expression.trim() || /['\r\n]/.test(expression)) fail(lineNumber, 'JQ 表达式不能安全序列化');
  // false and 只编译表达式，不运行其业务逻辑或读取环境数据。
  const result = spawnSync('jq', ['-n', `false and (${expression})`], { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) fail(lineNumber, `JQ 编译失败：${result.error?.message || result.stderr.trim()}`);
  return expression;
}

export function parseApp2Module(source) {
  let section;
  const metadata = {};
  const sections = new Set();
  const scripts = new Map();
  let ruleCount = 0, mitmCount = 0;
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = original.trim(), lineNumber = index + 1;
    if (!line || line.startsWith('#') && !line.startsWith('#!') || line.startsWith('//')) continue;
    if (line.startsWith('#!')) {
      const match = line.match(/^#!(name|desc|arguments|arguments-desc)=(.*)$/);
      if (section || !match || Object.hasOwn(metadata, match[1])) fail(lineNumber, '未知、重复或位置错误的模块元信息');
      metadata[match[1]] = match[2];
    } else if (line.startsWith('[')) {
      const match = line.match(/^\[(Rule|MITM|Script)\]$/);
      if (!match || sections.has(match[1])) fail(lineNumber, '未知或重复模块配置段');
      section = match[1]; sections.add(section);
    } else if (section === 'Rule') {
      if (line !== `RULE-SET,${AD_LIST_URL},REJECT-DROP` || ruleCount++) fail(lineNumber, '分流规则或订阅地址发生未审核变化');
    } else if (section === 'MITM') {
      if (line !== 'hostname = %APPEND% tiebac.baidu.com' || mitmCount++) fail(lineNumber, 'MITM 主机发生未审核变化');
    } else if (section === 'Script') {
      const match = line.match(/^(贴吧json|贴吧proto)\s*=\s*(.+)$/);
      if (!match || scripts.has(match[1])) fail(lineNumber, '未知或重复响应脚本');
      const parameters = {};
      for (const field of match[2].split(',')) {
        const pair = field.trim().match(/^([a-z-]+)=(.*)$/);
        if (!pair || !new Set(['type', 'pattern', 'requires-body', 'binary-body-mode', 'max-size', 'script-path', 'script-update-interval', 'argument']).has(pair[1]) || Object.hasOwn(parameters, pair[1])) fail(lineNumber, '未知或重复脚本参数');
        parameters[pair[1]] = pair[2];
      }
      const isProto = match[1] === '贴吧proto';
      const expectedKeys = isProto ? ['type', 'pattern', 'requires-body', 'binary-body-mode', 'max-size', 'script-path', 'argument']
        : ['type', 'pattern', 'requires-body', 'max-size', 'script-path', 'script-update-interval'];
      if (Object.keys(parameters).length !== expectedKeys.length || expectedKeys.some((key) => !Object.hasOwn(parameters, key))
        || parameters.type !== 'http-response' || !['1', 'true'].includes(parameters['requires-body'])
        || !['0', '-1'].includes(parameters['max-size']) || parameters['script-path'] !== (isProto ? PROTO_URL : JSON_URL)
        || (isProto ? !['1', 'true'].includes(parameters['binary-body-mode']) || parameters.argument !== 'per_filter_video_thread={{{per_filter_video}}}'
          : parameters['script-update-interval'] !== '0')) fail(lineNumber, '响应脚本类型、参数、更新或来源发生未审核变化');
      patternCheck(parameters.pattern, isProto ? PROTO_PATTERN : JSON_PATTERN, lineNumber);
      scripts.set(match[1], parameters);
    } else fail(lineNumber, '配置不属于已知模块配置段');
  }
  if (sections.size !== 3 || scripts.size !== 2 || ruleCount !== 1 || mitmCount !== 1
    || metadata.arguments !== 'per_filter_video:0' || !metadata.name?.includes('贴吧') || !metadata.desc?.includes('开屏')) {
    throw new Error('app2smile 模块缺少预期贴吧规则或默认视频参数；保留旧成品。');
  }
  return { metadata, scripts };
}

export function parseAdList(source) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && !line.startsWith('//'));
  if (lines.length !== 2 || new Set(lines).size !== 2 || !lines.includes('DOMAIN,180.76.76.200') || !lines.includes('IP-CIDR,180.76.76.200/32,no-resolve')) {
    throw new Error('app2smile 分流表超出已审核的单个贴吧 IP 范围；保留旧成品。');
  }
  return lines.map((line) => line.startsWith('DOMAIN,') ? `${line},REJECT-DROP` : 'IP-CIDR,180.76.76.200/32,REJECT-DROP,no-resolve');
}

export function parseDdgSource(source) {
  const metadata = {}, jqRules = [];
  const seen = new Set();
  let hostnames, ipCount = 0, legacyRejectCount = 0, legacyScriptCount = 0, previousComment;
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = original.trim(), lineNumber = index + 1;
    if (!line) continue;
    if (line.startsWith('//')) {
      const match = line.match(/^\/\/\s*@(ScriptName|Author|UpdateTime|Version)\s+(.+)$/);
      if (match) metadata[match[1]] = match[2];
      continue;
    }
    if (line.startsWith('#')) { previousComment = line; continue; }
    if (/^hostname\s*=/.test(line)) {
      const hosts = line.replace(/^hostname\s*=\s*/, '').split(',').map((host) => host.trim());
      if (hostnames || hosts.length !== 2 || !hosts.includes('tieba.baidu.com') || !hosts.includes('tiebac.baidu.com')) fail(lineNumber, '未知或重复墨鱼 MITM 主机');
      hostnames = hosts; continue;
    }
    if (line === 'IP-CIDR,180.76.76.200/32,reject') {
      if (ipCount++) fail(lineNumber, '重复 IP 规则');
      continue;
    }
    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(lineNumber, '不认识的墨鱼配置语法');
    const [, pattern, action, argument = ''] = match;
    if (seen.has(pattern)) fail(lineNumber, '重复接口规则');
    seen.add(pattern);
    if (action === 'jsonjq-response-body') {
      const tail = pattern.slice(DDG_PREFIX.length);
      if (!pattern.startsWith(DDG_PREFIX) || !DDG_EXPRESSIONS.has(tail)) fail(lineNumber, 'JQ 接口超出已审核页面范围');
      patternCheck(pattern, `${DDG_PREFIX}${tail}`, lineNumber);
      if (argument !== `'${DDG_EXPRESSIONS.get(tail)}'`) fail(lineNumber, '页面净化表达式发生未审核变化');
      const expression = tail === String.raw`c\/u\/user\/profile` ? SAFE_PROFILE_EXPRESSION : DDG_EXPRESSIONS.get(tail);
      jqRules.push({ pattern, expression: jqCheck(expression, lineNumber), comment: previousComment });
    } else if (action === 'reject-200') {
      patternCheck(pattern, `${DDG_PREFIX}${String.raw`c\/f\/ad\/getFeedAd`}`, lineNumber);
      if (argument || legacyRejectCount++) fail(lineNumber, '未知或重复广告拒绝规则');
      // 旧规则会抢占 app2smile 新版 getFeedAd protobuf 脚本；改由新版脚本接管，不输出拒绝。
    } else if (action === 'script-response-body') {
      patternCheck(pattern, DDG_LEGACY_PROTO, lineNumber);
      if (argument !== PROTO_URL || legacyScriptCount++) fail(lineNumber, '未知或重复墨鱼 protobuf 来源');
      // 同一作者的完整原生模块包含更广接口，不重复生成第二份响应脚本。
    } else fail(lineNumber, '墨鱼规则命令发生未审核变化');
    previousComment = undefined;
  }
  if (!hostnames || ipCount !== 1 || legacyRejectCount !== 1 || legacyScriptCount !== 1 || jqRules.length !== 5
    || metadata.Author !== '@app2smile, @ddgksf2013' || !metadata.ScriptName?.includes('贴吧')) {
    throw new Error('墨鱼源缺少预期五类贴吧页面净化、署名或旧规则；保留旧成品。');
  }
  return { metadata, jqRules };
}

export function renderModule(app2Source, ddgSource, adSource, app2, ddg, adRules) {
  const digest = (source) => createHash('sha256').update(source).digest('hex');
  const lines = [
    '#!name=百度贴吧（去广告与页面净化）',
    '#!desc=百度贴吧去广告与页面净化：由 app2smile 原生 JSON / Protobuf 脚本处理开屏、推荐和吧内信息流、帖内、看图及悬浮广告，移除部分直播、关联商品和吧头推广；补充墨鱼搜索推荐、进吧热搜、侧栏及“我的”页面净化。默认保留普通推荐视频帖，参数 per_filter_video=1 可隐藏；部分直播、商品及推广入口会被精简，不修改真实会员或关注状态。规则每 6 小时检查上游，未知格式或范围变化停止发布；远程脚本由 Surge 每 24 小时检查原作者更新。iOS 需系统 15+ 及 Surge 5.14+，Mac 需 Surge 5.9+（原生 JQ）；开启重写、脚本、MITM，并安装及信任 MITM 证书。未在最新版贴吧手机实测，不保证移除所有广告。',
    '#!arguments=per_filter_video:0',
    '#!arguments-desc=per_filter_video:0 保留普通推荐视频帖（默认）；1 隐藏推荐页视频帖。广告、直播及关联商品按原作者逻辑处理，开关不恢复这些内容。',
    '#!author=app2smile, ddgksf2013',
    '#!category=AdBlock',
    `#!homepage=${APP2_URL}`,
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Tieba.sgmodule',
    '',
    '# 以下 MIT 许可适用于 app2smile 原生模块衍生内容；墨鱼规则按原作者要求保留出处。',
    '# 许可文件：https://github.com/wch19830910/wch/blob/main/Surge/licenses/app2smile-MIT.txt',
    ...MIT_NOTICE.split('\n').map((line) => `# ${line}`),
    `# app2smile 模块：${APP2_URL}`,
    `# app2smile 模块 SHA256：${digest(app2Source)}`,
    `# app2smile 分流表 SHA256：${digest(adSource)}`,
    `# 墨鱼页面净化：${DDG_URL}`,
    `# 墨鱼版本：${ddg.metadata.Version || '未声明'}；日期：${ddg.metadata.UpdateTime || '未声明'}；SHA256：${digest(ddgSource)}`,
    '# 自动生成；名称、描述和转换请修改 Surge/scripts/build-tieba.mjs，直接改本文件会被更新覆盖。',
    '# 完整使用 app2smile 当前原生 JSON / Protobuf 接口；不重复墨鱼旧 protobuf 入口。',
    '# 墨鱼旧 getFeedAd 空 200 会抢先截断新版 protobuf 响应，故交由 app2smile 脚本处理；不保留旧拒绝。',
    '# 五类 JQ 页面精简保留原行为；profile 的 zone_info 仅在数组时过滤，缺失/null/未知结构保持原样。',
    '# 分流表内联并合并墨鱼重复 IP 规则；不拒绝 sync 接口。',
    '# 精确补充 c.tieba.baidu.com 的 MITM，以覆盖原脚本现有 HTTPS 主机；不增加通配主机。',
    '# app2smile JSON sync 会调整长连接策略，使请求走可处理接口；不整段屏蔽 sync。',
    '# 原作者脚本正文仅远程引用，不在本仓库转载；JS 直接随作者更新，与构建检查独立。',
    '', '[Rule]', ...adRules,
    '', '[Body Rewrite]',
  ];
  for (const { pattern, expression, comment } of ddg.jqRules) {
    if (comment) lines.push(comment);
    lines.push(`http-response-jq ${pattern} '${expression}'`);
  }
  lines.push('', '[Script]');
  for (const [key, name] of [['贴吧json', 'tieba_json'], ['贴吧proto', 'tieba_proto']]) {
    const parameters = app2.scripts.get(key), isProto = key === '贴吧proto';
    lines.push(`${name} = type=http-response,pattern=${parameters.pattern},requires-body=true,${isProto ? 'binary-body-mode=true,' : ''}max-size=-1,timeout=30,script-update-interval=86400,script-path=${parameters['script-path']}${isProto ? ',argument=per_filter_video_thread={{{per_filter_video}}}' : ''}`);
  }
  lines.push('', '[MITM]', 'hostname = %APPEND% tiebac.baidu.com, c.tieba.baidu.com, tieba.baidu.com', '');
  return lines.join('\n');
}

async function fetchText(url, maxBytes) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Surge' } });
  if (!response.ok || response.url !== url) throw new Error(`下载失败或出现未审核跳转：HTTP ${response.status} ${url}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error(`远程文件过大：${url}`);
  const body = await response.text();
  if (!body.trim() || Buffer.byteLength(body) > maxBytes || /^\s*(?:<!doctype\s+html|<html\b)/i.test(body)) throw new Error(`远程文件为空、过大或返回网页：${url}`);
  return body;
}

async function writeIfChanged(path, content) {
  let existing;
  try { existing = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing === content) return false;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, path);
  return true;
}

export async function main() {
  if (process.argv.slice(2).some((argument) => argument !== '--check')) throw new Error('用法：node Surge/scripts/build-tieba.mjs [--check]');
  const urls = [APP2_URL, DDG_URL, AD_LIST_URL, JSON_URL, PROTO_URL];
  const sources = await Promise.all(urls.map((url, index) => fetchText(url, index < 3 ? 1024 * 1024 : 5 * 1024 * 1024)));
  const [app2Source, ddgSource, adSource] = sources;
  const app2 = parseApp2Module(app2Source), ddg = parseDdgSource(ddgSource), adRules = parseAdList(adSource);
  for (const index of [3, 4]) {
    try { new Script(sources[index], { filename: urls[index] }); }
    catch (error) { throw new Error(`远程 JavaScript 编译失败，保留旧成品：${error.message}`); }
    if (!sources[index].includes('$done')) throw new Error('远程脚本缺少预期响应入口，保留旧成品。');
  }
  const module = renderModule(app2Source, ddgSource, adSource, app2, ddg, adRules);
  console.log('校验通过：2 条分流、5 条原生 JQ、2 份原作者远程响应脚本、3 个精确 MITM 主机；普通视频默认保留。');
  if (process.argv.includes('--check')) { console.log('只校验，不写入成品。'); return; }
  const changed = [];
  for (const [index, content] of [module, app2Source, ddgSource, adSource].entries()) if (await writeIfChanged(OUTPUTS[index], content)) changed.push(OUTPUTS[index]);
  console.log(changed.length ? `已更新 ${changed.length} 份模块或来源快照。` : '内容无变化。');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
