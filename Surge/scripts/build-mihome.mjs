#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Upstream author: fmz200 / 奶思; modified 2026-10-26 for validated remote publishing.
// License: Surge/licenses/fmz200-GPL-3.0.txt. Provided without warranty.
// Node.js 20+。保留米家原生规则，仅整理元信息及远程发布；无远程 JavaScript。
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://raw.githubusercontent.com/fmz200/wool_scripts/main/Surge/module/split/partM/Mijia.sgmodule';
const RAW_URL = 'https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/MiHome.sgmodule';
const LICENSE_URL = 'https://github.com/wch19830910/wch/blob/main/Surge/licenses/fmz200-GPL-3.0.txt';
const SURGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_MODULE = resolve(SURGE_ROOT, 'AdBlock/MiHome.sgmodule');
const OUTPUT_SOURCE = resolve(SURGE_ROOT, 'upstream/MiHome.sgmodule');
const MAX_SOURCE_BYTES = 1024 * 1024;
const SECTIONS = new Set(['Rule', 'Map Local', 'MITM']);
const METADATA = new Set(['name', 'desc', 'author', 'category', 'homepage', 'raw-url', 'tg-channel']);
const AD_RULE = 'DOMAIN,sdkconfig.ad.xiaomi.com,REJECT';
const MAP_LINES = [
  String.raw`^https?:\/\/home\.mi\.com\/cgi-op\/api\/v1\/recommendation\/(banner|carousel\/banners|myTab|openingBanner) data-type=text data="{}" status-code=200 header="Content-Type:application/json"`,
  String.raw`^https?:\/\/home\.mi\.com\/cgi-op\/api\/v1\/resource\/realtime\/openingBanner data-type=text data="{}" status-code=200 header="Content-Type:application/json"`,
];

function fail(lineNumber, message) {
  throw new Error(`上游第 ${lineNumber} 行：${message}；保留旧成品。`);
}

export function parseSource(source) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('米家来源为空；保留旧成品。');
  const metadata = {}, seenSections = new Set(), mapLocal = [];
  let section, rule, hostname;
  for (const [index, original] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = original.trim(), lineNumber = index + 1;
    if (!line || line.startsWith('#') && !line.startsWith('#!') || line.startsWith('//')) continue;
    if (line.startsWith('#!')) {
      const match = line.match(/^#!([A-Za-z_-]+)=(.*)$/);
      if (section || !match || !METADATA.has(match[1]) || Object.hasOwn(metadata, match[1])) fail(lineNumber, '未知、重复或位置错误的模块元信息');
      metadata[match[1]] = match[2];
    } else if (line.startsWith('[')) {
      const match = line.match(/^\[([^\]]+)\]$/);
      if (!match || !SECTIONS.has(match[1]) || seenSections.has(match[1])) fail(lineNumber, '未知或重复配置段');
      section = match[1]; seenSections.add(section);
    } else if (section === 'Rule') {
      if (rule || line !== AD_RULE) fail(lineNumber, '广告域名或拒绝范围发生未审核变化');
      rule = line;
    } else if (section === 'Map Local') {
      if (!MAP_LINES.includes(line) || mapLocal.includes(line)) fail(lineNumber, '本地响应路径、内容或动作发生未审核变化');
      try { new RegExp(line.split(/\s+/, 1)[0]); }
      catch (error) { fail(lineNumber, `正则无法编译：${error.message}`); }
      mapLocal.push(line);
    } else if (section === 'MITM') {
      if (hostname || line !== 'hostname = %APPEND% home.mi.com') fail(lineNumber, 'MITM 主机发生未审核变化');
      hostname = 'home.mi.com';
    } else fail(lineNumber, '规则不属于已知配置段');
  }
  if (seenSections.size !== SECTIONS.size || rule !== AD_RULE || mapLocal.length !== MAP_LINES.length || !hostname
    || metadata.author !== '奶思' || metadata.name !== '米家' || metadata.homepage !== 'https://github.com/fmz200/wool_scripts') {
    throw new Error('上游缺少预期米家规则、主机或原作者声明；保留旧成品。');
  }
  return { metadata, rule, mapLocal, hostname, counts: { Rule: 1, 'Map Local': 2, MITM: 1 } };
}

