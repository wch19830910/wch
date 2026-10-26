# 微信（公众号推广与部分小程序去广告）

[安装远程模块](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/WeChat.sgmodule)

基于墨鱼／ddgksf2013 的去开屏合集和微信小程序规则，整理为原生 Surge 模块。文件名为 `WeChat.sgmodule`，显示中文名称。使用本地空响应和正文替换，不下载或执行远程 JavaScript。

## 功能范围

| 功能 | 处理方式 |
|---|---|
| 公众号文章带货商品信息 | 仅对 `mp.weixin.qq.com/mp/cps_product_info` 返回空 HTTP 200 |
| 公众号文章相关搜索词 | 仅对 `mp.weixin.qq.com/mp/relatedsearchword` 返回空 HTTP 200 |
| 便利蜂小程序横幅广告 | 仅对 `api.blibee.com` 的指定 banner 版本接口返回空 HTTP 200 |
| 顺丰速运小程序信息流广告 | 仅对 `ucmp.sf-express.com` 的指定广告查询接口返回空 HTTP 200 |
| 掌上公交小程序广告标记 | 仅在 `wx.mygolbs.com/WxBusServer/ApiData.do` 响应中，将完整字段 `Ad`、`Ad_ab` 的数字值 1 改为 0 |

共五个 URL 目标，MITM 只追加上述四个精确主机。广告接口匹配使用路径边界，不拦截微信或小程序整个域名。未直接匹配聊天、登录、支付、朋友圈、视频号及普通文章 URL；这只是规则范围验证，尚未在最新版微信手机实测。

它只处理表内的推广和三个小程序的指定广告接口，不能去除所有小程序的五秒开屏、朋友圈或视频号广告。顺丰、便利蜂的接口域名可能被其他入口共用，相同 URL 的请求也会受这些规则影响。

## 上游旧功能的处理

墨鱼的 `WeChat.conf` 已明确标注旧 `getappmsgad` 公众号图文去广告规则失效，本模块没有启用或将它宣传为有效功能。它在去开屏和小程序合集里的重复配置也不重复接入。

去开屏合集中的 `WeChat110` 外链提示处理保持未启用。通用 WordPress 小程序脚本匹配任意域名，并包含直接查看隐藏内容的逻辑，本模块没有引入。公众号带货和相关搜索词是独立接口处理，不能等同公众号广告全面清除。

## 安装与使用

需要 **Surge iOS 5.10+ 或 Surge Mac 5.6+**。在 Surge 的模块页面选择从 URL 安装，粘贴上方地址并启用。开启重写及 MITM，安装并信任 MITM 证书，再完全退出微信并打开目标公众号文章或小程序。这个模块不依赖脚本开关或 JQ。

如已启用其他微信去广告模块，先停用其中重叠的规则，避免重复响应处理。出现文章或小程序页面异常时，可停用本模块并重开对应页面，检查是否恢复。

## 远程更新

- GitHub Actions 的 **Update WeChat** 每六小时检查已接入的墨鱼公开来源，构建和测试通过后发布变更。
- 只同步已审核范围。新增主机、扩大路径、新执行脚本或已审核处理发生变化时停止发布，等待兼容审查，保留仓库现有模块。
- Surge 按远程模块机制更新，也可在模块页面手动更新。没有额外的远程脚本更新。
- GitHub 定时任务可能延迟，公开仓库长期无活动时可能被 GitHub 暂停，届时在 Actions 页面重新启用。
- 修改显示名称或描述，请编辑 `Surge/scripts/build-wechat.mjs` 后运行对应工作流。直接修改自动生成的模块会被下次同步覆盖。

## 来源与验证

- [墨鱼去开屏 2.0](https://ddgksf2013.top/rewrite/StartUpAds.conf)：公众号带货、相关搜索词。
- [墨鱼微信小程序规则](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/Applet.conf)：便利蜂、顺丰和掌上公交入口。
- [掌上公交原处理说明](https://raw.githubusercontent.com/ddgksf2013/Scripts/master/zhangshanggongjiao.js)：只参考其中两项广告字段行为，不发布或运行原脚本。
- [已标失效的旧公众号规则](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/WeChat.conf)：用于记录排除原因。
- [来源与原作者声明](../licenses/ddgksf2013-WeChat-NOTICE.txt)。来源元信息保存在 `Surge/upstream/WeChat.sources.json`，未将上游未声明许可的代码改称某种开源许可。

构建仅读取公开源文件，不访问微信账号、小程序业务接口或个人数据。合成样本验证五个目标的匹配范围、正常功能路径不匹配、公交广告字段修改、未知上游拒绝接入以及失败时保留旧文件。本机安装 Surge CLI 时另做原生配置检查，Linux CI 明确跳过这项本机检查；这些验证不能替代手机实测。
