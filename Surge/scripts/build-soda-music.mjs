#!/usr/bin/env node
// ddgksf2013 规则的 Surge 转换；2026-10-27 缩小作用范围，移除共享配置与位置接口拦截。
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/refs/heads/master/AdBlock/QiShuiMusicAds.conf';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/SodaMusic.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/QiShuiMusicAds.conf');
const SOURCE_HOSTS = ['beta-luna.douyin.com', 'api.qishui.com', 'tnc*-*.zijieapi.com'];
const HOSTS = SOURCE_HOSTS.slice(0, 2);
const ORIGINAL_PREFIX = String.raw`^https:\/\/[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+){1,3}`;
const SCOPED_PREFIX = String.raw`^https:\/\/(?:beta-luna\.douyin\.com|api\.qishui\.com)`;
const TARGETS = [
  ['视频广告', String.raw`\/luna\/media_ads`, 'reject-200', ''],
  ['通用广告', String.raw`\/luna\/ads`, 'reject-200', ''],
  ['商业弹窗', String.raw`\/luna\/commerce`, 'reject-200', ''],
  ['TAGS推荐', String.raw`\/luna\/hashtag\/recommend`, 'reject-200', ''],
  ['我的页面广告横幅', String.raw`\/luna\/me`, 'jsonjq-response-body', "'del(.reward_ad_banner)'"],
  ['会员试听引导', String.raw`\/luna\/card`, 'jsonjq-response-body', "'del(.preview_guide)'"],
  ['热门搜索', String.raw`\/luna\/search-block`, 'jsonjq-response-body', "'del(.search_chart_block)'"],
  ['搜索界面活动', String.raw`\/luna\/activities`, 'jsonjq-response-body', "'del(.activity_map)'"],
  ['歌曲流推广', String.raw`\/luna\/feed\/song-tab`, 'jsonjq-response-body', `'.items |= map(select(.type == "track"))'`],
].map(([purpose, path, action, argument]) => ({ purpose, path, action, argument,
  sourcePattern: ORIGINAL_PREFIX + path + (purpose === '我的页面广告横幅' ? String.raw`\?` : ''),
}));
const EXCLUDED = [ORIGINAL_PREFIX + String.raw`\/location\/info`, String.raw`^https:\/\/tnc.*zijieapi\.com\/get_domains`];

