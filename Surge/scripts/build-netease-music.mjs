#!/usr/bin/env node
// Node.js 20+。从墨鱼站点列出的网易云音乐官方源构建；不执行下载的脚本。
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const SOURCE_URL = 'https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/NeteaseAds.conf';
const SCRIPT_URL = 'https://gist.githubusercontent.com/ddgksf2013/4f53b7c6083678df25fecc8ff68b52c4/raw/netease.adblock.js';
const REMOTE_SCRIPT = 'https://raw.githubusercontent.com/wch19830910/wch/main/Surge/Script/NetEaseMusic.js';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/NetEaseMusic.sgmodule');
const OUTPUT_SCRIPT = resolve(SURGE_ROOT, 'Script/NetEaseMusic.js');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/NeteaseAds.conf');
const CHECK_ONLY = process.argv.includes('--check');

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

function fail(lineNumber, message) {
  throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`);
}

function parseSource(source) {
  const sections = { 'Map Local': [], Script: [] };
  const counts = { 'reject-200': 0, 'script-response-body': 0 };
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
      section = 'Script';
      const name = `netease_music_response_${String(counts[action] + 1).padStart(2, '0')}`;
      // 上游压缩分支直接使用 TextEncoder，明确选择提供 WebAPI 的 WebView 引擎。
      converted = `${name} = type=http-response,pattern=${pattern},requires-body=true,binary-body-mode=true,engine=webview,max-size=-1,timeout=60,script-update-interval=86400,script-path=${REMOTE_SCRIPT}`;
    }
    if (previousComment) sections[section].push(previousComment);
    sections[section].push(converted);
    previousComment = undefined;
    counts[action] += 1;
  }
  if (!hostnames || !counts['reject-200'] || !counts['script-response-body'] || author !== 'ddgksf2013') {
    throw new Error('上游缺少 hostname、有效规则或原作者声明；保留旧成品。');
  }
  return { sections, counts, hostnames, version, author };
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
    throw new Error('上游脚本结构改变，需人工核对二进制兼容性；保留旧成品。');
  }
  const script = [
    '/*',
    '网易云音乐净化：原作者 ddgksf2013，来源为墨鱼网站。',
    `Attribution policy: ${SOURCE_URL} — @Attention 如需引用请注明出处，谢谢合作！`,
    `Upstream: ${SCRIPT_URL}`,
    `Upstream SHA256: ${createHash('sha256').update(javascript).digest('hex')}`,
    'Surge compatibility derivative: an outer IIFE supports the upstream top-level return.',
    'The adapter converts only strict UTF-8 JSON object/array response bytes to text for the upstream plain-JSON branch.',
    'Encrypted, non-JSON, scalar-JSON, and invalid UTF-8 bytes are left unchanged.',
    'The original upstream source below is retained verbatim; no membership or music-rights unlocking is added.',
    'Generated by Surge/scripts/build-netease-music.mjs. Do not edit this generated file.',
    THIRD_PARTY_NOTICES.trim(),
    '*/',
    '(function () {',
    '// Surge binary-body-mode also delivers plain /api JSON as bytes. Restore only valid object/array JSON to text.',
    "if (Object.prototype.toString.call($response.body) === '[object Uint8Array]') {",
    '  try {',
    "    const text = new TextDecoder('utf-8', { fatal: true }).decode($response.body);",
    '    const value = JSON.parse(text);',
    "    if (value !== null && typeof value === 'object') $response.body = text;",
    '  } catch { /* Keep the original encrypted/non-JSON response bytes. */ }',
    '}',
    '// BEGIN UNMODIFIED UPSTREAM SOURCE',
    javascript,
    '// END UNMODIFIED UPSTREAM SOURCE',
    '}).call(this);',
    '',
  ].join('\n');
  // 仅编译；不在构建中执行远程 JavaScript。IIFE 允许原脚本的顶层 return。
  try { new Script(script, { filename: SCRIPT_URL }); } catch (error) {
    throw new Error(`上游 JavaScript 语法检查失败，保留旧成品：${error.message}`);
  }
  return script;
}

function renderModule(source, javascript, parsed) {
  const lines = [
    '#!name=网易云音乐',
    '#!desc=从墨鱼官方网易云音乐规则自动转换，兼容加密响应和明文 JSON；每 6 小时同步规则与兼容脚本，Surge 每 24 小时检查脚本更新。需启用重写、脚本及 MITM，并信任 MITM 证书；仅广告净化，不解锁会员或音乐版权。',
    `#!author=${parsed.author}`,
    `#!homepage=${SOURCE_URL}`,
    '#!category=AdBlock',
    '#!raw-url=https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/NetEaseMusic.sgmodule',
    '',
    `# 上游配置：${SOURCE_URL}`,
    `# 上游脚本：${SCRIPT_URL}`,
    `# 上游版本：${parsed.version || '未声明'}`,
    `# 上游规则 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    `# 上游脚本 SHA256：${createHash('sha256').update(javascript).digest('hex')}`,
    '# 自动生成，请修改 Surge/scripts/build-netease-music.mjs；未知语法停止更新并保留旧版。',
    '# 原作者脚本使用加密二进制响应，已启用 binary-body-mode；兼容层添加 IIFE 并恢复明文 JSON 输入类型，不改原文。',
    '# gzip 分支使用 TextEncoder，必须运行在 WebView 引擎；旧 macOS 10.15 及更早版本、tvOS 的纯 JSC 环境不支持。',
    '# 引用按上游 @Attention 保留出处；兼容脚本头部保留原文并附 CryptoJS/pako/zlib 许可。',
    '# 原作者提示：默认不去除底部“漫游”，可在侧栏设置中手动关闭。',
    '# Map Local 的 text 需要 Surge iOS 5.9.1+ 或 Surge Mac 5.5.1+。',
  ];
  for (const [section, rules] of Object.entries(parsed.sections)) {
    if (rules.length) lines.push('', `[${section}]`, ...rules);
  }
  lines.push('', '[MITM]', `hostname = %APPEND% ${parsed.hostnames.join(', ')}`, '');
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
  const source = await fetchText(SOURCE_URL, 1024 * 1024);
  const parsed = parseSource(source);
  const javascript = await fetchText(SCRIPT_URL, 5 * 1024 * 1024);
  const script = renderScript(javascript);
  const module = renderModule(source, javascript, parsed);
  console.log(`校验通过：${JSON.stringify(parsed.counts)}；远程脚本 1 个，二进制模式及 IIFE 兼容层。`);
  if (CHECK_ONLY) {
    console.log('只校验，不写入成品。');
    return;
  }
  // 下载、解析、正则、编译全部通过后才写入；失败不覆盖旧成品。
  const changedScript = await writeIfChanged(OUTPUT_SCRIPT, script);
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；兼容脚本${changedScript ? '已更新' : '无变化'}；快照${changedSource ? '已更新' : '无变化'}。`);
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
