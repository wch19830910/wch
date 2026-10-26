#!/usr/bin/env node
// Independently written build guard for selected RiskBird interface facts, 2026-10-26.
// References: 可莉 / iKeLee, indexed as a Surge conversion by QingRex.
// Attribution and reuse boundaries: Surge/licenses/RiskBird-NOTICE.txt.
// No upstream JavaScript is downloaded, copied or executed by this builder.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_URL = encodeURI('https://raw.githubusercontent.com/QingRex/LoonKissSurge/main/Surge/风鸟去广告.sgmodule');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUTS = ['AdBlock/RiskBird.sgmodule', 'upstream/RiskBird.sources.json'].map((path) => resolve(ROOT, path));
const RAW_URL = 'https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/RiskBird.sgmodule';
const NOTICE_URL = 'https://github.com/wch19830910/wch/blob/main/Surge/licenses/RiskBird-NOTICE.txt';
const MAX_SOURCE_BYTES = 1024 * 1024;
const AUTHOR = '可莉🅥[https://github.com/luestr/ProxyResource/blob/main/README.md]';
const METADATA = new Set(['name', 'desc', 'author', 'icon', 'category', 'openUrl', 'tag', 'loon_version', 'homepage', 'date']);
const SECTIONS = new Set(['Map Local', 'Script', 'MITM']);
const TARGETS = Object.freeze([
  {
    purpose: '首页轮播图',
    path: '/prod-qbb-api/user/getBannerList',
    originalPattern: String.raw`^https:\/\/m\.riskbird\.com\/prod-qbb-api\/user\/getBannerList`,
  },
  {
    purpose: '首页热门企业推荐',
    path: '/prod-qbb-api/searchHotEnt',
    originalPattern: String.raw`^https:\/\/m\.riskbird\.com\/prod-qbb-api\/searchHotEnt`,
  },
]);
const RESPONSE = 'data-type=text data="{}" status-code=200 header="Content-Type:application/json"';
const EXCLUDED_SCRIPT = Object.freeze({
  name: '移除推荐老板',
  pattern: String.raw`^https:\/\/m\.riskbird\.com\/prod-qbb-api\/query\/person\/personRecommend`,
  url: 'https://kelee.one/Resource/JavaScript/RiskBird/RiskBird_remove_ads.js',
  enabled: false,
  reason: '仅接入已确认的两个首页接口。推荐老板脚本在2026-10-26审查时下载返回403，未确认响应字段；不下载、不执行、不发布原脚本。',
});
const EXPECTED_SCRIPT_LINE = `移除推荐老板 = type=http-response, pattern=${EXCLUDED_SCRIPT.pattern}, script-path=${EXCLUDED_SCRIPT.url}, requires-body=true`;
const DIGEST = (text) => createHash('sha256').update(text).digest('hex');

function fail(line, message) {
  throw new Error(`风鸟上游${line ? `第 ${line} 行` : ''}：${message}；保留旧成品。`);
}

export function parseSource(source) {
  if (typeof source !== 'string' || !source.trim()) fail(undefined, '来源为空');
  const metadata = {}, seenSections = new Set(), selected = [];
  let section, scriptSeen = false, hostname;
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = original.trim(), lineNumber = index + 1;
    if (!line || line.startsWith('//') || line.startsWith('#') && !line.startsWith('#!')) continue;
    if (line.startsWith('#!')) {
      const match = line.match(/^#!([A-Za-z_-]+)=(.*)$/);
      if (section || !match || !METADATA.has(match[1]) || Object.hasOwn(metadata, match[1])) fail(lineNumber, '未知、重复或位置错误的元信息');
      metadata[match[1]] = match[2];
      continue;
    }
    if (line.startsWith('[')) {
      const match = line.match(/^\[([^\]]+)\]$/);
      if (!match || !SECTIONS.has(match[1]) || seenSections.has(match[1])) fail(lineNumber, '未知或重复配置段');
      section = match[1]; seenSections.add(section); continue;
    }
    if (section === 'Map Local') {
      const target = TARGETS.find(({ originalPattern }) => line === `${originalPattern} ${RESPONSE}`);
      if (!target || selected.some(({ path }) => path === target.path)) fail(lineNumber, '本地响应路径、内容、动作或数量发生未审核变化');
      selected.push({ line: lineNumber, text: line, ...target });
    } else if (section === 'Script') {
      if (scriptSeen || line !== EXPECTED_SCRIPT_LINE) fail(lineNumber, '排除的脚本入口发生未审核变化');
      scriptSeen = true;
    } else if (section === 'MITM') {
      if (hostname || line !== 'hostname = %APPEND% m.riskbird.com') fail(lineNumber, 'MITM 主机发生未审核变化');
      hostname = 'm.riskbird.com';
    } else fail(lineNumber, '配置不属于已审核段');
  }
  if (metadata.name !== '风鸟去广告' || metadata.author !== AUTHOR
      || metadata.openUrl !== 'https://apps.apple.com/app/id1528682937'
      || metadata.homepage !== 'https://hub.kelee.one'
      || !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(metadata.date ?? '')
      || seenSections.size !== SECTIONS.size || selected.length !== TARGETS.length || !scriptSeen || !hostname) {
    fail(undefined, '缺少预期应用身份、署名、接口或来源结构');
  }
  selected.sort((a, b) => TARGETS.findIndex(({ path }) => path === a.path) - TARGETS.findIndex(({ path }) => path === b.path));
  const mapLocal = selected.map(({ originalPattern }) => `${originalPattern}(?:\\?|$) ${RESPONSE}`);
  for (const rule of mapLocal) {
    try { new RegExp(rule.split(/\s+/, 1)[0]); }
    catch (error) { fail(undefined, `生成的路径正则无效：${error.message}`); }
  }
  return { metadata, selected, excluded: [{ ...EXCLUDED_SCRIPT }], mapLocal, hostname, counts: { 'Map Local': 2, MITM: 1, excludedScripts: 1 } };
}

