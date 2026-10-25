// Generates the merged runtime without executing downloaded JavaScript.
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

const DECODE_ANCHOR = 'decryptAndParse=()=>JSON[_0x554d36(-0x4d,-0x87,-0x8b,-0xc)](eapiDecrypt(binaryToHex(responseBody)))';
const DISPATCH_ANCHOR = 'if(/ad\\/loading\\/get/[_0x554d36(-0x68,-0x9d,-0x2a,-0xa4)](url))';
const MAIN_ANCHOR = 'try{let decryptedData,encryptedData,parsedData;const responseBody=';
const OUTPUT_ANCHOR = 'if(isObject)$done';

function requireUnique(source, anchor, label) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) throw new Error(`网易云合并锚点 ${label} 应出现一次，实际 ${count} 次；保留旧成品。`);
}

// This function is serialized into Surge; keep it self-contained.
function parseNetEaseOptions(argument) {
  const defaults = {
    hideDiscover: false,
    hideRoam: false,
    hideNotes: false,
    hideGreeting: false,
    hideDailyRecommend: false,
    hidePlaylistRecommend: false,
    hideRecentPlayed: false,
    hideMusicPartner: false,
    hideRadar: false,
    hideRanking: false,
    hideMyPlaylist: false,
    hideCombinationPlaylist: false,
    cleanCommentDecorations: true,
    showNotFollowingBack: false,
  };
  let supplied;
  if (argument !== null && typeof argument === 'object' && !Array.isArray(argument)) {
    supplied = argument;
  } else if (typeof argument === 'string' && argument.trim()) {
    const text = argument.trim();
    if (text.startsWith('{')) {
      try { supplied = JSON.parse(text); } catch { return defaults; }
      if (supplied === null || typeof supplied !== 'object' || Array.isArray(supplied)) return defaults;
    } else {
      supplied = Object.create(null);
      for (const pair of text.split('&')) {
        const equal = pair.indexOf('=');
        if (equal < 1) continue;
        try {
          const key = decodeURIComponent(pair.slice(0, equal).replace(/\+/g, ' ')).trim();
          const value = decodeURIComponent(pair.slice(equal + 1).replace(/\+/g, ' ')).trim();
          if (Object.prototype.hasOwnProperty.call(defaults, key)) supplied[key] = value;
        } catch { /* Ignore an invalid encoded pair; keep that option's default. */ }
      }
    }
  }
  if (!supplied) return defaults;
  for (const key of Object.keys(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(supplied, key)) continue;
    const value = supplied[key];
    if (value === true || value === 1 || value === '1' || value === 'true') defaults[key] = true;
    else if (value === false || value === 0 || value === '0' || value === 'false') defaults[key] = false;
  }
  return defaults;
}

/**
 * @param {string} javascript Verified ddgksf2013 upstream source. The caller owns the SHA gate.
 * @param {string} customizeSource Self-contained customizeNetEase function expression/declaration.
 * @param {string} notices Original attribution and third-party license notices.
 * @returns {string} Compile-checked JavaScript; this function never evaluates the upstream.
 */
