// Independently implemented by wch19830910/wch. No third-party script is embedded.
// Scope, attribution and experimental status: Surge/AdBlock/WeChat.md.
(function () {
  const transformResponse = function transformResponse({ url, body, status, headers, options } = {}) {
  const original = body;
  try {
    if (typeof body !== 'string' || typeof url !== 'string') return original;
    const MAX_BYTES = 1048576;
    if (body.length > MAX_BYTES) return original;
    let byteLength = 0;
    for (let i = 0; i < body.length; i += 1) {
      const code = body.charCodeAt(i);
      if (code <= 0x7f) byteLength += 1;
      else if (code <= 0x7ff) byteLength += 2;
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < body.length
        && body.charCodeAt(i + 1) >= 0xdc00 && body.charCodeAt(i + 1) <= 0xdfff) {
        byteLength += 4;
        i += 1;
      } else byteLength += 3;
      if (byteLength > MAX_BYTES) return original;
    }

    let statusCode;
    if (typeof status === 'number' && Number.isInteger(status)) statusCode = status;
    else if (typeof status === 'string') {
      const code = status.trim().match(/^(?:HTTP\/\d+(?:\.\d+)?\s+)?(\d{3})(?:\s.*)?$/);
      if (code) statusCode = Number(code[1]);
    }
    if (!(statusCode >= 200 && statusCode < 300)) return original;

    if (headers != null) {
      if (typeof headers !== 'object' || Array.isArray(headers)) return original;
      const contentTypes = Object.keys(headers).filter((key) => key.toLowerCase() === 'content-type');
      if (contentTypes.length > 1) return original;
      if (contentTypes.length) {
        const value = headers[contentTypes[0]];
        if (typeof value !== 'string') return original;
        const mime = value.split(';', 1)[0].trim();
        if (!/^(?:application|text)\/(?:[a-z0-9.+-]+\+)?json$/i.test(mime)) return original;
      }
    }

    // Avoid Web APIs that the standard Surge JavaScript engine need not provide.
    const address = url.match(/^https:\/\/([A-Za-z0-9.-]+)(\/[^?#]*)(\?[^#]*)?$/);
    if (!address) return original;
    const host = address[1].toLowerCase(), path = address[2], query = address[3] || '';
    const settings = options && typeof options === 'object' ? options : {};
    let mode;
    if (host === 'minifm.maxxipoint.com' && path === '/banner/list' && settings.familyMart !== false) mode = 'familyMart';
    else if (host === 'ump.ems.com.cn' && path === '/new-generation-extend/redis/pageInfoByChannel' && settings.ems !== false) mode = 'ems';
    else if (host === 'coco-com.e.verystar.net' && path === '/v1/home/info' && settings.coco !== false) mode = 'coco';
    else if (host === 'htwkop.xiaojukeji.com' && path === '/gateway' && settings.qingju !== false) {
      const api = [];
      for (const part of query.slice(1).split('&')) {
        const equals = part.indexOf('=');
        const key = decodeURIComponent((equals < 0 ? part : part.slice(0, equals)).replace(/\+/g, ' '));
        const value = decodeURIComponent((equals < 0 ? '' : part.slice(equals + 1)).replace(/\+/g, ' '));
        if (key === 'api') api.push(value);
      }
      if (api.length === 1 && api[0] === 'hm.fa.homeConfig') mode = 'qingju';
    } else if (host === 'mp.weixin.qq.com' && path === '/mp/getappmsgad' && settings.officialAccountExperimental === true) mode = 'official';
    if (!mode) return original;

    // A token tree records source spans without converting any JSON number to a JS number.
    function parseDocument(text) {
      let cursor = 0, count = 0;
      function whitespace() { while (/[\x20\t\r\n]/.test(text[cursor] || '\0')) cursor += 1; }
      function string() {
        const start = cursor;
        if (text[cursor++] !== '"') throw new Error('string expected');
        let closed = false;
        while (cursor < text.length) {
          const char = text[cursor++];
          if (char === '\\') {
            if (cursor >= text.length) throw new Error('incomplete escape');
            const escape = text[cursor++];
            if (escape === 'u') {
              if (!/^[0-9a-fA-F]{4}$/.test(text.slice(cursor, cursor + 4))) throw new Error('invalid unicode escape');
              cursor += 4;
            } else if (!/["\\/bfnrt]/.test(escape)) throw new Error('invalid escape');
          } else if (char === '"') { closed = true; break; }
          else if (char.charCodeAt(0) < 0x20) throw new Error('control character');
        }
        if (!closed) throw new Error('unterminated string');
        return { type: 'string', start, end: cursor, value: JSON.parse(text.slice(start, cursor)) };
      }
      function value(depth) {
        if (depth > 64 || ++count > 100000) throw new Error('JSON limit');
        whitespace();
        const start = cursor, char = text[cursor];
        if (char === '"') return string();
        if (char === '{') {
          cursor += 1;
          const properties = [], commas = [], keys = new Set();
          whitespace();
          if (text[cursor] === '}') { cursor += 1; return { type: 'object', start, end: cursor, properties, commas }; }
          while (cursor < text.length) {
            whitespace();
            const key = string();
            if (keys.has(key.value)) throw new Error('duplicate key');
            keys.add(key.value);
            whitespace();
            if (text[cursor++] !== ':') throw new Error('colon expected');
            const child = value(depth + 1);
            properties.push({ key: key.value, keyStart: key.start, value: child });
            whitespace();
            if (text[cursor] === '}') { cursor += 1; return { type: 'object', start, end: cursor, properties, commas }; }
            if (text[cursor] !== ',') throw new Error('comma expected');
            commas.push(cursor++);
          }
          throw new Error('unclosed object');
        }
        if (char === '[') {
          cursor += 1;
          const items = [], commas = [];
          whitespace();
          if (text[cursor] === ']') { cursor += 1; return { type: 'array', start, end: cursor, items, commas }; }
          while (cursor < text.length) {
            items.push(value(depth + 1));
            whitespace();
            if (text[cursor] === ']') { cursor += 1; return { type: 'array', start, end: cursor, items, commas }; }
            if (text[cursor] !== ',') throw new Error('comma expected');
            commas.push(cursor++);
          }
          throw new Error('unclosed array');
        }
        const literal = text.slice(cursor).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
        if (!literal) throw new Error('JSON value expected');
        cursor += literal[0].length;
        return { type: literal[0] === 'true' || literal[0] === 'false' ? 'boolean' : literal[0] === 'null' ? 'null' : 'number', start, end: cursor, raw: literal[0] };
      }
      const root = value(0);
      whitespace();
      if (cursor !== text.length) throw new Error('trailing JSON data');
      return root;
    }
    function property(node, key) {
      if (!node || node.type !== 'object') return undefined;
      return node.properties.find((item) => item.key === key);
    }
    function isSuccess(root) {
      if (root.type !== 'object') return false;
      for (const key of ['ret', 'errcode']) {
        const item = property(root, key);
        if (item) {
          const node = item.value;
          const token = node.type === 'number' ? node.raw : node.type === 'string' ? node.value.trim() : '';
          if (!token || !/^[+-]?(?:0+(?:\.0*)?|\.0+)(?:[eE][+-]?\d+)?$/.test(token)) return false;
        }
      }
      const code = property(root, 'code');
      if (code) {
        const node = code.value;
        const token = node.type === 'number' ? node.raw : node.type === 'string' ? node.value.trim() : '';
        const parts = token.match(/^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
        if (!parts) return false;
        let digits = (parts[2] + (parts[3] || '')).replace(/^0+/, '');
        if (digits) {
          if (parts[1] === '-') return false;
          const places = (parts[3] || '').length - Number(parts[4] || 0);
          if (places > 0) {
            if (places >= digits.length || /[1-9]/.test(digits.slice(-places))) return false;
            digits = digits.slice(0, -places);
          } else if (places < 0) {
            if (digits.length - places > 3) return false;
            digits += '0'.repeat(-places);
          }
          if (digits !== '200') return false;
        }
      }
      const success = property(root, 'success');
      if (success && !(success.value.type === 'boolean' && success.value.raw === 'true')) return false;
      return true;
    }
    function editText(text, edits) {
      if (!edits.length) return text;
      edits.sort((a, b) => a.start - b.start);
      let end = 0, output = '';
      for (const edit of edits) {
        if (edit.start < end || edit.end < edit.start) throw new Error('overlapping edit');
        output += text.slice(end, edit.start) + (edit.text || '');
        end = edit.end;
      }
      return output + text.slice(end);
    }
    function removeMembers(text, node, shouldRemove) {
      const members = node.type === 'object' ? node.properties : node.items;
      const remove = members.map(shouldRemove);
      if (!remove.some(Boolean)) return text;
      let lastRetained = -1;
      for (let i = 0; i < remove.length; i += 1) if (!remove[i]) lastRetained = i;
      const edits = [];
      for (let i = 0; i < members.length; i += 1) {
        if (remove[i]) {
          const item = members[i];
          edits.push({ start: node.type === 'object' ? item.keyStart : item.start, end: node.type === 'object' ? item.value.end : item.end });
        }
        if (i < node.commas.length && (remove[i] || i >= lastRetained)) {
          edits.push({ start: node.commas[i], end: node.commas[i] + 1 });
        }
      }
      return editText(text, edits);
    }

    const document = parseDocument(body);
    if (!isSuccess(document)) return original;
    if (mode === 'official') {
      const count = property(document, 'advertisement_num'), advertisements = property(document, 'advertisement_info');
      if (!count || count.value.type !== 'number' || !advertisements || advertisements.value.type !== 'array') return original;
      const number = Number(count.value.raw);
      if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0) return original;
      // Check the source decimal too: floating-point rounding/underflow must not turn a fraction into an integer.
      const parts = count.value.raw.match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
      const digits = parts[2] + (parts[3] || '');
      if (/[1-9]/.test(digits)) {
        const fractionalPlaces = (parts[3] || '').length - Number(parts[4] || 0);
        if (parts[1] || fractionalPlaces > 0 && /[1-9]/.test(digits.slice(-fractionalPlaces))) return original;
      }
      const edits = [];
      if (number !== 0) edits.push({ start: count.value.start, end: count.value.end, text: '0' });
      if (advertisements.value.items.length) edits.push({ start: advertisements.value.start, end: advertisements.value.end, text: '[]' });
      return editText(body, edits);
    }
    if (mode === 'ems') {
      const info = property(document, 'info');
      const moduleJson = property(info && info.value, 'moduleJson');
      if (!moduleJson || moduleJson.value.type !== 'string') return original;
      const text = moduleJson.value.value;
      const modules = parseDocument(text);
      if (modules.type !== 'array') return original;
      const updated = removeMembers(text, modules, (item) => {
        const name = property(item, 'moduleName');
        return Boolean(name && name.value.type === 'string' && name.value.value.includes('广告'));
      });
      if (updated === text) return original;
      return editText(body, [{ start: moduleJson.value.start, end: moduleJson.value.end, text: JSON.stringify(updated) }]);
    }
    const data = property(document, 'data');
    if (!data || data.value.type !== 'object') return original;
    const keys = mode === 'familyMart' ? ['topBanner'] : mode === 'coco' ? ['top_background_url', 'bottom_banner_list'] : ['bannerInfoConfig'];
    return removeMembers(body, data.value, (item) => keys.includes(item.key));
  } catch (_error) {
    return original;
  }
};
  let result = {};
  try {
    const options = {};
    const allowed = ["familyMart", "ems", "coco", "qingju", "officialAccountExperimental"];
    const argument = typeof $argument === "string" ? $argument : "";
    for (const piece of argument.split(",")) {
      const equals = piece.indexOf("=");
      if (equals < 0) continue;
      const key = piece.slice(0, equals).trim();
      const value = piece.slice(equals + 1).trim();
      if (allowed.includes(key)) options[key] = value === "true" || value === "1";
    }
    const request = typeof $request === "object" && $request ? $request : {};
    const response = typeof $response === "object" && $response ? $response : {};
    const body = transformResponse({ url: request.url, body: response.body, status: response.status, headers: response.headers, options });
    if (typeof body === "string" && body !== response.body) result = { body };
  } catch (_error) {}
  $done(result);
})();
