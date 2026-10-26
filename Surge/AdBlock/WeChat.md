# 微信（公众号推广与部分小程序去广告）

[安装／更新远程模块](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/WeChat.sgmodule)

保留原有公众号推广及三个小程序的广告处理，加入全家、EMS、COCO、青桔的指定广告项，并提供默认关闭的公众号广告字段兼容性实验。原有规则使用 Surge 原生本地响应和正文替换；新增处理由本仓库独立编写的一个响应脚本完成，不下载或执行可莉、Belcheck 的原脚本。

## 功能范围

| 项目 | 处理内容 | 默认状态 |
|---|---|---|
| 公众号推广 | 带货商品信息、文章相关搜索词接口返回空 HTTP 200 | 开启 |
| 便利蜂小程序 | 指定 banner 版本接口返回空 HTTP 200 | 开启 |
| 顺丰速运小程序 | 指定信息流广告查询接口返回空 HTTP 200 | 开启 |
| 掌上公交小程序 | 指定接口中完整 Ad、Ad_ab 字段的数字 1 改为 0 | 开启 |
| 全家微会员小程序 | 只删除 data.topBanner | 开启，可关闭 |
| EMS 小程序 | 只过滤 info.moduleJson 字符串数组内名称包含“广告”的对象 | 开启，可关闭 |
| COCO 点单小程序 | 只删除 data.top_background_url、data.bottom_banner_list | 开启，可关闭 |
| 青桔小程序 | 仅 api=hm.fa.homeConfig 接口删除 data.bannerInfoConfig | 开启，可关闭 |
| 公众号广告字段清理 | 对可识别成功响应中的根级广告数量／列表尝试清理 | **关闭，兼容性实验** |

共十个明确 URL 目标，其中公众号实验默认不修改响应；MITM 仅追加八个精确主机，不包含整域拒绝、图片降质、DNS／支付分流或外链安全提示跳过。公众号和小程序的普通业务路径没有直接纳入处理范围，相同服务接口若被其他入口共用仍会受到对应规则作用。

本模块不覆盖朋友圈、视频号及所有小程序五秒开屏。规则检查和合成样本测试不能代替手机实测，未保证最新版微信或所有小程序兼容。

## 参数

在 Surge 的模块列表中编辑本模块参数，使用 `true` 开启、`false` 关闭：

| 参数 | 默认值 | 功能 |
|---|---|---|
| `familyMart` | `true` | 全家横幅 |
| `ems` | `true` | EMS 名称明确包含“广告”的模块 |
| `coco` | `true` | COCO 背景和底部横幅 |
| `qingju` | `true` | 青桔横幅 |
| `officialAccountExperimental` | `false` | 公众号广告字段兼容性实验 |

原有公众号推广、便利蜂、顺丰及掌上公交处理仍随模块开关启停。参数只控制新增五项；关闭参数不删除账号或业务数据。关闭公众号实验时脚本原样透传该接口，但同一脚本还服务其他新增小程序，仍可能被加载和缓冲响应。

## 公众号实验的边界

实验仍使用旧 getappmsgad 接口线索，不代表已经适配当前微信所有公众号广告。只有手动开启后，且响应为可识别的成功 JSON、根级广告数量是非负整数、广告列表是数组时，才尝试把数量改为 0、列表清空。

它保留 appid、未知字段、嵌套同名字段和其他正文文本。错误响应、未知类型、重复键、过深或过大的 JSON 均原样放行；未找到目标字段或已经没有广告时也不重写。数据保留指 Surge 交给脚本的正文文本，不指压缩报文或 HTTP 头。

墨鱼已标失效的 advertisement 字符串替换没有恢复。公众号新实验为本仓库独立实现，与该旧规则分开标注。启用实验后应分别确认广告、空白占位、正文图片、链接和留言是否正常；异常时先把实验参数恢复为 `false`。

## 正常内容保留

独立实现按 JSON 源文本位置修改目标字段，不把整份响应解析后重新序列化，避免改变其他字段的空白、顺序、字符串转义或大整数。EMS 只重编码 moduleJson 那一个字符串字段，内部非广告对象、未知成员和数字原文保留。

脚本只有五个新目标的处理入口，不请求网络、不发通知、不读写持久化存储。遇到未知响应保留原文，完成回调只调用一次。微信外链处理、任意域名 WordPress 隐藏内容脚本和原合集的服务入口精简均未接入。

## 安装与更新

需要 **Surge iOS 5.10+ 或 Surge Mac 5.6+**。从上方 URL 安装或更新，开启重写、脚本和 MITM，安装并信任 MITM 证书。完全退出微信后重新打开目标文章或小程序。本版没有 JQ／WebView 引擎依赖。

已经安装旧版时使用原订阅地址更新即可，新增四项默认开启，公众号实验默认关闭。相同接口的多个响应脚本可能互相抢占，使用本模块时停用其他模块中对应的重复规则。

GitHub Actions 的 **Update WeChat** 每六小时读取墨鱼与已审核的小程序配置来源；通过构建和测试后，自动发布模块、独立脚本及来源记录。新增域名、配置目标或已审核行为变化需要先审查，失败保留已有成品。可莉脚本当前下载受限，构建不下载它们，也不自动继承其新逻辑。

Surge 按远程模块机制更新；本仓库脚本设置为每24小时检查一次，也可手动更新。GitHub 定时任务可能延迟，长期无活动时可能暂停。修改显示名称或描述，请编辑 `Surge/scripts/build-wechat.mjs`；直接改生成文件会被后续同步覆盖。

## 来源与验证

- [墨鱼去开屏](https://ddgksf2013.top/rewrite/StartUpAds.conf)、[小程序规则](https://raw.githubusercontent.com/ddgksf2013/Rewrite/master/AdBlock/Applet.conf)、[掌上公交行为参考](https://raw.githubusercontent.com/ddgksf2013/Scripts/master/zhangshanggongjiao.js)。
- [可莉来源的 QingRex 小程序配置](https://raw.githubusercontent.com/QingRex/LoonKissSurge/main/Surge/Beta/微信小程序去广告.beta.sgmodule)：仅作四个接口及字段行为参考，不转载原 JavaScript。
- [NobyDa 公众号接口线索](https://raw.githubusercontent.com/NobyDa/Script/master/QuantumultX/File/Wechat.js)、[Belcheck 数据保留与实验边界说明](https://github.com/belcheckyoung/Belcheck-QX-AdBlock/blob/main/Docs/WeChatAdClean.md)：只作参考，响应代码独立实现。
- [来源与原作者声明](../licenses/ddgksf2013-WeChat-NOTICE.txt)。来源元信息位于 `Surge/upstream/WeChat.sources.json`，不保存上述受限制的完整脚本正文。

验证使用合成响应和地址，覆盖开关默认值、字段范围、错误回退、文本／大整数保留、EMS 内层字符串、匹配边界、更新失败保护及本地可用时的 Surge CLI 原生配置检查。CI 不访问微信账号、聊天、订单、支付或实际小程序业务接口。
