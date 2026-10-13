# Surge AdBlock

## AdBlock

| App | Remote module | Upstream |
| --- | --- | --- |
| Ximalaya | [Install / Raw](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Ximalaya.sgmodule) | [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/Ximalaya.conf) |

在 Surge 的模块页面选择“从 URL 安装”，粘贴 Raw 地址并启用。安装并信任 MITM 证书，开启 MITM、重写和脚本，然后完全退出 App 再打开。相同 App 只启用一份净化模块。

## Updates

- GitHub Actions 的 `Update Ximalaya` 每 6 小时检查墨鱼上游规则，内容变化时重新生成 `Surge/AdBlock/Ximalaya.sgmodule`。
- 转换或语法检查失败时停止发布，保留上一个版本；没有变化不产生提交。
- Surge 自动检查通过 URL 安装的模块更新，检查周期由 Surge 控制。
- 响应脚本直接引用原作者 `master` 分支，每 24 小时检查更新。
- GitHub 定时任务可能延迟；公开仓库连续 60 天没有活动时可能自动停用，届时在 Actions 页面重新启用。

规则和脚本作者为 ddgksf2013，来源是 [墨鱼网站](https://ddgksf2013.top/) 的 Ximalaya 条目。保留作者原有净化逻辑；格式转换和语法检查不等于已在最新 App 实机验证。

## Build

在仓库根目录执行，需要 Node.js 20+；上游包含 JQ 规则时还需要 jq：

```sh
node Surge/scripts/build-ximalaya.mjs
```

- [Surge remote scripts](https://manual.nssurge.com/scripting/overview.html)
- [Surge modules](https://manual.nssurge.com/profile/module.html)
- [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
