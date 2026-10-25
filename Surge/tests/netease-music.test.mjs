#!/usr/bin/env node
// Local, offline regression fixtures for the repository's merged derivative.
// Downloaded author scripts must only be syntax-compiled, never executed here.
// Node crypto/zlib independently create and inspect the synthetic wire fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, webcrypto } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';
import { customizeNetEase } from '../scripts/netease-customize.mjs';

const MODULE_PATH = fileURLToPath(new URL('../AdBlock/NetEaseMusic.sgmodule', import.meta.url));
const SCRIPT_PATH = fileURLToPath(new URL('../Script/NetEaseMusic.js', import.meta.url));
const SURGE_CLI = '/Applications/Surge.app/Contents/Applications/surge-cli';
const moduleSource = await readFile(MODULE_PATH, 'utf8');
const scriptSource = await readFile(SCRIPT_PATH, 'utf8');
const scriptProgram = new Script(scriptSource, { filename: SCRIPT_PATH });
const EAPI_KEY = Buffer.from('e82ckenh8dichen8', 'ascii');
const clone = (value) => JSON.parse(JSON.stringify(value));
const CARD_OPTIONS = {
  hideGreeting: 'PAGE_RECOMMEND_GREETING',
  hideDailyRecommend: 'PAGE_RECOMMEND_DAILY_RECOMMEND',
  hidePlaylistRecommend: 'PAGE_RECOMMEND_SPECIAL_CLOUD_VILLAGE_PLAYLIST',
  hideRecentPlayed: 'PAGE_RECOMMEND_SHORTCUT',
  hideMusicPartner: 'HOMEPAGE_MUSIC_PARTNER',
  hideRadar: 'PAGE_RECOMMEND_RADAR',
  hideRanking: 'PAGE_RECOMMEND_RANK',
  hideMyPlaylist: 'PAGE_RECOMMEND_MY_SHEET',
  hideCombinationPlaylist: 'PAGE_RECOMMEND_COMBINATION',
};
const DEFAULTS = {
  hideDiscover: '0', hideRoam: '0', hideNotes: '0',
  ...Object.fromEntries(Object.keys(CARD_OPTIONS).map((name) => [name, '0'])),
  cleanCommentDecorations: '1', showNotFollowingBack: '0',
};

function metadataDefaults() {
  const declaration = moduleSource.match(/^#!arguments\s*=\s*(.+)$/m);
  assert.ok(declaration, 'merged module must declare its parameters');
  const result = {};
  for (const item of declaration[1].split(',')) {
    const match = item.trim().match(/^([A-Za-z][A-Za-z0-9_]*):\s*(0|1)$/);
    assert.ok(match, `expected an English parameter with a 0/1 default: ${item}`);
    assert.ok(!Object.hasOwn(result, match[1]), `duplicate parameter: ${match[1]}`);
    result[match[1]] = match[2];
  }
  return result;
}

function expandModule(overrides = {}) {
  const values = { ...metadataDefaults(), ...overrides };
  return moduleSource.replace(/\{\{\{([^{}]+)\}\}\}/g, (_, name) => {
    assert.ok(Object.hasOwn(values, name), `undeclared parameter: ${name}`);
    return String(values[name]);
  });
}

function scriptEntries(source) {
  const entries = [];
  let section;
  for (const original of source.split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) { section = heading[1]; continue; }
    if (section !== 'Script') continue;
    const declaration = line.match(/^([^=]+?)\s*=\s*(.+)$/);
    assert.ok(declaration, `bad script declaration: ${line}`);
    const parameters = {};
    // Delimit only actual parameter assignments, not a comma in a URL regex/JSON.
    for (const field of declaration[2].split(/,\s*(?=[A-Za-z][A-Za-z0-9_-]*\s*=)/)) {
      const pair = field.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.*)$/);
      assert.ok(pair, `bad script parameter: ${field}`);
      assert.ok(!Object.hasOwn(parameters, pair[1]), `duplicate script parameter: ${pair[1]}`);
      parameters[pair[1]] = pair[2];
    }
    entries.push({ name: declaration[1].trim(), parameters });
  }
  return entries;
}

function sectionLines(source, wanted) {
  let section;
  const lines = [];
  for (const original of source.split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) { section = heading[1]; continue; }
    if (section === wanted) lines.push(line);
  }
  return lines;
}

