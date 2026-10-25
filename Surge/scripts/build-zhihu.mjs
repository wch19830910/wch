#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Based on zirawell/R-Store, with original RuCu6 attribution retained.
// Modified 2026-10-26: reviewed native Surge publishing and optional content filters.
// License: Surge/licenses/zirawell-GPL-3.0.txt. Provided without warranty.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { renderZhihuRuntime } from './zhihu-runtime.mjs';

const SOURCE_URL = 'https://raw.githubusercontent.com/zirawell/R-Store/main/Rule/Surge/Adblock/App/Z/%E7%9F%A5%E4%B9%8E/zhihu.sgmodule';
const SCRIPT_URL = 'https://raw.githubusercontent.com/zirawell/R-Store/main/Res/Scripts/AntiAd/zhihu.js';
const SCRIPT_SHA256 = 'ac5ba31a6f4f6c6cc3c5896f846ddb692268b3aa4c580c1b9996e9a786b44c23';
const LOCAL_SCRIPT_URL = 'https://raw.githubusercontent.com/wch19830910/wch/main/Surge/Script/Zhihu.js';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUTS = ['AdBlock/Zhihu.sgmodule', 'Script/Zhihu.js', 'upstream/Zhihu.sgmodule', 'upstream/Zhihu.references.json'].map((path) => resolve(ROOT, path));
const digest = (source) => createHash('sha256').update(source).digest('hex');
const API = String.raw`^https?:\/\/api\.zhihu\.com\/`;
const WWW = String.raw`^https?:\/\/www\.zhihu\.com\/`;
const REWRITE_PATTERNS = [
  `${API}${String.raw`unlimited\/go\/my_card`}`,
  `${WWW}${String.raw`appview\/v\d\/zhmore`}`,
  `${API}${String.raw`appview\/api\/v\d\/answers\/\d+\/recommendations`}`,
  `${API}${String.raw`\w+\/\d+\/comments\/featured-comment-ad`}`,
  `${API}${String.raw`ab\/api\/v\d\/products\/zhihu\/platforms\/ios\/config`}`,
  `${WWW}${String.raw`api\/v\d\/hot_recommendation`}`,
  `${WWW}${String.raw`api\/v\d\/mcn\/v\d\/linkcards\?`}`,
  `${WWW}${String.raw`api\/v\d/(questions|anwsers)\/\d+/related-readings`}`,
  `${WWW}${String.raw`commercial_api\/banners_v\d\/mobile_banner`}`,
  String.raw`^https?:\/\/zhuanlan\.zhihu\.com\/api\/articles\/\d+\/recommendation`,
  String.raw`^https?:\/\/zhstatic\.zhihu\.com\/brand-ad`,
];
const MAP_PATTERNS = [
  `${API}${String.raw`commercial_api\/(banners_v\d\/app_topstory_banner|launch_v|real_time_launch_v)`}`,
  `${API}${String.raw`content-distribution-core\/bubble\/common\/settings`}`,
  `${API}${String.raw`(moments\/lastread|drama\/hot-drama-list)`}`,
  `${API}${String.raw`root\/window`}`, `${API}${String.raw`me\/guides`}`,
  `${API}${String.raw`feed\/render\/revisit\/current_reading`}`,
  `${API}${String.raw`search\/preset_words`}`,
  `${WWW}${String.raw`api\/v\d\/search\/related_queries\/(answer|article)\/\d+`}`,
  `${API}${String.raw`comment_v\d\/answers\/\d+\/list-headers`}`,
  `${API}${String.raw`v\d\.\d\/topics\/answer\/\d+\/relation`}`,
  `${API}ad`,
  String.raw`^https?:\/\/appcloud2\.zhihu\.com\/v\d\/resource\?group_name=mp`,
  `${API}${String.raw`distribute\/rhea\/qa_ad_card\/h5\/recommendation\?`}`,
];
const SCRIPT_PATTERNS = [
  `${API}${String.raw`commercial_api\/app_float_layer`}`,
  `${API}${String.raw`(moments_v\d|topstory\/recommend(_v\d)?)`}`,
  `${API}${String.raw`v2\/topstory\/hot-lists\/everyone-seeing\?`}`,
  `${API}${String.raw`next-(bff|data|render)\?`}`,
  `${API}${String.raw`(v\d\/)?questions\/\d+\/(feeds|answers)\?`}`,
  `${WWW}${String.raw`api\/v\d\/(answers|articles)\/\d+\/recommendations?`}`,
  String.raw`^https?:\/\/appcloud2\.zhihu\.com\/v\d\/config`,
  String.raw`^https?:\/\/m-cloud\.zhihu\.com\/api\/cloud\/config\/all\?`,
];
const EXTRA_SCRIPT_PATTERNS = [
  String.raw`^https?:\/\/(?:api|page-info)\.zhihu\.com\/(?:answers|articles)\/v2\/\d+`,
  `${API}${String.raw`root\/tab(?:\/v\d+)?(?:\?|$)`}`,
  `${API}${String.raw`feed\/render\/tab\/config(?:\?|$)`}`,
  `${API}${String.raw`bazaar\/vip_tab\/header(?:\?|$)`}`,
  `${API}${String.raw`topstory\/hot-lists\/total(?:\?|$)`}`,
  `${API}${String.raw`search\/recommend_query\/v2(?:\?|$)`}`,
];
const DOMAIN_RULES = ['appcloud.zhihu.com', 'appcloud2.in.zhihu.com', 'crash2.zhihu.com', 'mqtt.zhihu.com', 'sugar.zhihu.com', 'zxid-m.mobileservice.cn'];
const IP_RULES = ['103.41.167.237/32', '118.89.204.198/32', '2402:4e00:1200:ed00:0:9089:6dac:96b6/128'];
const HOSTS = ['api.zhihu.com', 'www.zhihu.com', 'appcloud2.zhihu.com', 'm-cloud.zhihu.com', 'zhuanlan.zhihu.com', 'zhstatic.zhihu.com'];
const BODY_LINE = `http-response ${API}${String.raw`search\/recommend_query\/v2\? "recommend_queries":\{.+\} "recommend_queries":{}`}`;
const METADATA_NAMES = new Set(['name', 'desc', 'openUrl', 'bundleId', 'author', 'tag', 'basedOn', 'surge_version', 'homepage', 'icon', 'date']);

