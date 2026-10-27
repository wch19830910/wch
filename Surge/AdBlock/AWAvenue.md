# 秋风广告拦截（Only.Ads兼容版）

[远程模块](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/AWAvenue.sgmodule)。来源为 [TG-Twilight 秋风 Only.Ads](https://github.com/TG-Twilight/AWAvenue-Ads-Rule)，2026-10-28 由本仓库做兼容调整，不是秋风官方发布的兼容保证，也不是可莉加密插件转换。

用于通用广告域名拦截，与本仓库 App 专用模块搭配。首次构建来源665条、保留661条、排除4条；以后数量随通过检查的上游变化。规则类型为精确域名、域名后缀及四个已审核关键词；其余规则保留上游 REJECT、extended-matching、pre-matching 和原顺序。仍包含部分广告SDK、统计等域名，不能保证只影响所有人都认定的广告。

| 排除主机 | 原因 |
|---|---|
| `ad.12306.cn` | 保留铁路12306专用模块在请求阶段返回广告占位响应 |
| `optimus-ads.amap.com` | 保留高德专用模块的放行和处理安排 |
| `sdkapp.uve.weibo.com` | 保留微博专用模块按路径净化 |
| `open.snssdk.com` | [头条OAuth授权](https://open.douyin.com/platform/resource/docs/openapi/account-permission/toutiao-get-permission-code)共享主机，不整域拒绝 |

构建按规则含义排除覆盖上述主机的精确、后缀或关键词项，以及明确指向其子域名的域名条目。未知匹配类型/选项会停止更新。它不会额外将这些域名强制DIRECT：请求继续走你已有配置。其他模块或主配置仍可能拒绝相同请求；本模块不能保证覆盖所有其他订阅。

## 安装

1. 使用 Surge iOS 5.14+ / Mac 5.9+，在模块管理中从上述 URL 安装并启用。
2. 如已装秋风原版、其他秋风方案或可莉广告平台拦截器，停用旧通用广告模块；也不要同时叠加 anti-AD、AdRules 等多份大列表。保留现有 App 专用模块。
3. 本模块只有 `[Rule]`，不需要脚本或MITM证书；现有 App 专用模块各自的证书/脚本要求保持其原说明。
4. 更新模块后完全退出相关 App 再打开，确认抖音评论、头条授权及高德/12306/微博等实际流程。

pre-matching 会提前拒绝，普通DIRECT或调整模块顺序不能可靠覆盖；本版本从拒绝列表本身排除冲突项。[Surge官方说明](https://manual.nssurge.com/policies/reject.html)。如果出现异常，先停用这一份通用模块再重开App，以确认关联；不必先卸载或清空全部配置。

## 更新与维护

GitHub Actions `Update AWAvenue` 每6小时检查官方 Only.Ads 来源和GPL许可；Surge端仍需刷新远程模块取得更新，任务可能有调度延迟。

通过身份、大小、状态码、无跳转、配置段、重复/数量及许可检查后重建。新精确域名可同步，但指向受保护主机的条目会过滤；新增后缀/关键词范围及命中已知业务、推送、tnc/HTTPDNS等敏感共享接口时停止发布，需审查。不会改用秋风完整版或叠加其他大列表。解析、下载、许可或测试失败保留旧成品。

自动发布只允许改变模块、原始Only.Ads快照和来源记录三份产物。名称/说明及排除策略需修改 `Surge/scripts/build-awavenue.mjs`，直接改生成模块会被下一次构建覆盖。不要仅手动加一条DIRECT来处理预匹配拒绝。

## 验证与许可

`node Surge/tests/awavenue.test.mjs` 包含四主机保护、扩大的后缀/关键词排除、敏感共享接口和业务主机负例、广告匹配正例、与现有DIRECT条目交叉检查、失败保留产物和只检查模式。本机有Surge时另做原生配置检查；CI没有Surge会明确跳过该项。测试不请求App业务接口，不执行远程脚本，尚未手机实测。

原始来源、构建及测试源码与修改记录公开。[GPL-3.0全文](../licenses/AWAvenue-GPL-3.0.txt)、[署名与修改声明](../licenses/AWAvenue-NOTICE.txt)。无任何保证；不改变仓库其他独立模块的许可。
