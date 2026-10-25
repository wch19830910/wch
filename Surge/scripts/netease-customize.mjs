// Independently implemented UI customization for the combined NetEase module.
// This function is embedded with .toString(); keep every runtime dependency inside it.
// It never changes membership data or account-following state and never performs I/O.
export function customizeNetEase(data, path, options = {}) {
  const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const normalizePath = (value) => {
    let result = typeof value === 'string' ? value.trim() : '';
    result = result.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/, 1)[0];
    if (result && !result.startsWith('/')) result = `/${result}`;
    return result.replace(/^\/(?:weapi|eapi|api)(?=\/)/, '');
  };
  const flag = (name, fallback = false) => {
    const value = record(options) ? options[name] : undefined;
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    if (typeof value === 'string') {
      const text = value.trim().toLowerCase();
      if (text === 'true' || text === '1') return true;
      if (text === 'false' || text === '0') return false;
    }
    return fallback;
  };
  const endpoint = normalizePath(path);
  const cardOptions = {
    PAGE_RECOMMEND_GREETING: 'hideGreeting',
    PAGE_RECOMMEND_DAILY_RECOMMEND: 'hideDailyRecommend',
    PAGE_RECOMMEND_SPECIAL_CLOUD_VILLAGE_PLAYLIST: 'hidePlaylistRecommend',
    PAGE_RECOMMEND_SHORTCUT: 'hideRecentPlayed',
    HOMEPAGE_MUSIC_PARTNER: 'hideMusicPartner',
    PAGE_RECOMMEND_RADAR: 'hideRadar',
    PAGE_RECOMMEND_RANK: 'hideRanking',
    PAGE_RECOMMEND_MY_SHEET: 'hideMyPlaylist',
    PAGE_RECOMMEND_COMBINATION: 'hideCombinationPlaylist',
  };
  const codesOf = (value) => {
    if (typeof value === 'string') return [value];
    if (!record(value)) return [];
    return [value.bizCode, value.positionCode, value.blockCode, value.block?.bizCode, value.block?.positionCode, value.block?.blockCode]
      .filter((candidate) => typeof candidate === 'string' && candidate);
  };
  const keepHomeCode = (value) => {
    const codes = codesOf(value);
    if (codes.some((code) => code.includes('PAGE_RECOMMEND_BANNER'))) return false;
    return !codes.some((code) => Object.prototype.hasOwnProperty.call(cardOptions, code) && flag(cardOptions[code]));
  };
  const keepDiscoveryCode = (value) => !codesOf(value).includes('PAGE_DISCOVERY_BANNER');
  const filterOrder = (container, predicate) => {
    if (!record(container)) return;
    const order = container.blockCodeOrderList;
    if (Array.isArray(order)) {
      container.blockCodeOrderList = order.filter(predicate);
    } else if (typeof order === 'string') {
      try {
        const parsed = JSON.parse(order);
        if (Array.isArray(parsed)) container.blockCodeOrderList = JSON.stringify(parsed.filter(predicate));
      } catch { /* Unknown order formats must not erase the page. */ }
    }
  };
  const pageData = (value) => record(value?.data) ? value.data : value;
  const cleanLegacyBanners = (block) => {
    // Only an explicitly labelled ad is removed; activity/unknown banners remain.
    if (record(block?.extInfo) && Array.isArray(block.extInfo.banners)) {
      block.extInfo.banners = block.extInfo.banners.filter((banner) => banner?.typeTitle !== '广告');
    }
  };
  const filterHomePage = (value) => {
    const page = pageData(value);
    if (!record(page)) return;
    if (Array.isArray(page.blocks)) {
      page.blocks = page.blocks.filter(keepHomeCode);
      page.blocks.forEach(cleanLegacyBanners);
    }
    filterOrder(page, keepHomeCode);
  };
  const cleanComment = (comment) => {
    if (!record(comment)) return;
    // vipRights, vipLevel, status, expiration and followed are deliberately untouched.
    if (record(comment.user)) delete comment.user.avatarDetail;
    delete comment.pendantData;
    if (record(comment.tag)) {
      delete comment.tag.extDatas;
      delete comment.tag.contentPicDatas;
    }
  };
  const cleanCommentEnvelope = (value) => {
    if (!flag('cleanCommentDecorations', true)) return;
    const page = pageData(value);
    if (!record(page)) return;
    cleanComment(page.ownerComment);
    if (Array.isArray(page.comments)) page.comments.forEach(cleanComment);
  };
  const commentPath = (value) => /^\/v\d+\/resource\/(?:comments|comment\/floor\/get)$/.test(value);
  const cleanBatchComments = (value) => {
    if (!flag('cleanCommentDecorations', true)) return;
    const visited = new Set();
    const visit = (node, depth) => {
      if (!record(node) || depth > 8 || visited.has(node)) return;
      visited.add(node);
      for (const [key, child] of Object.entries(node)) {
        const childPath = normalizePath(key);
        if (commentPath(childPath)) cleanCommentEnvelope(child);
        else if (key === 'data' || childPath === '/batch') visit(child, depth + 1);
      }
    };
    visit(value, 0);
  };

  // Own the real membership page only to keep the base ad script from emptying it.
  // No value in this page is inspected or modified.
  if (endpoint === '/vipnewcenter/app/resource/newaccountpage') return { data, handled: true };

  if (endpoint === '/batch') {
    cleanBatchComments(data);
    // The base script must still remove its known batch-advertising subresponses.
    return { data, handled: false };
  }

  if (endpoint === '/link/home/framework/tab') {
    const page = pageData(data);
    if (record(page) && Array.isArray(page.commonResourceList)) {
      page.commonResourceList = page.commonResourceList.filter((item) => {
        if (!record(item)) return true;
        if (item.resourceType === '11fm') return false;
        const discover = item.resourceType === 'explore' || item.title === '发现';
        const notes = item.resourceType === 'social' || item.title === '笔记';
        const roam = item.resourceType === 'roam' || item.title === '漫游';
        if ((discover && flag('hideDiscover')) || (notes && flag('hideNotes')) || (roam && flag('hideRoam'))) return false;
        if (item.resourceType === 'explore' && Array.isArray(item.subCommonResourceList)) {
          item.subCommonResourceList = item.subCommonResourceList.filter((child) => child?.resourceType === 'music');
        }
        return true;
      });
    }
    return { data, handled: true };
  }

  if (endpoint === '/homepage/block/page' || endpoint === '/link/page/rcmd/resource/show') {
    filterHomePage(data);
    return { data, handled: true };
  }

  if (endpoint === '/link/page/rcmd/block/resource/multi/refresh') {
    if (Array.isArray(data)) data = data.filter(keepHomeCode);
    else if (record(data) && Array.isArray(data.data)) data.data = data.data.filter(keepHomeCode);
    else filterHomePage(data);
    return { data, handled: true };
  }

  if (endpoint === '/link/page/discovery/resource/show') {
    const page = pageData(data);
    if (record(page)) {
      if (Array.isArray(page.blocks)) page.blocks = page.blocks.filter(keepDiscoveryCode);
      filterOrder(page, keepDiscoveryCode);
    }
    return { data, handled: true };
  }

  if (commentPath(endpoint)) {
    cleanCommentEnvelope(data);
    return { data, handled: true };
  }

  if (/^\/user\/follow\/users\/mixed\/get(?:\/v\d+)?$/.test(endpoint)) {
    const page = pageData(data);
    if (flag('showNotFollowingBack') && record(page) && Array.isArray(page.records)) {
      for (const user of page.records) {
        if (!record(user) || user.mutualFollowDay !== null) continue;
        user.showContent = {
          ...(record(user.showContent) ? user.showContent : {}),
          message: '他/她，未关注你',
          active: true,
        };
      }
    }
    return { data, handled: true };
  }

  return { data, handled: false };
}
