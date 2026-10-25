#!/usr/bin/env node
// Offline configuration and synthetic JSON fixtures. Never executes remote JS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseApp2Module, parseAdList, parseDdgSource } from '../scripts/build-tieba.mjs';

const MODULE_PATH = fileURLToPath(new URL('../AdBlock/Tieba.sgmodule', import.meta.url));
const SURGE_CLI = '/Applications/Surge.app/Contents/Applications/surge-cli';
const moduleSource = await readFile(MODULE_PATH, 'utf8');
const [app2Source, ddgSource, adSource] = await Promise.all([
  readFile(new URL('../upstream/Tieba.app2smile.sgmodule', import.meta.url), 'utf8'),
  readFile(new URL('../upstream/Tieba.ddgksf2013.conf', import.meta.url), 'utf8'),
  readFile(new URL('../upstream/Tieba.ad.list', import.meta.url), 'utf8'),
]);
const authorScripts = {
  json: 'https://raw.githubusercontent.com/app2smile/rules/master/js/tieba-json.js',
  proto: 'https://raw.githubusercontent.com/app2smile/rules/master/js/tieba-proto.js',
};

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

function defaults() {
  const match = moduleSource.match(/^#!arguments=(.+)$/m);
  assert.ok(match, 'the video-filter option must be exposed to the user');
  return Object.fromEntries(match[1].split(',').map((field) => {
    const item = field.trim().match(/^([A-Za-z][A-Za-z0-9_]*):\s*(0|1)$/);
    assert.ok(item, `expected a named 0/1 argument: ${field}`);
    return [item[1], item[2]];
  }));
}

function expanded(overrides = {}) {
  const argumentsMap = { ...defaults(), ...overrides };
  return moduleSource.replace(/\{\{\{([^{}]+)\}\}\}/g, (_, name) => {
    assert.ok(Object.hasOwn(argumentsMap, name), `undeclared argument: ${name}`);
    return argumentsMap[name];
  });
}

function unquote(value) {
  if (value?.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value); } catch { return value.slice(1, -1); }
  }
  return value;
}

function scripts(source = expanded()) {
  return sectionLines(source, 'Script').map((line) => {
    const definition = line.match(/^([^=]+?)\s*=\s*(.+)$/);
    assert.ok(definition, `invalid script definition: ${line}`);
    const parameters = {};
    for (const field of definition[2].split(/,\s*(?=[A-Za-z][A-Za-z0-9_-]*\s*=)/)) {
      const item = field.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.*)$/);
      assert.ok(item, `invalid script field: ${field}`);
      assert.ok(!Object.hasOwn(parameters, item[1]), `duplicate script field: ${field}`);
      parameters[item[1]] = unquote(item[2]);
    }
    return { name: definition[1].trim(), parameters, pattern: new RegExp(parameters.pattern) };
  });
}

function jqRules() {
  return sectionLines(expanded(), 'Body Rewrite').map((line) => {
    const match = line.match(/^http-response-jq\s+(\S+)\s+'(.*)'$/);
    assert.ok(match, `expected a native response JQ rule: ${line}`);
    return { pattern: new RegExp(match[1]), expression: match[2] };
  });
}

