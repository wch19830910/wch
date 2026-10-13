# Build Scripts

`build-ximalaya.mjs` 从墨鱼网站列出的官方 Ximalaya 规则生成 Surge 原生模块。
`build-amap.mjs` 对应官方 AmapAds 规则，模块显示名称为“高德地图”。

在仓库根目录运行，需要 Node.js 20+：

```sh
node Surge/scripts/build-ximalaya.mjs
node Surge/scripts/build-amap.mjs
```

模块输出到 `Surge/AdBlock/Ximalaya.sgmodule`，原始规则快照输出到 `Surge/upstream/Ximalaya.conf`。
高德地图分别输出到 `Surge/AdBlock/Amap.sgmodule` 和 `Surge/upstream/AmapAds.conf`。

需要调整 Surge 内的显示名称或描述时，修改对应构建脚本中的 `#!name` / `#!desc` 文案，保留 JavaScript 引号和逗号。不要只修改自动生成的 `.sgmodule`，因为后续同步会覆盖它。

GitHub Actions 会定期运行本脚本；上游脚本只做语法检查，不在构建中执行。
