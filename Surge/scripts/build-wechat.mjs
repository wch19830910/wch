#!/usr/bin/env node
// Original rule references: ddgksf2013 / 墨鱼. Modified 2026-10-26 for native Surge publishing.
// Attribution and source restrictions: Surge/licenses/ddgksf2013-WeChat-NOTICE.txt.
// Third-party JavaScript is statically reviewed, never executed, saved or published by this builder.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { buildScript } from './wechat-runtime.mjs';

export const SOURCE_URLS = Object.freeze({
  startup: 'https://ddgksf2013.top/rewrite/StartUpAds.conf',
  applet: 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/refs/heads/master/AdBlock/Applet.conf',
  bus: 'https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/zhangshanggongjiao.js',
  miniPrograms: encodeURI('https://raw.githubusercontent.com/QingRex/LoonKissSurge/main/Surge/Beta/微信小程序去广告.beta.sgmodule'),
});
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUTS = ['AdBlock/WeChat.sgmodule', 'upstream/WeChat.sources.json', 'Script/WeChat.js'].map((path) => resolve(ROOT, path));
const RAW_URL = 'https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/WeChat.sgmodule';
const SCRIPT_URL = 'https://raw.githubusercontent.com/wch19830910/wch/main/Surge/Script/WeChat.js';
const NOTICE_URL = 'https://github.com/wch19830910/wch/blob/main/Surge/licenses/ddgksf2013-WeChat-NOTICE.txt';
const LEGACY_NOTICE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/refs/heads/master/AdBlock/WeChat.conf';
const DIGEST = (text) => createHash('sha256').update(text).digest('hex');
const MAX_SOURCE_BYTES = 1024 * 1024;
const STARTUP_RULES = Object.freeze({
  WeChat110: [String.raw`;^https\:\/\/(weixin110\.qq|security.wechat)\.com\/cgi-bin\/mmspamsupport-bin\/newredirectconfirmcgi\? url script-response-body https://raw.githubusercontent.com/ddgksf2013/Scripts/master/weixin110.js`],
  weixindaihuo: [String.raw`^https?:\/\/mp\.weixin\.qq\.com\/mp\/cps_product_info url reject-200`],
  WeChat: [
    String.raw`^https?:\/\/mp\.weixin\.qq\.com\/mp\/relatedsearchword url reject-200`,
    String.raw`^https?:\/\/mp\.weixin\.qq\.com\/mp\/getappmsgad url response-body advertisement response-body ddgksf2013`,
  ],
});
const APPLET_RULES = Object.freeze({
  '小程序_便利蜂@ddgksf2013': String.raw`^https?:\/\/api\.blibee\.com\/cvsnotify-api\/cvs\/notify\/app\/banner\/v\d+$ url reject-200`,
  '小程序_顺丰速运@ddgksf2013': String.raw`^https?:\/\/ucmp\.sf-express\.com\/proxy\/operation-platform\/info-flow-adver\/query$ url reject-200`,
  '公众号_图文去广告@ddgksf2013': String.raw`^(http|https):\/\/mp\.weixin\.qq\.com\/mp\/getappmsgad url response-body advertisement response-body ddgksf2013`,
  '小程序_掌上公交@ddgksf2013': String.raw`^https?:\/\/wx\.mygolbs\.com\/WxBusServer\/ApiData\.do url script-response-body https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/zhangshanggongjiao.js`,
  '小程序_去广告@ddgksf2013': String.raw`^(https?://)?([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}(:\d+)?/wp-json/[a-zA-Z0-9_-]+/(mp\/)?v\d/posts url script-response-body https://raw.githubusercontent.com/ddgksf2013/Scripts/refs/heads/master/applet.js`,
});
const APPLET_HOSTS = 'api.blibee.com, ucmp.sf-express.com, www.bbkj.work, wx.wxqqurl.cn, wp3.lobdol.cn, awg.enmonster.com, mp.weixin.qq.com, wx.mygolbs.com, jabi.coding.net, api.bspapp.com, 3dd0be8a-54fe-43ff-a0e7-f670c4f20432.bspapp.com, *.tslt.xyz, g.syshhc.top, c.jxjt888.top, www.laoguikeji.cn, qj.bpojie.com, b.tslt.xyz, m.xgjyouhui.com, www.freeheikeji.cn, xcx.xianbaow.com, *.smkj33.top, *.ddly666.top, hkj178.com, a.jxjt888.top, lysl2020.com, www.i3zh.com, iosoi.cn, jabi.coding.net, jt.jxjt888.top, gjsx.vip, d.syshhc.top, gz.gongzijx.com, tvapp.guilaile.cn, www.benbenfx.xyz, 4thdimension.top, api.bspapp.com, tan.ipnas.ltd'.split(', ').filter((host, index, all) => all.indexOf(host) === index).sort();
const MAP_LOCAL = Object.freeze([
  { name: '公众号带货商品信息', pattern: String.raw`^https?:\/\/mp\.weixin\.qq\.com\/mp\/cps_product_info(?:\?|$)` },
  { name: '公众号相关搜索词', pattern: String.raw`^https?:\/\/mp\.weixin\.qq\.com\/mp\/relatedsearchword(?:\?|$)` },
  { name: '便利蜂小程序横幅', pattern: String.raw`^https?:\/\/api\.blibee\.com\/cvsnotify-api\/cvs\/notify\/app\/banner\/v\d+$` },
  { name: '顺丰速运小程序信息流广告', pattern: String.raw`^https?:\/\/ucmp\.sf-express\.com\/proxy\/operation-platform\/info-flow-adver\/query$` },
]);
const BODY_REWRITE = Object.freeze({
  url: String.raw`^https?:\/\/wx\.mygolbs\.com\/WxBusServer\/ApiData\.do(?:\?|$)`,
  replacements: [
    { find: String.raw`(?<!\\)\x22Ad\x22\s*:\s*1(?=\s*[,}])`, replacement: '"Ad":0' },
    { find: String.raw`(?<!\\)\x22Ad_ab\x22\s*:\s*1(?=\s*[,}])`, replacement: '"Ad_ab":0' },
  ],
});
const HOSTS = Object.freeze(['mp.weixin.qq.com', 'api.blibee.com', 'ucmp.sf-express.com', 'wx.mygolbs.com']);
export const MINI_PROGRAM_REFERENCES = Object.freeze([
  { key: 'familyMart', title: '全家微会员去广告', host: 'minifm.maxxipoint.com', path: '/banner/list', referenceUrl: 'https://kelee.one/Resource/JavaScript/WexinMiniPrograms/FamilyMart/FamilyMart.js', reviewedSha256: 'e25457f43eacfbf27ca8229445e69f60f7562ece723b5ebaf07969c0ebf75e1c', behavior: '仅删除对象 data 的 topBanner 自有字段', upstreamLine: String.raw`全家微会员去广告 = type=http-response, pattern=^https:\/\/minifm\.maxxipoint\.com\/banner\/list, script-path=https://kelee.one/Resource/JavaScript/WexinMiniPrograms/FamilyMart/FamilyMart.js, requires-body=true` },
  { key: 'ems', title: 'EMS中国邮政物流速递去广告', host: 'ump.ems.com.cn', path: '/new-generation-extend/redis/pageInfoByChannel', referenceUrl: 'https://kelee.one/Resource/JavaScript/WexinMiniPrograms/ems/ems.js', reviewedSha256: '2208e4945d8781e5bc9d20a436fc141629a7e4dc9fd516f9fe917196010cf5bc', behavior: '仅在 info.moduleJson 的 JSON 字符串数组中移除 moduleName 字符串含广告的对象，其余项保留', upstreamLine: String.raw`EMS中国邮政物流速递去广告 = type=http-response, pattern=^https:\/\/ump\.ems\.com\.cn\/new-generation-extend\/redis\/pageInfoByChannel, script-path=https://kelee.one/Resource/JavaScript/WexinMiniPrograms/ems/ems.js, requires-body=true` },
  { key: 'coco', title: 'COCO点单去广告', host: 'coco-com.e.verystar.net', path: '/v1/home/info', referenceUrl: 'https://kelee.one/Resource/JavaScript/WexinMiniPrograms/coco/coco.js', reviewedSha256: 'dc9a1915eed8f6f760a8f3a03f5e2f5a0f346373693ae4ac2e0c5dbd90fd46b3', behavior: '仅删除对象 data 的 top_background_url 与 bottom_banner_list 自有字段', upstreamLine: String.raw`COCO点单去广告 = type=http-response, pattern=^https:\/\/coco-com\.e\.verystar\.net\/v1\/home\/info, script-path=https://kelee.one/Resource/JavaScript/WexinMiniPrograms/coco/coco.js, requires-body=true` },
  { key: 'qingju', title: '滴滴青桔去广告', host: 'htwkop.xiaojukeji.com', path: '/gateway', api: 'hm.fa.homeConfig', referenceUrl: 'https://kelee.one/Resource/JavaScript/WexinMiniPrograms/qingju/qingju.js', reviewedSha256: '8664e7a22b21aaa8546ec167e3a43fee7ebd2c00552a126212720b09a4819bf8', behavior: '仅删除对象 data 的 bannerInfoConfig 自有字段，要求唯一 api 参数精确匹配', upstreamLine: String.raw`滴滴青桔去广告 = type=http-response, pattern=^https:\/\/htwkop\.xiaojukeji\.com\/gateway\?api=hm\.fa\.homeConfig, script-path=https://kelee.one/Resource/JavaScript/WexinMiniPrograms/qingju/qingju.js, requires-body=true` },
]);
export const OPTION_DEFAULTS = Object.freeze({ familyMart: true, ems: true, coco: true, qingju: true, officialAccountExperimental: false });
export const SCRIPT_PATTERN = String.raw`^https:\/\/(?:minifm\.maxxipoint\.com\/banner\/list(?:\?[^#]*)?|ump\.ems\.com\.cn\/new-generation-extend\/redis\/pageInfoByChannel(?:\?[^#]*)?|coco-com\.e\.verystar\.net\/v1\/home\/info(?:\?[^#]*)?|htwkop\.xiaojukeji\.com\/gateway\?(?:[^#&]*&)*api=hm\.fa\.homeConfig(?:&[^#]*)?|mp\.weixin\.qq\.com\/mp\/getappmsgad(?:\?[^#]*)?)$`;

