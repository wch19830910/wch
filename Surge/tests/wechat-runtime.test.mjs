#!/usr/bin/env node
// Independently authored behavioral checks using synthetic responses only.
// No upstream JavaScript or captured account data is loaded or executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { transformResponse, buildScript } from '../scripts/wechat-runtime.mjs';

const URLS = Object.freeze({
  familyMart: 'https://minifm.maxxipoint.com/banner/list',
  ems: 'https://ump.ems.com.cn/new-generation-extend/redis/pageInfoByChannel',
  coco: 'https://coco-com.e.verystar.net/v1/home/info',
  qingju: 'https://htwkop.xiaojukeji.com/gateway?api=hm.fa.homeConfig',
  official: 'https://mp.weixin.qq.com/mp/getappmsgad',
});
const DEFAULT_HEADERS = Object.freeze({ 'Content-Type': 'application/json; charset=utf-8' });

function apply(kind, body, extra = {}) {
  return transformResponse({ url: URLS[kind], body, status: 200, headers: DEFAULT_HEADERS, ...extra });
}
const parse = JSON.parse;

test('FamilyMart: only the direct topBanner field is removed and unrelated raw text is preserved', () => {
  const original = '{\n "id":900719925474099312345, "data": {"topBanner":[{"ad":true}], "normal" : { "id":900719925474099312346, "topBanner":"nested-normal" }, "name":"全家正常会员页"}, "appid":"keep"\n}';
  const result = apply('familyMart', original);
  const expected = parse(original);
  delete expected.data.topBanner;
  assert.deepEqual(parse(result), expected);
  assert.ok(result.includes('"id":900719925474099312345'));
  assert.ok(result.includes('"normal" : { "id":900719925474099312346, "topBanner":"nested-normal" }'));
  assert.ok(result.includes('"appid":"keep"'));
  for (const missing of ['{"data":{"normal":1}}', '{"data":null}', '{"data":[]}', '{"data":"normal"}', '{"topBanner":[1]}']) {
    assert.equal(apply('familyMart', missing), missing);
  }
});

test('COCO: removes only the direct advertising background and banner list', () => {
  const body = '{"data":{"top_background_url":"https://ads.invalid/banner","bottom_banner_list":[1,2],"menu":{"id":900719925474099312345,"bottom_banner_list":["normal"]},"coupons":[{"id":1}],"balance":12.34},"user":{"vip":true}}';
  const expected = parse(body);
  delete expected.data.top_background_url;
  delete expected.data.bottom_banner_list;
  const result = apply('coco', body);
  assert.deepEqual(parse(result), expected);
  assert.ok(result.includes('"menu":{"id":900719925474099312345,"bottom_banner_list":["normal"]}'));
  assert.ok(result.includes('"user":{"vip":true}'));
  const oneField = '{"data":{"bottom_banner_list":[],"normal":1}}';
  assert.deepEqual(parse(apply('coco', oneField)), { data: { normal: 1 } });
});

test('Qingju: removes the direct banner configuration while retaining trips, benefits and nested data', () => {
  const body = '{"data":{"bannerInfoConfig":{"ad":1},"trip":{"id":900719925474099312345,"amount":18.88},"benefits":[1],"other":{"bannerInfoConfig":"normal"}},"ret":0}';
  const expected = parse(body);
  delete expected.data.bannerInfoConfig;
  const result = apply('qingju', body);
  assert.deepEqual(parse(result), expected);
  assert.ok(result.includes('"trip":{"id":900719925474099312345,"amount":18.88}'));
  const reordered = 'https://htwkop.xiaojukeji.com/gateway?scene=wechat&api=hm.fa.homeConfig&version=1';
  assert.equal(transformResponse({ url: reordered, body, status: 200, headers: DEFAULT_HEADERS }), result);
});

test('EMS: filters only named advertising modules inside the JSON string and preserves the outer response', () => {
  const inner = '[ { "moduleName":"正常物流", "id":900719925474099312345 }, {"moduleName":"首页广告","ad":1}, {"moduleName":"包裹服务","normal":{"number":900719925474099312346}} ]';
  const body = '{ "outer_id":900719925474099312347, "info" : { "moduleJson" : ' + JSON.stringify(inner) + ', "tracking" : {"number":"EMS-SYNTHETIC","status":"正常"} }, "unknown" : [ 1, 2 ] }';
  const result = apply('ems', body);
  const parsed = parse(result);
  const modules = parse(parsed.info.moduleJson);
  assert.deepEqual(modules.map((item) => item.moduleName), ['正常物流', '包裹服务']);
  assert.ok(parsed.info.moduleJson.includes('"id":900719925474099312345'));
  assert.ok(parsed.info.moduleJson.includes('"normal":{"number":900719925474099312346}'));
  assert.ok(result.includes('"outer_id":900719925474099312347'));
  assert.ok(result.includes('"tracking" : {"number":"EMS-SYNTHETIC","status":"正常"}'));
  assert.ok(result.includes('"unknown" : [ 1, 2 ]'));
});

