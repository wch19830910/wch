# Build Scripts

`build-ximalaya.mjs` 从墨鱼网站列出的官方 Ximalaya 规则生成 Surge 原生模块。
`build-amap.mjs` 对应官方 AmapAds 规则，模块显示名称为“高德地图”。
`build-railway12306.mjs` 读取官方 12306 脚本顶部注释中的圈 X 配置，转换为请求阶段脚本，模块显示名称为“铁路12306”。
`build-rednote.mjs` 对应小红书去广告去水印条目，模块显示名称为“小红书”，不合入另一份屏蔽首页视频规则。
`build-coolapk.mjs` 读取官方酷安脚本内嵌配置，模块显示名称为“酷安”；不转载其完整 JavaScript。
`build-netease-music.mjs` 对应网易云音乐净化条目，模块显示名称为“网易云音乐”；同时生成原作者 Gist 脚本的最小 Surge 兼容副本。
`build-cainiao.mjs` 对应菜鸟 App 和支付宝小程序净化条目，模块显示名称为“菜鸟”。
`build-smzdm.mjs` 对应什么值得买净化条目，保留 blackmatrix7、ddgksf2013 双署名。
`build-goofish.mjs` 对应闲鱼净化条目，模块显示名称为“闲鱼”，JQ 转为 Surge 原生 Body Rewrite。
`build-soda-music.mjs` 对应汽水音乐净化条目，模块显示名称为“汽水音乐”，不使用远程 JavaScript，JQ 转为 Surge 原生 Body Rewrite。

在仓库根目录运行，需要 Node.js 20+：

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

模块输出到 `Surge/AdBlock/Ximalaya.sgmodule`，原始规则快照输出到 `Surge/upstream/Ximalaya.conf`。
高德地图分别输出到 `Surge/AdBlock/Amap.sgmodule` 和 `Surge/upstream/AmapAds.conf`。
铁路12306分别输出到 `Surge/AdBlock/Railway12306.sgmodule` 和 `Surge/upstream/12306.js`。
小红书输出 `Surge/AdBlock/RedNote.sgmodule` 和对应上游规则快照。
酷安输出 `Surge/AdBlock/Coolapk.sgmodule` 和 `Surge/upstream/Coolapk.source.json` 来源元信息。
网易云音乐输出 `Surge/AdBlock/NetEaseMusic.sgmodule`、上游规则快照及 `Surge/Script/NetEaseMusic.js`。兼容脚本在原文外包裹函数以支持顶层 return；输入为二进制但能严格解码为 JSON 对象时先转回文本，其他字节保持原样。模块启用二进制响应和 WebView 引擎；每次同步重新从官方 Gist 获取原文，保留原作者署名与第三方许可说明。
菜鸟、什么值得买、闲鱼、汽水音乐分别输出对应英文名的模块和 `CainiaoAds.conf`、`SmzdmAds.conf`、`GoofishAds.conf`、`QiShuiMusicAds.conf` 上游快照。

闲鱼、汽水音乐的构建环境需要 jq；输出原样保留上游 JQ 表达式，客户端需要 Surge iOS 5.14+ / Mac 5.9+。

需要调整 Surge 内的显示名称或描述时，修改对应构建脚本中的 `#!name` / `#!desc` 文案，保留 JavaScript 引号和逗号。不要只修改自动生成的 `.sgmodule`，因为后续同步会覆盖它。

GitHub Actions 会定期运行本脚本；上游脚本只做语法检查，不在构建中执行。
