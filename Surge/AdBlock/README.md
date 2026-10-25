# Surge AdBlock

## AdBlock

| App | Remote module / Surge name | Upstream |
| --- | --- | --- |
| Ximalaya | [喜马拉雅（全净化）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Ximalaya.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/Ximalaya.conf) |
| Amap | [高德地图（全净化）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Amap.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/AmapAds.conf) |
| Railway12306 | [铁路12306（开屏去广告）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Railway12306.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Scripts/master/12306.js) |
| RedNote | [小红书（去广告与去水印）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/RedNote.sgmodule) | [ddgksf2013](https://ddgksf2013.top/rewrite/XiaoHongShuAds.conf) |
| Coolapk | [酷安（去广告）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Coolapk.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Scripts/master/coolapk.js) |
| NetEaseMusic | [网易云音乐（自定义净化）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/NetEaseMusic.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/NeteaseAds.conf) / [Keywos（功能参考）](https://raw.githubusercontent.com/Keywos/rule/refs/heads/main/script/wy/wy.sgmodule) |
| Cainiao | [菜鸟（去广告与页面净化）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Cainiao.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/CainiaoAds.conf) |
| Smzdm | [什么值得买（去广告）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Smzdm.sgmodule) | [blackmatrix7 / ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/SmzdmAds.conf) |
| Goofish | [闲鱼（全净化）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Goofish.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/refs/heads/master/AdBlock/GoofishAds.conf) |
| SodaMusic | [汽水音乐（广告与推广净化）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/SodaMusic.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/refs/heads/master/AdBlock/QiShuiMusicAds.conf) |
| DiDi | [滴滴出行（全净化）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/DiDi.sgmodule) | [ZenmoFeiShi（怎么肥事）](https://raw.githubusercontent.com/ZenmoFeiShi/Qx/main/Didichuxing.snippet) |
| Weibo | [微博（全净化）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Weibo.sgmodule) | [ddgksf2013 / zmqcherish](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/WeiboAds.conf) |
| Freshippo | [盒马（全净化）](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Freshippo.sgmodule) | [zirawell](https://raw.githubusercontent.com/zirawell/R-Store/main/Rule/Surge/Adblock/App/H/%E7%9B%92%E9%A9%AC/freshippo.sgmodule) |

在 Surge 的模块页面选择“从 URL 安装”，粘贴 Raw 地址并启用。安装并信任 MITM 证书，开启 MITM、重写和脚本，然后完全退出 App 再打开。相同 App 只启用一份净化模块。

## Updates

- GitHub Actions 的 `Update Ximalaya` 每 6 小时检查墨鱼上游规则，内容变化时重新生成 `Surge/AdBlock/Ximalaya.sgmodule`。
- `Update Amap` 每 6 小时单独检查高德地图规则，内容变化时重新生成 `Surge/AdBlock/Amap.sgmodule`。
- `Update Railway12306` 每 6 小时单独检查铁路12306脚本内嵌规则，内容变化时重新生成 `Surge/AdBlock/Railway12306.sgmodule`。
- `Update RedNote`、`Update Coolapk`、`Update NetEaseMusic` 每 6 小时分别检查小红书、酷安、网易云音乐的上游来源。
- `Update Cainiao`、`Update Smzdm`、`Update Goofish`、`Update SodaMusic` 每 6 小时分别检查菜鸟、什么值得买、闲鱼和汽水音乐的上游来源。
- `Update DiDi` 每 6 小时检查 ZenmoFeiShi 的滴滴出行完整精简规则，保留上游全部分流、拒绝响应、JQ 和 MITM 配置。
- `Update Weibo` 每 6 小时检查墨鱼微博规则，完整转换微博及国际版/轻享版的上游配置。
- `Update Freshippo` 每 6 小时检查 zirawell 的盒马完整净化模块；响应脚本直接引用原作者 `main` 分支，Surge 每 24 小时检查脚本更新。
- 转换或语法检查失败时停止发布，保留仓库上次生成的模块和快照；没有变化不产生提交。直接引用的原作者脚本由 Surge 独立更新，这不是手机端脚本冻结或回滚保证。
- Surge 自动检查通过 URL 安装的模块更新，检查周期由 Surge 控制。
- 喜马拉雅、高德地图、铁路12306、酷安、菜鸟、什么值得买、闲鱼和微博的 JavaScript 直接引用原作者分支；小红书使用原作者站点的脚本。Surge 每 24 小时检查这些远程脚本更新。汽水音乐没有远程 JavaScript，直接使用原生 JQ 规则。
- 网易云音乐使用本仓库的合并版 `Surge/Script/NetEaseMusic.js`：每 6 小时检查墨鱼配置/脚本及 Keywos 两份功能参考文件。四份源均有已审核 SHA256，发生变化时先停发布，须人工兼容审查及测试后才能接入；不是自动拼接两个完整脚本。Surge 每 24 小时检查合并脚本，原模块地址不变。
- GitHub 定时任务可能延迟；公开仓库连续 60 天没有活动时可能自动停用，届时在 Actions 页面重新启用。

除盒马外，规则和脚本来源是 [墨鱼网站](https://ddgksf2013.top/) 的对应 App 条目；滴滴使用[墨鱼 GitHub 官方索引](https://github.com/ddgksf2013)推荐的 ZenmoFeiShi（怎么肥事）规则，不冒称墨鱼自作。盒马使用 zirawell 的独立原生 Surge 模块，不冒称墨鱼规则。什么值得买保留 blackmatrix7、ddgksf2013 双署名，微博保留 ddgksf2013、zmqcherish、shiro 署名，其余为 ddgksf2013。保留作者原有净化逻辑；格式转换和语法检查不等于已在最新 App 实机验证。

Surge 内显示“中文软件名（功能类型）”，区分开屏去广告、去广告、去水印、界面精简与全净化，文件名和远程地址仍使用原来的常用英文名。全净化表示保留完整上游功能，不保证移除所有广告。各模块描述已列明具体处理范围、作者、更新周期、启用/版本要求及副作用；名称和描述可在对应生成脚本中修改，自动同步时会保留这些设置。

高德地图若仍显示旧广告，可先完全退出 App 后重开、清理 App 缓存；原作者另有先挂载模块再重新安装 App 的提示。

铁路12306使用请求阶段脚本直接返回广告占位响应，仅处理 `ad.12306.cn` 广告接口，并保留原作者要求的该域名 DIRECT 分流。未添加其他购票或支付域名。

小红书选用“去广告去水印”的 Ads 条目，保留该条目自带的功能增强与请求净化，不合并另一份“屏蔽首页信息流视频”规则。其远程脚本依赖作者站点继续允许 Surge 下载。

Surge 的 [MITM `auto-quic-block`](https://manual.nssurge.com/http/mitm.html) 默认开启，对命中 MITM 域名的 QUIC 自动阻断以回落 TCP；请保持默认开启，无需照搬圈 X 的全局 UDP 443 丢弃配置。

酷安脚本按作者要求仅远程引用，不转载完整脚本；仓库仅保存转换后的配置和来源元信息。

使用 Map Local 的空 200 响应需要 Surge iOS 5.9.1+ 或 Surge Mac 5.5.1+。使用原生 [JQ Body Rewrite](https://manual.nssurge.com/http/body-rewrite.html) 的闲鱼、汽水音乐、滴滴出行和微博还需要 Surge iOS 5.14+ 或 Surge Mac 5.9+；当前喜马拉雅模块未使用 JQ。

菜鸟包含原作者的菜鸟 App 与支付宝小程序规则。菜鸟、闲鱼和汽水音乐如仍显示缓存广告，可先完全退出 App 后重开、清理缓存；原作者另有先启用模块再重装 App 的提示，重装前请自行确认账号及本地数据备份。

滴滴出行为完整上游精简版，不是仅去广告：会隐藏“安全中心”等入口，修改钱包、首页导航和行程组件，并保留上游域名/IP 拒绝与配置接口拦截。启用前请确认接受这些功能变化；若使用受影响，请停用该模块并完全退出 App 后重开。此模块没有远程 JavaScript，随原生规则模块更新。

微博完整保留墨鱼上游逻辑，不是仅去广告：会精简发现页、推荐、打赏及个人页组件，包含原上游皮肤状态和视频预览限制相关响应修改，不是账号会员开通。主脚本选项目前在作者脚本内固定，不能用另一作者的 `weibo_config.js` 配置。两个 `.json` 后缀的搜索脚本实际也是 JavaScript，模块直接引用原地址。若页面或功能异常，请停用模块并完全退出 App 后重开；未保证最新微博实机兼容。

盒马为完整上游净化版：保留全部 IP 拒绝、AMDC 处理、页面/推荐/更新查询接口拦截，以及首页、我的、购物车和小程序页面的原作者净化逻辑，不是只去开屏。12 条 `pre-matching` IP 拒绝优先于普通分流，且部分接口使用共享的淘宝域名，可能影响其他阿里系 App；不能靠普通前置 DIRECT 保证覆盖。若盒马购物功能或其他 App 异常，请先停用此模块并完全退出相关 App 后重开。先尝试重开和清缓存；上游另有可能需要重装的提示，重装前请自行备份本地数据。未保证最新版盒马实机效果。

盒马建议 Surge iOS 5.14.2+（上游标注版本）或 Surge Mac 5.9+；`pre-matching` 本身最低要求 iOS 5.14 / Mac 5.9。为通过原生校验，将上游 5 条 `data-type=json` 规范为 `data-type=text` 并显式设置 JSON Content-Type；脚本 `max-size=0` 按官方手册改为 `-1`，保留原 ICU 原子组正则和脚本正文。模块、原始快照和盒马构建脚本按 GPL-3.0 发布，许可全文见 [zirawell-GPL-3.0.txt](../licenses/zirawell-GPL-3.0.txt)，无任何保证；其他独立模块的许可不因此改变。

网易云音乐的加密响应处理需要 [WebView 脚本引擎](https://manual.nssurge.com/scripting/overview.html)，模块已显式设置 `engine=webview`；Mac 需 macOS 11+，不适用于仅有 JSC 的旧 macOS 或 tvOS。

网易云音乐现为自定义合并版：墨鱼广告处理主干加独立编写的底栏、九类首页卡片、评论装饰及未回关提示选项；不转载或执行 Keywos 原脚本。默认保留发现/漫游/笔记与九类卡片，评论精简开启、未回关提示关闭。真实会员信息与关注状态保留，不包含伪 VIP、HTTPDNS 全域拒绝、艺术家关注接口拦截或版权解锁。参数只控制服务器返回的项目，不能恢复 App 已不提供的栏目。安装、参数和更新说明见 [NetEaseMusic.md](NetEaseMusic.md)，只启用这一份网易云模块。

## Build

在仓库根目录执行，需要 Node.js 20+；上游包含 JQ 规则时还需要 jq：

```sh
node Surge/scripts/build-ximalaya.mjs
node Surge/scripts/build-amap.mjs
node Surge/scripts/build-railway12306.mjs
node Surge/scripts/build-rednote.mjs
node Surge/scripts/build-coolapk.mjs
node Surge/scripts/build-netease-music.mjs
node Surge/scripts/build-cainiao.mjs
node Surge/scripts/build-smzdm.mjs
node Surge/scripts/build-goofish.mjs
node Surge/scripts/build-soda-music.mjs
node Surge/scripts/build-didi.mjs
node Surge/scripts/build-weibo.mjs
node Surge/scripts/build-freshippo.mjs
```

- [Surge remote scripts](https://manual.nssurge.com/scripting/overview.html)
- [Surge modules](https://manual.nssurge.com/profile/module.html)
- [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
