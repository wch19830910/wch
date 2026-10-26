#!/usr/bin/env node
// Synthetic scope and publication checks. No RiskBird business API or source script is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { SOURCE_URL, parseSource, renderModule, renderSources, main } from '../scripts/build-riskbird.mjs';

const OUTPUTS = [new URL('../AdBlock/RiskBird.sgmodule', import.meta.url), new URL('../upstream/RiskBird.sources.json', import.meta.url)];
const moduleSource = await readFile(OUTPUTS[0], 'utf8');
const SURGE_CLI = '/Applications/Surge.app/Contents/Applications/surge-cli';

// Minimal, fixed configuration facts independently taken from the reviewed public source.
// The excluded JavaScript appears only as a URL, never as executable source.
const SOURCE_FIXTURE = String.raw`#!name=风鸟去广告
#!author=可莉🅥[https://github.com/luestr/ProxyResource/blob/main/README.md]
#!openUrl=https://apps.apple.com/app/id1528682937
#!homepage=https://hub.kelee.one
#!date=2025-05-13 15:17:08
#!desc=移除首页信息流和轮播图

[Map Local]
^https:\/\/m\.riskbird\.com\/prod-qbb-api\/user\/getBannerList data-type=text data="{}" status-code=200 header="Content-Type:application/json"
^https:\/\/m\.riskbird\.com\/prod-qbb-api\/searchHotEnt data-type=text data="{}" status-code=200 header="Content-Type:application/json"
[Script]
移除推荐老板 = type=http-response, pattern=^https:\/\/m\.riskbird\.com\/prod-qbb-api\/query\/person\/personRecommend, script-path=https://kelee.one/Resource/JavaScript/RiskBird/RiskBird_remove_ads.js, requires-body=true
[MITM]
hostname = %APPEND% m.riskbird.com
`;

function sections(source = moduleSource) {
  const result = new Map();
  let current;
  for (const original of source.split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) { current = heading[1]; assert.ok(!result.has(current), `duplicate section ${current}`); result.set(current, []); }
    else { assert.ok(current, 'configuration needs a section'); result.get(current).push(line); }
  }
  return result;
}
const configuration = sections();
const mapLines = configuration.get('Map Local') || [];
const patterns = mapLines.map((line) => new RegExp(line.match(/^(\S+)/)[1]));
const matches = (url) => patterns.filter((pattern) => pattern.test(url)).length;

async function outputSnapshot() {
  return Promise.all(OUTPUTS.map(async (url) => ({ body: await readFile(url), mtime: (await stat(url)).mtimeMs })));
}
async function assertUnchanged(before) {
  for (const [index, url] of OUTPUTS.entries()) {
    assert.ok((await readFile(url)).equals(before[index].body), `${url.pathname}: published contents changed`);
    assert.equal((await stat(url)).mtimeMs, before[index].mtime, `${url.pathname}: modification time changed`);
  }
}
function sourceResponse(body = SOURCE_FIXTURE, options = {}) {
  return { ok: true, status: 200, url: SOURCE_URL, headers: new Headers(), text: async () => body, ...options };
}

