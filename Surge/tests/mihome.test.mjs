#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Synthetic routing and publication protection checks; no Mi Home account/API access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseSource, main } from '../scripts/build-mihome.mjs';

const SOURCE_URL = 'https://raw.githubusercontent.com/fmz200/wool_scripts/main/Surge/module/split/partM/Mijia.sgmodule';
const OUTPUTS = [new URL('../AdBlock/MiHome.sgmodule', import.meta.url), new URL('../upstream/MiHome.sgmodule', import.meta.url)];
const [moduleSource, upstreamSource] = await Promise.all(OUTPUTS.map((url) => readFile(url, 'utf8')));
const SURGE_CLI = '/Applications/Surge.app/Contents/Applications/surge-cli';

function sectionLines(sectionName) {
  let section;
  const result = [];
  for (const original of moduleSource.split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) { section = heading[1]; continue; }
    if (section === sectionName) result.push(line);
  }
  return result;
}

const localPatterns = sectionLines('Map Local').map((line) => new RegExp(line.match(/^(\S+)/)[1]));
const isLocal = (url) => localPatterns.some((pattern) => pattern.test(url));
async function snapshot() {
  return Promise.all(OUTPUTS.map(async (url) => ({ body: await readFile(url), mtime: (await stat(url)).mtimeMs })));
}
async function unchanged(before) {
  for (const [index, url] of OUTPUTS.entries()) {
    assert.ok((await readFile(url)).equals(before[index].body), `${url.pathname}: published bytes changed`);
    assert.equal((await stat(url)).mtimeMs, before[index].mtime, `${url.pathname}: modification time changed`);
  }
}

test('scope: opening banners and the four advertised recommendation slots receive local responses', () => {
  const paths = [
    '/cgi-op/api/v1/recommendation/banner',
    '/cgi-op/api/v1/recommendation/carousel/banners',
    '/cgi-op/api/v1/recommendation/myTab',
    '/cgi-op/api/v1/recommendation/openingBanner',
    '/cgi-op/api/v1/resource/realtime/openingBanner',
  ];
  for (const scheme of ['http', 'https']) {
    for (const path of paths) {
      assert.ok(isLocal(`${scheme}://home.mi.com${path}`), path);
      assert.ok(isLocal(`${scheme}://home.mi.com${path}?locale=zh_CN`), `${path} query`);
    }
  }
});

test('scope: device, camera, automation, login and unrelated host requests are not mocked', () => {
  const untouched = [
    'https://home.mi.com/cgi-op/api/v1/device/control',
    'https://home.mi.com/cgi-op/api/v1/device/list',
    'https://home.mi.com/cgi-op/api/v1/camera/live',
    'https://home.mi.com/cgi-op/api/v1/automation/run',
    'https://home.mi.com/cgi-op/api/v1/user/login',
    'https://home.mi.com/cgi-op/api/v1/recommendation/devices',
    'https://api.io.mi.com/app/home/device_list',
    'https://account.xiaomi.com/pass/serviceLogin',
    'https://home.mi.com.example.org/cgi-op/api/v1/recommendation/banner',
    'https://example.org/cgi-op/api/v1/recommendation/banner',
    'ftp://home.mi.com/cgi-op/api/v1/recommendation/banner',
  ];
  for (const url of untouched) assert.ok(!isLocal(url), url);
  assert.deepEqual(sectionLines('Rule'), ['DOMAIN,sdkconfig.ad.xiaomi.com,REJECT']);
  assert.deepEqual(sectionLines('MITM'), ['hostname = %APPEND% home.mi.com']);
});

test('native response: empty JSON uses the correct content type and no remote script dependencies', () => {
  assert.match(moduleSource, /^#!name=米家（开屏与推荐去广告）$/m);
  assert.match(moduleSource, /fmz200|奶思/);
  assert.equal(sectionLines('Map Local').length, 2);
  for (const line of sectionLines('Map Local')) {
    assert.match(line, / data-type=text data="\{\}" status-code=200 header="Content-Type:application\/json"$/);
    assert.deepEqual(JSON.parse(line.match(/ data="([^"]+)"/)[1]), {});
  }
  assert.deepEqual(sectionLines('Script'), []);
  assert.deepEqual(sectionLines('Body Rewrite'), []);
  assert.deepEqual(sectionLines('URL Rewrite'), []);
  assert.ok(!moduleSource.includes('script-path='));
});

test('update guard: expanded domains, API scope, response actions and executable sections need review', () => {
  assert.doesNotThrow(() => parseSource(upstreamSource));
  const mutations = [
    upstreamSource.replace('DOMAIN,sdkconfig.ad.xiaomi.com,REJECT', 'DOMAIN-SUFFIX,xiaomi.com,REJECT'),
    upstreamSource.replace('hostname = %APPEND% home.mi.com', 'hostname = %APPEND% *.mi.com'),
    upstreamSource.replace('home\\.mi\\.com', '.*\\.mi\\.com'),
    upstreamSource.replace('data="{}"', 'data="[]"'),
    upstreamSource.replace('status-code=200', 'status-code=302'),
    `${upstreamSource}\n[Script]\nextra = type=http-response,pattern=^https://home.mi.com,script-path=https://example.org/extra.js\n`,
    upstreamSource.replace('[Rule]', '[Rule]\nDOMAIN,api.io.mi.com,REJECT'),
  ];
  for (const mutation of mutations) {
    assert.notEqual(mutation, upstreamSource, 'the fixture must actually modify the source');
    assert.throws(() => parseSource(mutation));
  }
});

test('download failure retains the previous module and snapshot bytes and modification times', async () => {
  const before = await snapshot();
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('synthetic MiHome source unavailable'); };
  try { await assert.rejects(() => main(), /synthetic MiHome source unavailable/); }
  finally { globalThis.fetch = savedFetch; }
  await unchanged(before);
});

test('check-only mode validates changed metadata without writing the previous release', async () => {
  const before = await snapshot();
  const source = upstreamSource.replace(/^#!desc=.*$/m, '#!desc=synthetic upstream metadata change');
  assert.notEqual(source, upstreamSource);
  const savedFetch = globalThis.fetch;
  const savedArgv = process.argv;
  globalThis.fetch = async () => ({ ok: true, status: 200, url: SOURCE_URL, headers: new Headers(), text: async () => source });
  process.argv = [...savedArgv, '--check'];
  try { await main(); }
  finally { globalThis.fetch = savedFetch; process.argv = savedArgv; }
  await unchanged(before);
});

test('native Surge CLI accepts the module as a complete temporary profile', { skip: !existsSync(SURGE_CLI) && 'Surge CLI is not installed on this host' }, async () => {
  const profile = moduleSource.replace(/hostname\s*=\s*%APPEND%\s*/g, 'hostname = ').replace('[Rule]', '[Rule]\nFINAL,DIRECT');
  const directory = await mkdtemp(join(tmpdir(), 'mihome-profile-'));
  const path = join(directory, 'profile.conf');
  try {
    await writeFile(path, profile, 'utf8');
    const result = spawnSync(SURGE_CLI, ['--check', path], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /OK/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
