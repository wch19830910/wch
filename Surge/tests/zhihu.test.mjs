#!/usr/bin/env node
// GPL-3.0-only. Offline synthetic tests for our adapted runtime; no author JS is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Script, createContext } from 'node:vm';
import { customizeZhihu, renderZhihuRuntime } from '../scripts/zhihu-runtime.mjs';
import { parseSource, validateUpstreamScript, main } from '../scripts/build-zhihu.mjs';

const SURGE_CLI = '/Applications/Surge.app/Contents/Applications/surge-cli';
const MODULE_URL = new URL('../AdBlock/Zhihu.sgmodule', import.meta.url);
const OUTPUT_URLS = [MODULE_URL, new URL('../Script/Zhihu.js', import.meta.url),
  new URL('../upstream/Zhihu.sgmodule', import.meta.url), new URL('../upstream/Zhihu.references.json', import.meta.url)];
const [moduleSource, runtimeSource, upstreamSource] = await Promise.all([
  readFile(MODULE_URL, 'utf8'), readFile(OUTPUT_URLS[1], 'utf8'), readFile(OUTPUT_URLS[2], 'utf8'),
]);
const copy = (value) => JSON.parse(JSON.stringify(value));

function sectionLines(wanted, source = moduleSource) {
  const result = [];
  let section;
  for (const original of source.split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) { section = heading[1]; continue; }
    if (section === wanted) result.push(line);
  }
  return result;
}

