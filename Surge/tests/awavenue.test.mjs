#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Synthetic compatibility checks; never requests App business endpoints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, stat, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SOURCE_URL, LICENSE_URL, parseSource, renderModule, renderReferences, main } from '../scripts/build-awavenue.mjs';
const outputs = ['../AdBlock/AWAvenue.sgmodule', '../upstream/AWAvenue-OnlyAds.sgmodule', '../upstream/AWAvenue.sources.json'].map((p) => new URL(p, import.meta.url));
const module = await readFile(outputs[0], 'utf8'), source = await readFile(outputs[1], 'utf8'), license = await readFile(new URL('../licenses/AWAvenue-GPL-3.0.txt', import.meta.url), 'utf8');
const lines = module.split('\n').filter((line) => line && !line.startsWith('#') && !line.startsWith('['));
const rules = lines.map((line) => { const [type, host] = line.split(','); return { type, host }; });
const protectedHosts = ['ad.12306.cn', 'optimus-ads.amap.com', 'sdkapp.uve.weibo.com', 'open.snssdk.com'];
// Independent interpretation of the three supported native domain rule types.
function hits(host, list = rules) { return list.filter((r) => r.type === 'DOMAIN' ? host === r.host : r.type === 'DOMAIN-SUFFIX' ? ('.' + host).endsWith('.' + r.host) : host.indexOf(r.host) !== -1); }
async function snapshot() { return Promise.all(outputs.map(async (p) => ({ data: await readFile(p), mtime: (await stat(p)).mtimeMs }))); }
async function unchanged(before) { for (const [i, p] of outputs.entries()) { assert.ok((await readFile(p)).equals(before[i].data)); assert.equal((await stat(p)).mtimeMs, before[i].mtime); } }
const nativeRule = (type, host) => `${type},${host},REJECT,extended-matching,pre-matching`;
const response = (url, body, extra = {}) => ({ ok: true, status: 200, url, headers: new Headers(), text: async () => body, ...extra });

