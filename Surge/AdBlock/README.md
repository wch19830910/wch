# Surge AdBlock

## AdBlock

| App | Remote module | Upstream |
| --- | --- | --- |
| Ximalaya | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Ximalaya.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/Ximalaya.conf) |
| Amap | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Amap.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/AmapAds.conf) |
| Railway12306 | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Railway12306.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Scripts/master/12306.js) |
| RedNote | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/RedNote.sgmodule) | [ddgksf2013](https://ddgksf2013.top/rewrite/XiaoHongShuAds.conf) |
| Coolapk | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Coolapk.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Scripts/master/coolapk.js) |
| NetEaseMusic | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/NetEaseMusic.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/NeteaseAds.conf) |
| Cainiao | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Cainiao.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/CainiaoAds.conf) |
| Smzdm | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Smzdm.sgmodule) | [blackmatrix7 / ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/SmzdmAds.conf) |
| Goofish | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Goofish.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/refs/heads/master/AdBlock/GoofishAds.conf) |
| SodaMusic | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/SodaMusic.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/refs/heads/master/AdBlock/QiShuiMusicAds.conf) |

在 Surge 的模块页面选择“从 URL 安装”，粘贴 Raw 地址并启用。安装并信任 MITM 证书，开启 MITM、重写和脚本，然后完全退出 App 再打开。相同 App 只启用一份净化模块。

## Updates

- GitHub Actions 的 `Update Ximalaya` 每 6 小时检查墨鱼上游规则，内容变化时重新生成 `Surge/AdBlock/Ximalaya.sgmodule`。
- `Update Amap` 每 6 小时单独检查高德地图规则，内容变化时重新生成 `Surge/AdBlock/Amap.sgmodule`。
- `Update Railway12306` 每 6 小时单独检查铁路12306脚本内嵌规则，内容变化时重新生成 `Surge/AdBlock/Railway12306.sgmodule`。
- `Update RedNote`、`Update Coolapk`、`Update NetEaseMusic` 每 6 小时分别检查小红书、酷安、网易云音乐的上游来源。
- `Update Cainiao`、`Update Smzdm`、`Update Goofish`、`Update SodaMusic` 每 6 小时分别检查菜鸟、什么值得买、闲鱼和汽水音乐的上游来源。
- 转换或语法检查失败时停止发布，保留上一个版本；没有变化不产生提交。
- Surge 自动检查通过 URL 安装的模块更新，检查周期由 Surge 控制。
- 喜马拉雅、高德地图、铁路12306、酷安、菜鸟、什么值得买和闲鱼的 JavaScript 直接引用原作者分支；小红书使用原作者站点的脚本。Surge 每 24 小时检查这些远程脚本更新。汽水音乐没有远程 JavaScript，直接使用原生 JQ 规则。
- 网易云音乐使用本仓库的最小兼容副本 `Surge/Script/NetEaseMusic.js`：每 6 小时检查原作者 Gist 更新并重新包装，Surge 每 24 小时检查此副本更新。保留原净化代码，添加外层函数包装、明文/二进制输入兼容与响应配置，不增加会员或版权解锁功能。
- GitHub 定时任务可能延迟；公开仓库连续 60 天没有活动时可能自动停用，届时在 Actions 页面重新启用。

规则和脚本来源是 [墨鱼网站](https://ddgksf2013.top/) 的对应 App 条目，什么值得买保留 blackmatrix7、ddgksf2013 双署名，其余为 ddgksf2013。保留作者原有净化逻辑；格式转换和语法检查不等于已在最新 App 实机验证。

Surge 内显示对应的中文 App 名称，文件名使用常用英文名。名称和描述可在各自的生成脚本中修改，自动同步时会保留这些设置。

高德地图若仍显示旧广告，可先完全退出 App 后重开、清理 App 缓存；原作者另有先挂载模块再重新安装 App 的提示。

铁路12306使用请求阶段脚本直接返回广告占位响应，仅处理 `ad.12306.cn` 广告接口，并保留原作者要求的该域名 DIRECT 分流。未添加其他购票或支付域名。

小红书选用“去广告去水印”的 Ads 条目，保留该条目自带的功能增强与请求净化，不合并另一份“屏蔽首页信息流视频”规则。其远程脚本依赖作者站点继续允许 Surge 下载。

Surge 的 [MITM `auto-quic-block`](https://manual.nssurge.com/http/mitm.html) 默认开启，对命中 MITM 域名的 QUIC 自动阻断以回落 TCP；请保持默认开启，无需照搬圈 X 的全局 UDP 443 丢弃配置。

酷安脚本按作者要求仅远程引用，不转载完整脚本；仓库仅保存转换后的配置和来源元信息。

使用 Map Local 的空 200 响应需要 Surge iOS 5.9.1+ 或 Surge Mac 5.5.1+。使用原生 [JQ Body Rewrite](https://manual.nssurge.com/http/body-rewrite.html) 的喜马拉雅、闲鱼、汽水音乐还需要 Surge iOS 5.14+ 或 Surge Mac 5.9+。

菜鸟包含原作者的菜鸟 App 与支付宝小程序规则。菜鸟、闲鱼和汽水音乐如仍显示缓存广告，可先完全退出 App 后重开、清理缓存；原作者另有先启用模块再重装 App 的提示，重装前请自行确认账号及本地数据备份。

网易云音乐的加密响应处理需要 [WebView 脚本引擎](https://manual.nssurge.com/scripting/overview.html)，模块已显式设置 `engine=webview`；Mac 需 macOS 11+，不适用于仅有 JSC 的旧 macOS 或 tvOS。

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
```

- [Surge remote scripts](https://manual.nssurge.com/scripting/overview.html)
- [Surge modules](https://manual.nssurge.com/profile/module.html)
- [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