function unquote(value) {
  if (value?.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value); } catch { return value.slice(1, -1); }
  }
  return value;
}

function argumentFromModule(overrides = {}) {
  const entries = scriptEntries(expandModule(overrides));
  assert.equal(entries.length, 1, 'a response must enter one unified handler');
  return unquote(entries[0].parameters.argument || '');
}

function aesEncrypt(bytes) {
  const cipher = createCipheriv('aes-128-ecb', EAPI_KEY, null);
  return Buffer.concat([cipher.update(bytes), cipher.final()]);
}

function aesDecrypt(bytes) {
  const decipher = createDecipheriv('aes-128-ecb', EAPI_KEY, null);
  return Buffer.concat([decipher.update(bytes), decipher.final()]);
}

function wireBody(data, format) {
  const json = JSON.stringify(data);
  if (format === 'plain') return json;
  if (format === 'utf8') return new Uint8Array(Buffer.from(json, 'utf8'));
  if (format === 'aes') return new Uint8Array(aesEncrypt(Buffer.from(json, 'utf8')));
  if (format === 'gzip') return new Uint8Array(aesEncrypt(gzipSync(Buffer.from(json, 'utf8'))));
  throw new Error(`unknown fixture format: ${format}`);
}

function decodeWire(body, format) {
  if (format === 'plain' || format === 'utf8') {
    const text = typeof body === 'string' ? body : new TextDecoder('utf-8', { fatal: true }).decode(body);
    return JSON.parse(text);
  }
  assert.ok(ArrayBuffer.isView(body), 'encrypted output must remain a byte view');
  let clear = aesDecrypt(Buffer.from(body.buffer, body.byteOffset, body.byteLength));
  if (format === 'gzip') {
    assert.equal(clear[0], 0x1f, 'compressed EAPI response must retain a valid gzip envelope');
    assert.equal(clear[1], 0x8b, 'compressed EAPI response must retain a valid gzip envelope');
    clear = gunzipSync(clear);
  }
  return JSON.parse(clear.toString('utf8'));
}

async function runDerivative(path, body, { options = {}, argument, headers = {}, responseHeaders = {} } = {}) {
  // Prevent this runner from accidentally executing the old untouched author script.
  assert.match(scriptSource, /cleanCommentDecorations/);
  assert.match(scriptSource, /showNotFollowingBack/);
  const done = [];
  const request = {
    url: path.startsWith('http') ? path : `https://interface.music.163.com/eapi${path}`,
    method: 'POST', headers,
  };
  const response = { body, status: 200, headers: responseHeaders };
  const context = {
    $request: request, $response: response,
    $argument: argument === undefined ? argumentFromModule(options) : argument,
    $script: { binaryBodyMode: true },
    $done(value = {}) { done.push(value); },
    $utils: {
      ungzip: (value) => new Uint8Array(gunzipSync(Buffer.from(value))),
      gzip: (value) => new Uint8Array(gzipSync(Buffer.from(value))),
    },
    TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, URL, URLSearchParams,
    crypto: webcrypto,
    console: { log() {}, warn() {}, error() {} },
  };
  // No require, process, fetch, HTTP client, business request, or host file access.
  const returned = scriptProgram.runInNewContext(context, { timeout: 5_000 });
  if (returned && typeof returned.then === 'function') await returned;
  await Promise.resolve();
  assert.equal(done.length, 1, 'every success/no-op/failure must call $done exactly once');
  assert.ok(done[0] && typeof done[0] === 'object', '$done must receive an object');
  return { result: done[0], request, response };
}

async function runData(path, data, { format = 'plain', options = {}, argument, headers = {} } = {}) {
  const original = wireBody(data, format);
  const requestHeaders = { ...(format === 'gzip' ? { 'x-aeapi': 'true' } : {}), ...headers };
  const { result } = await runDerivative(path, original, { options, argument, headers: requestHeaders });
  const output = Object.hasOwn(result, 'body') ? result.body : original;
  return { data: decodeWire(output, format), result };
}

function homepageFixture() {
  const codes = [...Object.values(CARD_OPTIONS), 'FUTURE_SAFE_CARD'];
  return {
    code: 200,
    data: {
      blocks: codes.map((code) => ({ bizCode: code, positionCode: code, marker: code })),
      blockCodeOrderList: JSON.stringify(codes),
    },
  };
}