export function renderModule(source, parsed) {
  return [
    '#!name=风鸟（首页广告与推荐精简）',
    '#!desc=依据可莉来源、QingRex转换配置中的两个已审核接口，处理首页轮播图和热门企业推荐：仅对m.riskbird.com指定路径返回空JSON。热门企业是推荐内容精简，并非仅删除付费广告。只追加一个精确MITM主机，无远程JavaScript、JQ或整域拒绝；未接入推荐老板脚本，不处理“我的”页面横幅，也不声明去开屏或全净化。每6小时检查已审核来源，路径/动作/主机变化先审查，失败保留旧成品。需Surge iOS 5.9.1+ / Mac 5.5.1+，开启重写和MITM并安装及信任证书。未在最新版风鸟手机实测，不能保证广告效果及业务兼容；异常时停用模块并重开App。',
    '#!author=可莉（接口来源）；QingRex（转换参考）；本仓库范围整理',
    '#!category=AdBlock',
    '#!homepage=https://github.com/QingRex/LoonKissSurge',
    `#!raw-url=${RAW_URL}`,
    '',
    '# 整理日期：2026-10-26；仅依据已公开接口事实独立整理有限配置。',
    `# 来源与复用边界：${NOTICE_URL}`,
    `# 配置参考：${SOURCE_URL}`,
    `# 参考配置 SHA256：${DIGEST(source)}`,
    '# 自动生成；显示名称和功能说明请修改 Surge/scripts/build-riskbird.mjs，直接修改成品会被同步覆盖。',
    '# 两个路径增加端点边界，保留同端点查询参数；不匹配相似主机或路径后缀。',
    '# personRecommend推荐老板需另行确认响应结构；当前完全不加载该远程脚本。',
    '# 这是首页轮播与热门企业推荐精简，不是开屏广告或全部页面净化。',
    '', '[Map Local]',
    ...parsed.mapLocal.flatMap((line, index) => [`# ${parsed.selected[index].purpose}`, line]),
    '', '[MITM]', `hostname = %APPEND% ${parsed.hostname}`, '',
  ].join('\n');
}

export function renderSources(source, parsed) {
  return JSON.stringify({
    schemaVersion: 1,
    source: { url: SOURCE_URL, sha256: DIGEST(source), metadata: parsed.metadata },
    attribution: { interfaceSource: '可莉 / iKeLee', conversionReference: 'QingRex/LoonKissSurge', notice: NOTICE_URL },
    selected: parsed.selected.map(({ line, path, purpose, originalPattern }) => ({ sourceLine: line, host: parsed.hostname, path, purpose, originalPattern, response: { status: 200, body: {}, contentType: 'application/json' } })),
    excluded: parsed.excluded,
    generatedScope: { mapLocal: parsed.mapLocal, mitmHosts: [parsed.hostname], scripts: [], domainRejects: [] },
    policy: '只保存公开接口事实与来源元信息，不镜像完整原插件或脚本正文；原许可和归属不能因转换而自动改变。',
    modifications: ['只保留两个明确首页目标', '为原路径增加端点边界', '保持空JSON成功响应及单个精确MITM主机', '完全排除未确认的推荐老板脚本', '不加入开屏、我的页面、账号或会员处理'],
    testingLimit: '只作配置及合成路由验证，尚未在最新版风鸟手机实测。',
  }, null, 2) + '\n';
}

async function fetchSource() {
  const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Surge' } });
  if (!response.ok || response.url !== SOURCE_URL) fail(undefined, `下载失败或出现未审核跳转：HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) fail(undefined, '来源内容过大');
  const source = await response.text();
  if (!source.trim() || Buffer.byteLength(source) > MAX_SOURCE_BYTES || /^\s*(?:<!doctype\s+html|<html\b)/i.test(source)) fail(undefined, '来源为空、过大或返回网页');
  return source;
}

async function writeIfChanged(path, content) {
  let previous;
  try { previous = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous === content) return false;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, path);
  return true;
}

export async function main() {
  if (process.argv.slice(2).some((argument) => argument !== '--check')) throw new Error('用法：node Surge/scripts/build-riskbird.mjs [--check]');
  const source = await fetchSource();
  const parsed = parseSource(source), module = renderModule(source, parsed), references = renderSources(source, parsed);
  console.log('风鸟构建验证通过：2条精确首页本地响应、1个MITM主机；没有脚本或整域拒绝。');
  if (process.argv.includes('--check')) { console.log('只检查，不写入产物。'); return; }
  const changed = [];
  for (const [index, content] of [module, references].entries()) if (await writeIfChanged(OUTPUTS[index], content)) changed.push(OUTPUTS[index]);
  console.log(changed.length ? `已更新 ${changed.length} 份模块或来源记录。` : '内容无变化。');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
