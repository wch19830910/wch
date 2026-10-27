#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// AWAvenue (TG-Twilight) Only.Ads derivative; wch19830910/wch, 2026-10-28.
// Full source, exclusions and license are published alongside the module.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const SOURCE_URL = 'https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-Surge-module-Only.Ads.sgmodule';
export const LICENSE_URL = 'https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/LICENSE';
const LICENSE_SHA256 = '589ed823e9a84c56feb95ac58e7cf384626b9cbf4fda2a907bc36e103de1bad2';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUTS = ['AdBlock/AWAvenue.sgmodule', 'upstream/AWAvenue-OnlyAds.sgmodule', 'upstream/AWAvenue.sources.json'].map((p) => resolve(ROOT, p));
export const EXCLUSIONS = Object.freeze({
  'ad.12306.cn': '保留铁路12306专用模块的请求阶段广告占位响应',
  'optimus-ads.amap.com': '保留高德地图专用模块的DIRECT与处理流程',
  'sdkapp.uve.weibo.com': '保留微博专用模块按路径处理',
  'open.snssdk.com': '头条OAuth共享授权主机，不作整域广告拒绝',
});
const SUFFIXES = new Set(['1rtb.com', 'a.market.xiaomi.com', 'ad.gameley.com', 'adintl.cn', 'adsmoloco.com', 'adx.adwangmai.com', 'data.hicloud.com', 'ubixioe.com', 'unityads.unity3d.com', 'vlion.cn', 'yfanads.com', 'zhangyuyidong.cn']);
const KEYWORDS = new Set(['-ad.sm.cn', '-ad.video.yximgs.com', '-ad.wtzw.com', '-be-pack-sign.pglstatp-toutiao.com']);
const BUSINESS_HOSTS = ['www.douyin.com', 'aweme.snssdk.com', 'api.amemv.com', 'beta-luna.douyin.com', 'api.qishui.com', 'mp.weixin.qq.com', 'ucmp.sf-express.com', 'api.blibee.com', 'acs.m.taobao.com', 'acs-m.freshippo.com', 'acs.m.goofish.com', 'g-acs.m.goofish.com', 'home.mi.com', 'api.zhihu.com', 'interface.music.163.com', 'tiebac.baidu.com', 'c.tieba.baidu.com', 'app-api.smzdm.com', 'm.riskbird.com', 'm5.amap.com', 'api.coolapk.com'];
const SHARED_HOSTS = ['jpush.cn', 'jpush.io', 'getui.cn', 'getui.com', 'getui.net', 'tpns.qq.com', 'openinstall.com', 'httpdns.music.163.com'];
const METADATA = new Set(['name', 'desc', 'category', 'author', 'icon', 'homepage']);
export const digest = (s) => createHash('sha256').update(s).digest('hex');
function fail(message) { throw new Error(`秋风来源：${message}；停止更新，保留旧成品。`); }
export function matches(rule, host) {
  if (rule.type === 'DOMAIN') return host === rule.host;
  if (rule.type === 'DOMAIN-SUFFIX') return host === rule.host || host.endsWith('.' + rule.host);
  if (rule.type === 'DOMAIN-KEYWORD') return host.includes(rule.host);
  fail('未知匹配类型');
}
function overlapsExclusion(rule, host) {
  if (matches(rule, host)) return true;
  // Also drop explicit domain/suffix entries below a protected domain.
  return rule.type !== 'DOMAIN-KEYWORD' && rule.host.endsWith('.' + host);
}
export function parseSource(source) {
  if (typeof source !== 'string' || !source.trim()) fail('空文件');
  const metadata = {}, rules = [], seen = new Set();
  let section;
  for (const [i, raw] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith('#!')) {
      const m = line.match(/^#!([a-z]+)=(.*)$/);
      if (section || !m || !METADATA.has(m[1]) || Object.hasOwn(metadata, m[1])) fail(`第${i + 1}行元信息变化`);
      metadata[m[1]] = m[2]; continue;
    }
    if (line.startsWith('#') || line.startsWith('//')) continue;
    if (line.startsWith('[')) { if (section || line !== '[Rule]') fail('出现未知或重复配置段'); section = 'Rule'; continue; }
    if (!section) fail('规则不在Rule段内');
    const p = line.split(',');
    if (p.length !== 5 || !['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD'].includes(p[0]) || p.slice(2).join(',') !== 'REJECT,extended-matching,pre-matching') fail(`第${i + 1}行匹配类型、动作或选项变化`);
    const [type, host] = p;
    if (!host || host !== host.toLowerCase() || host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.includes('..')) fail('无效主机或关键词');
    if (type !== 'DOMAIN-KEYWORD' && (host.split('.').length < 2 || host.split('.').some((s) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s)))) fail('无效域名');
    if (seen.has(type + ',' + host)) fail('出现重复规则'); seen.add(type + ',' + host);
    rules.push({ type, host, sourceLine: i + 1 });
  }
  if (metadata.name !== 'AWAvenue Ads Rule' || metadata.author !== 'TG-Twilight[https://github.com/TG-Twilight]' || metadata.homepage !== 'https://awavenue.top' || !metadata.desc?.includes('Update time:') || rules.length < 500 || rules.length > 1000) fail('应用身份、来源结构或规则规模未通过校验');
  const selected = [], excluded = [];
  for (const rule of rules) {
    const protectedHosts = Object.keys(EXCLUSIONS).filter((h) => overlapsExclusion(rule, h));
    if (protectedHosts.length) { excluded.push({ ...rule, protectedHosts }); continue; }
    // New or broadened suffix/keyword rules require human review; new exact ad hosts can sync.
    if (rule.type === 'DOMAIN-SUFFIX' && !SUFFIXES.has(rule.host) || rule.type === 'DOMAIN-KEYWORD' && !KEYWORDS.has(rule.host)) fail(`后缀或关键词范围变化：${rule.type},${rule.host}`);
    if ([...BUSINESS_HOSTS, ...SHARED_HOSTS].some((h) => overlapsExclusion(rule, h)) || /(?:^|\.)tnc[0-9*-]/.test(rule.host) || /(?:^|[.-])httpdns(?:[.-]|$)/.test(rule.host)) fail(`新增业务或共享接口拦截需审查：${rule.host}`);
    selected.push(rule);
  }
  if (selected.length < 450 || selected.length < rules.length * 0.8) fail('过滤后的规则数量异常');
  return { metadata, rules, selected, excluded };
}
export function renderModule(source, parsed) {
  return [
    '#!name=秋风广告拦截（Only.Ads兼容版）',
    '#!desc=基于TG-Twilight秋风Only.Ads的通用广告域名拦截，搭配本仓库App专用模块使用。排除ad.12306.cn、optimus-ads.amap.com、sdkapp.uve.weibo.com及头条授权open.snssdk.com，避免抢占12306、高德、微博专用处理和头条授权。每6小时检查上游，构建过滤冲突项；新增后缀/关键词范围或敏感共享接口需先审查。仅原生域名REJECT，无脚本、MITM或会员修改；需Surge iOS 5.14+ / Mac 5.9+。不与秋风原版、其他秋风方案或多份通用大列表重复启用。仍会拦截部分广告SDK与统计域名，未保证所有App兼容；异常时先停用此模块。尚未手机实测。',
    '#!author=TG-Twilight（秋风原规则）；wch19830910/wch（兼容调整）',
    '#!category=AdBlock', '#!homepage=https://github.com/TG-Twilight/AWAvenue-Ads-Rule',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/AWAvenue.sgmodule', '',
    '# SPDX-License-Identifier: GPL-3.0-only', '# 2026-10-28 修改声明：从Only.Ads排除冲突规则；其余通过审查的规则保留原顺序和选项。',
    `# 上游：${SOURCE_URL}`, `# 上游SHA256：${digest(source)}`,
    `# 来源${parsed.rules.length}条；保留${parsed.selected.length}条；排除${parsed.excluded.length}条。`,
    '# 排除不是强制DIRECT：被排除请求继续按你已有配置分流。pre-matching拒绝不能靠普通DIRECT或调整模块顺序覆盖。',
    '# 许可、原始快照、构建与测试源码随仓库公开；无任何保证。',
    '# 许可：https://github.com/wch19830910/wch/blob/main/Surge/licenses/AWAvenue-GPL-3.0.txt',
    '# 说明：https://github.com/wch19830910/wch/blob/main/Surge/AdBlock/AWAvenue.md',
    ...Object.entries(EXCLUSIONS).map(([host, reason]) => `# 排除 ${host}：${reason}`), '', '[Rule]',
    ...parsed.selected.map(({ type, host }) => `${type},${host},REJECT,extended-matching,pre-matching`), '',
  ].join('\n');
}
export function renderReferences(source, parsed) {
  return JSON.stringify({ schemaVersion: 1, source: { url: SOURCE_URL, sha256: digest(source), metadata: parsed.metadata }, license: { url: LICENSE_URL, sha256: LICENSE_SHA256, spdx: 'GPL-3.0-only' }, counts: { source: parsed.rules.length, selected: parsed.selected.length, excluded: parsed.excluded.length }, protectedHosts: EXCLUSIONS, excludedRules: parsed.excluded, policy: '仅使用Only.Ads；排除规则语义覆盖冲突主机的条目；新后缀/关键词及敏感共享接口需人工审查；不强制DIRECT、不合并其他通用列表；不代表手机实测或零误伤。' }, null, 2) + '\n';
}
async function download(url, maxBytes) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Surge' } });
  if (!response.ok || response.url !== url) fail(`下载失败或跳转HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > maxBytes) fail('来源过大');
  const body = await response.text();
  if (!body.trim() || Buffer.byteLength(body) > maxBytes || /^\s*(?:<!doctype\s+html|<html\b)/i.test(body)) fail('空文件、过大或返回网页');
  return body;
}
async function writeIfChanged(path, body) {
  let previous; try { previous = await readFile(path, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (previous === body) return;
  await mkdir(dirname(path), { recursive: true }); const temporary = path + '.tmp-' + process.pid;
  await writeFile(temporary, body, 'utf8'); await rename(temporary, path);
}
export async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('用法：node Surge/scripts/build-awavenue.mjs [--check]');
  const [source, license] = await Promise.all([download(SOURCE_URL, 1024 * 1024), download(LICENSE_URL, 100_000)]);
  if (digest(license) !== LICENSE_SHA256 || digest(await readFile(resolve(ROOT, 'licenses/AWAvenue-GPL-3.0.txt'), 'utf8')) !== LICENSE_SHA256) fail('上游或本地许可变化需审查');
  const parsed = parseSource(source), bodies = [renderModule(source, parsed), source, renderReferences(source, parsed)];
  console.log(`秋风兼容检查通过：${parsed.rules.length}条来源，保留${parsed.selected.length}条，排除${parsed.excluded.length}条；4个冲突主机不再拦截。`);
  if (process.argv.includes('--check')) { console.log('只检查，不写入。'); return; }
  for (const [i, body] of bodies.entries()) await writeIfChanged(OUTPUTS[i], body);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main().catch((e) => { console.error(e.message); process.exitCode = 1; });
