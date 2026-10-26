#!/usr/bin/env node
// Synthetic regression checks; no Douyin/SodaMusic business API is requested.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, stat, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SOURCE_URL, parseSource, renderModule, main } from '../scripts/build-soda-music.mjs';
const moduleURL = new URL('../AdBlock/SodaMusic.sgmodule', import.meta.url);
const sourceURL = new URL('../upstream/QiShuiMusicAds.conf', import.meta.url);
const source = await readFile(sourceURL, 'utf8'), module = await readFile(moduleURL, 'utf8');
const maps = module.split('\n').filter((line) => line.startsWith('^https:'));
const bodies = module.split('\n').filter((line) => line.startsWith('http-response-jq '));
const rules = [...maps.map((line) => line.split(' ')[0]), ...bodies.map((line) => line.split(' ')[1])].map((pattern) => new RegExp(pattern));
const paths = ['/luna/media_ads', '/luna/ads', '/luna/commerce', '/luna/hashtag/recommend', '/luna/me', '/luna/card', '/luna/search-block', '/luna/activities', '/luna/feed/song-tab'];
const matches = (url) => rules.filter((rule) => rule.test(url)).length;
const outputs = [moduleURL, sourceURL];
async function snapshot() { return Promise.all(outputs.map(async (url) => ({ body: await readFile(url), mtime: (await stat(url)).mtimeMs }))); }
async function unchanged(before) { for (const [i, url] of outputs.entries()) { assert.ok((await readFile(url)).equals(before[i].body)); assert.equal((await stat(url)).mtimeMs, before[i].mtime); } }
function response(text, overrides = {}) { return { ok: true, status: 200, url: SOURCE_URL, headers: new Headers(), text: async () => text, ...overrides }; }

test('published module is reproducible and limits MITM to two exact SodaMusic hosts', () => {
  assert.equal(module, renderModule(source, parseSource(source)));
  assert.equal(maps.length, 4); assert.equal(bodies.length, 5);
  assert.equal(module.match(/^hostname = .*$/m)?.[0], 'hostname = %APPEND% beta-luna.douyin.com, api.qishui.com');
  assert.deepEqual(module.match(/^\[[^\]]+\]$/gm), ['[Map Local]', '[Body Rewrite]', '[MITM]']);
  assert.ok(!module.includes('script-path='));
  for (const line of maps) assert.ok(line.endsWith(' data-type=text data="" status-code=200'));
});
test('nine reviewed endpoints still match once on both allowed hosts, with and without queries', () => {
  for (const host of ['beta-luna.douyin.com', 'api.qishui.com']) for (const path of paths) for (const query of ['', '?synthetic=1']) assert.equal(matches(`https://${host}${path}${query}`), 1, host + path + query);
});
test('Douyin/shared-host traffic and comment, domain-config, location endpoints are not intercepted', () => {
  const hosts = ['www.douyin.com', 'aweme.snssdk.com', 'api.amemv.com', 'tnc3-alisc1.zijieapi.com', 'tnc.example.zijieapi.com', 'example.org', 'api.qishui.com.example.org', 'beta-luna.douyin.com.example.org'];
  for (const host of hosts) for (const path of [...paths, '/get_domains', '/location/info', '/aweme/v1/comment/list/', '/aweme/v1/comment/list/reply/']) assert.equal(matches(`https://${host}${path}?synthetic=1`), 0, host + path);
  for (const host of ['api.qishui.com', 'beta-luna.douyin.com']) for (const path of ['/get_domains', '/location/info', '/aweme/v1/comment/list/', '/luna/comment/list', '/luna/user/login', '/luna/pay/order', '/luna/song/detail']) assert.equal(matches(`https://${host}${path}?synthetic=1`), 0, host + path);
});
test('path suffixes, subpaths, HTTP and lookalike hosts are not matched', () => {
  for (const path of paths) for (const url of [`http://api.qishui.com${path}`, `https://api.qishui.com${path}Extra`, `https://api.qishui.com${path}/extra`, `https://x.api.qishui.com${path}`, `https://apiXqishuiXcom${path}`]) assert.equal(matches(url), 0, url);
});
test('native JQ preserves unrelated data while removing only selected fields and feed promotions', () => {
  const samples = [
    { reward_ad_banner: { ad: 1 }, keep: 1 }, { preview_guide: { ad: 1 }, keep: 2 },
    { search_chart_block: { ad: 1 }, keep: 3 }, { activity_map: { ad: 1 }, keep: 4 },
    { items: [{ type: 'track', id: 1 }, { type: 'ad', id: 2 }, { type: 'track', id: 3 }], keep: 5 },
  ];
  for (const [index, line] of bodies.entries()) {
    const expr = line.slice(line.indexOf(" '") + 2, -1);
    const result = spawnSync('jq', ['-c', expr], { input: JSON.stringify(samples[index]), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), index === 4 ? { items: [{ type: 'track', id: 1 }, { type: 'track', id: 3 }], keep: 5 } : { keep: index + 1 });
  }
});
test('unknown upstream host, path, action, JQ and additional rule are rejected', () => {
  const mutations = [
    source.replace('tnc*-*.zijieapi.com', '*.douyin.com'), source.replace('media_ads', 'media_ads_new'),
    source.replace('url reject-200', 'url reject'), source.replace('del(.preview_guide)', 'del(.account)'),
    source + '\n^https:\\/\\/example\\.org\\/ad url reject-200\n',
  ];
  for (const changed of mutations) assert.throws(() => parseSource(changed), /保留旧成品/);
});
test('failed or changed downloads preserve module and source bytes and modification times; check mode never writes', async () => {
  const before = await snapshot(), savedFetch = globalThis.fetch, savedArgv = process.argv;
  process.argv = savedArgv.slice(0, 2);
  try {
    for (const mock of [async () => { throw new Error('synthetic network failure'); }, async () => response('<html>failure</html>'), async () => response(source, { url: 'https://example.org/redirect' }), async () => response(source, { ok: false, status: 403 }), async () => response(source.replace('media_ads', 'unknown_path'))]) {
      globalThis.fetch = mock; await assert.rejects(main()); await unchanged(before);
    }
    globalThis.fetch = async () => response(source.replace('@Version           V1.0.6', '@Version           V1.0.7'));
    process.argv = [...savedArgv.slice(0, 2), '--check']; await main(); await unchanged(before);
  } finally { globalThis.fetch = savedFetch; process.argv = savedArgv; }
});
const CLI = '/Applications/Surge.app/Contents/Applications/surge-cli';
test('Surge native CLI accepts the complete temporary profile', { skip: !existsSync(CLI) && 'Surge CLI not installed on this host' }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'soda-music-regression-')), path = join(folder, 'profile.conf');
  try {
    await writeFile(path, module.replace('hostname = %APPEND% ', 'hostname = ') + '\n[Rule]\nFINAL,DIRECT\n');
    const result = spawnSync(CLI, ['--check', path], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message); assert.match(result.stdout, /OK/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
