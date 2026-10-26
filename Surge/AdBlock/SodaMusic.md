# 汽水音乐（广告与推广净化）

[远程模块](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/SodaMusic.sgmodule)，地址保持不变。

2026-10-27 根据用户“启用后抖音评论加载失败”的反馈缩小作用范围。旧版沿用上游通配主机规则，拦截字节系共享的 `get_domains` 配置接口及不限定 App 的 `location/info`。这些属于可能影响其他 App 的范围；未取得手机请求日志，不能确定实际触发的具体请求，也未声称实机故障已经恢复。

修正版完全移除这两类拦截与 `tnc*-*.zijieapi.com` MITM，其他规则仅匹配 `beta-luna.douyin.com`、`api.qishui.com` 的九个明确 `/luna/` 端点（允许查询参数，拒绝相似主机和路径后缀）。保留视频/通用广告、商业弹窗、TAGS推荐、我的页横幅、会员试听引导、热搜、搜索活动及歌曲流推广精简。只使用原生本地响应和 JQ，不加载远程脚本，不解锁会员或版权。

先停用旧汽水模块，完全退出抖音再重开，确认评论是否恢复；随后更新此远程模块再启用。只启用一份汽水音乐模块，避免旧副本继续拦截。若仍异常，保持该模块停用，并在 Surge 请求记录中查看失败的抖音请求及命中规则。无需为此次修复卸载 App、修改证书或清空所有配置。

需要 Surge iOS 5.14+ / Mac 5.9+，开启重写与 MITM 并安装、信任证书。只做了合成路由、JQ 和配置验证，尚未手机实测；App 接口可能变化，效果以实际使用为准。

规则来源为 [ddgksf2013](https://raw.githubusercontent.com/ddgksf2013/Rewrite/refs/heads/master/AdBlock/QiShuiMusicAds.conf)，原始快照保留供追溯，本仓库负责上述范围调整。每 6 小时检查来源；构建器固定九项可用规则和两项排除规则，未知主机、路径、动作或 JQ 变化会停止更新，保留旧成品。测试通过后才发布，不会因同步把共享接口拦截重新加回来。Surge 端仍需更新远程模块以取得仓库新版本。

名称、说明和兼容范围请改 `Surge/scripts/build-soda-music.mjs`；直接修改生成模块会被下次构建覆盖。验证命令：`node Surge/tests/soda-music.test.mjs`。