function fail(line, message) { throw new Error(`上游${line ? `第 ${line} 行` : ''}：${message}；保留旧成品。`); }
function validateJq(expression, line) {
  const result = spawnSync('jq', ['-n', `false and (${expression.slice(1, -1)})`], { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error || result.status !== 0) fail(line, `JQ 编译失败：${result.error?.message || result.stderr.trim()}`);
}
export function parseSource(source) {
  if (typeof source !== 'string' || !source.trim()) fail(null, '来源为空');
  let hosts, author, version;
  const selected = new Map(), excluded = new Set();
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = original.trim(), number = index + 1;
    if (!line) continue;
    if (line.startsWith('//')) {
      const metadata = line.match(/^\/\/\s*@(Version|Author)\s+(.+)$/);
      if (metadata?.[1] === 'Version') version = metadata[2].trim();
      if (metadata?.[1] === 'Author') author = metadata[2].trim().replace(/^@/, '');
      continue;
    }
    if (line.startsWith('#')) continue;
    if (/^hostname\s*=/.test(line)) {
      if (hosts) fail(number, '重复 hostname');
      hosts = line.replace(/^hostname\s*=\s*/, '').split(',').map((host) => host.trim());
      if (hosts.length !== SOURCE_HOSTS.length || hosts.some((host, i) => host !== SOURCE_HOSTS[i])) fail(number, '上游主机范围发生未审核变化');
      continue;
    }
    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(number, '未知配置语法');
    const [, pattern, action, raw = ''] = match, argument = raw.trim();
    if (EXCLUDED.includes(pattern)) {
      if (action !== 'reject-200' || argument || excluded.has(pattern)) fail(number, '已排除规则出现未审核变化');
      excluded.add(pattern); continue;
    }
    const target = TARGETS.find((entry) => entry.sourcePattern === pattern);
    if (!target || selected.has(pattern) || target.action !== action || target.argument !== argument) fail(number, '路径、动作、JQ或数量发生未审核变化');
    if (action === 'jsonjq-response-body') validateJq(argument, number);
    selected.set(pattern, target);
  }
  if (!hosts || author !== 'ddgksf2013' || !version || selected.size !== TARGETS.length || excluded.size !== EXCLUDED.length) fail(null, '缺少已审核的作者、主机或规则');
  const sections = { 'Map Local': [], 'Body Rewrite': [] };
  for (const target of TARGETS) {
    const pattern = SCOPED_PREFIX + target.path + String.raw`(?:\?|$)`;
    new RegExp(pattern);
    const section = target.action === 'reject-200' ? 'Map Local' : 'Body Rewrite';
    sections[section].push(`# ${target.purpose}（ddgksf2013；本仓库限定主机与路径边界）`);
    sections[section].push(target.action === 'reject-200' ? `${pattern} data-type=text data="" status-code=200` : `http-response-jq ${pattern} ${target.argument}`);
  }
  return { sections, hostnames: HOSTS, author, version, counts: { 'reject-200': 4, 'jsonjq-response-body': 5, excluded: 2 } };
}
export function renderModule(source, parsed) {
  const lines = [
    '#!name=汽水音乐（广告与推广净化）',
    '#!desc=仅处理beta-luna.douyin.com和api.qishui.com的指定/luna/接口：视频及通用广告、商业弹窗、TAGS推荐、我的页面广告横幅、会员试听引导、热搜、搜索活动和歌曲流推广。2026-10-27兼容修复：移除字节系共享域名配置/get_domains与/location/info拦截，不再追加tnc通配MITM；规则限定两个汽水域名及精确路径边界。参考ddgksf2013，每6小时检查上游；未审核范围变化停止更新。无远程JavaScript。需Surge iOS 5.14+ / Mac 5.9+，启用重写、MITM并信任证书。不解锁会员或版权；推荐等页面内容会精简，未在最新App实机验证，不保证所有广告均消失。',
    `#!author=${parsed.author}；本仓库兼容性调整`,
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/SodaMusic.sgmodule', '',
    `# 上游：${SOURCE_URL}`, `# 上游版本：${parsed.version}`,
    `# 上游规则 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    '# 自动生成；名称、说明和兼容范围请修改 Surge/scripts/build-soda-music.mjs。',
    '# 2026-10-27：排除共享域名配置与位置拦截；全部规则收窄到两个精确主机及端点，避免影响其他字节系App。',
    '# 上游原始快照仅供追溯，不直接安装。同步也不会重新加入上述排除项。',
    '# 未使用抖音的评论接口；这是合成路由/配置验证，尚未手机验证故障是否恢复。',
    '# 使用说明：https://github.com/wch19830910/wch/blob/main/Surge/AdBlock/SodaMusic.md',
  ];
  for (const [section, rules] of Object.entries(parsed.sections)) lines.push('', `[${section}]`, ...rules);
  lines.push('', '[MITM]', `hostname = %APPEND% ${parsed.hostnames.join(', ')}`, '');
  return lines.join('\n');
}
async function fetchSource() {
  const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Surge' } });
  if (!response.ok || response.url !== SOURCE_URL) fail(null, `下载失败或跳转：HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > 1024 * 1024) fail(null, '来源过大');
  const source = await response.text();
  if (!source.trim() || Buffer.byteLength(source) > 1024 * 1024 || /^\s*(?:<!doctype\s+html|<html\b)/i.test(source)) fail(null, '来源为空、过大或返回网页');
  return source;
}
async function writeIfChanged(path, content) {
  let previous;
  try { previous = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous === content) return false;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, content, 'utf8'); await rename(temporary, path); return true;
}
export async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('用法：node Surge/scripts/build-soda-music.mjs [--check]');
  const source = await fetchSource(), parsed = parseSource(source), module = renderModule(source, parsed);
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；2个精确主机；无共享配置/位置拦截。`);
  if (process.argv.includes('--check')) { console.log('只检查，不写入产物。'); return; }
  await writeIfChanged(OUTPUT_MODULE, module); await writeIfChanged(OUTPUT_SOURCE, source);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
