# 百度贴吧（去广告与页面净化）

[安装模块](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/Tieba.sgmodule)

使用 app2smile 官方 Surge 完整版作为广告处理主干，加入墨鱼的搜索、侧栏和个人页面精简。文件名为 `Tieba.sgmodule`，在 Surge 内显示中文名称。只启用这一份贴吧模块。

## 功能

- 处理开屏、推荐页及吧内帖子列表广告、帖内广告、看图广告、右下角悬浮广告，以及部分吧头广告。
- 沿用 app2smile 对推荐和帖子中的直播、关联商品、帖内小说推荐卡等内容的精简。
- 清空首页和进吧搜索推荐、进吧热搜；移除搜索起始页的推荐数据。
- 侧栏移除游戏中心、工具、会员推广横幅和任务推广。
- “我的”页面移除金融、推广、会员横幅和推荐内容；功能分区只保留上游定义的常用功能及辅助功能，其他分区可能不再显示。
- 默认保留普通视频帖。模块参数 `per_filter_video` 设为 `1` 时，按原作者逻辑隐藏 protobuf 推荐接口返回的视频帖；设为 `0` 时保留，默认值为 `0`。旧 JSON 接口没有此视频开关分支。

广告处理脚本直接引用 app2smile 原始地址，不复制 JavaScript 正文。模块不加入会员解锁、关注关系修改或签到功能。没有合入未审核的第三方 PR，也没有加入可莉版的额外导航精简。

## 安装和使用

1. 系统需 iOS 15 以上，Surge iOS 5.14+；Mac 需 Surge 5.9+（规则语法要求，贴吧 iOS App 的实际使用环境仍为 iPhone/iPad）。
2. Surge → 模块 → 从 URL 安装，粘贴上方安装地址并启用。
3. 开启 MITM、脚本及重写，安装并信任 MITM 证书，完全退出贴吧后重新打开。
4. 如果以前装过其他贴吧模块，停用重复的模块；检查其他去广告规则是否直接拒绝了 `c/s/sync`，该接口需要交给本模块处理。

MITM 范围限定为 `tiebac.baidu.com`、`tieba.baidu.com`、`c.tieba.baidu.com`。后者补齐当前官方脚本正则已覆盖的 HTTPS 主机，不扩展到整个百度域名。

原作者的 `sync` 处理会关闭部分广告 SDK 开关，并调整长连接配置，让相关帖子请求走可处理的 HTTP 接口；这也是不能直接拒绝整个 `sync` 接口的原因。模块沿用官方的 `180.76.76.200` DNS/HTTPDNS 拒绝规则，未加入其他百度 IP 拒绝。

## 更新

- GitHub Actions 的 **Update Tieba** 每 6 小时检查两份上游配置、广告地址表及两份远程脚本。
- 构建验证通过、内容发生变化时，自动更新模块和配置快照；下载失败、结构变化或测试失败时，不提交新的成品。
- 两份原作者脚本由 Surge 每 24 小时独立检查更新；GitHub 构建失败并不代表客户端直引的脚本被冻结。
- 在 Surge 内更新模块和外部资源即可获取已发布内容。GitHub 定时任务可能延迟；公开仓库连续 60 天无活动时，需重新启用定时任务。
- 修改显示名称、描述或默认参数，应编辑 `Surge/scripts/build-tieba.mjs` 后运行对应工作流。只编辑生成的模块会被下一次同步覆盖。

为避免旧规则抢占新脚本，墨鱼的旧 `getFeedAd` 无条件空响应规则由 app2smile 当前 protobuf 处理统一接管。其余五类页面净化转换为 Surge 原生 JQ Body Rewrite；个人页 `zone_info` 仅在数组时过滤，缺失或格式不符时保留原值。

## 来源和验证范围

- [app2smile 官方 Surge 模块](https://raw.githubusercontent.com/app2smile/rules/master/module/tieba.sgmodule)、[广告地址表](https://raw.githubusercontent.com/app2smile/rules/master/rule/tieba-ad.list)、[JSON 脚本](https://raw.githubusercontent.com/app2smile/rules/master/js/tieba-json.js)、[protobuf 脚本](https://raw.githubusercontent.com/app2smile/rules/master/js/tieba-proto.js)。相关配置和快照遵循 [app2smile MIT 许可证](../licenses/app2smile-MIT.txt)。
- [墨鱼 TieBaAds.conf](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/TieBaAds.conf)，保留 app2smile、ddgksf2013 双署名及来源说明。
- [Surge JQ 版本与处理方式](https://manual.nssurge.com/http/body-rewrite.html)。

本仓库通过合成响应测试验证接口覆盖、JQ 页面净化、参数及配置；构建时只编译检查远程脚本，不执行下载的脚本，也不访问贴吧账户或业务接口。本机安装 Surge CLI 时另做原生配置检查，GitHub Linux 环境明确跳过该项。尚未在最新版贴吧手机端实测，不保证清除所有广告。页面或通知出现异常时，可停用模块并完全退出贴吧后重开。