test('native module has two empty JSON responses, one exact MITM host and no script or domain rejection', () => {
  assert.match(moduleSource, /^#!name=风鸟（首页广告与推荐精简）$/m);
  assert.match(moduleSource, /可莉|iKeLee/);
  assert.equal(mapLines.length, 2);
  assert.equal(new Set(mapLines).size, 2);
  for (const line of mapLines) {
    assert.match(line, / data-type=text data="\{\}" status-code=200 header="Content-Type:application\/json"$/);
    assert.deepEqual(JSON.parse(line.match(/\bdata="([^"]+)"/)[1]), {});
  }
  assert.deepEqual([...configuration.keys()].sort(), ['MITM', 'Map Local'].sort());
  assert.deepEqual(configuration.get('MITM'), ['hostname = %APPEND% m.riskbird.com']);
  assert.ok(!moduleSource.includes('script-path='));
});

test('routing: homepage banners and hot enterprises match exactly once with or without query parameters', () => {
  for (const path of ['/prod-qbb-api/user/getBannerList', '/prod-qbb-api/searchHotEnt']) {
    for (const query of ['', '?page=1&test=synthetic']) assert.equal(matches(`https://m.riskbird.com${path}${query}`), 1, path + query);
  }
});

test('routing: normal search, person recommendations, account, purchase and similar paths stay untouched', () => {
  const urls = [
    'http://m.riskbird.com/prod-qbb-api/user/getBannerList',
    'ftp://m.riskbird.com/prod-qbb-api/searchHotEnt',
    'https://m.riskbird.com.example.org/prod-qbb-api/user/getBannerList',
    'https://mxriskbirdxcom/prod-qbb-api/searchHotEnt',
    'https://riskbird.com/prod-qbb-api/searchHotEnt',
    'https://example.org/prod-qbb-api/searchHotEnt',
    'https://m.riskbird.com/prod-qbb-api/user/getBannerListExtra',
    'https://m.riskbird.com/prod-qbb-api/user/getBannerList/extra',
    'https://m.riskbird.com/prod-qbb-api/searchHotEnterprise',
    'https://m.riskbird.com/prod-qbb-api/searchHotEnt/extra',
    'https://m.riskbird.com/prod-qbb-api/user/login',
    'https://m.riskbird.com/prod-qbb-api/user/profile',
    'https://m.riskbird.com/prod-qbb-api/query/person/personRecommend',
    'https://m.riskbird.com/prod-qbb-api/query/person/personRecommend?page=1',
    'https://m.riskbird.com/prod-qbb-api/query/person/detail?id=synthetic',
    'https://m.riskbird.com/prod-qbb-api/search?keyword=synthetic',
    'https://m.riskbird.com/prod-qbb-api/search/company?keyword=synthetic',
    'https://m.riskbird.com/prod-qbb-api/query/enterprise/detail?id=synthetic',
    'https://m.riskbird.com/prod-qbb-api/user/myBanner',
    'https://m.riskbird.com/prod-qbb-api/user/vip',
    'https://m.riskbird.com/prod-qbb-api/order/create',
    'https://m.riskbird.com/prod-qbb-api/pay/order',
  ];
  for (const url of urls) assert.equal(matches(url), 0, url);
});

test('source selection keeps the excluded recommendation route only as a reference, never as active configuration', () => {
  const parsed = parseSource(SOURCE_FIXTURE);
  const rendered = renderModule(SOURCE_FIXTURE, parsed);
  const references = JSON.parse(renderSources(SOURCE_FIXTURE, parsed));
  assert.equal((sections(rendered).get('Map Local') || []).length, 2);
  assert.ok(!sections(rendered).has('Script'));
  assert.ok(!sections(rendered).has('Rule'));
  assert.ok(!rendered.split(/\r?\n/).filter((line) => !line.trim().startsWith('#')).join('\n').includes('personRecommend'));
  assert.ok(JSON.stringify(references).includes('personRecommend'));
  assert.ok(JSON.stringify(references).includes('RiskBird_remove_ads.js'));
});

test('source guard rejects changed scope, hosts, actions, executable entries and unknown sections', () => {
  assert.doesNotThrow(() => parseSource(SOURCE_FIXTURE));
  const mutations = [
    SOURCE_FIXTURE.replace('m\\.riskbird\\.com', '.*\\.riskbird\\.com'),
    SOURCE_FIXTURE.replace('/prod-qbb-api\\/user\\/getBannerList', '/prod-qbb-api\\/'),
    SOURCE_FIXTURE.replace('hostname = %APPEND% m.riskbird.com', 'hostname = %APPEND% *.riskbird.com'),
    SOURCE_FIXTURE.replace('data="{}"', 'data="[]"'),
    SOURCE_FIXTURE.replace('status-code=200', 'status-code=302'),
    SOURCE_FIXTURE.replace('RiskBird_remove_ads.js', 'new-handler.js'),
    SOURCE_FIXTURE.replace('[MITM]', 'extra = type=http-response, pattern=^https://m.riskbird.com, script-path=https://example.org/new.js\n[MITM]'),
    `${SOURCE_FIXTURE}\n[Rule]\nDOMAIN-SUFFIX,riskbird.com,REJECT\n`,
    `${SOURCE_FIXTURE}\n[Host]\nm.riskbird.com = 127.0.0.1\n`,
  ];
  for (const mutation of mutations) {
    assert.notEqual(mutation, SOURCE_FIXTURE, 'the guard fixture must actually change');
    assert.throws(() => parseSource(mutation));
  }
});

test('download failure retains both published output files and their modification times', async () => {
  const before = await outputSnapshot();
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('synthetic RiskBird source unavailable'); };
  try { await assert.rejects(() => main(), /synthetic RiskBird source unavailable/); }
  finally { globalThis.fetch = savedFetch; }
  await assertUnchanged(before);
});

test('HTML, redirect and changed upstream responses fail before either output is written', async () => {
  const before = await outputSnapshot();
  const savedFetch = globalThis.fetch;
  try {
    for (const response of [sourceResponse('<html>not a module</html>'), sourceResponse(SOURCE_FIXTURE, { url: 'https://example.org/unreviewed' }), sourceResponse(SOURCE_FIXTURE.replace('status-code=200', 'status-code=500'))]) {
      globalThis.fetch = async () => response;
      await assert.rejects(() => main());
      await assertUnchanged(before);
    }
  } finally { globalThis.fetch = savedFetch; }
});

test('check-only mode validates allowed metadata changes without writing contents or timestamps', async () => {
  const before = await outputSnapshot();
  const changed = SOURCE_FIXTURE.replace('移除首页信息流和轮播图', 'synthetic metadata change');
  assert.notEqual(changed, SOURCE_FIXTURE);
  const savedFetch = globalThis.fetch, savedArgv = process.argv;
  globalThis.fetch = async () => sourceResponse(changed);
  process.argv = [...savedArgv, '--check'];
  try { await main(); }
  finally { globalThis.fetch = savedFetch; process.argv = savedArgv; }
  await assertUnchanged(before);
});

test('native Surge CLI accepts a complete temporary profile containing the module', { skip: !existsSync(SURGE_CLI) && 'Surge CLI is not installed on this host' }, async () => {
  const profile = moduleSource.replace(/hostname\s*=\s*%APPEND%\s*/g, 'hostname = ') + '\n[Rule]\nFINAL,DIRECT\n';
  const directory = await mkdtemp(join(tmpdir(), 'riskbird-profile-'));
  const path = join(directory, 'profile.conf');
  try {
    await writeFile(path, profile, 'utf8');
    const result = spawnSync(SURGE_CLI, ['--check', path], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /OK/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
