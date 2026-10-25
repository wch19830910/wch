# 网易云音乐（自定义净化）

原来的安装地址不变：

[NetEaseMusic.sgmodule](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/NetEaseMusic.sgmodule)

这是“墨鱼广告处理主干 + 独立实现的可配置界面/评论净化”，不是把两个完整脚本依次运行。Keywos 仅作为功能设计参考，不内嵌、转载或执行其原脚本。墨鱼来源与第三方库许可保留在生成脚本头部。

## 使用方法

在 Surge 更新原来的网易云模块，进入该模块的参数设置后修改选项。不要同时启用其他网易云广告模块。启用重写、脚本及 MITM，并安装、信任 MITM 证书，然后完全退出网易云再打开。

建议 Surge iOS 5.9.1+ / Mac 5.5.1+；Mac 还需要 macOS 11+。模块显式使用 WebView 和二进制响应。脚本地址的 `?v=merged-1` 用于从旧缓存切换到合并版，不影响后续远程更新。

## 默认行为

- 继续处理开屏、搜索、歌单/评论广告、侧栏及活动推广。
- 保留发现、漫游、笔记和九类首页卡片；移除已知广告横幅，未知卡片保留。
- 评论装饰精简默认开启；未回关提示默认关闭。
- 首页、底栏参数只控制服务器已返回的项目，不能凭空恢复 App 不再提供的栏目。
- 为保留真实会员信息，不再清空整个会员账户页；因此可能保留该页部分原有显示。

## 参数

`0` 表示保留/关闭，`1` 表示隐藏/开启。也接受 `true` / `false`；建议使用 `0` / `1`，无效值会回退默认值。

| 参数 | 作用 | 默认 |
| --- | --- | --- |
| hideDiscover | 隐藏底部“发现” | 0 |
| hideRoam | 隐藏底部“漫游” | 0 |
| hideNotes | 隐藏底部“笔记” | 0 |
| hideGreeting | 隐藏首页问候语 | 0 |
| hideDailyRecommend | 隐藏每日推荐 | 0 |
| hidePlaylistRecommend | 隐藏推荐歌单 | 0 |
| hideRecentPlayed | 隐藏最近常听 | 0 |
| hideMusicPartner | 隐藏音乐合伙人 | 0 |
| hideRadar | 隐藏雷达歌单 | 0 |
| hideRanking | 隐藏排行榜 | 0 |
| hideMyPlaylist | 隐藏推荐专属歌单 | 0 |
| hideCombinationPlaylist | 隐藏你的专属歌单 | 0 |
| cleanCommentDecorations | 清理头像挂件、评论标签等装饰 | 1 |
| showNotFollowingBack | 根据返回字段显示未回关提示 | 0 |

评论精简保留 `vipRights`、会员等级、到期数据及 `followed`。部分会员徽章可能仍显示，这是保留真实会员信息的边界。未回关选项只改提示文本，不会关注、取消关注或伪造关注状态，判断依据可能随 App 接口变化。

## 不包含的内容

- 不包含 Keywos 的独立或批量“伪 VIP”改写；不改会员等级或到期时间。
- 不解锁会员、付费歌曲或音乐版权。
- 不合入 HTTPDNS 全域拒绝、艺术家关注接口拦截，避免额外改变网络调度或关注功能。

## 更新和验证

GitHub Actions 每 6 小时检查墨鱼配置、墨鱼脚本及 Keywos 两份参考文件的已审核 SHA256。任何上游内容变化都会先停止发布，保留上一版；须兼容审查、更新测试并确认新 hash 后才能接入，不能无脑覆盖合并代码。Keywos 的正文不会保存到仓库，只有参考地址和 hash 元信息。

Surge 每 24 小时检查本仓库生成脚本。自定义源码在 `Surge/scripts/netease-customize.mjs` 与 `netease-runtime.mjs`，名称和描述在 `build-netease-music.mjs`，自动同步不会覆盖这些手工维护的设置。

测试覆盖明文 JSON、UTF-8 JSON 字节、AES、AES+gzip、参数默认与切换、首页刷新、评论与关注提示、真实会员数据原样、异常放行、单次完成及原生配置语法。测试使用合成数据，不访问网易云业务接口，不等于最新版 App 手机实测；页面或功能异常时请停用模块。