test('EMS: unknown mixed array members are retained; malformed or non-array inner JSON passes through', () => {
  const members = [null, '未知字符串', 123, {}, { moduleName: null }, { moduleName: 123 }, { moduleName: '正常服务' }, { moduleName: '广告横幅', ad: 1 }];
  const body = JSON.stringify({ info: { moduleJson: JSON.stringify(members), ordinary: 'keep' } });
  const result = apply('ems', body);
  assert.deepEqual(parse(parse(result).info.moduleJson), members.slice(0, -1));
  for (const inner of ['{"moduleName":"广告"}', 'invalid', '[{"moduleName":"广告"}', 'null']) {
    const malformed = JSON.stringify({ info: { moduleJson: inner, ordinary: 'keep' } });
    assert.equal(apply('ems', malformed), malformed);
  }
  for (const missing of ['{"info":null}', '{"info":{"moduleJson":[]}}', '{"data":{"moduleJson":"[]"}}']) {
    assert.equal(apply('ems', missing), missing);
  }
});

test('each mini-program option can turn its transformation off without changing response bytes', () => {
  const fixtures = {
    familyMart: '{"data":{"topBanner":[1],"normal":1}}',
    ems: '{"info":{"moduleJson":"[{\\"moduleName\\":\\"广告\\"}]"}}',
    coco: '{"data":{"top_background_url":"ad","bottom_banner_list":[1],"normal":1}}',
    qingju: '{"data":{"bannerInfoConfig":{"ad":1},"normal":1}}',
  };
  for (const [key, body] of Object.entries(fixtures)) {
    assert.notEqual(apply(key, body), body, key + ' default should handle this known advertisement');
    assert.equal(apply(key, body, { options: { [key]: false } }), body, key + ' false must preserve exact bytes');
  }
});

test('official-account experiment is off by default and only clears the two recognized root fields when enabled', () => {
  const body = '{\n "advertisement_num" : 2, "advertisement_info" : [{"id":1},{"id":2}], "appid" : "ordinary-app", "user_id":900719925474099312345, "normal" : {"advertisement_num":3,"advertisement_info":[1]}, "content":"公众号正文 \\"广告\\""\n}';
  assert.equal(apply('official', body), body);
  assert.equal(apply('official', body, { options: { officialAccountExperimental: false } }), body);
  const result = apply('official', body, { options: { officialAccountExperimental: true } });
  const expected = parse(body);
  expected.advertisement_num = 0;
  expected.advertisement_info = [];
  assert.deepEqual(parse(result), expected);
  assert.ok(result.includes('"advertisement_num" : 0'));
  assert.ok(result.includes('"advertisement_info" : []'));
  assert.ok(result.includes('"appid" : "ordinary-app"'));
  assert.ok(result.includes('"user_id":900719925474099312345'));
  assert.ok(result.includes('"normal" : {"advertisement_num":3,"advertisement_info":[1]}'));
  const alreadyClean = '{ "advertisement_num" : 0, "advertisement_info" : [], "appid":"ordinary" }';
  assert.equal(apply('official', alreadyClean, { options: { officialAccountExperimental: true } }), alreadyClean);
});

test('official-account experiment ignores incomplete, nested-only, wrong-type and error responses', () => {
  const fixtures = [
    '{"advertisement_info":[1],"normal":1}',
    '{"advertisement_num":1,"normal":1}',
    '{"data":{"advertisement_num":1,"advertisement_info":[1]}}',
    '{"advertisement_num":"1","advertisement_info":[1]}',
    '{"advertisement_num":-1,"advertisement_info":[1]}',
    '{"advertisement_num":1.5,"advertisement_info":[1]}',
    '{"advertisement_num":1e-999,"advertisement_info":[1]}',
    '{"advertisement_num":99.999999999999999,"advertisement_info":[1]}',
    '{"advertisement_num":1,"advertisement_info":{}}',
    '{"ret":1,"advertisement_num":1,"advertisement_info":[1]}',
    '{"errcode":400,"advertisement_num":1,"advertisement_info":[1]}',
    '{"code":500,"advertisement_num":1,"advertisement_info":[1]}',
    '{"code":"unknown","advertisement_num":1,"advertisement_info":[1]}',
    '{"success":false,"advertisement_num":1,"advertisement_info":[1]}',
  ];
  for (const body of fixtures) {
    assert.equal(apply('official', body, { options: { officialAccountExperimental: true } }), body, body);
  }
});