test('module and reference record reproduce from the published source and retain attribution/license', async () => {
 const parsed = parseSource(source); assert.equal(module, renderModule(source, parsed));
 assert.equal(await readFile(outputs[2], 'utf8'), renderReferences(source, parsed));
 assert.equal(parsed.rules.length - parsed.selected.length, parsed.excluded.length);
 assert.match(module, /TG-Twilight/); assert.match(module, /GPL-3.0-only/); assert.match(license, /GNU GENERAL PUBLIC LICENSE/);
 for (const host of protectedHosts) assert.deepEqual(hits(host, parsed.selected), []);
});
test('native output contains only unique REJECT domain rules; no DIRECT, IP block, script, MITM or remote rule chain', () => {
 assert.deepEqual(module.match(/^\[[^\]]+\]$/gm), ['[Rule]']);
 assert.equal(new Set(lines).size, lines.length);
 for (const line of lines) assert.match(line, /^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD),[a-z0-9.-]+,REJECT,extended-matching,pre-matching$/);
 assert.ok(!module.includes('script-path='));
});
test('all four conflicting hosts and ordinary subdomains stay outside generated rejection rules', () => {
 for (const host of protectedHosts) for (const name of [host, 'static.' + host]) assert.deepEqual(hits(name), [], name);
});
test('known exact, suffix and keyword ads remain blocked while lookalike exact hosts do not match', () => {
 for (const host of ['ad.doubleclick.net', 'ads3-normal.zijieapi.com', 'child.adsmoloco.com', 'a-ad.sm.cn']) assert.ok(hits(host).length, host);
 assert.deepEqual(hits('ad.doubleclick.net.example.org'), []);
 const parsed = parseSource(source); assert.deepEqual(lines, parsed.selected.map((r) => nativeRule(r.type, r.host)));
});
test('Douyin/SodaMusic, login, notification and existing App business host samples are not directly rejected', () => {
 for (const host of ['www.douyin.com', 'aweme.snssdk.com', 'api.amemv.com', 'beta-luna.douyin.com', 'api.qishui.com', 'tnc3-alisc1.bytedance.com', 'tnc3-alisc1.zijieapi.com', 'httpdns.music.163.com', 'jpush.cn', 'jpush.io', 'getui.cn', 'getui.com', 'getui.net', 'tpns.qq.com', 'openinstall.com', 'mp.weixin.qq.com', 'ucmp.sf-express.com', 'api.blibee.com', 'acs.m.taobao.com', 'acs-m.freshippo.com', 'acs.m.goofish.com', 'g-acs.m.goofish.com', 'home.mi.com', 'api.zhihu.com', 'interface.music.163.com', 'tiebac.baidu.com', 'c.tieba.baidu.com', 'app-api.smzdm.com', 'm.riskbird.com', 'm5.amap.com', 'api.coolapk.com']) assert.deepEqual(hits(host), [], host);
});
test('new exact/suffix/keyword entries that cover protected hosts are filtered semantically, not by string deletion', () => {
 for (const line of [nativeRule('DOMAIN-SUFFIX', '12306.cn'), nativeRule('DOMAIN-SUFFIX', 'weibo.com'), nativeRule('DOMAIN-KEYWORD', 'snssdk'), nativeRule('DOMAIN', 'child.ad.12306.cn')]) {
  const parsed = parseSource(source + '\n' + line + '\n');
  assert.ok(parsed.excluded.length > parseSource(source).excluded.length);
  for (const host of protectedHosts) assert.deepEqual(hits(host, parsed.selected), [], host);
 }
});
test('new exact ad hosts can update; expanded suffix/keyword rules, shared interfaces and unknown syntax stop', () => {
 assert.ok(parseSource(source + '\n' + nativeRule('DOMAIN', 'synthetic-ad.example.org')).selected.some((r) => r.host === 'synthetic-ad.example.org'));
 const changes = [
  source + '\n' + nativeRule('DOMAIN-SUFFIX', 'new-ad-network.example.org'), source + '\n' + nativeRule('DOMAIN-KEYWORD', 'new-ad-keyword'),
  source + '\n' + nativeRule('DOMAIN', 'tnc3-alisc1.bytedance.com'), source + '\n' + nativeRule('DOMAIN', 'httpdns.example.org'),
  source + '\n' + nativeRule('DOMAIN', 'mp.weixin.qq.com'), source + '\n' + nativeRule('DOMAIN', 'b-gtc.getui.net'), source + '\n[Script]\n',
  source.replace(',REJECT,extended-matching,pre-matching', ',DIRECT'), source.replace('TG-Twilight[', 'unknown['),
  source + '\n' + lines[0], source + '\n' + nativeRule('DOMAIN', 'bad..example.org'),
 ];
 for (const changed of changes) assert.throws(() => parseSource(changed), /保留旧成品/);
});
test('no native DIRECT host in the existing Amap/12306/Weibo modules is rejected', async () => {
 for (const file of ['Amap', 'Railway12306', 'Weibo']) {
  const s = await readFile(new URL(`../AdBlock/${file}.sgmodule`, import.meta.url), 'utf8');
  for (const line of s.split('\n')) {
   const p = line.split(',').map((x) => x.trim());
   if (p[2] === 'DIRECT' && ['DOMAIN', 'DOMAIN-SUFFIX'].includes(p[0])) assert.deepEqual(hits(p[1]), [], file + ':' + line);
  }
 }
});
test('network/HTML/redirect/license/source failures preserve all output bytes and mtimes; check never writes', async () => {
 const before = await snapshot(), savedFetch = globalThis.fetch, savedArgv = process.argv;
 process.argv = savedArgv.slice(0, 2);
 try {
  for (const bad of ['network', 'html', 'redirect', '403', 'license', 'source']) {
   globalThis.fetch = async (url) => {
    if (bad === 'network') throw new Error('synthetic outage');
    if (url === LICENSE_URL) return response(url, bad === 'license' ? 'changed license' : license);
    if (bad === 'html') return response(url, '<html>failure</html>');
    if (bad === 'redirect') return response(url, source, { url: 'https://example.org' });
    if (bad === '403') return response(url, '', { ok: false, status: 403 });
    return response(url, bad === 'source' ? source + '\n[MITM]\n' : source);
   };
   await assert.rejects(main()); await unchanged(before);
  }
  globalThis.fetch = async (url) => response(url, url === LICENSE_URL ? license : source + '\n' + nativeRule('DOMAIN', 'synthetic-ad.example.org'));
  process.argv = [...savedArgv.slice(0, 2), '--check']; await main(); await unchanged(before);
 } finally { globalThis.fetch = savedFetch; process.argv = savedArgv; }
});
const CLI = '/Applications/Surge.app/Contents/Applications/surge-cli';
test('Surge native CLI accepts the complete temporary profile', { skip: !existsSync(CLI) && 'Surge CLI not installed on this host' }, async () => {
 const folder = await mkdtemp(join(tmpdir(), 'awavenue-compat-')), path = join(folder, 'profile.conf');
 try {
  await writeFile(path, module + '\n[Rule]\nFINAL,DIRECT\n');
  const result = spawnSync(CLI, ['--check', path], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message); assert.match(result.stdout, /OK/);
 } finally { await rm(folder, { recursive: true, force: true }); }
});
