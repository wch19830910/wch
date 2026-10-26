#!/usr/bin/env node
// Offline routing, native rewrite and publication checks. No upstream JavaScript is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { SOURCE_URLS, parseStartupSource, parseAppletSource, validateBusScript, parseSources, main } from '../scripts/build-wechat.mjs';

const OUTPUTS = [new URL('../AdBlock/WeChat.sgmodule', import.meta.url), new URL('../upstream/WeChat.sources.json', import.meta.url)];
const [moduleSource, snapshotText] = await Promise.all(OUTPUTS.map((url) => readFile(url, 'utf8')));
const sourceSnapshot = JSON.parse(snapshotText);
const SURGE_CLI = '/Applications/Surge.app/Contents/Applications/surge-cli';

// Minimal static fixtures preserve the reviewed transformation facts and source attribution.
// These strings are parsed as data only. No upstream script is loaded into a JavaScript VM.
const SOURCE_FIXTURES = {
  startup: String.raw`// @ScriptName 墨鱼去开屏2.0
// @Author @ddgksf2013
// @UpdateTime 2026-08-29
# > WeChat110
;^https\:\/\/(weixin110\.qq|security.wechat)\.com\/cgi-bin\/mmspamsupport-bin\/newredirectconfirmcgi\? url script-response-body https://raw.githubusercontent.com/ddgksf2013/Scripts/master/weixin110.js
# > weixindaihuo
^https?:\/\/mp\.weixin\.qq\.com\/mp\/cps_product_info url reject-200
# > WeChat
^https?:\/\/mp\.weixin\.qq\.com\/mp\/relatedsearchword url reject-200
^https?:\/\/mp\.weixin\.qq\.com\/mp\/getappmsgad url response-body advertisement response-body ddgksf2013
`,
  applet: String.raw`// @ScriptName 微信小程序去除广告[墨鱼版]
// @Author ddgksf2013
// @UpdateTime 2023-09-13
hostname = api.blibee.com, ucmp.sf-express.com, www.bbkj.work, wx.wxqqurl.cn, wp3.lobdol.cn, awg.enmonster.com, mp.weixin.qq.com, wx.mygolbs.com, jabi.coding.net, api.bspapp.com, 3dd0be8a-54fe-43ff-a0e7-f670c4f20432.bspapp.com, *.tslt.xyz, g.syshhc.top, c.jxjt888.top, www.laoguikeji.cn, qj.bpojie.com, b.tslt.xyz, m.xgjyouhui.com, www.freeheikeji.cn, xcx.xianbaow.com, *.smkj33.top, *.ddly666.top, hkj178.com, a.jxjt888.top, lysl2020.com, www.i3zh.com, iosoi.cn, jabi.coding.net, jt.jxjt888.top, gjsx.vip, d.syshhc.top, gz.gongzijx.com, tvapp.guilaile.cn, www.benbenfx.xyz, 4thdimension.top, api.bspapp.com, tan.ipnas.ltd
# > 小程序_便利蜂@ddgksf2013
^https?:\/\/api\.blibee\.com\/cvsnotify-api\/cvs\/notify\/app\/banner\/v\d+$ url reject-200
# > 小程序_顺丰速运@ddgksf2013
^https?:\/\/ucmp\.sf-express\.com\/proxy\/operation-platform\/info-flow-adver\/query$ url reject-200
# > 公众号_图文去广告@ddgksf2013
^(http|https):\/\/mp\.weixin\.qq\.com\/mp\/getappmsgad url response-body advertisement response-body ddgksf2013
# > 小程序_掌上公交@ddgksf2013
^https?:\/\/wx\.mygolbs\.com\/WxBusServer\/ApiData\.do url script-response-body https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/zhangshanggongjiao.js
# > 小程序_去广告@ddgksf2013
^(https?://)?([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}(:\d+)?/wp-json/[a-zA-Z0-9_-]+/(mp\/)?v\d/posts url script-response-body https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/applet.js
`,
  bus: String.raw`var body = $response.body.replace(/Ad":1/g, 'Ad":0').replace(/Ad_ab":1/g, 'Ad_ab":0'); $done({ body });`,
};

function mockedSources(raw = SOURCE_FIXTURES) {
  return async (url) => {
    const key = Object.keys(SOURCE_URLS).find((key) => SOURCE_URLS[key] === String(url));
    assert.ok(key && Object.hasOwn(raw, key), `unexpected source download: ${url}`);
    return { ok: true, status: 200, url: SOURCE_URLS[key], headers: new Headers(), text: async () => raw[key] };
  };
}