function transform(url, payload) {
  const selected = jqRules().filter((rule) => rule.pattern.test(url));
  assert.ok(selected.length, `no JSON cleanup selected for ${url}`);
  let data = payload;
  for (const rule of selected) {
    const result = spawnSync('jq', ['-c', rule.expression], {
      input: JSON.stringify(data), encoding: 'utf8', timeout: 5_000,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const lines = result.stdout.trim().split('\n');
    assert.equal(lines.length, 1, 'JSON cleanup must produce exactly one response');
    data = JSON.parse(lines[0]);
  }
  return data;
}

const apiOrigins = [
  'https://tiebac.baidu.com', 'http://tiebac.baidu.com',
  'https://c.tieba.baidu.com', 'http://c.tieba.baidu.com',
];

test('module: one exposed video option defaults to retaining ordinary videos', () => {
  assert.match(moduleSource, /^#!name=.*贴吧/m);
  assert.deepEqual(Object.values(defaults()), ['0']);
  assert.match(moduleSource, /^#!arguments-desc=.*[\u4e00-\u9fff]/m);
  assert.ok(!expanded().includes('{{{'));
  const key = Object.keys(defaults())[0];
  const protoOff = scripts(expanded({ [key]: '0' })).find((entry) => entry.parameters['script-path'] === authorScripts.proto);
  const protoOn = scripts(expanded({ [key]: '1' })).find((entry) => entry.parameters['script-path'] === authorScripts.proto);
  assert.equal(protoOff.parameters.argument, 'per_filter_video_thread=0');
  assert.equal(protoOn.parameters.argument, 'per_filter_video_thread=1');
});

test('module: direct author JS, daily update checks, binary ProtoBuf and unlimited response size', () => {
  const entries = scripts();
  assert.equal(entries.length, 2, 'JSON and protobuf need separate decoding modes');
  assert.equal(new Set(entries.map((entry) => entry.name)).size, 2);
  assert.deepEqual(entries.map((entry) => entry.parameters['script-path']).sort(), Object.values(authorScripts).sort());
  for (const { parameters } of entries) {
    assert.equal(parameters.type, 'http-response');
    assert.ok(['1', 'true'].includes(parameters['requires-body']));
    assert.equal(parameters['max-size'], '-1');
    assert.equal(parameters['script-update-interval'], '86400');
    if (parameters['script-path'] === authorScripts.proto) {
      assert.ok(['1', 'true'].includes(parameters['binary-body-mode']));
    }
  }
});

test('routing: the original JSON advertising endpoints work on both official host families', () => {
  const jsonRoutes = [
    '/c/s/sync', '/c/f/ad/getSplashAd', '/c/f/frs/page', '/c/f/frs/threadlist',
    '/c/f/frs/generalTabList', '/c/f/pb/page', '/c/f/pb/picpage',
    '/c/f/excellent/personalized', '/tiebaads/commonbatch?batch=synthetic',
  ];
  for (const origin of apiOrigins) {
    for (const route of jsonRoutes) {
      const matches = scripts().filter((entry) => entry.pattern.test(origin + route));
      assert.equal(matches.length, 1, `JSON response must enter one handler: ${origin}${route}`);
      assert.equal(matches[0].parameters['script-path'], authorScripts.json);
    }
  }
});

test('routing: protobuf bidding, feed, forum, post and recommendation endpoints retain their binary handler', () => {
  const protoRoutes = [
    '/c/b/ad/adBid', '/c/f/ad/getFeedAd', '/c/f/frs/page', '/c/f/frs/threadlist',
    '/c/f/frs/generalTabList', '/c/f/pb/page', '/c/f/excellent/personalized',
  ];
  for (const origin of apiOrigins) {
    for (const route of protoRoutes) {
      const url = `${origin}${route}?cmd=301002&format=protobuf`;
      const matches = scripts().filter((entry) => entry.pattern.test(url));
      assert.equal(matches.length, 1, `protobuf response must enter one handler: ${url}`);
      assert.equal(matches[0].parameters['script-path'], authorScripts.proto);
    }
  }
});

test('routing: no unrelated hosts, account endpoints or sync-wide rejection', () => {
  const sensitiveUrls = [
    'https://example.com/c/f/frs/page?cmd=1&format=protobuf',
    'https://tiebac.baidu.com.example.com/c/s/sync',
    'https://tiebac.baidu.com/c/u/login',
    'https://tiebac.baidu.com/c/u/user/member',
    'https://tiebac.baidu.com/c/u/user/follow',
  ];
  for (const url of sensitiveUrls) assert.ok(!scripts().some((entry) => entry.pattern.test(url)), url);
  for (const line of sectionLines(expanded(), 'Rule')) {
    if (/REJECT/.test(line)) {
      assert.match(line, /^(?:DOMAIN,180\.76\.76\.200,|IP-CIDR,180\.76\.76\.200\/32,)/);
    }
  }
  for (const section of ['URL Rewrite', 'Map Local']) {
    for (const line of sectionLines(expanded(), section)) {
      const regex = new RegExp(line.match(/^(\S+)/)[1]);
      for (const origin of apiOrigins) {
        assert.ok(!regex.test(`${origin}/c/s/sync`), 'sync configuration must be processed, not blocked');
        assert.ok(!regex.test(`${origin}/c/f/ad/getFeedAd?cmd=1&format=protobuf`), 'a local response must not bypass protobuf cleanup');
      }
    }
  }
});

test('search cleanup removes recommendations while preserving status, unrelated data and user state', () => {
  const payload = { error_code: 0, user: { is_vip: 1, is_follow: true }, data: { discover_list: [{ text: '广告热搜' }], safe: { marker: 1 } } };
  for (const origin of ['https://tieba.baidu.com', 'https://tiebac.baidu.com']) {
    const output = transform(`${origin}/c/f/search/discover`, payload);
    assert.deepEqual(output.data.discover_list, []);
    assert.deepEqual(output.data.safe, payload.data.safe);
    assert.deepEqual(output.user, payload.user);
    assert.equal(output.error_code, 0);
  }
});

test('sidebar cleanup removes promotion entries and keeps normal navigation and real membership', () => {
  const payload = { game_center: [1], tools: [2], vip_banner: [3], task_list: [4], common: [{ name: '收藏' }], user: { is_vip: 0, followed: false }, unknown_field: { preserve: true } };
  const output = transform('https://tiebac.baidu.com/c/f/sidebar/home', payload);
  for (const key of ['game_center', 'tools', 'vip_banner', 'task_list']) assert.ok(!Object.hasOwn(output, key));
  assert.deepEqual(output.common, payload.common);
  assert.deepEqual(output.user, payload.user);
  assert.deepEqual(output.unknown_field, payload.unknown_field);
});

test('profile cleanup preserves real account fields and ordinary function cards', () => {
  const payload = {
    duxiaoman: [1], namoaixud: [2], namoaixud_entry: [3], recom_naws_list: [4], duxiaoman_entry: [5], vip_banner: [6],
    user: { id: 123, is_vip: 1, vip_expire: 1890000123, followed: true, mutual_follow: false },
    zone_info: [
      { type: 'commerce', ad: true }, { type: 'common_func', functions: ['收藏', '历史'] },
      { type: 'auxiliary_func', functions: ['设置'] },
    ],
    unknown_field: { future: 'preserve' },
  };
  const output = transform('https://tiebac.baidu.com/c/u/user/profile', payload);
  for (const key of ['duxiaoman', 'namoaixud', 'namoaixud_entry', 'recom_naws_list', 'duxiaoman_entry', 'vip_banner']) assert.ok(!Object.hasOwn(output, key));
  assert.deepEqual(output.user, payload.user);
  assert.deepEqual(output.zone_info, payload.zone_info.slice(1));
  assert.deepEqual(output.unknown_field, payload.unknown_field);
});

test('forum guide and search start-page cleanup retain normal non-promotional response fields', () => {
  const guide = { hot_search: [{ text: '热搜推广' }], forum_list: [{ id: 1, name: '正常关注吧' }], user: { is_vip: 0, followed: true } };
  const guideOutput = transform('https://tieba.baidu.com/c/f/forum/forumGuide', guide);
  assert.deepEqual(guideOutput.hot_search, []);
  assert.deepEqual(guideOutput.forum_list, guide.forum_list);
  assert.deepEqual(guideOutput.user, guide.user);
  const start = { no: 0, error: 'success', data: { recommendations: [1, 2] }, unknown: 'keep' };
  const startOutput = transform('https://tiebac.baidu.com/mo/q/search/startPage', start);
  assert.ok(!Object.hasOwn(startOutput, 'data'));
  assert.equal(startOutput.no, 0);
  assert.equal(startOutput.error, 'success');
  assert.equal(startOutput.unknown, 'keep');
});

test('optional profile fields: missing, null and future non-array containers do not break the response', () => {
  for (const zone of [undefined, null, { unknown: 'preserve' }]) {
    const payload = { user: { is_vip: 2, followed: true }, unknown: ['preserve'] };
    if (zone !== undefined) payload.zone_info = zone;
    const output = transform('https://tiebac.baidu.com/c/u/user/profile', payload);
    assert.deepEqual(output, payload);
  }
});

test('upstream guard: unreviewed script source, wildcard hosts and disabled binary decoding are rejected', () => {
  assert.equal(parseApp2Module(app2Source).scripts.size, 2);
  for (const badSource of [
    app2Source.replace(authorScripts.proto, 'https://example.com/unreviewed.js'),
    app2Source.replace('hostname = %APPEND% tiebac.baidu.com', 'hostname = %APPEND% *.baidu.com'),
    app2Source.replace('binary-body-mode=1', 'binary-body-mode=0'),
    `${app2Source}\n[Map Local]\n^https://tiebac.baidu.com/c/u/login data-type=text data="{}"`,
  ]) {
    assert.notEqual(badSource, app2Source, 'the fixture must actually change the upstream');
    assert.throws(() => parseApp2Module(badSource));
  }
});

test('upstream guard: changed page cleanup, expanded rejection and foreign protobuf sources require review', () => {
  assert.equal(parseDdgSource(ddgSource).jqRules.length, 5);
  for (const badSource of [
    ddgSource.replace('.data.discover_list = []', '.user.is_vip = 1'),
    ddgSource.replace('c\\/f\\/ad\\/getFeedAd url reject-200', 'c\\/u\\/login url reject-200'),
    ddgSource.replace(authorScripts.proto, 'https://example.com/unreviewed.js'),
    `${ddgSource}\n^https://tiebac.baidu.com/c/u/login url reject-200`,
  ]) {
    assert.notEqual(badSource, ddgSource, 'the fixture must actually change the upstream');
    assert.throws(() => parseDdgSource(badSource));
  }
});

test('upstream guard: new domain or network-wide blocking is not silently inherited', () => {
  assert.equal(parseAdList(adSource).length, 2);
  for (const badSource of [
    `${adSource}\nDOMAIN,passport.baidu.com`,
    adSource.replace('180.76.76.200/32', '180.76.0.0/16'),
    adSource.replace('DOMAIN,180.76.76.200', 'DOMAIN-SUFFIX,baidu.com'),
  ]) {
    assert.notEqual(badSource, adSource, 'the fixture must actually change the upstream');
    assert.throws(() => parseAdList(badSource));
  }
});

test('native Surge CLI: default-expanded module validates as a complete temporary profile', { skip: !existsSync(SURGE_CLI) && 'Surge CLI is not installed on this host' }, async () => {
  let profile = expanded().replace(/hostname\s*=\s*%APPEND%\s*/g, 'hostname = ');
  if (profile.includes('[Rule]')) profile = profile.replace('[Rule]', '[Rule]\nFINAL,DIRECT');
  else profile += '\n[Rule]\nFINAL,DIRECT\n';
  const directory = await mkdtemp(join(tmpdir(), 'tieba-module-profile-'));
  const path = join(directory, 'profile.conf');
  try {
    await writeFile(path, profile, 'utf8');
    const result = spawnSync(SURGE_CLI, ['--check', path], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /OK/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
