#!/usr/bin/env node
// Node.js 20+。墨鱼主干与独立自定义功能整合；不执行下载的脚本。
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { customizeNetEase } from './netease-customize.mjs';
import { renderMergedNetEaseScript } from './netease-runtime.mjs';

const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/NeteaseAds.conf';
const SCRIPT_URL = 'https://gist.githubusercontent.com/ddgksf2013/4f53b7c6083678df25fecc8ff68b52c4/raw/netease.adblock.js';
const KEY_MODULE_URL = 'https://raw.githubusercontent.com/Keywos/rule/refs/heads/main/script/wy/wy.sgmodule';
const KEY_SCRIPT_URL = 'https://raw.githubusercontent.com/Keywos/rule/main/script/wy/js/wyres.js';
// 新 URL 的查询参数用于让旧模块升级时取得新脚本；后续仍按这个固定地址远程更新。
const REMOTE_SCRIPT = 'https://raw.githubusercontent.com/wch19830910/wch/main/Surge/Script/NetEaseMusic.js?v=merged-1';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/NetEaseMusic.sgmodule');
const OUTPUT_SCRIPT = resolve(SURGE_ROOT, 'Script/NetEaseMusic.js');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/NeteaseAds.conf');
const OUTPUT_REFERENCES = resolve(SURGE_ROOT, 'upstream/NetEaseMusic.references.json');
const CHECK_ONLY = process.argv.includes('--check');
const AUDITED_SHA256 = new Map([
  [SOURCE_URL, '3d09d41ed78536e091612afd10fc471455ae82b274bbbf2f0b37399078e1677b'],
  [SCRIPT_URL, '6ba468eb994e3843d69563f8f3b31c2d63a62a68d60fc3a1fd61947c1546936f'],
  [KEY_MODULE_URL, '088b5d872f5c34ff79e6947a950d4d3093e6b91291a872eb7819f118ff434324'],
  [KEY_SCRIPT_URL, 'b729d3f27bcb4992b7dc8d82ef7563af7b2a1380976f55975166f68defe3c393'],
]);
const ARGUMENTS = [
  ['hideDiscover', 0, '隐藏底部发现'], ['hideRoam', 0, '隐藏底部漫游'], ['hideNotes', 0, '隐藏底部笔记'],
  ['hideGreeting', 0, '隐藏首页问候语'], ['hideDailyRecommend', 0, '隐藏每日推荐'],
  ['hidePlaylistRecommend', 0, '隐藏推荐歌单'], ['hideRecentPlayed', 0, '隐藏最近常听'],
  ['hideMusicPartner', 0, '隐藏音乐合伙人'], ['hideRadar', 0, '隐藏雷达歌单'], ['hideRanking', 0, '隐藏排行榜'],
  ['hideMyPlaylist', 0, '隐藏推荐专属歌单'], ['hideCombinationPlaylist', 0, '隐藏你的专属歌单'],
  ['cleanCommentDecorations', 1, '精简评论区头像挂件与装饰（保留会员及关注状态）'],
  ['showNotFollowingBack', 0, '在关注列表显示未回关提示'],
];

if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('用法：node Surge/scripts/build-netease-music.mjs [--check]');
}

async function fetchText(url, maxBytes) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'NetEaseMusic-Surge-native-builder/1.0' },
  });
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status} ${url}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error(`远程文件过大：${url}`);
  const body = await response.text();
  if (!body.trim() || Buffer.byteLength(body, 'utf8') > maxBytes) throw new Error(`远程文件为空或过大：${url}`);
  if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(body)) throw new Error(`远程地址返回了网页：${url}`);
  return body;
}

function requireAudited(url, text) {
  const digest = createHash('sha256').update(text).digest('hex');
  if (digest !== AUDITED_SHA256.get(url)) {
    throw new Error(`上游发生变化，须人工兼容审查并更新测试后再发布：${url}（${digest}）；保留旧成品。`);
  }
  return digest;
}