function sectionLines(wanted, source = moduleSource) {
  let section;
  const result = [];
  for (const original of source.split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) { section = heading[1]; continue; }
    if (section === wanted) result.push(line);
  }
  return result;
}

const mapLines = sectionLines('Map Local');
const localPatterns = mapLines.map((line) => new RegExp(line.match(/^(\S+)/)[1]));
const busRules = sectionLines('Body Rewrite').map((line) => {
  const words = line.match(/"(?:\\.|[^"\\])*"|\S+/g);
  assert.equal(words?.length, 6, 'one bus rewrite needs exactly two replacement pairs');
  assert.equal(words[0], 'http-response');
  return {
    pattern: new RegExp(words[1]),
    replacements: [[words[2], JSON.parse(words[3])], [words[4], JSON.parse(words[5])]],
  };
});
const matches = (url) => [...localPatterns, ...busRules.map((rule) => rule.pattern)].filter((pattern) => pattern.test(url));
function busBody(body) {
  return busRules[0].replacements.reduce((result, [find, replacement]) => result.replace(new RegExp(find, 'g'), replacement), body);
}
async function snapshot() {
  return Promise.all(OUTPUTS.map(async (url) => ({ body: await readFile(url), mtime: (await stat(url)).mtimeMs })));
}
async function unchanged(before) {
  for (const [index, url] of OUTPUTS.entries()) {
    assert.ok((await readFile(url)).equals(before[index].body), `${url.pathname}: published bytes changed`);
    assert.equal((await stat(url)).mtimeMs, before[index].mtime, `${url.pathname}: modification time changed`);
  }
}