export function renderMergedNetEaseScript(javascript, customizeSource, notices = '') {
  if (typeof javascript !== 'string' || !javascript.trim()) throw new Error('网易云上游脚本为空。');
  if (typeof customizeSource !== 'string' || !customizeSource.trim()) throw new Error('网易云自定义处理函数为空。');
  if (typeof notices !== 'string' || notices.includes('*/')) throw new Error('网易云许可说明不能安全嵌入注释。');
  for (const [anchor, label] of [[MAIN_ANCHOR, 'main'], [DECODE_ANCHOR, 'decode'], [DISPATCH_ANCHOR, 'dispatch'], [OUTPUT_ANCHOR, 'output']]) {
    requireUnique(javascript, anchor, label);
  }
  if (javascript.includes('__neteaseDecodeOnce') || javascript.includes('const neteaseOptions=')) {
    throw new Error('网易云上游疑似已注入合并代码；保留旧成品。');
  }

  let patched = javascript.replace(DECODE_ANCHOR,
    'decryptAndParse=()=>__neteaseDecodeOnce(responseBody,()=>eapiDecrypt(binaryToHex(responseBody)))');
  patched = patched.replace(DISPATCH_ANCHOR, [
    'const neteaseLocal=customizeNetEase(decryptAndParse(),url,neteaseOptions);',
    'if(!neteaseLocal||typeof neteaseLocal.handled!=="boolean"||neteaseLocal.data===null||typeof neteaseLocal.data!=="object")throw new Error("Invalid NetEase customizer result");',
    '__neteaseDecodedCache=neteaseLocal.data;',
    'if(neteaseLocal.handled)parsedData=neteaseLocal.data;else ',
    DISPATCH_ANCHOR,
  ].join(''));

  // The customizer is an independently written function, never the Keywos script.
  const customizer = customizeSource.trim().replace(/^export\s+(?=function\s+customizeNetEase\b)/, '');
  const lines = [
    '/*',
    '网易云音乐：墨鱼广告处理主干 + 独立实现的可配置界面和评论净化。',
    'Upstream author: ddgksf2013.',
    'Upstream: https://gist.githubusercontent.com/ddgksf2013/4f53b7c6083678df25fecc8ff68b52c4/raw/netease.adblock.js',
    `Upstream SHA256: ${createHash('sha256').update(javascript).digest('hex')}`,
    'Compatibility modifications: IIFE, one-shot completion, strict plain-JSON input, cached decoding, and an owned-route dispatch before the original advertising policy.',
    'The upstream libraries and helpers are retained; the decode and dispatch expressions below are intentionally patched, not verbatim upstream.',
    'No Keywos script is embedded; no membership, expiry-time, or music-rights granting is added.',
    notices.trim(),
    '*/',
    '(function (__neteaseOriginalDone) {',
    '  let __neteaseCompleted = false;',
    '  let __neteaseDecoded = false;',
    '  let __neteaseDecodedCache;',
    '  function $done(result) {',
    '    if (__neteaseCompleted) return;',
    '    __neteaseCompleted = true;',
    '    if (typeof __neteaseOriginalDone === "function") __neteaseOriginalDone(result || {});',
    '  }',
    '  function __neteaseDecodeOnce(body, decrypt) {',
    '    if (__neteaseDecoded) return __neteaseDecodedCache;',
    '    let value;',
    '    let plainObject = false;',
    '    if (typeof body === "string") {',
    '      try { value = JSON.parse(body); plainObject = value !== null && typeof value === "object"; } catch {}',
    '    }',
    '    if (!plainObject) value = JSON.parse(decrypt());',
    '    if (value === null || typeof value !== "object") throw new Error("Unsupported NetEase JSON body");',
    '    __neteaseDecodedCache = value;',
    '    __neteaseDecoded = true;',
    '    return value;',
    '  }',
    '  try {',
    `    const neteaseOptions=(${parseNetEaseOptions.toString()})(typeof $argument === "undefined" ? undefined : $argument);`,
    `    const customizeNetEase=(${customizer});`,
    '    if (typeof customizeNetEase !== "function") throw new Error("Invalid NetEase customizer");',
    '    // binary-body-mode also delivers plain JSON as bytes. Restore only valid UTF-8 objects/arrays.',
    '    if (Object.prototype.toString.call($response.body) === "[object Uint8Array]") {',
    '      try {',
    '        const text = new TextDecoder("utf-8", { fatal: true }).decode($response.body);',
    '        const value = JSON.parse(text);',
    '        if (value !== null && typeof value === "object") $response.body = text;',
    '      } catch { /* Leave encrypted, non-JSON, scalar JSON, and invalid UTF-8 bytes unchanged. */ }',
    '    }',
    '// BEGIN PATCHED DDG UPSTREAM SOURCE',
    patched,
    '// END PATCHED DDG UPSTREAM SOURCE',
    '  } catch (__neteaseError) {',
    '    $done({});',
    '  }',
    '}).call(this, typeof $done === "function" ? $done : undefined);',
    '',
  ];
  const script = lines.join('\n');
  try { new Script(script, { filename: 'NetEaseMusic.merged.js' }); } catch (error) {
    throw new Error(`网易云合并脚本语法检查失败；保留旧成品：${error.message}`);
  }
  return script;
}