function defaults() {
  const match = moduleSource.match(/^#!arguments=(.*)$/m);
  assert.ok(match, 'module must expose its two independent content options');
  return Object.fromEntries(match[1].split(',').map((field) => {
    const pair = field.trim().match(/^([A-Za-z][A-Za-z0-9_]*):([01])$/);
    assert.ok(pair, `invalid module argument: ${field}`);
    return [pair[1], pair[2]];
  }));
}

function expanded(overrides = {}) {
  const options = { ...defaults(), ...overrides };
  return moduleSource.replace(/\{\{\{([^{}]+)\}\}\}/g, (_, name) => {
    assert.ok(Object.hasOwn(options, name), `missing argument: ${name}`);
    return options[name];
  });
}

function scriptEntry(source = expanded()) {
  const lines = sectionLines('Script', source);
  assert.equal(lines.length, 1, 'all JSON paths need one uniquely named response script');
  const definition = lines[0].match(/^([^=]+?)\s*=\s*(.+)$/);
  assert.ok(definition, 'named script declaration is required');
  const parameters = {};
  for (const field of definition[2].split(/,\s*(?=[A-Za-z][A-Za-z0-9_-]*\s*=)/)) {
    const item = field.match(/^([A-Za-z][A-Za-z0-9_-]*)=(.*)$/);
    assert.ok(item, `invalid script field: ${field}`);
    assert.ok(!Object.hasOwn(parameters, item[1]), `duplicate field: ${field}`);
    let value = item[2];
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    parameters[item[1]] = value;
  }
  return { name: definition[1].trim(), parameters, pattern: new RegExp(parameters.pattern) };
}

function run(url, payload, options = {}) {
  return customizeZhihu(copy(payload), url, options);
}

function runtime(url, body, argument = 'hideVideos=0&hidePaid=0') {
  const calls = [];
  let ioCalls = 0;
  const forbidden = () => { ioCalls += 1; throw new Error('runtime must not perform network, notification or storage I/O'); };
  const sandbox = {
    $request: { url, method: 'GET' }, $response: { body }, $argument: argument,
    $done: (value) => calls.push(value === undefined ? undefined : copy(value)),
    console: { log() {}, warn() {}, error() {} },
    fetch: forbidden, XMLHttpRequest: forbidden,
    $httpClient: { get: forbidden, post: forbidden }, $task: { fetch: forbidden },
    $notification: { post: forbidden }, $persistentStore: { read: forbidden, write: forbidden },
    $prefs: { valueForKey: forbidden, setValueForKey: forbidden },
  };
  new Script(runtimeSource, { filename: 'Zhihu.js' }).runInContext(createContext(sandbox), { timeout: 2_000 });
  assert.equal(calls.length, 1, 'each response must finish exactly once');
  assert.equal(ioCalls, 0, 'JSON cleanup must stay entirely local');
  return calls[0];
}

function runtimeData(url, data, argument) {
  const result = runtime(url, JSON.stringify(data), argument);
  assert.equal(typeof result?.body, 'string', 'handled JSON must return a JSON response');
  return JSON.parse(result.body);
}

const USER_STATE = {
  user: { id: '9007199254740993', is_vip: 0, followed: true, mutual_follow: false },
  vip_info: { is_vip: false, vip_type: 0, expire_time: 0 },
  notifications: { count: 5, unread: 3, message: 2 },
};
const keepVideo = { id: 'video', type: 'common_card', extra: { type: 'zvideo' }, common_card: { feed_content: { video: { id: '9223372036854775807', customized_page_url: 'https://www.zhihu.com/zvideo?videoID=123' } } } };
const contentItems = [
  { id: 'answer', type: 'answer', content: '普通回答' }, keepVideo,
  { id: 'live', type: 'common_card', extra: { type: 'drama' } },
  { id: 'paid', type: 'answer', target: { answer_type: 'paid_answer' } },
  { id: 'paid-video', type: 'video', target: { answer_type: 'PAID' } },
  { id: 'salt', type: 'common_card', common_card: { feed_content: { source_line: { elements: [{ text: { panel_text: '作者' } }, { text: { panel_text: '盐选专栏' } }] } } } },
  { id: 'future', type: 'future_card', section_info: { normal: true }, tips: ['普通提示'], biz_type_list: ['article', 'content'] },
];
const advertItems = [
  { id: 'ad', type: 'feed_advert' },
  { id: 'promotion', type: 'common_card', promotion_extra: { campaign_id: 'ad-only' } },
  { id: 'ad-json', type: 'common_card', adjson: { campaign: 1 } },
  { id: 'styled-ad', type: 'common_card', common_card: { style: { type: 'ads' } } },
];

test('module: videos and paid content are separate opt-in filters, both default off', () => {
  assert.match(moduleSource, /^#!name=知乎（去广告与页面净化）$/m);
  assert.deepEqual(defaults(), { hideVideos: '0', hidePaid: '0' });
  const off = scriptEntry().parameters.argument;
  const on = scriptEntry(expanded({ hideVideos: '1', hidePaid: '1' })).parameters.argument;
  assert.equal(off, 'hideVideos=0&hidePaid=0');
  assert.equal(on, 'hideVideos=1&hidePaid=1');
  assert.ok(!expanded().includes('{{{'));
});

test('module: one local runtime with daily checks and valid response sizing', () => {
  const { parameters } = scriptEntry();
  assert.equal(parameters.type, 'http-response');
  assert.ok(['1', 'true'].includes(parameters['requires-body']));
  assert.equal(parameters['max-size'], '-1');
  assert.equal(parameters['script-update-interval'], '86400');
  assert.equal(parameters['script-path'], 'https://raw.githubusercontent.com/wch19830910/wch/main/Surge/Script/Zhihu.js');
  assert.equal(runtimeSource, renderZhihuRuntime(), 'published runtime must match its maintained source');
});

test('routing: all maintained response classes and repaired previously unreachable branches are covered', () => {
  const urls = [
    'https://api.zhihu.com/commercial_api/app_float_layer',
    'https://api.zhihu.com/moments_v3?limit=20',
    'https://api.zhihu.com/topstory/recommend?limit=20',
    'https://api.zhihu.com/topstory/recommend_v2?limit=20',
    'https://api.zhihu.com/v2/topstory/hot-lists/everyone-seeing?limit=20',
    'https://api.zhihu.com/topstory/hot-lists/total?limit=20',
    'https://api.zhihu.com/next-bff?answer_id=1',
    'https://api.zhihu.com/next-data?answer_id=1',
    'https://api.zhihu.com/next-render?answer_id=1',
    'https://api.zhihu.com/v4/questions/123/answers?limit=20',
    'https://api.zhihu.com/questions/123/feeds?limit=20',
    'https://api.zhihu.com/answers/v2/123',
    'https://page-info.zhihu.com/answers/v2/123',
    'https://api.zhihu.com/articles/v2/123',
    'https://www.zhihu.com/api/v4/answers/123/recommendations?limit=20',
    'https://www.zhihu.com/api/v4/articles/123/recommendation?limit=20',
    'https://api.zhihu.com/root/tab/v2',
    'https://api.zhihu.com/feed/render/tab/config?version=1',
    'https://api.zhihu.com/bazaar/vip_tab/header?version=1',
    'https://appcloud2.zhihu.com/v3/config',
    'https://m-cloud.zhihu.com/api/cloud/config/all?version=1',
    'https://api.zhihu.com/search/recommend_query/v2?word=test',
  ];
  const { pattern } = scriptEntry();
  for (const url of urls) assert.ok(pattern.test(url), `missing response route: ${url}`);
  for (const url of ['https://example.com/topstory/recommend', 'https://api.zhihu.com.example.com/topstory/recommend', 'https://api.zhihu.com/people/self', 'https://api.zhihu.com/notifications/v3/count']) {
    assert.ok(!pattern.test(url), `unrelated/user-state route must stay untouched: ${url}`);
  }
});

test('module: user membership, notifications, shared SDKs and ordinary drama feed remain reachable', () => {
  const rules = sectionLines('Rule').join('\n');
  assert.doesNotMatch(rules, /USER-AGENT.*AVOS|zxid-m\.mobileservice\.cn|mqtt\.zhihu\.com/);
  for (const section of ['Map Local', 'URL Rewrite']) {
    for (const line of sectionLines(section)) {
      const pattern = new RegExp(line.match(/^(\S+)/)[1]);
      for (const url of [
        'https://api.zhihu.com/unlimited/go/my_card', 'https://api.zhihu.com/notifications/v3/count',
        'https://api.zhihu.com/me/guides', 'https://api.zhihu.com/drama/hot-drama-list',
        'https://api.zhihu.com/admin/user', 'https://api.zhihu.com/people/self',
      ]) assert.ok(!pattern.test(url), `${section} must not replace a protected endpoint: ${url}`);
    }
  }
  const mitm = sectionLines('MITM').join('\n');
  assert.ok(!mitm.includes('*'), 'MITM should use exact hosts');
  assert.match(mitm, /api\.zhihu\.com/);
  assert.match(mitm, /page-info\.zhihu\.com/);
});

test('recommendations: explicit advertisements are removed while normal videos, live and paid items remain by default', () => {
  const payload = { ...copy(USER_STATE), data: [...copy(contentItems), ...copy(advertItems)], paging: { is_end: false }, future: 'preserve' };
  const result = run('https://api.zhihu.com/topstory/recommend?limit=20', payload);
  assert.equal(result.handled, true);
  assert.deepEqual(result.data.data.map((item) => item.id), contentItems.map((item) => item.id));
  for (const key of Object.keys(USER_STATE)) assert.deepEqual(result.data[key], payload[key]);
  assert.deepEqual(result.data.paging, payload.paging);
  assert.equal(result.data.future, 'preserve');
});

test('content filters: video and paid switches work independently, including a paid video', () => {
  const cases = [
    [{}, ['answer', 'video', 'live', 'paid', 'paid-video', 'salt', 'future']],
    [{ hideVideos: true }, ['answer', 'paid', 'salt', 'future']],
    [{ hidePaid: true }, ['answer', 'video', 'live', 'future']],
    [{ hideVideos: true, hidePaid: true }, ['answer', 'future']],
  ];
  for (const [options, ids] of cases) {
    const result = run('/topstory/recommend', { data: copy(contentItems) }, options);
    assert.deepEqual(result.data.data.map((item) => item.id), ids, JSON.stringify(options));
  }
});

test('regression: normal market-card videos do not reference an undefined item or rewrite large video IDs', () => {
  const market = { id: 'market', type: 'market_card', fields: { header: { url: 'https://www.zhihu.com/zvideo?videoID=9' }, body: { video: { id: '9223372036854775807' } } } };
  const output = runtimeData('https://api.zhihu.com/topstory/recommend', { data: [market, copy(keepVideo)] });
  assert.equal(output.data.length, 2);
  assert.deepEqual(output.data[0], market);
  assert.deepEqual(output.data[1], keepVideo);
});

test('lossless JSON: raw 64-bit integer identifiers survive parsing and advertising removal exactly', () => {
  const body = '{"user":{"id":9007199254740993},"vip_info":{"is_vip":true,"expire_time":9223372036854775806},"notifications":{"count":7},"data":[{"id":9223372036854775807,"type":"common_card","extra":{"type":"zvideo"},"common_card":{"feed_content":{"video":{"id":-9223372036854775808}}}},{"id":9223372036854775805,"type":"feed_advert"}]}';
  const output = runtime('https://api.zhihu.com/topstory/recommend', body);
  for (const token of ['9007199254740993', '9223372036854775806', '9223372036854775807', '-9223372036854775808']) {
    assert.ok(output.body.includes(`:${token}`), `integer token changed: ${token}`);
  }
  assert.equal(JSON.parse(output.body).data.length, 1);
  assert.equal(JSON.parse(output.body).notifications.count, 7);
  assert.equal(JSON.parse(output.body).vip_info.is_vip, true);
  assert.ok(!output.body.includes('"feed_advert"'));
  assert.ok(!output.body.includes('9223372036854775805'), 'a removed advert must not reappear while restoring integer placeholders');
});

test('lossless JSON: existing integer-marker-like strings and escaped keys cannot be converted to numbers', () => {
  const body = String.raw`{"data":[{"id":9223372036854775807,"type":"answer","numeric_text":"9223372036854775807","note":"__SURGE_ZHIHU_INTEGER__0__","escaped":"\u005f_SURGE_ZHIHU_INTEGER__0__"}],"\u005f_SURGE_ZHIHU_INTEGER___0__":"__SURGE_ZHIHU_INTEGER____0__"}`;
  const output = runtime('https://api.zhihu.com/topstory/recommend', body);
  assert.ok(output.body.includes(':9223372036854775807'));
  const parsed = JSON.parse(output.body);
  assert.equal(parsed.data[0].note, '__SURGE_ZHIHU_INTEGER__0__');
  assert.equal(parsed.data[0].numeric_text, '9223372036854775807');
  assert.equal(parsed.data[0].escaped, '__SURGE_ZHIHU_INTEGER__0__');
  assert.equal(parsed.__SURGE_ZHIHU_INTEGER___0__, '__SURGE_ZHIHU_INTEGER____0__');
});

test('advertising detection: words containing ad and empty promotion metadata do not erase normal content', () => {
  const items = [
    { id: 'adventure', type: 'adventure_card', resource_type: 'download' },
    { id: 'roadmap', type: 'answer', origin_data: { resource_type: 'roadmap' } },
    { id: 'empty-promotion', type: 'common_card', promotion_extra: {}, ad: false, adjson: null },
    { id: 'ordinary-section', type: 'article', tips: ['help'], section_info: { title: 'normal' } },
  ];
  const output = run('/topstory/recommend', { data: [...copy(items), { id: 'real-ad', type: 'ad_card' }] }).data;
  assert.deepEqual(output.data, items);
});

test('negative and unknown enum values: NOT_PAID, unpaid, not_ad and non_ad are not interpreted as paid or advertising', () => {
  const items = [
    ...['NOT_PAID', 'non_paid', 'not-paid', 'unpaid', 'future_paid_variant'].map((answer_type) => ({ id: answer_type, type: 'answer', target: { answer_type } })),
    ...['not_ad', 'non_ad', 'adventure', 'download', 'future_ad_variant'].map((type) => ({ id: type, type })),
  ];
  const output = run('/topstory/recommend', { data: copy(items) }, { hidePaid: true, hideVideos: true }).data;
  assert.deepEqual(output.data, items);
});

test('next-answer routes: ordinary article/content sections and tips are retained; paid removal is opt-in', () => {
  const normal = { id: 'normal', biz_type_list: ['article', 'content'], section_info: { normal: 1 }, tips: ['help'], type: 'answer' };
  for (const [path, data] of [
    ['/next-render', { data: [normal, { id: 'ad', adjson: { id: 1 } }, { id: 'paid', business_type: 'paid_answer' }] }],
    ['/next-bff', { data: [normal, { id: 'ad', origin_data: { type: 'ad' } }, { id: 'paid', target: { answer_type: 'paid_answer' } }] }],
    ['/next-data', { data: { data: [normal, { id: 'ad', type: 'ad' }, { id: 'paid', data: { answer_type: 'PAID' } }] } }],
  ]) {
    const result = run(path, data);
    const output = Array.isArray(result.data.data) ? result.data.data : result.data.data.data;
    assert.deepEqual(output.map((item) => item.id), ['normal', 'paid'], path);
    assert.deepEqual(output[0], normal);
    const filtered = run(path, data, { hidePaid: true });
    const remaining = Array.isArray(filtered.data.data) ? filtered.data.data : filtered.data.data.data;
    assert.deepEqual(remaining.map((item) => item.id), ['normal'], `${path} paid option`);
  }
});

test('questions: advertising metadata is removed without hiding a paid answer or changing account state by default', () => {
  const input = { ...copy(USER_STATE), ad_info: { id: 1 }, query_info: { promotion: true }, data: [{ id: 'normal', target: { answer_type: 'normal' } }, { id: 'paid', target: { answer_type: 'paid_answer' } }] };
  const result = run('/questions/123/feeds', input).data;
  assert.deepEqual(result.data.map((item) => item.id), ['normal', 'paid']);
  assert.ok(!result.ad_info);
  assert.ok(!result.query_info);
  for (const key of Object.keys(USER_STATE)) assert.deepEqual(result[key], input[key]);
  assert.deepEqual(run('/questions/123/feeds', input, { hidePaid: true }).data.data.map((item) => item.id), ['normal']);
});

test('hot lists: promotion markers are filtered without removing normal ranked answers', () => {
  const payload = { data: { data: [{ id: 'normal', target: { metrics_area: { text: '讨论 100' } } }, { id: 'ad', target: { metrics_area: { text: '合作推广' } } }] } };
  const result = run('/v2/topstory/hot-lists/everyone-seeing', payload).data;
  assert.deepEqual(result.data.data.map((item) => item.id), ['normal']);
  const total = run('/topstory/hot-lists/total', { data: [{ id: 'normal' }, { id: 'ad', ad: { id: 1 } }] }).data;
  assert.deepEqual(total.data.map((item) => item.id), ['normal']);
});

test('floating promotion: deletes the actual payload field and retains unrelated response state', () => {
  const input = { ...copy(USER_STATE), feed_egg: { campaign: 1 }, future: { keep: true } };
  const output = runtimeData('https://api.zhihu.com/commercial_api/app_float_layer', input);
  assert.ok(!Object.hasOwn(output, 'feed_egg'));
  assert.deepEqual(output.future, input.future);
  for (const key of Object.keys(USER_STATE)) assert.deepEqual(output[key], input[key]);
});

test('tabs: ordinary discovery, stories and ideas remain; only explicit activity tabs are removed by default', () => {
  const input = { tab_list: [{ tab_name: '推荐' }, { tab_name: '故事' }, { tab_name: '想法' }, { tab_name: '活动', tab_type: 'activity' }, { tab_name: '直播', tab_type: 'live' }] };
  const result = run('/root/tab/v2', input).data;
  assert.deepEqual(result.tab_list.map((item) => item.tab_name), ['推荐', '故事', '想法', '直播']);
  assert.deepEqual(run('/root/tab/v2', input, { hideVideos: true }).data.tab_list.map((item) => item.tab_name), ['推荐', '故事', '想法']);
});

test('server config: matches the real host/path and preserves notifications, membership and video quota', () => {
  const input = { ...copy(USER_STATE), config: { zhcnh_thread_sync: { isOpenLocalDNS: '1', ZHBackUpIP_Switch_Open: '1', dns_ip_detector_operation_lock: '0', LocalDNSSetHostWhiteList: ['api.zhihu.com'], unknown: 'keep' }, zvideo_max_number: 50, is_show_followguide_alert: true, unknown: { keep: true } } };
  const output = runtimeData('https://appcloud2.zhihu.com/v3/config', input);
  assert.equal(output.config.zhcnh_thread_sync.isOpenLocalDNS, '0');
  assert.equal(output.config.zhcnh_thread_sync.ZHBackUpIP_Switch_Open, '0');
  assert.equal(output.config.zvideo_max_number, 50);
  assert.equal(output.config.is_show_followguide_alert, true);
  assert.equal(output.config.zhcnh_thread_sync.unknown, 'keep');
  assert.deepEqual(output.config.unknown, input.config.unknown);
  for (const key of Object.keys(USER_STATE)) assert.deepEqual(output[key], input[key]);
});

test('future containers and null list members never break cleanup or lose user state', () => {
  const urls = ['/topstory/recommend', '/questions/1/feeds', '/next-bff', '/next-data', '/next-render', '/root/tab', '/moments_v3'];
  for (const path of urls) {
    for (const data of [undefined, null, { future: true }, [null, 5, 'future', { id: 'known-future', unknown: true }]]) {
      const input = { ...copy(USER_STATE), future: { keep: true } };
      if (data !== undefined) input.data = data;
      assert.doesNotThrow(() => run(path, input), `${path}: ${JSON.stringify(data)}`);
      const result = run(path, input).data;
      for (const key of Object.keys(USER_STATE)) assert.deepEqual(result[key], input[key]);
      assert.deepEqual(result.future, input.future);
    }
  }
});

test('runtime arguments: module query values toggle only the requested filter and invalid values keep defaults', () => {
  const input = { data: copy(contentItems) };
  const video = runtimeData('https://api.zhihu.com/topstory/recommend', input, 'hideVideos=1&hidePaid=0');
  assert.deepEqual(video.data.map((item) => item.id), ['answer', 'paid', 'salt', 'future']);
  const paid = runtimeData('https://api.zhihu.com/topstory/recommend', input, 'hideVideos=0&hidePaid=1');
  assert.deepEqual(paid.data.map((item) => item.id), ['answer', 'video', 'live', 'future']);
  const invalid = runtimeData('https://api.zhihu.com/topstory/recommend', input, 'hideVideos=unexpected&hidePaid=unexpected');
  assert.deepEqual(invalid.data.map((item) => item.id), contentItems.map((item) => item.id));
});

test('runtime failures: empty, malformed, scalar and unrelated responses fail open exactly once without I/O', () => {
  for (const body of [undefined, '', '<html>gateway error</html>', '{broken', 'null', 'true', '7', '"text"']) {
    assert.deepEqual(runtime('https://api.zhihu.com/topstory/recommend', body), {}, String(body));
  }
  assert.deepEqual(runtime('https://api.zhihu.com/people/self', JSON.stringify(USER_STATE)), {});
});

test('upstream guard: new script sources, wildcard hosts and account blocking require review', () => {
  assert.doesNotThrow(() => parseSource(upstreamSource));
  const ownScript = 'https://raw.githubusercontent.com/zirawell/R-Store/main/Res/Scripts/AntiAd/zhihu.js';
  for (const changed of [
    upstreamSource.replace(ownScript, 'https://example.com/unreviewed.js'),
    upstreamSource.replace('api.zhihu.com, www.zhihu.com', '*.zhihu.com, www.zhihu.com'),
    `${upstreamSource}\n[Header Rewrite]\n^https://api.zhihu.com/people/self header-replace x-test 1`,
    upstreamSource.replace('103.41.167.237/32', '103.41.0.0/16'),
  ]) {
    assert.notEqual(changed, upstreamSource, 'the fixture must change actual upstream content');
    assert.throws(() => parseSource(changed));
  }
  assert.throws(() => validateUpstreamScript('$done({});\n// changed after audit'));
});

test('download failure: previous module, runtime and references remain byte-for-byte and mtime-identical', async () => {
  const before = await Promise.all(OUTPUT_URLS.map(async (url) => ({ body: await readFile(url), mtime: (await stat(url)).mtimeMs })));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('synthetic upstream unavailable'); };
  try { await assert.rejects(() => main(), /synthetic upstream unavailable/); }
  finally { globalThis.fetch = originalFetch; }
  for (const [index, url] of OUTPUT_URLS.entries()) {
    assert.ok((await readFile(url)).equals(before[index].body), url.pathname);
    assert.equal((await stat(url)).mtimeMs, before[index].mtime, url.pathname);
  }
});

test('native Surge CLI: expanded module is a valid temporary complete profile', { skip: !existsSync(SURGE_CLI) && 'Surge CLI is not installed on this host' }, async () => {
  let profile = expanded().replace(/hostname\s*=\s*%APPEND%\s*/g, 'hostname = ');
  profile = profile.replace(/(\[Rule\]\n)([\s\S]*?)(?=\n\[|$)/, '$1$2\nFINAL,DIRECT\n');
  const directory = await mkdtemp(join(tmpdir(), 'zhihu-profile-'));
  const path = join(directory, 'profile.conf');
  try {
    await writeFile(path, profile, 'utf8');
    const result = spawnSync(SURGE_CLI, ['--check', path], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /OK/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