test('routing: ordinary business URLs, spoofed hosts, path suffixes and duplicate Qingju api parameters pass through', () => {
  const body = '{"data":{"topBanner":[1],"top_background_url":"ad","bottom_banner_list":[1],"bannerInfoConfig":{}},"info":{"moduleJson":"[{\\"moduleName\\":\\"广告\\"}]"},"advertisement_num":1,"advertisement_info":[1]}';
  const untouched = [
    'http://minifm.maxxipoint.com/banner/list',
    'https://minifm.maxxipoint.com/banner/listMore',
    'https://minifm.maxxipoint.com/banner/list/extra',
    'https://minifm.maxxipoint.com.example.org/banner/list',
    'https://minifm.maxxipoint.com:443/banner/list',
    'https://user@minifm.maxxipoint.com/banner/list',
    'https://ump.ems.com.cn/new-generation-extend/redis/pageInfoByChannelOther',
    'https://ump.ems.com.cn/tracking/query',
    'https://coco-com.e.verystar.net/v1/home/info/extra',
    'https://coco-com.e.verystar.net/v1/order/create',
    'https://htwkop.xiaojukeji.com/gateway?api=hm.fa.homeConfigOther',
    'https://htwkop.xiaojukeji.com/gateway?api=hm.fa.homeConfig&api=other',
    'https://htwkop.xiaojukeji.com/gateway?api=other&api=hm.fa.homeConfig',
    'https://htwkop.xiaojukeji.com/gateway?scene=hm.fa.homeConfig',
    'https://htwkop.xiaojukeji.com/gatewayExtra?api=hm.fa.homeConfig',
    'https://htwkop.xiaojukeji.com/order?api=hm.fa.homeConfig',
    'https://mp.weixin.qq.com/mp/getappmsgadExtra',
    'https://mp.weixin.qq.com/mp/getappmsgad/extra',
    'https://mp.weixin.qq.com.example.org/mp/getappmsgad',
    'https://mp.weixin.qq.com/s?__biz=ordinary-article',
    'https://pay.weixin.qq.com/pay/orderquery',
    'https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb',
    'https://channels.weixin.qq.com/cgi-bin/finder/list',
    'https://szextshort.weixin.qq.com/cgi-bin/micromsg-bin/sync',
    'https://weixin110.qq.com/cgi-bin/mmspamsupport-bin/newredirectconfirmcgi?url=ordinary',
    'https://example.org/wp-json/plugin/v1/posts',
  ];
  for (const url of untouched) {
    assert.equal(transformResponse({ url, body, status: 200, headers: DEFAULT_HEADERS, options: { officialAccountExperimental: true } }), body, url);
  }
});