export function renderModule(source, parsed) {
  return [
    '#!name=米家（开屏与推荐去广告）',
    '#!desc=基于奶思 fmz200 米家原生规则：处理开屏广告、推荐横幅、轮播及“我的”页面 myTab 推荐位，拦截小米广告 SDK 配置域名。只保留上游明确路径，不包含底栏或商城完整净化；规则未直接匹配设备控制、自动化或摄像头流接口，实际兼容性仍需试用。SDK 域名拒绝也作用于其他 App 对同一域名的请求。每 6 小时检查上游模块，验证通过后同步，无远程 JavaScript。需 Surge iOS 5.9.1+ / Mac 5.5.1+，开启重写与 MITM，并安装及信任 MITM 证书。可先完全退出米家并清理 App 缓存后重开；异常时停用。未在最新版米家手机实测，不保证移除所有广告。',
    '#!author=奶思（fmz200）',
    '#!category=AdBlock',
    '#!homepage=https://github.com/fmz200/wool_scripts',
    `#!raw-url=${RAW_URL}`,
    '',
    '# SPDX-License-Identifier: GPL-3.0-only',
    '# 原作者：奶思 / fmz200；修改日期：2026-10-26。',
    `# 许可证：${LICENSE_URL}；无任何保证。`,
    `# 原始模块：${SOURCE_URL}`,
    `# 上游 SHA256：${createHash('sha256').update(source).digest('hex')}`,
    '# 自动生成；显示名称和功能说明请修改 Surge/scripts/build-mihome.mjs，直接改成品会被同步覆盖。',
    '# 保留原作者 1 条广告配置域名拒绝、2 条本地空 JSON 响应和精确 MITM 主机；不依赖远程脚本。',
    '# 未扩展 recommendation 整个路径、设备控制、摄像头、账户或自动化接口。',
    '# 小米广告 SDK 域名是共享域名，域名规则并不限于米家进程；不把它描述成仅米家生效。',
    '# 源格式或规则范围变化须先核对；下载、解析或校验失败时不覆盖现有产物。',
    '', '[Rule]', parsed.rule,
    '', '[Map Local]', ...parsed.mapLocal,
    '', '[MITM]', `hostname = %APPEND% ${parsed.hostname}`, '',
  ].join('\n');
}

async function fetchSource() {
  const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Surge' } });
  if (!response.ok || response.url !== SOURCE_URL) throw new Error(`下载失败或出现未审核跳转：HTTP ${response.status} ${SOURCE_URL}`);
  if (Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) throw new Error('上游文件过大；保留旧成品。');
  const source = await response.text();
  if (!source.trim() || Buffer.byteLength(source) > MAX_SOURCE_BYTES || /^\s*(?:<!doctype\s+html|<html\b)/i.test(source)) {
    throw new Error('上游文件为空、过大或返回网页；保留旧成品。');
  }
  return source;
}

async function writeIfChanged(path, content) {
  let existing;
  try { existing = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing === content) return false;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, path);
  return true;
}

export async function main() {
  if (process.argv.slice(2).some((argument) => argument !== '--check')) throw new Error('用法：node Surge/scripts/build-mihome.mjs [--check]');
  const source = await fetchSource();
  const parsed = parseSource(source);
  const module = renderModule(source, parsed);
  console.log('米家构建验证通过：1 条广告配置域名拒绝、2 条精确本地 JSON 响应、1 个 MITM 主机；无远程脚本。');
  if (process.argv.includes('--check')) { console.log('只校验，不写入产物。'); return; }
  const changedModule = await writeIfChanged(OUTPUT_MODULE, module);
  const changedSource = await writeIfChanged(OUTPUT_SOURCE, source);
  console.log(`模块${changedModule ? '已更新' : '无变化'}；来源快照${changedSource ? '已更新' : '无变化'}。`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