test('module: only four precise local responses, one bus rewrite and four exact MITM hosts are enabled', () => {
  assert.match(moduleSource, /^#!name=.*微信/m);
  assert.match(moduleSource, /ddgksf2013|墨鱼/);
  assert.equal(mapLines.length, 4);
  assert.equal(new Set(mapLines.map((line) => line.match(/^(\S+)/)[1])).size, 4);
  for (const line of mapLines) assert.match(line, /\bdata-type=text\s+data=""\s+status-code=200(?:\s|$)/);
  assert.equal(busRules.length, 1);
  const mitm = sectionLines('MITM');
  assert.equal(mitm.length, 1);
  const hosts = mitm[0].replace(/^hostname\s*=\s*%APPEND%\s*/, '').split(',').map((host) => host.trim());
  assert.deepEqual(hosts.sort(), ['api.blibee.com', 'mp.weixin.qq.com', 'ucmp.sf-express.com', 'wx.mygolbs.com'].sort());
  assert.equal(new Set(hosts).size, 4);
  assert.deepEqual(sectionLines('Rule'), []);
  assert.deepEqual(sectionLines('Script'), []);
  assert.deepEqual(sectionLines('URL Rewrite'), []);
  assert.deepEqual(sectionLines('Header Rewrite'), []);
  assert.ok(!moduleSource.includes('script-path='));
});

test('routing: five advertised endpoints match once, preserving the two upstream query-free anchors', () => {
  const routes = [
    ['mp.weixin.qq.com', '/mp/cps_product_info'],
    ['mp.weixin.qq.com', '/mp/relatedsearchword'],
    ['api.blibee.com', '/cvsnotify-api/cvs/notify/app/banner/v1'],
    ['api.blibee.com', '/cvsnotify-api/cvs/notify/app/banner/v12'],
    ['ucmp.sf-express.com', '/proxy/operation-platform/info-flow-adver/query'],
    ['wx.mygolbs.com', '/WxBusServer/ApiData.do'],
  ];
  for (const scheme of ['http', 'https']) {
    for (const [host, path] of routes) {
      const queries = ['mp.weixin.qq.com', 'wx.mygolbs.com'].includes(host) ? ['', '?test=synthetic&v=1'] : [''];
      for (const query of queries) {
        const url = `${scheme}://${host}${path}${query}`;
        assert.equal(matches(url).length, 1, url);
      }
    }
  }
});

test('routing: ordinary WeChat, payment, mini-program business and safety pages stay outside the module', () => {
  const untouched = [
    'https://mp.weixin.qq.com/cgi-bin/login',
    'https://mp.weixin.qq.com/mp/profile_ext?action=home',
    'https://mp.weixin.qq.com/s?__biz=normal-article',
    'https://mp.weixin.qq.com/s/normal-article',
    'https://mp.weixin.qq.com/mp/appmsg_search?action=search',
    'https://mp.weixin.qq.com/cgi-bin/searchbiz',
    'https://mp.weixin.qq.com/mp/getappmsgad?f=json',
    'https://mp.weixin.qq.com/mp/cps_product_info-extra',
    'https://mp.weixin.qq.com/mp/relatedsearchwordExtra',
    'https://weixin.qq.com/cgi-bin/micromsg-bin/newsendmsg',
    'https://szextshort.weixin.qq.com/cgi-bin/micromsg-bin/sync',
    'https://szextshort.weixin.qq.com/cgi-bin/micromsg-bin/mmsnstimeline',
    'https://pay.weixin.qq.com/pay/orderquery',
    'https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb',
    'https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/post/get_post_list',
    'https://weixin110.qq.com/cgi-bin/mmspamsupport-bin/newredirectconfirmcgi?url=synthetic',
    'https://security.wechat.com/cgi-bin/mmspamsupport-bin/newredirectconfirmcgi?url=synthetic',
    'https://ucmp.sf-express.com/proxy/order/create',
    'https://ucmp.sf-express.com/proxy/operation-platform/info-flow-adver/queryMore',
    'https://ucmp.sf-express.com/proxy/operation-platform/info-flow-adver/query?test=synthetic',
    'https://api.blibee.com/cvs-order-api/order/create',
    'https://api.blibee.com/cvsnotify-api/cvs/notify/app/banner/v1/extra',
    'https://api.blibee.com/cvsnotify-api/cvs/notify/app/banner/v1?test=synthetic',
    'https://api.blibee.com/cvsnotify-api/cvs/notify/app/banner/vx',
    'https://wx.mygolbs.com/WxBusServer/ApiData.doExtra',
    'https://wx.mygolbs.com/WxBusServer/other.do',
    'https://example.org/wp-json/plugin/v1/posts',
    'https://test.freeheikeji.com/wp-json/plugin/v1/posts',
    'https://mp.weixin.qq.com.example.org/mp/relatedsearchword',
    'https://mpxweixinxqqxcom/mp/cps_product_info',
    'https://api.blibee.com.example.org/cvsnotify-api/cvs/notify/app/banner/v1',
    'https://ucmp.sf-express.com.example.org/proxy/operation-platform/info-flow-adver/query',
    'https://wx.mygolbs.com.example.org/WxBusServer/ApiData.do',
    'ftp://mp.weixin.qq.com/mp/relatedsearchword',
  ];
  for (const url of untouched) assert.equal(matches(url).length, 0, url);
});

test('bus response: only complete Ad and Ad_ab keys with numeric value 1 become zero', () => {
  const payload = {
    Ad: 1, Ad_ab: 1,
    route: { id: '9007199254740993', name: '正常公交路线', arrival: 10, Ad: 1, Ad_ab: 0 },
    isAd: 1, fooAd: 1, Ad_more: 1, Ad_ab_more: 1,
    flags: [{ Ad: 10, Ad_ab: 11 }, { Ad: '1', Ad_ab: '1' }, { Ad: 1.5, Ad_ab: -1 }],
    content: '文字中的 "Ad":1, 和 "Ad_ab":1, 必须保留',
    user: { vip: 0, is_vip: false, balance: 1 },
  };
  const expected = structuredClone(payload);
  expected.Ad = 0;
  expected.Ad_ab = 0;
  expected.route.Ad = 0;
  const original = JSON.stringify(payload, null, 2);
  assert.deepEqual(JSON.parse(busBody(original)), expected);
  const rawLargeInteger = '{"Ad":1,"Ad_ab":1,"normal_id":9007199254740993,"content":"\\\"Ad\\\":1,"}';
  assert.equal(busBody(rawLargeInteger), '{"Ad":0,"Ad_ab":0,"normal_id":9007199254740993,"content":"\\\"Ad\\\":1,"}');
  assert.equal(busBody('{"Ad":10,"Ad_ab":11,"isAd":1}'), '{"Ad":10,"Ad_ab":11,"isAd":1}');
  assert.equal(busBody('{"route":"normal","arrivals":[1,10,11]}'), '{"route":"normal","arrivals":[1,10,11]}');
});

test('source merge: reviewed fixtures select four local responses, one native bus operation and exact hosts', () => {
  const parsed = parseSources(SOURCE_FIXTURES);
  assert.equal(parsed.mapLocal.length, 4);
  assert.equal(parsed.bodyRewrite.replacements.length, 2);
  assert.deepEqual([...parsed.hosts].sort(), ['api.blibee.com', 'mp.weixin.qq.com', 'ucmp.sf-express.com', 'wx.mygolbs.com'].sort());
  assert.ok(sourceSnapshot && typeof sourceSnapshot === 'object');
  assert.ok(!JSON.stringify(parsed.mapLocal).includes('getappmsgad'));
  assert.ok(!JSON.stringify(parsed.mapLocal).includes('wp-json'));
  assert.ok(!JSON.stringify(parsed.mapLocal).includes('weixin110'));
});

test('source guard: new selected domains, scripts and broad paths require review before publication', () => {
  assert.doesNotThrow(() => parseStartupSource(SOURCE_FIXTURES.startup));
  assert.doesNotThrow(() => parseAppletSource(SOURCE_FIXTURES.applet));
  const badStartup = [
    SOURCE_FIXTURES.startup.replace('mp\\.weixin\\.qq\\.com\\/mp\\/cps_product_info', '.*\\.qq\\.com\\/mp\\/cps_product_info'),
    SOURCE_FIXTURES.startup.replace('/mp\\/relatedsearchword', '/mp\\/'),
    SOURCE_FIXTURES.startup.replace('url reject-200', 'url script-response-body https://example.org/unreviewed.js'),
  ];
  for (const source of badStartup) {
    assert.notEqual(source, SOURCE_FIXTURES.startup, 'guard fixture must change the startup source');
    assert.throws(() => parseStartupSource(source));
  }
  const badApplet = [
    SOURCE_FIXTURES.applet.replace('hostname = api.blibee.com,', 'hostname = *.blibee.com,'),
    SOURCE_FIXTURES.applet.replace('zhangshanggongjiao.js', 'new-handler.js'),
    `${SOURCE_FIXTURES.applet}\n# > 小程序_新接口\n^https://example.org/new-api url script-response-body https://example.org/unreviewed.js\n`,
  ];
  for (const source of badApplet) {
    assert.notEqual(source, SOURCE_FIXTURES.applet, 'guard fixture must change the applet source');
    assert.throws(() => parseAppletSource(source));
  }
});

test('bus source guard: additional executable behavior or changed replacement values are not inherited', () => {
  assert.doesNotThrow(() => validateBusScript(SOURCE_FIXTURES.bus));
  const mutations = [
    SOURCE_FIXTURES.bus.replace('Ad":1/g', 'Ad":10/g'),
    SOURCE_FIXTURES.bus.replace(String.raw`'Ad":0'`, String.raw`'Ad":1'`),
    `${SOURCE_FIXTURES.bus}\n$httpClient.get('https://example.org/unreviewed');`,
    SOURCE_FIXTURES.bus.replace('$done({ body });', 'body = body.replace(/is_vip\\":0/g, \'is_vip\\":1\'); $done({ body });'),
  ];
  for (const source of mutations) {
    assert.notEqual(source, SOURCE_FIXTURES.bus, 'guard fixture must change the script');
    assert.throws(() => validateBusScript(source));
  }
});

test('download failure retains both previously published files and their modification times', async () => {
  const before = await snapshot();
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('synthetic WeChat source unavailable'); };
  try { await assert.rejects(() => main(), /synthetic WeChat source unavailable/); }
  finally { globalThis.fetch = savedFetch; }
  await unchanged(before);
});

test('check-only mode validates changed metadata without writing either published file', async () => {
  const before = await snapshot();
  const savedFetch = globalThis.fetch;
  const savedArgv = process.argv;
  const changed = { ...SOURCE_FIXTURES, startup: SOURCE_FIXTURES.startup.replace('2026-08-29', '2026-08-30') };
  assert.notEqual(changed.startup, SOURCE_FIXTURES.startup);
  globalThis.fetch = mockedSources(changed);
  process.argv = [...savedArgv, '--check'];
  try { await main(); }
  finally { globalThis.fetch = savedFetch; process.argv = savedArgv; }
  await unchanged(before);
});

test('native Surge CLI accepts the module as a complete temporary profile', { skip: !existsSync(SURGE_CLI) && 'Surge CLI is not installed on this host' }, async () => {
  const profile = moduleSource.replace(/hostname\s*=\s*%APPEND%\s*/g, 'hostname = ') + '\n[Rule]\nFINAL,DIRECT\n';
  const directory = await mkdtemp(join(tmpdir(), 'wechat-profile-'));
  const path = join(directory, 'profile.conf');
  try {
    await writeFile(path, profile, 'utf8');
    const result = spawnSync(SURGE_CLI, ['--check', path], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /OK/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
