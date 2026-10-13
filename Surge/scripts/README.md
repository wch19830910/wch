# Build Scripts

`build-ximalaya.mjs` 从墨鱼网站列出的官方 Ximalaya 规则生成 Surge 原生模块。

在仓库根目录运行，需要 Node.js 20+：

```sh
node Surge/scripts/build-ximalaya.mjs
```

模块输出到 `Surge/AdBlock/Ximalaya.sgmodule`，原始规则快照输出到 `Surge/upstream/Ximalaya.conf`。

GitHub Actions 会定期运行本脚本；上游脚本只做语法检查，不在构建中执行。
