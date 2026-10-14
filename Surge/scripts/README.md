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
`build-didi.mjs` 对应墨鱼 GitHub 索引推荐的 ZenmoFeiShi 滴滴完整精简版，模块显示名称为“滴滴出行”。完整保留上游行为，包括隐藏安全中心入口、钱包与行程页面精简；不是保守去广告版。
`build-weibo.mjs` 对应墨鱼微博及国际版/轻享版完整净化规则，模块显示名称为“微博”；完整保留原上游皮肤状态、视频预览和界面精简行为，不是账号会员开通，也不是仅去广告。

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
node Surge/scripts/build-didi.mjs
node Surge/scripts/build-weibo.mjs
```

模块输出到 `Surge/AdBlock/Ximalaya.sgmodule`，原始规则快照输出到 `Surge/upstream/Ximalaya.conf`。
高德地图分别输出到 `Surge/AdBlock/Amap.sgmodule` 和 `Surge/upstream/AmapAds.conf`。
铁路12306分别输出到 `Surge/AdBlock/Railway12306.sgmodule` 和 `Surge/upstream/12306.js`。
小红书输出 `Surge/AdBlock/RedNote.sgmodule` 和对应上游规则快照。
酷安输出 `Surge/AdBlock/Coolapk.sgmodule` 和 `Surge/upstream/Coolapk.source.json` 来源元信息。
网易云音乐输出 `Surge/AdBlock/NetEaseMusic.sgmodule`、上游规则快照及 `Surge/Script/NetEaseMusic.js`。兼容脚本在原文外包裹函数以支持顶层 return；输入为二进制但能严格解码为 JSON 对象时先转回文本，其他字节保持原样。模块启用二进制响应和 WebView 引擎；每次同步重新从官方 Gist 获取原文，保留原作者署名与第三方许可说明。
菜鸟、什么值得买、闲鱼、汽水音乐分别输出对应英文名的模块和 `CainiaoAds.conf`、`SmzdmAds.conf`、`GoofishAds.conf`、`QiShuiMusicAds.conf` 上游快照。
滴滴出行输出 `Surge/AdBlock/DiDi.sgmodule` 和 `Surge/upstream/Didichuxing.snippet`；没有远程 JavaScript，保留 ZenmoFeiShi（怎么肥事）署名与墨鱼推荐来源。
微博输出 `Surge/AdBlock/Weibo.sgmodule` 和 `Surge/upstream/WeiboAds.conf`；三个脚本均直接引用墨鱼 master 分支，其中两个 `.json` 后缀文件实际是 JavaScript，按 JavaScript 做语法校验。保留 ddgksf2013、zmqcherish、shiro 署名；选项由上游脚本固定，不使用另一个版本的 `weibo_config.js`。

闲鱼、汽水音乐、滴滴出行和微博的构建环境需要 jq；输出原样保留上游 JQ 表达式，客户端需要 Surge iOS 5.14+ / Mac 5.9+。

需要调整 Surge 内的显示名称或描述时，修改对应构建脚本中的 `#!name` / `#!desc` 文案，保留 JavaScript 引号和逗号。不要只修改自动生成的 `.sgmodule`，因为后续同步会覆盖它。

GitHub Actions 会定期运行本脚本；上游脚本只做语法检查，不在构建中执行。