test('HTTP and JSON guards retain errors, non-JSON payloads, malformed syntax and duplicate keys', () => {
  const body = '{"data":{"topBanner":[1],"normal":1}}';
  for (const status of [199, 301, 400, 500, undefined, 'unknown']) {
    assert.equal(apply('familyMart', body, { status }), body, String(status));
  }
  for (const headers of [{ 'Content-Type': 'text/html' }, { 'content-type': 'text/plain; charset=utf-8' }]) {
    assert.equal(apply('familyMart', body, { headers }), body);
  }
  assert.notEqual(apply('familyMart', body, { headers: {} }), body);
  assert.notEqual(apply('familyMart', body, { status: 'HTTP/1.1 200 OK', headers: { 'CONTENT-TYPE': 'application/problem+json' } }), body);
  for (const code of [0, 200, '0', '200']) {
    const successful = JSON.stringify({ code, data: { topBanner: [1], normal: 1 } });
    assert.notEqual(apply('familyMart', successful), successful, 'recognized successful business code ' + code);
    assert.deepEqual(parse(apply('familyMart', successful)), { code, data: { normal: 1 } });
  }
  for (const erroneous of [
    '{"ret":1,"data":{"topBanner":[1]}}',
    '{"errcode":-1,"data":{"topBanner":[1]}}',
    '{"success":false,"data":{"topBanner":[1]}}',
    '{"code":500,"data":{"topBanner":[1]}}',
    '{"code":"500","data":{"topBanner":[1]}}',
    '{"code":"unknown","data":{"topBanner":[1]}}',
    '{"code":null,"data":{"topBanner":[1]}}',
    '{"code":{},"data":{"topBanner":[1]}}',
    '{"code":199.999999999999999,"data":{"topBanner":[1]}}',
    '{"code":1e-999,"data":{"topBanner":[1]}}',
    '<html>{"data":{"topBanner":[1]}}</html>',
    '{"data":{"topBanner":[1]}',
    '{"data":{"topBanner":[1]},}',
    '{"data":{"topBanner":[1]}} trailing',
    '{"data":{"topBanner":[1],"topBanner":[2]}}',
    '{"data":{"topBanner":[1],"normal":{"a":1,"a":2}}}',
    '{"data":{"topBanner":[1],"\\u0074opBanner":[2]}}',
  ]) assert.equal(apply('familyMart', erroneous), erroneous, erroneous);
  for (const unusual of [null, undefined, 123, {}, [], '']) assert.equal(apply('familyMart', unusual), unusual);
});

test('body size and nesting limits pass through instead of partially editing', () => {
  const deep = '{"data":{"topBanner":[1],"nested":' + '['.repeat(70) + '0' + ']'.repeat(70) + '}}';
  assert.equal(apply('familyMart', deep), deep);
  const largeUtf8 = '{"data":{"topBanner":[1],"text":"' + '😀'.repeat(300_000) + '"}}';
  assert.ok(Buffer.byteLength(largeUtf8, 'utf8') > 1024 * 1024);
  assert.equal(apply('familyMart', largeUtf8), largeUtf8);
});

function runWrapper({ url, body, argument, status = 200, headers = DEFAULT_HEADERS }) {
  const done = [], capabilityCalls = [];
  const forbidden = (name) => new Proxy(function () {}, {
    get(_target, key) { return forbidden(name + '.' + String(key)); },
    apply() { capabilityCalls.push(name); throw new Error('Forbidden capability: ' + name); },
    construct() { capabilityCalls.push(name); throw new Error('Forbidden constructor: ' + name); },
  });
  const context = {
    $request: { url }, $response: { body, status, headers },
    $done: (value) => done.push(value),
    $httpClient: forbidden('$httpClient'), $task: forbidden('$task'),
    $notification: forbidden('$notification'), $persistentStore: forbidden('$persistentStore'),
    $prefs: forbidden('$prefs'), $httpAPI: forbidden('$httpAPI'),
    fetch: forbidden('fetch'), XMLHttpRequest: forbidden('XMLHttpRequest'),
    WebSocket: forbidden('WebSocket'), require: forbidden('require'),
  };
  if (argument !== undefined) context.$argument = argument;
  runInNewContext(buildScript(), context, { timeout: 2000 });
  assert.equal(done.length, 1, 'Surge wrapper must complete exactly once');
  assert.deepEqual(capabilityCalls, [], 'local transformation must not access external capabilities');
  return done[0];
}

test('Surge wrapper: default and argument toggles complete once without network, notification or storage access', () => {
  const body = '{"data":{"topBanner":[1],"normal":1}}';
  const enabled = runWrapper({ url: URLS.familyMart, body });
  assert.equal(typeof enabled?.body, 'string');
  assert.deepEqual(parse(enabled.body), { data: { normal: 1 } });
  const disabled = runWrapper({ url: URLS.familyMart, body, argument: 'familyMart=false,ems=true,coco=true,qingju=true,officialAccountExperimental=false' });
  assert.equal(disabled?.body, undefined);
  const officialBody = '{"advertisement_num":1,"advertisement_info":[1],"appid":"keep"}';
  assert.equal(runWrapper({ url: URLS.official, body: officialBody })?.body, undefined);
  const officialOn = runWrapper({ url: URLS.official, body: officialBody, argument: 'officialAccountExperimental=true' });
  assert.deepEqual(parse(officialOn.body), { advertisement_num: 0, advertisement_info: [], appid: 'keep' });
  const malformed = runWrapper({ url: URLS.familyMart, body: 'not JSON' });
  assert.equal(malformed?.body, undefined);
});