function fail(label, message) { throw new Error(`${label}：${message}；保留旧成品。`); }
function sourceMetadata(source, kind) {
  if (typeof source !== 'string' || !source.trim()) fail(kind, '来源为空');
  const metadata = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*\/\/\s*@([A-Za-z]+)\s+(.+)$/);
    if (match && ['ScriptName', 'Author', 'UpdateTime'].includes(match[1])) {
      if (metadata[match[1]]) fail(kind, '重复来源元信息');
      metadata[match[1]] = match[2].trim();
    }
  }
  if (!/^@?ddgksf2013$/.test(metadata.Author ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.UpdateTime ?? '')) fail(kind, '缺少预期作者或更新日期');
  return metadata;
}

export function parseStartupSource(source) {
  const metadata = sourceMetadata(source, '墨鱼去开屏');
  if (!(metadata.ScriptName ?? '').includes('墨鱼去开屏')) fail('墨鱼去开屏', '来源名称变化');
  const blocks = new Map(); let current;
  for (const [index, original] of source.split(/\r?\n/).entries()) {
    const text = original.trim();
    const title = text.match(/^#\s*>\s*(.+)$/)?.[1];
    if (title) {
      current = Object.hasOwn(STARTUP_RULES, title) ? title : undefined;
      if (!current && /wechat|weixin/i.test(title)) fail('墨鱼去开屏', '出现未审核微信条目');
      if (current) { if (blocks.has(current)) fail('墨鱼去开屏', '微信条目重复'); blocks.set(current, []); }
    } else if (current && text && !/^(?:#|\/\/)/.test(text)) {
      if (text.startsWith('hostname')) { current = undefined; continue; }
      blocks.get(current).push({ title: current, line: index + 1, text });
    }
  }
  for (const [title, expected] of Object.entries(STARTUP_RULES)) {
    const actual = blocks.get(title);
    if (!actual || actual.length !== expected.length || actual.some((line, index) => line.text !== expected[index])) fail('墨鱼去开屏', `${title} 的域名、路径、动作或启用状态发生未审核变化`);
  }
  const selected = [blocks.get('weixindaihuo')[0], blocks.get('WeChat')[0]];
  const excluded = [
    { ...blocks.get('WeChat')[1], reason: '公众号 getappmsgad 文本替换在独立 WeChat.conf 中被原作者标为已失效，未启用。', noticeUrl: LEGACY_NOTICE_URL },
    { ...blocks.get('WeChat110')[0], reason: '上游禁用的外链安全提示处理，保持排除。' },
  ];
  return { metadata, selected, excluded };
}

export function parseAppletSource(source) {
  const metadata = sourceMetadata(source, '微信小程序');
  if (metadata.ScriptName !== '微信小程序去除广告[墨鱼版]') fail('微信小程序', '来源名称变化');
  const blocks = new Map(); let current, hosts;
  for (const [index, original] of source.split(/\r?\n/).entries()) {
    const text = original.trim();
    if (!text || /^(?:\/\/|#(?!\s*>))/.test(text)) continue;
    const title = text.match(/^#\s*>\s*(.+)$/)?.[1];
    if (title) {
      if (!Object.hasOwn(APPLET_RULES, title) || blocks.has(title)) fail('微信小程序', '未知或重复条目');
      current = title; blocks.set(title, []); continue;
    }
    const hostname = text.match(/^hostname\s*=\s*(.+)$/);
    if (hostname) {
      if (hosts) fail('微信小程序', '重复主机声明');
      hosts = [...new Set(hostname[1].split(',').map((host) => host.trim()))].sort(); continue;
    }
    if (!current) fail('微信小程序', '配置不属于已审核条目');
    blocks.get(current).push({ title: current, line: index + 1, text });
  }
  if (JSON.stringify(hosts) !== JSON.stringify(APPLET_HOSTS) || blocks.size !== Object.keys(APPLET_RULES).length) fail('微信小程序', '主机或条目数量发生未审核变化');
  for (const [title, expected] of Object.entries(APPLET_RULES)) {
    const lines = blocks.get(title);
    if (!lines || lines.length !== 1 || lines[0].text !== expected) fail('微信小程序', `${title} 的域名、路径、动作或脚本来源发生未审核变化`);
  }
  const selected = ['小程序_便利蜂@ddgksf2013', '小程序_顺丰速运@ddgksf2013', '小程序_掌上公交@ddgksf2013'].map((title) => blocks.get(title)[0]);
  const excluded = [
    { ...blocks.get('公众号_图文去广告@ddgksf2013')[0], reason: '与去开屏中的旧 getappmsgad 规则重复，且独立规则已标失效；未启用。', noticeUrl: LEGACY_NOTICE_URL },
    { ...blocks.get('小程序_去广告@ddgksf2013')[0], reason: '通用 WordPress 文章处理含隐藏内容访问行为，超出本模块广告范围；未引入。' },
  ];
  return { metadata, selected, excluded };
}

export function validateBusScript(source) {
  if (typeof source !== 'string' || !source.trim()) fail('掌上公交参考脚本', '来源为空');
  try { new Script(source, { filename: SOURCE_URLS.bus }); }
  catch (error) { fail('掌上公交参考脚本', `语法无法编译：${error.message}`); }
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  const marker = stripped.match(/\bvar\s+body\s*=\s*/g);
  if (!marker || marker.length !== 1) fail('掌上公交参考脚本', '正文操作声明变化');
  const index = stripped.search(/\bvar\s+body\s*=\s*/);
  const prefix = stripped.slice(0, index).trim();
  if (prefix) {
    const match = prefix.match(/^var\s+cuttlefish\s*=\s*(\{[^\n]*\})\s*;$/);
    let declaration;
    try { declaration = match && JSON.parse(match[1]); } catch { /* fail below */ }
    if (!declaration || Object.keys(declaration).sort().join(',') !== 'feedback,tgchannel,warning' || Object.values(declaration).some((value) => typeof value !== 'string')) fail('掌上公交参考脚本', '元信息声明含未审核行为');
  }
  const operations = stripped.slice(index).replace(/\s/g, '').replace(/;(?=\$done)/, '');
  const expected = "varbody=$response.body.replace(/Ad\":1/g,'Ad\":0').replace(/Ad_ab\":1/g,'Ad_ab\":0')$done({body});";
  if (operations !== expected) fail('掌上公交参考脚本', '不再是已审核的两次广告标志替换与完成回调');
  return { sha256: DIGEST(source), originalReplacements: [{ find: 'Ad":1', replacement: 'Ad":0' }, { find: 'Ad_ab":1', replacement: 'Ad_ab":0' }], policy: '仅静态核对两次替换；不执行、不保存或发布原脚本。' };
}

export function parseMiniProgramSource(source) {
  if (typeof source !== 'string' || !source.trim()) fail('小程序扩展来源', '来源为空');
  if (!/^#!name=微信小程序去广告$/m.test(source) || !/^#!author=可莉/m.test(source)) fail('小程序扩展来源', '模块名称或署名变化');
  const selected = [];
  for (const reference of MINI_PROGRAM_REFERENCES) {
    const matches = source.split(/\r?\n/).map((text, index) => ({ text: text.trim(), line: index + 1 })).filter(({ text }) => text.startsWith(`${reference.title} =`));
    if (matches.length !== 1 || matches[0].text !== reference.upstreamLine) fail('小程序扩展来源', `${reference.title} 的路径、主机或来源发生未审核变化`);
    selected.push({ key: reference.key, title: reference.title, line: matches[0].line, text: matches[0].text, host: reference.host, path: reference.path, ...(reference.api ? { api: reference.api } : {}), behavior: reference.behavior, referenceUrl: reference.referenceUrl, reviewedSha256: reference.reviewedSha256, reviewDate: '2026-10-26', referenceOnly: true });
  }
  return { sha256: DIGEST(source), selected, policy: '只监测四条已审核配置；不下载、执行或发布可莉脚本，独立实现不自动继承原脚本变化。' };
}

export function parseSources(sources) {
  const startup = parseStartupSource(sources.startup), applet = parseAppletSource(sources.applet), bus = validateBusScript(sources.bus), miniPrograms = parseMiniProgramSource(sources.miniPrograms);
  for (const item of MAP_LOCAL) new RegExp(item.pattern);
  new RegExp(BODY_REWRITE.url);
  for (const pair of BODY_REWRITE.replacements) new RegExp(pair.find);
  new RegExp(SCRIPT_PATTERN);
  return { startup, applet, bus, miniPrograms, mapLocal: MAP_LOCAL.map((item) => ({ ...item })), bodyRewrite: { ...BODY_REWRITE, replacements: BODY_REWRITE.replacements.map((item) => ({ ...item })) }, hosts: [...new Set([...HOSTS, ...MINI_PROGRAM_REFERENCES.map(({ host }) => host)])] };
}

export function renderModule(sources, parsed) {
  const body = `http-response ${parsed.bodyRewrite.url} ${parsed.bodyRewrite.replacements.map(({ find, replacement }) => `${find} ${JSON.stringify(replacement)}`).join(' ')}`;
  return [
    '#!name=微信（公众号推广与部分小程序去广告）',
    '#!desc=处理公众号带货与相关搜索词，便利蜂、顺丰、掌上公交，以及全家横幅、EMS广告模块、COCO背景/底部横幅、青桔横幅。新增四项可独立关闭；公众号广告字段清理是默认关闭的兼容性实验，需手动开启并在手机验收。保留四条本地响应和公交正文重写，新增五个精确目标由本仓库独立响应脚本处理，异常或未知结构原样放行，保留其他原文字节和大整数。每6小时检查已审核来源；本仓库脚本每24小时检查更新，不下载可莉或Belcheck脚本。需Surge iOS 5.10+ / Mac 5.6+，开启重写、脚本与MITM并信任证书。不处理朋友圈、视频号或全部小程序5秒开屏；未手机实测。',
    '#!author=ddgksf2013（基础规则）；wch19830910（独立扩展）；可莉 / QingRex、NobyDa / Belcheck（行为与接口参考）',
    '#!category=AdBlock',
    '#!homepage=https://github.com/ddgksf2013/Rewrite',
    `#!raw-url=${RAW_URL}`,
    `#!arguments=${Object.entries(OPTION_DEFAULTS).map(([key, value]) => `${key}:${value}`).join(',')}`,
    '#!arguments-desc=familyMart=全家横幅；ems=EMS广告模块；coco=COCO背景与横幅；qingju=青桔横幅（四项默认true，可填false关闭）。officialAccountExperimental=公众号广告字段兼容性实验，默认false；填true仅尝试清理已识别响应，尚未手机验证。',
    '', '# 原作者：ddgksf2013 / 墨鱼；兼容整理日期：2026-10-26。',
    `# 来源署名及限制：${NOTICE_URL}`,
    `# 去开屏来源：${SOURCE_URLS.startup}`,
    `# 小程序来源：${SOURCE_URLS.applet}`,
    `# 公交行为参考：${SOURCE_URLS.bus}（仅静态审查，不发布原脚本）`,
    `# 小程序接口参考：${SOURCE_URLS.miniPrograms}（不复制其脚本实现）`,
    '# 公众号接口线索：NobyDa；数据保留设计参考：https://github.com/belcheckyoung/Belcheck-QX-AdBlock/blob/main/Docs/WeChatAdClean.md',
    `# 来源SHA256：startup=${DIGEST(sources.startup)}；applet=${DIGEST(sources.applet)}；bus=${parsed.bus.sha256}；miniPrograms=${parsed.miniPrograms.sha256}`,
    '# 自动生成；显示名称和说明请修改 Surge/scripts/build-wechat.mjs，直接改成品会被同步覆盖。',
    '# 原五个目标保留；新增四个小程序目标和一个默认关闭的公众号实验，合计八个精确MITM主机；没有整域拒绝、会员或隐藏内容处理。',
    '# 公交仅将完整JSON键 Ad / Ad_ab 的数字1改为0；保留10、其他键、字符串和未知字段。',
    '# 不启用旧 getappmsgad 字符串替换、WeChat110 或 WordPress 通用脚本；公众号新实验默认透传，参考记录见 Surge/upstream/WeChat.sources.json。',
    '# 下载、解析或范围验证失败时不发布新成品。',
    '', '[Map Local]',
    ...parsed.mapLocal.flatMap(({ name, pattern }) => [`# ${name}`, `${pattern} data-type=text data="" status-code=200`]),
    '', '[Body Rewrite]', body,
    '', '[Script]', `WeChat_Selected = type=http-response,pattern=${SCRIPT_PATTERN},requires-body=true,max-size=1048576,timeout=5,script-path=${SCRIPT_URL},script-update-interval=86400,argument="${Object.keys(OPTION_DEFAULTS).map((key) => `${key}={{{${key}}}}`).join(',')}"`,
    '', '[MITM]', `hostname = %APPEND% ${parsed.hosts.join(', ')}`, '',
  ].join('\n');
}

export function renderSources(sources, parsed) {
  return JSON.stringify({
    schemaVersion: 2, author: 'ddgksf2013 / 墨鱼（基础）；本仓库独立扩展', notice: NOTICE_URL,
    sources: {
      startup: { url: SOURCE_URLS.startup, sha256: DIGEST(sources.startup), metadata: parsed.startup.metadata, selected: parsed.startup.selected, excluded: parsed.startup.excluded, policy: '只审查微信条目；其他App增删不影响范围验证。' },
      applet: { url: SOURCE_URLS.applet, sha256: DIGEST(sources.applet), metadata: parsed.applet.metadata, selected: parsed.applet.selected, excluded: parsed.applet.excluded, policy: '审核全部5条原规则和主机集合，仅启用3项选择。' },
      bus: { url: SOURCE_URLS.bus, ...parsed.bus },
      miniPrograms: { url: SOURCE_URLS.miniPrograms, ...parsed.miniPrograms },
      officialAccountExperiment: { referenceOnly: true, urls: ['https://raw.githubusercontent.com/NobyDa/Script/master/QuantumultX/File/Wechat.js', 'https://github.com/belcheckyoung/Belcheck-QX-AdBlock/blob/main/Docs/WeChatAdClean.md'], implementation: '独立编写JSON span编辑；不复制、不下载参考实现。', defaultEnabled: false, limitation: '同一旧接口的兼容性实验，尚未手机验证。' },
    },
    generatedScope: { mapLocal: parsed.mapLocal, bodyRewrite: parsed.bodyRewrite, mitmHosts: parsed.hosts, ownScript: { url: SCRIPT_URL, pattern: SCRIPT_PATTERN, options: OPTION_DEFAULTS, sha256: DIGEST(buildScript()) } },
    modifications: ['保留原5个目标，增加4项可关闭的小程序精确处理及默认关闭公众号实验', '原四条reject-200转换为空HTTP200本地响应', '公众号与公交URL增加端点边界', '公交完整JSON键及数字1边界替代原宽泛替换', '独立JSON span编辑保留其他原始文本和大整数；EMS只重编码目标字符串字段', '保留登录、聊天、支付、会员与外链安全提醒', '旧getappmsgad字符串替换保持排除；新结构化实验明确区分且默认关闭', '不引入WordPress隐藏内容脚本', '不执行或发布上游JavaScript正文；扩展脚本仅来自本仓库独立实现'],
    testingLimit: '配置与合成样本测试，不代表最新版微信或所有小程序的设备实测结果。',
  }, null, 2) + '\n';
}

async function fetchSource(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Surge iOS/5.14.0' } });
  if (!response.ok || response.url !== url) fail('下载来源', `失败或出现未审核跳转：HTTP ${response.status} ${url}`);
  if (Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) fail('下载来源', '内容过大');
  const source = await response.text();
  if (!source.trim() || Buffer.byteLength(source) > MAX_SOURCE_BYTES || /^\s*(?:<!doctype\s+html|<html\b)/i.test(source)) fail('下载来源', '内容为空、过大或返回网页');
  return source;
}
async function writeIfChanged(path, content) {
  let existing;
  try { existing = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing === content) return false;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, content, 'utf8'); await rename(temporary, path); return true;
}
export async function main() {
  if (process.argv.slice(2).some((argument) => argument !== '--check')) throw new Error('用法：node Surge/scripts/build-wechat.mjs [--check]');
  const sources = Object.fromEntries(await Promise.all(Object.entries(SOURCE_URLS).map(async ([key, url]) => [key, await fetchSource(url)])));
  const parsed = parseSources(sources), script = buildScript(), module = renderModule(sources, parsed), references = renderSources(sources, parsed);
  new Script(script, { filename: 'WeChat.js' });
  console.log('微信构建验证通过：原5个目标、新4项小程序与默认关闭公众号实验，8个精确MITM主机；只使用本仓库扩展脚本。');
  if (process.argv.includes('--check')) { console.log('只检查，不写入产物。'); return; }
  const changed = [];
  for (const [index, content] of [module, references, script].entries()) if (await writeIfChanged(OUTPUTS[index], content)) changed.push(OUTPUTS[index]);
  console.log(changed.length ? `已更新 ${changed.length} 份模块或来源记录。` : '内容无变化。');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