function fail(lineNumber, message) {
  throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`);
}

function parseSource(source) {
  const sections = { 'Map Local': [] };
  const counts = { 'reject-200': 0, 'script-response-body': 0 };
  const scriptPatterns = [];
  let hostnames;
  let previousComment;
  let version = '';
  let author = '';

  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = original.trim();
    const lineNumber = index + 1;
    if (!line) continue;
    if (line.startsWith('//')) {
      const metadata = line.match(/^\/\/\s*@(Version|Author)\s+(.+)$/);
      if (metadata?.[1] === 'Version') version = metadata[2].trim();
      if (metadata?.[1] === 'Author') author = metadata[2].trim().replace(/^@/, '');
      continue;
    }
    if (line.startsWith('#')) {
      previousComment = line;
      continue;
    }
    if (/^hostname\s*=/.test(line)) {
      if (hostnames) fail(lineNumber, '出现了多份 hostname 声明');
      hostnames = line.replace(/^hostname\s*=\s*/, '').split(',').map((host) => host.trim());
      if (hostnames.length !== 1 || hostnames[0] !== 'interface*.music.163.com') {
        fail(lineNumber, 'MITM 主机范围改变，需人工核对');
      }
      previousComment = undefined;
      continue;
    }
    const match = line.match(/^(\S+)\s+url\s+(\S+)(?:\s+(.+))?$/);
    if (!match) fail(lineNumber, `不认识的配置语法：${line}`);
    const [, pattern, action, argument = ''] = match;
    if (!Object.hasOwn(counts, action)) fail(lineNumber, `不支持的命令 ${action}`);
    try { new RegExp(pattern); } catch (error) { fail(lineNumber, `无法编译正则：${error.message}`); }
    if (!pattern.startsWith('^https?:\\/\\/interface') || !pattern.includes('\\.music\\.163\\.com\\/')) {
      fail(lineNumber, '规则范围离开网易云接口，需人工核对');
    }

    let section;
    let converted;
    if (action === 'reject-200') {
      if (argument) fail(lineNumber, 'reject-200 不应携带参数');
      section = 'Map Local';
      converted = `${pattern} data-type=text data="" status-code=200`;
    } else {
      if (pattern.includes(',')) fail(lineNumber, '脚本正则含逗号，不能安全转换为参数列表');
      if (argument !== SCRIPT_URL) fail(lineNumber, `脚本源改变，需人工核对：${argument}`);
      scriptPatterns.push(pattern);
      previousComment = undefined;
      counts[action] += 1;
      continue;
    }
    if (previousComment) sections[section].push(previousComment);
    sections[section].push(converted);
    previousComment = undefined;
    counts[action] += 1;
  }
  if (!hostnames || !counts['reject-200'] || !counts['script-response-body'] || author !== 'ddgksf2013') {
    throw new Error('上游缺少 hostname、有效规则或原作者声明；保留旧成品。');
  }
  return { sections, counts, scriptPatterns, hostnames, version, author };
}

const THIRD_PARTY_NOTICES = `
Bundled third-party libraries in the original upstream script:

CryptoJS 4.1.1 — https://github.com/brix/crypto-js/blob/4.1.1/LICENSE
Copyright (c) 2009-2013 Jeff Mott
Copyright (c) 2013-2016 Evan Vosberg

pako — https://github.com/nodeca/pako/blob/2.1.0/LICENSE
Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn

The MIT License (applies to CryptoJS and pako's MIT-licensed portions):
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

pako's zlib-derived portions:
https://github.com/nodeca/pako/blob/2.1.0/lib/zlib/inflate.js
(C) 1995-2013 Jean-loup Gailly and Mark Adler
(C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
`;

function renderScript(javascript) {
  if (!javascript.includes('CryptoJS') || !javascript.includes('pako') || !javascript.includes('isQuanX') || !javascript.includes('eapiDecrypt')) {
    throw new Error('上游脚本结构改变，需人工核对兼容性；保留旧成品。');
  }
  const script = renderMergedNetEaseScript(javascript, customizeNetEase.toString(), THIRD_PARTY_NOTICES);
  try { new Script(script, { filename: 'NetEaseMusic.js' }); } catch (error) {
    throw new Error('合并脚本语法检查失败，保留旧成品：' + error.message);
  }
  return script;
}

function renderModule(source, javascript, parsed) {
  const upstreamPrefix = '^https?:\\/\\/interface(\\d)?\\.music\\.163\\.com\\/e?api\\/';
  const tails = parsed.scriptPatterns.map((pattern) => {
    if (!pattern.startsWith(upstreamPrefix)) throw new Error('响应接口前缀改变，保留旧成品。');
    return pattern.slice(upstreamPrefix.length);
  });
  tails.push(
    'homepage\\/block\\/page',
    'link\\/page\\/rcmd\\/block\\/resource\\/multi\\/refresh',
    'v\\d\\/resource\\/comment\\/floor\\/get',
    'user\\/follow\\/users\\/mixed\\/get(?:\\/v\\d+)?'
  );
  const pattern = '^https?:\\/\\/(?:interface\\d?|ipv4)\\.music\\.163\\.com\\/e?api\\/(?:'
    + [...new Set(tails)].join('|') + ')(?:[/?]|$)';
  new RegExp(pattern);
  const argument = ARGUMENTS.map(([key]) => key + '={{{' + key + '}}}').join('&');
  const argumentHelp = [
    '0=保留/关闭，1=隐藏/开启。名称为 hide 的选项控制隐藏对应栏目。',
    '默认保留发现、漫游、笔记及九类首页卡片；保留未知卡片，只清理已知广告横幅。',
    '默认开启评论装饰清理；未回关提示默认关闭；真实会员、版权和关注关系不改写。',
    ...ARGUMENTS.map(([key, value, label]) => key + '：' + label + '（默认 ' + value + '）'),
  ].join('\\n');
  const lines = [
    '#!name=网易云音乐（自定义净化）',
    '#!desc=墨鱼广告处理与独立实现的自定义净化合一：处理开屏、搜索、歌单/评论广告、侧栏与活动推广；可分别隐藏底部发现/漫游/笔记及九类首页卡片，可选评论装饰精简与未回关提示。默认保留三类底栏和九类卡片，评论精简开启、未回关提示关闭；保留真实会员数据及关注关系，不包含伪 VIP 或音乐版权解锁。支持明文 JSON、AES 与 gzip，统一入口处理响应。每 6 小时检测双上游，源变化先停止发布等待兼容审查；远程脚本每 24 小时检查更新。需 Surge iOS 5.9.1+ / Mac 5.5.1+，Mac 另需 macOS 11+；开启重写、脚本与 MITM 并信任证书。界面可能因版本不同而变化，异常时请停用；未在最新版 App 实机验证。',
    '#!author=ddgksf2013；Keywos（功能设计参考，未转载其代码）',
    '#!homepage=https://github.com/wch19830910/wch/tree/main/Surge/AdBlock',
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/NetEaseMusic.sgmodule',
    '#!arguments=' + ARGUMENTS.map(([key, value]) => key + ':' + value).join(','),
    '#!arguments-desc=' + argumentHelp,
    '',
    '# 墨鱼配置：' + SOURCE_URL,
    '# 墨鱼脚本：' + SCRIPT_URL,
    '# 功能参考：' + KEY_MODULE_URL,
    '# 本地自定义功能独立编写；不内嵌、转载或运行 Keywos 原脚本。',
    '# 上游规则 SHA256：' + createHash('sha256').update(source).digest('hex'),
    '# 上游脚本 SHA256：' + createHash('sha256').update(javascript).digest('hex'),
    '# 四份上游源均按已审查 hash 保护；变化时停止自动发布，人工兼容审查并测试后才能更新。',
    '# 生成脚本：Surge/scripts/build-netease-music.mjs；自定义源码：netease-customize.mjs / netease-runtime.mjs。',
    '# 单个响应入口，统一解码/处理/编码；参数由 Surge 原生模块参数表保存。',
    '# 为保留真实会员数据，自定义层接管会员侧栏响应，不再将整个会员 data 清空。',
    '# 未合入 Keywos 的伪 VIP、HTTPDNS 全域拒绝和艺术家关注接口拦截。',
    '# 默认保留未知栏目；卡片结构或接口变化时可能不能完全净化，不保证去除全部广告。',
    '',
    '[Map Local]',
    ...parsed.sections['Map Local'].map((line) => line.replace(
      '^https?:\\/\\/interface(\\d)?', '^https?:\\/\\/(?:interface\\d?|ipv4)'
    )),
    '',
    '[Script]',
    'netease_music_merged = type=http-response,pattern=' + pattern
      + ',requires-body=true,binary-body-mode=true,engine=webview,max-size=-1,timeout=60,script-update-interval=86400,script-path='
      + REMOTE_SCRIPT + ',argument="' + argument + '"',
    '',
    '[MITM]',
    'hostname = %APPEND% interface*.music.163.com, ipv4.music.163.com',
    '',
  ];
  return lines.join('\n');
}

async function readExisting(path) {
  try { return await readFile(path, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeIfChanged(path, content) {
  if (await readExisting(path) === content) return false;
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, content, 'utf8');
  await rename(temporaryPath, path);
  return true;
}

async function main() {
  const [source, javascript, keyModule, keyScript] = await Promise.all([
    fetchText(SOURCE_URL, 1024 * 1024),
    fetchText(SCRIPT_URL, 5 * 1024 * 1024),
    fetchText(KEY_MODULE_URL, 1024 * 1024),
    fetchText(KEY_SCRIPT_URL, 5 * 1024 * 1024),
  ]);
  const hashes = [
    [SOURCE_URL, source], [SCRIPT_URL, javascript],
    [KEY_MODULE_URL, keyModule], [KEY_SCRIPT_URL, keyScript],
  ].map(([url, content]) => ({ url, sha256: requireAudited(url, content) }));
  // Keywos 文件仅检查审阅版本/语法，不内嵌、不执行，也不保存它们的正文副本。
  new Script(keyScript, { filename: 'Keywos-reference-only.js' });
  const parsed = parseSource(source);
  const script = renderScript(javascript);
  const module = renderModule(source, javascript, parsed);
  const references = JSON.stringify({
    name: 'NetEaseMusic merged customization',
    reviewedOn: '2026-10-25',
    mode: 'ddgksf2013 backbone with independently implemented feature ideas',
    keywosNotice: 'Reference only. Keywos source is not embedded, redistributed or executed. No license grant is assumed.',
    updatePolicy: 'Check every six hours; any upstream hash change stops publishing until manual compatibility review and tests.',
    sources: hashes,
  }, null, 2) + '\n';
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；合并为 1 个响应入口、14 个参数；四份上游已审核。`);
  if (CHECK_ONLY) {
    console.log('只校验，不写入成品。');
    return;
  }
  // 下载、解析、正则、编译全部通过后才写入；失败不覆盖旧成品。
  const changedScript = await writeIfChanged(OUTPUT_SCRIPT, script);
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  const changedReferences = await writeIfChanged(OUTPUT_REFERENCES, references);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；兼容脚本${changedScript ? '已更新' : '无变化'}；快照${changedSource ? '已更新' : '无变化'}；参考版本${changedReferences ? '已更新' : '无变化'}。`);
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
