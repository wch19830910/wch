// SPDX-License-Identifier: GPL-3.0-only
// Zhihu response cleanup derived from zirawell, with RuCu6 credited upstream.
// Modified 2026-10-26: optional video/paid filtering, safe schemas and account preservation.
// Source: https://raw.githubusercontent.com/zirawell/R-Store/main/Res/Scripts/AntiAd/zhihu.js
// License: https://github.com/wch19830910/wch/blob/main/Surge/licenses/zirawell-GPL-3.0.txt
// Provided without warranty. No network calls, storage or notification side effects.
(function runZhihu(customize) {
  let completed = false;
  const finish = (result) => {
    if (completed) return;
    completed = true;
    $done(result);
  };
  const parseOptions = (input) => {
    if (input && typeof input === 'object' && !Array.isArray(input)) return input;
    if (typeof input !== 'string' || !input.trim()) return {};
    try {
      const json = JSON.parse(input);
      if (json && typeof json === 'object' && !Array.isArray(json)) return json;
    } catch { /* Native Surge arguments are normally query-style key/value pairs. */ }
    const result = {};
    for (const field of input.split('&')) {
      const separator = field.indexOf('=');
      if (separator < 1) continue;
      try {
        const key = decodeURIComponent(field.slice(0, separator));
        if (key === 'hideVideos' || key === 'hidePaid') result[key] = decodeURIComponent(field.slice(separator + 1));
      } catch { /* Bad option encoding leaves its safe default in place. */ }
    }
    return result;
  };
  const parseLossless = (source) => {
    const strings = [];
    // This validation pass also prevents a malicious escaped string from colliding with a
    // protected integer placeholder. Its parsed numeric values are never used as output.
    JSON.parse(source, (key, value) => {
      strings.push(key);
      if (typeof value === 'string') strings.push(value);
      return value;
    });
    let prefix = '__SURGE_ZHIHU_INTEGER__';
    while (strings.some((value) => value.includes(prefix))) prefix += '_';
    const integers = [];
    let protectedSource = '', inString = false, escaped = false;
    for (let offset = 0; offset < source.length;) {
      const character = source[offset];
      if (inString) {
        protectedSource += character;
        offset += 1;
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        protectedSource += character;
        offset += 1;
        continue;
      }
      if (character === '-' || /[0-9]/.test(character)) {
        const match = source.slice(offset).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
        if (match) {
          const token = match[0];
          if (/^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token))) {
            const index = integers.push(token) - 1;
            protectedSource += `"${prefix}${index}__"`;
          } else protectedSource += token;
          offset += token.length;
          continue;
        }
      }
      protectedSource += character;
      offset += 1;
    }
    return {
      data: JSON.parse(protectedSource),
      stringify: (value) => JSON.stringify(value).replace(new RegExp(`"${prefix}(\\d+)__"`, 'g'), (_, index) => integers[Number(index)]),
    };
  };
  try {
    const body = typeof $response === 'object' && $response ? $response.body : undefined;
    const url = typeof $request === 'object' && $request ? $request.url : '';
    if (typeof body !== 'string' || !body.trim()) { finish({}); return; }
    const decoded = parseLossless(body);
    const result = customize(decoded.data, url, parseOptions(typeof $argument === 'undefined' ? undefined : $argument));
    if (!result.handled) { finish({}); return; }
    finish({ body: decoded.stringify(result.data) });
  } catch {
    // A changed server schema, malformed body or unsupported response preserves the original.
    finish({});
  }
})(function customizeZhihu(data, path, options = {}) {
  const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const own = (value, key) => record(value) && Object.prototype.hasOwnProperty.call(value, key);
  const text = (value) => typeof value === 'string' ? value : '';
  const flag = (name) => {
    const value = record(options) ? options[name] : undefined;
    return value === true || value === 1 || typeof value === 'string' && /^(?:1|true)$/i.test(value.trim());
  };
  const hideVideos = flag('hideVideos');
  const hidePaid = flag('hidePaid');
  let endpoint = text(path).trim().replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/, 1)[0];
  if (endpoint && !endpoint.startsWith('/')) endpoint = `/${endpoint}`;
  if (!record(data)) return { data, handled: false };

  // Known enum values only: NOT_AD, non-ad, download and future types are ordinary content.
  const adTypes = new Set(['ad', 'ads', 'advert', 'advertisement', 'feed_advert', 'ad_card',
    'ads_card', 'commercial_card', 'answer_ad', 'video_ad', 'display_ad', 'splash_ad']);
  const paidTypes = new Set(['paid', 'paid_answer', 'paid_article', 'paid_content', 'answer_paid', 'article_paid']);
  const enumValue = (value) => text(value).toLowerCase().replace(/-/g, '_');
  const adType = (value) => adTypes.has(enumValue(value));
  const present = (value) => value !== undefined && value !== null && value !== false && value !== 0 && value !== '';
  const promotion = (value) => record(value) ? Object.keys(value).length > 0 : Array.isArray(value) ? value.length > 0 : present(value);
  const paidType = (value) => paidTypes.has(enumValue(value));
  const videoType = (value) => /^(?:zvideo|video|live|drama|live_room|video_card)$/i.test(text(value));
  const videoObject = (value) => record(value) && (present(value.id) || present(value.url) || present(value.play_url));
  const elements = (value) => Array.isArray(value) ? value : [];
  const isAdvertisement = (item) => {
    if (!record(item)) return false;
    const origin = record(item.origin_data) ? item.origin_data : {};
    const target = record(item.target) ? item.target : {};
    if ([item.type, item.resource_type, origin.type, origin.resource_type, target.type,
      item.extra?.type, item.common_card?.style?.type].some(adType)) return true;
    if ((own(item, 'adjson') && present(item.adjson)) || (own(item, 'ad') && present(item.ad))
      || promotion(item.promotion_extra) || promotion(origin.promotion_extra)) return true;
    if (elements(item.common_card?.footline?.elements).some((part) => text(part?.text?.panel_text).includes('广告'))) return true;
    return text(target.metrics_area?.text).includes('合作推广') || text(item.metrics_area?.text).includes('合作推广');
  };
  const isVideo = (item) => {
    if (!record(item)) return false;
    return [item.type, item.resource_type, item.extra?.type, item.target?.type,
      item.origin_data?.type, item.origin_data?.resource_type].some(videoType)
      || videoObject(item.video) || videoObject(item.fields?.body?.video)
      || videoObject(item.common_card?.feed_content?.video) || videoObject(item.target?.video);
  };
  const isPaid = (item) => {
    if (!record(item)) return false;
    if ([item.answer_type, item.business_type, item.target?.answer_type, item.data?.answer_type,
      item.origin_data?.answer_type, item.origin_data?.business_type].some(paidType)) return true;
    return elements(item.common_card?.feed_content?.source_line?.elements)
      .some((part) => text(part?.text?.panel_text).includes('盐选'));
  };
  const keep = (item) => !isAdvertisement(item) && !(hideVideos && isVideo(item)) && !(hidePaid && isPaid(item));
  const filterList = (container, key) => {
    if (record(container) && Array.isArray(container[key])) container[key] = container[key].filter(keep);
  };
  const cleanLists = () => {
    filterList(data, 'data');
    if (record(data.data)) filterList(data.data, 'data');
  };
  const removeAdFields = (container) => {
    if (!record(container)) return;
    delete container.ad_info;
    delete container.adjson;
  };
  const isActivityTab = (item) => record(item) &&
    (['activity', 'activity_tab'].includes(item.tab_type) || item.tab_name === '活动');
  const keepTab = (item) => !isActivityTab(item) && !(hideVideos && record(item) &&
    (videoType(item.tab_type) || ['视频', '直播'].includes(item.tab_name)));
  const cleanConfig = (config) => {
    if (!record(config)) return;
    if (record(config.homepage_feed_tab) && Array.isArray(config.homepage_feed_tab.tab_infos)) {
      config.homepage_feed_tab.tab_infos = config.homepage_feed_tab.tab_infos.filter(keepTab);
    }
    // Correct the actual appcloud2 /vN/config path and the old reversed tab predicate.
    // Preserve hp_channel_tab, zvideo_max_number, follow guidance and all account settings.
    const dns = config.zhcnh_thread_sync;
    if (record(dns)) {
      if (own(dns, 'LocalDNSSetHostWhiteList') && Array.isArray(dns.LocalDNSSetHostWhiteList)) dns.LocalDNSSetHostWhiteList = [];
      if (own(dns, 'isOpenLocalDNS')) dns.isOpenLocalDNS = '0';
      if (own(dns, 'ZHBackUpIP_Switch_Open')) dns.ZHBackUpIP_Switch_Open = '0';
      if (own(dns, 'dns_ip_detector_operation_lock')) dns.dns_ip_detector_operation_lock = '1';
    }
    if (record(config.gray_mode)) {
      if (own(config.gray_mode, 'enable')) config.gray_mode.enable = false;
      if (own(config.gray_mode, 'start_time')) config.gray_mode.start_time = '3818332800';
      if (own(config.gray_mode, 'end_time')) config.gray_mode.end_time = '3818419199';
    }
  };

  if (/^\/commercial_api\/app_float_layer$/.test(endpoint)) {
    // Remove the floating promotion itself, preserving unrelated response/account fields.
    delete data.feed_egg;
    return { data, handled: true };
  }
  if (/^\/topstory\/recommend(?:_v\d+)?$/.test(endpoint)
    || /^\/moments_v\d+$/.test(endpoint)
    || /^\/(?:v\d+\/)?topstory\/hot-lists(?:\/(?:total|everyone-seeing))?$/.test(endpoint)
    || /^\/next-(?:bff|data|render)$/.test(endpoint)) {
    // Upstream content/section/tips/article markers alone are not proof of advertising.
    cleanLists();
    return { data, handled: true };
  }
  if (/^\/(?:v\d+\/)?questions\/\d+(?:\/(?:feeds|answers))?$/.test(endpoint)) {
    cleanLists();
    removeAdFields(data);
    removeAdFields(data.data);
    delete data.query_info;
    return { data, handled: true };
  }
  if (/^\/(?:answers|articles)\/v\d+\/\d+$/.test(endpoint)) {
    removeAdFields(data);
    if (record(data.third_business?.related_queries) && Array.isArray(data.third_business.related_queries.queries)) {
      data.third_business.related_queries.queries = [];
    }
    return { data, handled: true };
  }
  if (/^\/api\/v\d+\/(?:answers|articles)\/\d+\/recommendations?$/.test(endpoint)) {
    // Filter known bottom advertising cards without deleting all related normal content.
    cleanLists();
    removeAdFields(data);
    return { data, handled: true };
  }
  if (/^\/bazaar\/vip_tab\/header$/.test(endpoint)) {
    for (const key of ['activity_banner', 'activity_window', 'vip_tip']) delete data[key];
    return { data, handled: true };
  }
  if (/^\/root\/tab(?:\/v\d+)?$/.test(endpoint)) {
    if (Array.isArray(data.tab_list)) data.tab_list = data.tab_list.filter(keepTab);
    return { data, handled: true };
  }
  if (endpoint === '/feed/render/tab/config') {
    if (Array.isArray(data.selected_sections)) data.selected_sections = data.selected_sections.filter(keepTab);
    return { data, handled: true };
  }
  if (/^\/search\/recommend_query\/v\d+$/.test(endpoint)) {
    // Native structured cleanup replaces the old greedy text substitution.
    if (record(data.recommend_queries)) data.recommend_queries = {};
    return { data, handled: true };
  }
  if (/^\/v\d+\/config$/.test(endpoint)) {
    cleanConfig(data.config);
    return { data, handled: true };
  }
  if (/^\/api\/cloud\/(?:zhihu\/)?config\/all$/.test(endpoint)) {
    if (Array.isArray(data.data?.configs)) {
      for (const item of data.data.configs) {
        if (!record(item) || !['feed_gray_theme', 'feed_top_res'].includes(item.configKey) || !record(item.configValue)) continue;
        item.configValue.start_time = '3818332800';
        item.configValue.end_time = '3818419199';
        item.status = false;
      }
    }
    return { data, handled: true };
  }
  return { data, handled: false };
});