function fail(lineNumber, message) { throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`); }
function checkPattern(pattern, allowed, lineNumber) {
  if (!allowed.includes(pattern)) fail(lineNumber, '接口正则超出已审核范围');
  try { new RegExp(pattern); } catch (error) { fail(lineNumber, `正则无效：${error.message}`); }
}

export function parseSource(source) {
  let section;
  const metadata = {}, sections = new Set(), rules = [], rewrites = [], maps = [], scripts = [];
  const seen = new Set();
  let bodyCount = 0, mitmCount = 0;
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = original.trim(), lineNumber = index + 1;
    if (!line || line.startsWith('#') && !line.startsWith('#!') || line.startsWith('//')) continue;
    if (line.startsWith('#!')) {
      const match = line.match(/^#!([A-Za-z_-]+)=(.*)$/);
      if (section || !match || !METADATA_NAMES.has(match[1]) || Object.hasOwn(metadata, match[1])) fail(lineNumber, '未知、重复或位置错误的元信息');
      metadata[match[1]] = match[2]; continue;
    }
    if (line.startsWith('[')) {
      const match = line.match(/^\[(Rule|URL Rewrite|Body Rewrite|Map Local|Script|MITM)\]$/);
      if (!match || sections.has(match[1])) fail(lineNumber, '未知或重复配置段');
      section = match[1]; sections.add(section); continue;
    }
    if (!section || seen.has(`${section}:${line}`)) fail(lineNumber, '规则不属于已知配置段或重复');
    seen.add(`${section}:${line}`);
    if (section === 'Rule') {
      const fields = line.split(',').map((field) => field.trim());
      let valid = false;
      if (fields[0] === 'USER-AGENT') valid = fields.join(',') === 'USER-AGENT,AVOS*,REJECT,pre-matching';
      else if (fields[0] === 'DOMAIN') valid = fields.length === 5 && DOMAIN_RULES.includes(fields[1]) && fields.slice(2).join(',') === 'REJECT,extended-matching,pre-matching';
      else if (['IP-CIDR', 'IP-CIDR6'].includes(fields[0])) valid = fields.length === 5 && IP_RULES.includes(fields[1]) && fields[0] === (fields[1].includes(':') ? 'IP-CIDR6' : 'IP-CIDR') && fields.slice(2).join(',') === 'REJECT,no-resolve,pre-matching';
      if (!valid || rules.some((rule) => rule.split(',')[1] === fields[1])) fail(lineNumber, '分流范围或参数发生未审核变化');
      rules.push(fields.join(','));
    } else if (section === 'URL Rewrite') {
      const match = line.match(/^(\S+)\s+-\s+reject$/);
      if (!match) fail(lineNumber, 'URL Rewrite 动作发生未审核变化');
      checkPattern(match[1], REWRITE_PATTERNS, lineNumber); rewrites.push(match[1]);
    } else if (section === 'Map Local') {
      const match = line.match(/^(\S+)\s+data-type=json\s+data="\{\}"\s+status-code=200$/);
      if (!match) fail(lineNumber, 'Map Local 响应发生未审核变化');
      checkPattern(match[1], MAP_PATTERNS, lineNumber); maps.push(match[1]);
    } else if (section === 'Body Rewrite') {
      if (line !== BODY_LINE || bodyCount++) fail(lineNumber, '搜索净化表达式发生未审核变化');
    } else if (section === 'Script') {
      const match = line.match(/^zhihu\s*=\s*(.+)$/), parameters = {};
      if (!match) fail(lineNumber, '响应脚本名称或声明变化');
      for (const field of match[1].split(',')) {
        const pair = field.trim().match(/^([a-z-]+)=(.*)$/);
        if (!pair || !new Set(['type', 'pattern', 'requires-body', 'max-size', 'script-path']).has(pair[1]) || Object.hasOwn(parameters, pair[1])) fail(lineNumber, '未知或重复脚本参数');
        parameters[pair[1]] = pair[2];
      }
      if (Object.keys(parameters).length !== 5 || parameters.type !== 'http-response' || parameters['requires-body'] !== '1' || parameters['max-size'] !== '0' || parameters['script-path'] !== SCRIPT_URL) fail(lineNumber, '脚本类型、正文模式、大小或来源变化');
      checkPattern(parameters.pattern, SCRIPT_PATTERNS, lineNumber); scripts.push(parameters.pattern);
    } else {
      const match = line.match(/^hostname\s*=\s*%APPEND%\s+(.+)$/);
      const hosts = match?.[1].split(',').map((host) => host.trim());
      if (!hosts || mitmCount++ || hosts.length !== HOSTS.length || new Set(hosts).size !== HOSTS.length || hosts.some((host) => !HOSTS.includes(host))) fail(lineNumber, 'MITM 主机发生未审核变化');
    }
  }
  if (sections.size !== 6 || rules.length !== 10 || rewrites.length !== REWRITE_PATTERNS.length || new Set(rewrites).size !== REWRITE_PATTERNS.length || maps.length !== MAP_PATTERNS.length || new Set(maps).size !== MAP_PATTERNS.length || scripts.length !== SCRIPT_PATTERNS.length || new Set(scripts).size !== SCRIPT_PATTERNS.length || bodyCount !== 1 || mitmCount !== 1 || metadata.author !== 'zirawell[https://github.com/zirawell]' || metadata.bundleId !== 'com.zhihu.ios' || !metadata.name?.includes('知乎')) throw new Error('上游缺少预期知乎规则、配置段或作者；保留旧成品。');
  return { metadata, rules, rewrites, maps, scripts };
}

export function validateUpstreamScript(javascript) {
  if (digest(javascript) !== SCRIPT_SHA256) throw new Error('知乎原脚本发生变化，须兼容审查及测试后更新已审核 SHA256；保留旧成品。');
  try { new Script(javascript, { filename: SCRIPT_URL }); } catch (error) { throw new Error(`原脚本编译检查失败：${error.message}；保留旧成品。`); }
  return SCRIPT_SHA256;
}

export function renderModule(source, parsed, scriptHash = SCRIPT_SHA256) {
  const rules = parsed.rules.filter((line) => !line.startsWith('USER-AGENT,') && !line.includes(',mqtt.zhihu.com,') && !line.includes(',zxid-m.mobileservice.cn,'));
  const rewrites = parsed.rewrites.filter((pattern) => pattern !== REWRITE_PATTERNS[0]).map((pattern) => pattern === REWRITE_PATTERNS[7] ? pattern.replace('(questions|anwsers)', '(questions|answers)') : pattern);
  const maps = parsed.maps.filter((pattern) => pattern !== MAP_PATTERNS[4]).map((pattern) => pattern === MAP_PATTERNS[2] ? `${API}${String.raw`moments\/lastread`}` : pattern === MAP_PATTERNS[10] ? `${API}${String.raw`ad(?:\/|\?|$)`}` : pattern);
  const pattern = `(?:${[...parsed.scripts, ...EXTRA_SCRIPT_PATTERNS].join('|')})`;
  new RegExp(pattern);
  return [
    '#!name=知乎（去广告与页面净化）',
    '#!desc=基于 zirawell / RuCu6 的知乎规则整理：处理开屏、悬浮、信息流、热榜、回答与文章推广、评论区顶部推广、搜索推荐及弹窗。默认保留普通视频、直播与付费内容；hideVideos=1 隐藏已识别的视频/直播项目，hidePaid=1 隐藏已识别的付费回答及盐选推荐。保留真实会员、会员入口、关注状态、消息计数及消息长连接；精简部分活动标签与推荐入口。规则每 6 小时检查上游，源范围或原脚本变化须审查后接入；本仓库兼容脚本每 24 小时检查更新。需 Surge iOS 5.14.2+ / Mac 5.9+，开启重写、脚本及 MITM，并安装及信任 MITM 证书。未在最新版知乎手机实测，不保证移除所有广告。',
    '#!arguments=hideVideos:0,hidePaid:0',
    '#!arguments-desc=hideVideos:0 保留视频和直播（默认）；1 在支持的列表中过滤已识别的视频与直播项目。\\nhidePaid:0 保留付费回答与盐选内容（默认）；1 过滤已识别的付费项目。两个参数独立生效，不改变会员权益，也不解锁付费正文。',
    '#!author=zirawell, RuCu6（原始来源）；本仓库兼容整理',
    '#!category=AdBlock',
    '#!homepage=https://github.com/zirawell/R-Store',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Zhihu.sgmodule',
    '',
    '# SPDX-License-Identifier: GPL-3.0-only',
    '# 原作者 zirawell，保留原脚本的 RuCu6 来源声明；兼容修改日期 2026-10-26。',
    '# 许可：https://github.com/wch19830910/wch/blob/main/Surge/licenses/zirawell-GPL-3.0.txt；无任何保证。',
    `# 上游模块：${SOURCE_URL}`, `# 上游模块 SHA256：${digest(source)}`,
    `# 上游脚本参考：${SCRIPT_URL}`, `# 已审核原脚本 SHA256：${scriptHash}`,
    '# 此模块由 build-zhihu.mjs 生成；显示名称和默认参数请在构建脚本修改。',
    '# 由本仓库自定义兼容脚本统一处理，修复重复名称、变量引用和遗漏接口；不直接执行原作者远程 JS。',
    '# 省略全局 AVOS*、共享 zxid SDK 和 mqtt 拒绝；保留消息长连接。',
    '# 不拦 unlimited/go/my_card、me/guides、通知计数和 drama/hot-drama-list；保留正常会员入口与卡片。',
    '# ad 接口增加路径边界；修正原 anwsers 拼写；搜索 JSON 交给响应脚本，不使用贪婪正则替换。',
    '# 视频/付费过滤默认关闭；保留未知结构、普通文章内容、视频 ID 与真实账号数据。',
    '', '[Rule]', ...rules, '', '[URL Rewrite]', ...rewrites.map((item) => `${item} - reject`),
    '', '[Map Local]', ...maps.map((item) => `${item} data-type=text data="{}" status-code=200 header="Content-Type:application/json"`),
    '', '[Script]', `zhihu_cleanup = type=http-response,pattern=${pattern},requires-body=true,max-size=-1,timeout=30,script-update-interval=86400,script-path=${LOCAL_SCRIPT_URL},argument="hideVideos={{{hideVideos}}}&hidePaid={{{hidePaid}}}"`,
    '', '[MITM]', `hostname = %APPEND% ${[...HOSTS, 'page-info.zhihu.com'].join(', ')}`, '',
  ].join('\n');
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
  await writeFile(temporary, content, 'utf8'); await rename(temporary, path); return true;
}
export async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('用法：node Surge/scripts/build-zhihu.mjs [--check]');
  const [source, originalScript] = await Promise.all([fetchText(SOURCE_URL, 1024 * 1024), fetchText(SCRIPT_URL, 5 * 1024 * 1024)]);
  const parsed = parseSource(source), scriptHash = validateUpstreamScript(originalScript);
  const javascript = renderZhihuRuntime();
  new Script(javascript, { filename: 'Zhihu.js' });
  const module = renderModule(source, parsed, scriptHash);
  const references = JSON.stringify({
    author: 'zirawell', originalReference: 'RuCu6', license: 'GPL-3.0-only',
    module: { url: SOURCE_URL, sha256: digest(source), upstreamDate: parsed.metadata.date },
    originalScript: { url: SCRIPT_URL, auditedSha256: scriptHash, policy: 'Changes require compatibility review before publication; original JavaScript is compiled but never executed or redistributed by the builder.' },
    generatedScript: { url: LOCAL_SCRIPT_URL, sha256: digest(javascript) },
    modifications: ['single response entry', 'optional video and paid-content filters default off', 'preserve real membership and notifications', 'omit global AVOS/shared zxid/mqtt rejection', 'preserve member cards and ordinary drama feed', 'precise ad path boundary', 'repair answers typo and missing routes', 'guarded local JSON response processing'],
  }, null, 2) + '\n';
  console.log('知乎构建验证通过：7 条分流、10 条 URL Rewrite、12 条 Map Local、1 个自定义响应脚本；两个内容过滤参数默认关闭。');
  if (process.argv.includes('--check')) { console.log('只检查，不写入产物。'); return; }
  const changed = [];
  for (const [index, content] of [module, javascript, source, references].entries()) if (await writeIfChanged(OUTPUTS[index], content)) changed.push(OUTPUTS[index]);
  console.log(changed.length ? `已更新 ${changed.length} 份模块、兼容脚本或来源记录。` : '内容无变化。');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