function commentFixture() {
  return {
    content: '应保留的评论',
    user: { followed: false, vipRights: { associator: { vipLevel: 2, expireTime: 1_890_001_234_567 } }, avatarDetail: { identityLevel: 2 } },
    pendantData: { id: 42 }, userBizLevels: [{ level: 3 }],
    tag: { extDatas: [{ id: 1 }], contentPicDatas: [{ id: 2 }], text: '非装饰内容' },
  };
}

function membershipFixture(level) {
  return {
    code: 200,
    data: {
      musicPackage: { expireTime: 1_890_001_234_567, vipLevel: level },
      associator: { expireTime: 1_890_001_111_111, vipLevel: level },
      voiceBookVip: { expireTime: 1_890_001_222_222, vipLevel: level },
      redplus: { vipCode: 100, expireTime: 1_890_001_333_333, vipLevel: level },
      redVipLevel: level, marker: 'real-server-membership',
    },
  };
}

test('module: English parameter names, expected defaults, one unified WebView/binary entry', () => {
  assert.deepEqual(metadataDefaults(), DEFAULTS);
  assert.match(moduleSource, /^#!arguments-desc=.*[\u4e00-\u9fff]/m, 'parameter instructions must remain understandable in Chinese');
  const expanded = expandModule();
  assert.ok(!expanded.includes('{{{'), 'all placeholders must be expanded before native checking');
  const entries = scriptEntries(expanded);
  assert.equal(entries.length, 1);
  assert.equal(new Set(entries.map((entry) => entry.name)).size, entries.length);
  const params = entries[0].parameters;
  assert.equal(params.type, 'http-response');
  assert.ok(['true', '1'].includes(params['requires-body']));
  assert.ok(['true', '1'].includes(params['binary-body-mode']));
  assert.equal(params.engine, 'webview');
  assert.equal(params['max-size'], '-1');
  assert.equal(params['script-update-interval'], '86400');
  const remoteScript = new URL(unquote(params['script-path']));
  assert.equal(remoteScript.origin + remoteScript.pathname, 'https://raw.githubusercontent.com/wch19830910/wch/main/Surge/Script/NetEaseMusic.js');
  assert.ok(['', '?v=merged-1'].includes(remoteScript.search), 'allow only the reviewed cache-migration query');
  assert.ok(argumentFromModule().includes('cleanCommentDecorations=1'));
  const pattern = new RegExp(unquote(params.pattern));
  for (const path of ['/batch', '/link/home/framework/tab', '/link/page/rcmd/resource/show', '/homepage/block/page', '/link/page/rcmd/block/resource/multi/refresh', '/v2/resource/comment/floor/get', '/user/follow/users/mixed/get/v2']) {
    assert.ok(pattern.test(`https://interface.music.163.com/eapi${path}`), `missing route: ${path}`);
  }
  assert.ok(pattern.test('https://ipv4.music.163.com/eapi/batch'), 'IPv4 API host must be covered');
  assert.ok(!pattern.test('https://example.com/eapi/batch'), 'the handler must not cover unrelated hosts');
  for (const line of sectionLines(expanded, 'Map Local')) {
    const match = line.match(/^(?:"([^"]+)"|(\S+))/);
    assert.ok(match, `missing Map Local regex: ${line}`);
    const localPattern = new RegExp(match[1] || match[2]);
    for (const path of ['/music-vip-membership/client/vip/info', '/vipnewcenter/app/resource/newaccountpage']) {
      assert.ok(!localPattern.test(`https://interface.music.163.com/eapi${path}`), `Map Local must not mask real account membership: ${line}`);
    }
  }
});

test('customizer: tab options hide only the selected known title and retain unknown tabs', async (t) => {
  const fields = { hideDiscover: '发现', hideRoam: '漫游', hideNotes: '笔记' };
  const fixture = { data: { commonResourceList: [{ title: '发现', resourceType: 'explore' }, { title: '漫游' }, { title: '笔记' }, { title: '未知标签' }] } };
  for (const [option, title] of Object.entries(fields)) {
    await t.test(option, () => {
      const kept = customizeNetEase(clone(fixture), '/link/home/framework/tab', { [option]: false }).data;
      assert.deepEqual(kept.data.commonResourceList.map((item) => item.title), ['发现', '漫游', '笔记', '未知标签']);
      const hidden = customizeNetEase(clone(fixture), '/link/home/framework/tab', { [option]: true }).data;
      assert.deepEqual(hidden.data.commonResourceList.map((item) => item.title), ['发现', '漫游', '笔记', '未知标签'].filter((item) => item !== title));
    });
  }
});

test('customizer: every home-card option, unknown preservation, and order-list synchronization', async (t) => {
  const fixture = homepageFixture();
  for (const [option, code] of Object.entries(CARD_OPTIONS)) {
    await t.test(option, () => {
      const visible = customizeNetEase(clone(fixture), '/link/page/rcmd/resource/show', { [option]: false }).data;
      assert.ok(visible.data.blocks.some((item) => item.bizCode === code), '0/false must keep the selected card');
      const hidden = customizeNetEase(clone(fixture), '/link/page/rcmd/resource/show', { [option]: true }).data;
      assert.ok(!hidden.data.blocks.some((item) => item.bizCode === code), '1/true must hide the selected card');
      assert.ok(hidden.data.blocks.some((item) => item.bizCode === 'FUTURE_SAFE_CARD'));
      assert.equal(typeof hidden.data.blockCodeOrderList, 'string');
      assert.ok(!JSON.parse(hidden.data.blockCodeOrderList).includes(code));
    });
  }
  const arrayOrder = clone(fixture);
  arrayOrder.data.blockCodeOrderList = JSON.parse(arrayOrder.data.blockCodeOrderList);
  const arrayResult = customizeNetEase(arrayOrder, '/link/page/rcmd/resource/show', { hideGreeting: true }).data;
  assert.ok(Array.isArray(arrayResult.data.blockCodeOrderList));
  assert.ok(!arrayResult.data.blockCodeOrderList.includes(CARD_OPTIONS.hideGreeting));
  const brokenOrder = clone(fixture);
  brokenOrder.data.blockCodeOrderList = '{invalid order';
  assert.equal(customizeNetEase(brokenOrder, '/link/page/rcmd/resource/show', { hideGreeting: true }).data.data.blockCodeOrderList, '{invalid order');
});

test('customizer: refresh cards use the same hide switches without dropping unknown cards', () => {
  const fixture = { data: [...Object.values(CARD_OPTIONS), 'FUTURE_SAFE_CARD'].map((code) => ({ blockCode: code, block: { marker: code } })) };
  const result = customizeNetEase(clone(fixture), '/link/page/rcmd/block/resource/multi/refresh', { hideGreeting: true }).data;
  assert.ok(!result.data.some((item) => item.blockCode === CARD_OPTIONS.hideGreeting));
  assert.ok(result.data.some((item) => item.blockCode === CARD_OPTIONS.hideDailyRecommend));
  assert.ok(result.data.some((item) => item.blockCode === 'FUTURE_SAFE_CARD'));
});

test('customizer: comment cleanup is optional and never changes vipRights or followed', () => {
  const comment = commentFixture();
  const fixture = { data: { ownerComment: clone(comment), comments: [clone(comment)] } };
  const disabled = customizeNetEase(clone(fixture), '/v2/resource/comment/floor/get', { cleanCommentDecorations: false }).data;
  assert.deepEqual(disabled, fixture);
  const enabled = customizeNetEase(clone(fixture), '/v2/resource/comment/floor/get', { cleanCommentDecorations: true }).data;
  for (const item of [enabled.data.ownerComment, ...enabled.data.comments]) {
    assert.equal(item.content, comment.content);
    assert.equal(item.user.followed, false);
    assert.deepEqual(item.user.vipRights, comment.user.vipRights);
    assert.notDeepEqual(item.user.avatarDetail, comment.user.avatarDetail);
    assert.notDeepEqual(item.pendantData, comment.pendantData);
  }
});

test('customizer: not-following-back indicator is optional and leaves relationship fields unchanged', () => {
  const fixture = { data: { records: [{ userId: 1, followed: false, mutualFollowDay: null, showContent: { message: '原提示' } }, { userId: 2, followed: true, mutualFollowDay: 12, showContent: { message: '互关提示' } }] } };
  assert.deepEqual(customizeNetEase(clone(fixture), '/user/follow/users/mixed/get/v2', { showNotFollowingBack: false }).data, fixture);
  const enabled = customizeNetEase(clone(fixture), '/user/follow/users/mixed/get/v2', { showNotFollowingBack: true }).data;
  assert.notDeepEqual(enabled.data.records[0].showContent, fixture.data.records[0].showContent);
  assert.equal(enabled.data.records[0].followed, false);
  assert.equal(enabled.data.records[0].mutualFollowDay, null);
  assert.deepEqual(enabled.data.records[1], fixture.data.records[1]);
});

test('customizer: owned routes bypass the old destructive branches; batch edits the shared cached object', () => {
  for (const path of ['/link/home/framework/tab', '/link/page/rcmd/resource/show', '/homepage/block/page', '/link/page/rcmd/block/resource/multi/refresh', '/v2/resource/comment/floor/get', '/user/follow/users/mixed/get/v2']) {
    assert.equal(customizeNetEase({ data: {} }, path, {}).handled, true, `route ownership missing: ${path}`);
  }
  const account = membershipFixture(2);
  const accountResult = customizeNetEase(clone(account), '/vipnewcenter/app/resource/newaccountpage', {});
  assert.equal(accountResult.handled, true, 'the old account-page empty-data branch must be bypassed');
  assert.deepEqual(accountResult.data, account);
  const batch = { '/api/v2/resource/comments': { data: { comments: [commentFixture()] } } };
  const batchResult = customizeNetEase(batch, '/batch', { cleanCommentDecorations: true });
  assert.equal(batchResult.handled, false, 'the original batch ad cleaner must still run');
  assert.equal(batchResult.data, batch, 'batch customization must operate on the same decoded cache object');
  assert.notDeepEqual(batch['/api/v2/resource/comments'].data.comments[0].user.avatarDetail, commentFixture().user.avatarDetail);
});

for (const format of ['plain', 'utf8', 'aes', 'gzip']) {
  test(`runtime: ${format} fixture is decoded, customized, and encoded once`, async () => {
    const { data } = await runData('/link/page/rcmd/resource/show', homepageFixture(), { format, options: { hideGreeting: '1', hideDailyRecommend: '0' } });
    assert.ok(!data.data.blocks.some((item) => item.bizCode === CARD_OPTIONS.hideGreeting));
    assert.ok(data.data.blocks.some((item) => item.bizCode === CARD_OPTIONS.hideDailyRecommend));
    assert.ok(data.data.blocks.some((item) => item.bizCode === 'FUTURE_SAFE_CARD'));
  });
}

test('runtime: gzip request header matching is case-insensitive', async () => {
  const body = wireBody(homepageFixture(), 'gzip');
  const { result } = await runDerivative('/link/page/rcmd/resource/show', body, { options: { hideGreeting: '1' }, headers: { 'X-AeApi': 'TRUE' } });
  assert.ok(Object.hasOwn(result, 'body'));
  const data = decodeWire(result.body, 'gzip');
  assert.ok(!data.data.blocks.some((item) => item.bizCode === CARD_OPTIONS.hideGreeting));
});

test('runtime: form and JSON options agree; invalid option values fall back to defaults', async () => {
  const fixture = { data: { commonResourceList: [{ title: '发现' }, { title: '漫游' }, { title: '笔记' }] } };
  const form = await runData('/link/home/framework/tab', fixture, { options: { hideRoam: '1' } });
  const json = await runData('/link/home/framework/tab', fixture, { argument: JSON.stringify({ hideRoam: '1' }) });
  assert.deepEqual(form.data, json.data);
  assert.deepEqual(form.data.data.commonResourceList.map((item) => item.title), ['发现', '笔记']);
  for (const argument of ['hideRoam=banana&cleanCommentDecorations=banana', '{invalid-json', 'hideRoam=-1', 'hideRoam=2']) {
    const output = await runData('/link/home/framework/tab', fixture, { argument });
    assert.deepEqual(output.data.data.commonResourceList.map((item) => item.title), ['发现', '漫游', '笔记']);
  }
});

test('runtime: original ad cleanup remains active', async () => {
  for (const format of ['plain', 'aes', 'gzip']) {
    const output = await runData('/ad/get', { code: 200, ads: { test: 'synthetic-ad' } }, { format });
    assert.deepEqual(output.data, { ads: {}, code: 200 });
  }
});

test('runtime: batch comment toggle applies to the shared payload while membership and relationship fields survive', async () => {
  const fixture = {
    '/api/v2/resource/comments': { data: { comments: [commentFixture()] } },
    '/api/music-vip-membership/client/vip/info': membershipFixture(2),
  };
  for (const format of ['plain', 'aes']) {
    for (const [value, clean] of [['0', false], ['1', true], ['invalid', true]]) {
      const output = await runData('/batch', fixture, { format, argument: `cleanCommentDecorations=${value}` });
      const comment = output.data['/api/v2/resource/comments'].data.comments[0];
      if (clean) assert.notDeepEqual(comment.user.avatarDetail, commentFixture().user.avatarDetail);
      else assert.deepEqual(comment, commentFixture());
      assert.equal(comment.user.followed, false);
      assert.deepEqual(comment.user.vipRights, commentFixture().user.vipRights);
      assert.deepEqual(output.data['/api/music-vip-membership/client/vip/info'], fixture['/api/music-vip-membership/client/vip/info']);
    }
  }
});

test('runtime: real membership data survives independent and batch routes, including non-VIP accounts', async () => {
  for (const level of [0, 2]) {
    const membership = membershipFixture(level);
    for (const path of ['/music-vip-membership/client/vip/info', '/vipnewcenter/app/resource/newaccountpage']) {
      const output = await runData(path, membership);
      assert.deepEqual(output.data, membership, `membership fields changed: ${path}`);
    }
    const batch = {
      '/api/music-vip-membership/client/vip/info': clone(membership),
      '/api/vipnewcenter/app/resource/newaccountpage': clone(membership),
      '/api/v2/resource/comments': { data: { comments: [commentFixture()] } },
    };
    const output = await runData('/batch', batch, { format: 'aes' });
    assert.deepEqual(output.data['/api/music-vip-membership/client/vip/info'], membership);
    assert.deepEqual(output.data['/api/vipnewcenter/app/resource/newaccountpage'], membership);
    assert.equal(output.data['/api/v2/resource/comments'].data.comments[0].user.followed, false);
    assert.deepEqual(output.data['/api/v2/resource/comments'].data.comments[0].user.vipRights, commentFixture().user.vipRights);
    assert.notDeepEqual(output.data['/api/v2/resource/comments'].data.comments[0].user.avatarDetail, commentFixture().user.avatarDetail);
  }
  const absentRights = { code: 200, data: { redVipLevel: 0, musicPackage: null } };
  assert.deepEqual((await runData('/music-vip-membership/client/vip/info', absentRights)).data, absentRights);
});

test('runtime: malformed or unrelated responses fail open and finish exactly once', async () => {
  for (const body of ['', '{invalid-json', new Uint8Array([0xff, 0xfe, 0xfd]), new Uint8Array([1, 2, 3, 4]), null, undefined]) {
    const { result } = await runDerivative('/link/page/rcmd/resource/show', body);
    assert.equal(Reflect.ownKeys(result).length, 0, 'a malformed response should pass through unchanged');
  }
  const unrelated = { marker: 'do-not-change', data: { items: [1, 2, 3] } };
  const output = await runData('/not/a/managed/route', unrelated);
  assert.deepEqual(output.data, unrelated);
});

test('native Surge CLI: default-expanded module is a valid temporary complete profile', { skip: !existsSync(SURGE_CLI) && 'Surge CLI not installed; synthetic fixture tests still run' }, async () => {
  let profile = expandModule().replace(/hostname\s*=\s*%APPEND%\s*/g, 'hostname = ');
  if (profile.includes('[Rule]')) profile = profile.replace('[Rule]', '[Rule]\nFINAL,DIRECT');
  else profile += '\n[Rule]\nFINAL,DIRECT\n';
  const directory = await mkdtemp(join(tmpdir(), 'netease-merged-profile-'));
  const path = join(directory, 'profile.conf');
  try {
    await writeFile(path, profile, 'utf8');
    const result = spawnSync(SURGE_CLI, ['--check', path], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /OK/);
  } finally {
    await unlink(path).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await rmdir(directory);
  }
});
