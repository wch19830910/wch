# Build Scripts

`build-ximalaya.mjs` 从墨鱼网站列出的官方 Ximalaya 规则生成 Surge 原生模块，显示名称为“喜马拉雅（全净化）”。
`build-amap.mjs` 对应官方 AmapAds 规则，显示名称为“高德地图（全净化）”。
`build-railway12306.mjs` 读取官方 12306 脚本顶部注释中的圈 X 配置，转换为请求阶段脚本，显示名称为“铁路12306（开屏去广告）”。
`build-rednote.mjs` 对应小红书去广告去水印条目，显示名称为“小红书（去广告与去水印）”，不合入另一份屏蔽首页视频规则。
`build-coolapk.mjs` 读取官方酷安脚本内嵌配置，显示名称为“酷安（去广告）”；不转载其完整 JavaScript。
`build-netease-music.mjs` 生成“网易云音乐（自定义净化）”：墨鱼广告处理主干加独立实现的底栏/首页卡片/评论/未回关选项。Keywos 仅作功能参考，不内嵌、转载或执行其脚本；不含独立或批量伪 VIP 改写。
`build-cainiao.mjs` 对应菜鸟 App 和支付宝小程序净化条目，显示名称为“菜鸟（去广告与页面净化）”。
`build-smzdm.mjs` 对应什么值得买净化条目，显示名称为“什么值得买（去广告）”，保留 blackmatrix7、ddgksf2013 双署名。
`build-goofish.mjs` 对应闲鱼净化条目，显示名称为“闲鱼（全净化）”，JQ 转为 Surge 原生 Body Rewrite。
`build-soda-music.mjs` 对应汽水音乐净化条目，显示名称为“汽水音乐（广告与推广净化）”，不使用远程 JavaScript，JQ 转为 Surge 原生 Body Rewrite。2026-10-27 起固定两个汽水主机和九个已审核 `/luna/` 端点，排除共享 `get_domains` 与位置接口，未知主机/路径/动作/JQ 变化停止更新，避免同步重新引入跨 App 拦截。
`build-didi.mjs` 对应墨鱼 GitHub 索引推荐的 ZenmoFeiShi 滴滴完整精简版，显示名称为“滴滴出行（全净化）”。完整保留上游行为，包括隐藏安全中心入口、钱包与行程页面精简；不是保守去广告版。
`build-weibo.mjs` 对应墨鱼微博及国际版/轻享版完整净化规则，显示名称为“微博（全净化）”；完整保留原上游皮肤状态、视频预览和界面精简行为，不是账号会员开通，也不是仅去广告。
`build-freshippo.mjs` 对应 zirawell 独立原生 Surge 盒马完整净化模块，模块显示名称为“盒马（全净化）”。保留全部 IP 拒绝、AMDC、页面及更新查询接口拦截和远程响应脚本；详细描述包含开屏、首页与二楼、我的、购物车推荐、小程序首页的处理范围及副作用，不是仅去开屏，也不保证移除所有广告。
`build-tieba.mjs` 合并 app2smile 官方原生贴吧广告模块和墨鱼五类 JQ 页面精简，显示名称为“百度贴吧（去广告与页面净化）”。默认保留普通视频帖；两个远程脚本直接引用 app2smile，每 24 小时更新。旧 `getFeedAd` 无条件拒绝由当前 protobuf 脚本接管，避免抢占广告处理。
`build-zhihu.mjs` 从 zirawell 知乎来源生成“知乎（去广告与页面净化）”，由 `zhihu-runtime.mjs` 整理单一响应脚本；修复兼容问题，保留真实会员、会员入口与消息通道，视频/付费过滤参数默认关闭。
`build-mihome.mjs` 同步奶思／fmz200 的原生米家规则，显示名称为“米家（开屏与推荐去广告）”。仅一条广告配置域名拒绝和两条 JSON 本地响应规则，不含 JavaScript 或 JQ。
`build-wechat.mjs` 保留墨鱼公众号推广、便利蜂、顺丰、掌上公交，并加入全家、EMS、COCO、青桔指定广告和默认关闭的公众号实验，显示名称为“微信（公众号推广与部分小程序去广告）”。基础使用原生空响应/正文替换；`wechat-runtime.mjs` 独立实现新增五个目标的响应处理，不复制第三方脚本。

`build-riskbird.mjs` 参考可莉风鸟规则的 QingRex 转换配置，仅生成首页轮播图与热门企业推荐两项，名称“风鸟（首页广告与推荐精简）”。推荐老板脚本不接入，无远程 JavaScript 或 JQ。

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
node Surge/scripts/build-freshippo.mjs
node Surge/scripts/build-tieba.mjs
node Surge/scripts/build-zhihu.mjs
node Surge/scripts/build-mihome.mjs
node Surge/scripts/build-wechat.mjs
node Surge/scripts/build-riskbird.mjs
```

模块输出到 `Surge/AdBlock/Ximalaya.sgmodule`，原始规则快照输出到 `Surge/upstream/Ximalaya.conf`。
高德地图分别输出到 `Surge/AdBlock/Amap.sgmodule` 和 `Surge/upstream/AmapAds.conf`。
铁路12306分别输出到 `Surge/AdBlock/Railway12306.sgmodule` 和 `Surge/upstream/12306.js`。
小红书输出 `Surge/AdBlock/RedNote.sgmodule` 和对应上游规则快照。
酷安输出 `Surge/AdBlock/Coolapk.sgmodule` 和 `Surge/upstream/Coolapk.source.json` 来源元信息。
网易云音乐输出 `Surge/AdBlock/NetEaseMusic.sgmodule`、`Surge/Script/NetEaseMusic.js`、墨鱼配置快照及 `Surge/upstream/NetEaseMusic.references.json`。`netease-runtime.mjs` 在已审核墨鱼源码的唯一解码和分派锚点接入自定义层；`netease-customize.mjs` 独立实现参数行为，接管布局路由，避免保留项先被原固定过滤删除。明文对象/数组 JSON 直接解析，其余走原 AES/gzip；缓存解码、原编码尾部和一次完成守卫。单一响应入口、14 项原生模块参数、WebView 和二进制模式；保留原作者及 CryptoJS/pako/zlib 许可。为保留真实会员数据，会员账户页不再整体清空。

构建每 6 小时检测四份上游文件的已审核 SHA256；任一变化则停止发布，须人工兼容审查、更新测试和 hash 后再构建。Keywos 只保存参考地址与 hash 元信息，不保存其文件正文。不能把未审核的新上游直接覆盖合并版。[使用与参数说明](../AdBlock/NetEaseMusic.md)。

网易云合并版测试：`node Surge/tests/netease-music.test.mjs`。用合成 JSON、独立 Node crypto/zlib AES/gzip 数据和隔离 VM 验证本仓库衍生代码，不访问业务 API；本机有 Surge CLI 时另做原生配置检查，CI 没有 CLI 时明确跳过该项。GitHub Actions 先构建再测试，失败不会提交发布。
菜鸟、什么值得买、闲鱼、汽水音乐分别输出对应英文名的模块和 `CainiaoAds.conf`、`SmzdmAds.conf`、`GoofishAds.conf`、`QiShuiMusicAds.conf` 上游快照。
滴滴出行输出 `Surge/AdBlock/DiDi.sgmodule` 和 `Surge/upstream/Didichuxing.snippet`；没有远程 JavaScript，保留 ZenmoFeiShi（怎么肥事）署名与墨鱼推荐来源。
微博输出 `Surge/AdBlock/Weibo.sgmodule` 和 `Surge/upstream/WeiboAds.conf`；三个脚本均直接引用墨鱼 master 分支，其中两个 `.json` 后缀文件实际是 JavaScript，按 JavaScript 做语法校验。保留 ddgksf2013、zmqcherish、shiro 署名；选项由上游脚本固定，不使用另一个版本的 `weibo_config.js`。
盒马输出 `Surge/AdBlock/Freshippo.sgmodule` 和逐字上游快照 `Surge/upstream/freshippo.sgmodule`；脚本直接引用 zirawell 的 `main` 分支。生成时仅规范不兼容的 `data-type=json` 为 text + JSON Content-Type、`max-size=0` 为官方不限值 `-1`，并显式设置 86400 秒脚本更新周期。原脚本正文和 ICU 原子组正则不变；Node 校验仅对已审核的原子组作检查副本，不修改输出正则。盒马相关源码及产物使用 [GPL-3.0](../licenses/zirawell-GPL-3.0.txt)，保留原作者和修改日期声明。

盒马建议 Surge iOS 5.14.2+ / Mac 5.9+；其中 `pre-matching` 最低要求 iOS 5.14 / Mac 5.9。完整净化及全局 IP 拦截可能影响其他阿里系 App，详见模块目录说明；未进行最新版盒马实机验证。

闲鱼、汽水音乐、滴滴出行和微博的构建环境需要 jq；输出原样保留上游 JQ 表达式，客户端需要 Surge iOS 5.14+ / Mac 5.9+。

贴吧构建也需要 jq；输出 `Surge/AdBlock/Tieba.sgmodule`、`Surge/upstream/Tieba.app2smile.sgmodule`、`Surge/upstream/Tieba.ddgksf2013.conf` 和 `Surge/upstream/Tieba.ad.list`。上游配置结构、主机和脚本地址按审核范围验证，下载的两份 JavaScript 只做编译检查、不执行或保存正文。保留 app2smile MIT 许可和双来源署名；个人页分区仅在 `zone_info` 为数组时执行过滤，保留其他类型以兼容缺失数据。使用 `node Surge/scripts/build-tieba.mjs --check` 可只检查、不写文件；`node Surge/tests/tieba.test.mjs` 运行合成样本和可用时的 Surge CLI 校验。GitHub 每 6 小时构建并先测试再发布，失败保留已有成品；Surge 直引脚本独立更新，不受 GitHub 发布失败冻结。[详细说明](../AdBlock/Tieba.md)。

知乎输出 `Surge/AdBlock/Zhihu.sgmodule`、`Surge/Script/Zhihu.js`、`Surge/upstream/Zhihu.sgmodule` 和 `Surge/upstream/Zhihu.references.json`。原始脚本只编译检查及核对已审核 SHA256，不执行；生成的响应脚本通过本仓库合成样本测试。源配置严格验证已审核的接口、主机、脚本与配置段，未知结构或脚本 hash 变化须先兼容审查；不是把原作者任意新脚本直接覆盖参数版。单入口避免重复脚本名，所有本地 JSON 响应规范为 text 加 Content-Type；搜索推荐交由本地响应脚本结构化清理，无 JQ 依赖。省略 MQTT、全局 AVOS、共享 SDK、会员卡片、整段个人页清空和整类视频榜单清空等规则，保留视频、直播和付费内容默认行为。[GPL-3.0 许可](../licenses/zirawell-GPL-3.0.txt)及来源与修改声明适用于相关代码。运行 `node Surge/tests/zhihu.test.mjs` 验证参数、广告过滤、错误回退、账户数据保留及可用时的 Surge CLI 配置检查；尚未手机实测。[详细说明](../AdBlock/Zhihu.md)。

名称采用“软件名（实际功能类型）”，全净化不表示保证移除全部广告。各 `#!desc` 明确具体功能、作者、更新周期、客户端与证书要求、功能变化及未实机验证的边界。

米家输出 `Surge/AdBlock/MiHome.sgmodule` 和逐字原始快照 `Surge/upstream/MiHome.sgmodule`。构建只接受已审核的配置段、一个 SDK 域名及两条广告路径，未知动作、主机或扩大范围时停止，保留已有成品；`--check` 只检查不写文件。每 6 小时检查上游，通过 `node Surge/tests/mihome.test.mjs` 的范围及失败保护检查后再发布。模块、快照、构建和测试保留奶思署名并按 [GPL-3.0](../licenses/fmz200-GPL-3.0.txt) 发布，无远程脚本；需要 Surge iOS 5.9.1+ / Mac 5.5.1+。设备接口未直接匹配不等于实机兼容保证，广告配置域名规则对其他 App 的相同请求也生效。[使用说明](../AdBlock/MiHome.md)。

微信输出 `Surge/AdBlock/WeChat.sgmodule`、`Surge/Script/WeChat.js` 和 `Surge/upstream/WeChat.sources.json`。保留原五个目标，新增四个可关闭小程序广告项及一个默认关闭的公众号实验，八个精确 MITM 主机；单一新增响应入口与原公交规则不重叠。独立 JSON span 编辑只改变目标字段，保留其他正文文本／大整数；EMS 内层数组的未知成员保留，仅重编码目标字符串。公众号仍是旧接口兼容性实验，不恢复已失效的字符串替换，不默认启用。构建只监测 QingRex 四个已审核配置行，不下载可莉或 Belcheck 的原脚本，也不自动继承它们的新逻辑。每六小时构建，通过 `node Surge/tests/wechat-runtime.test.mjs` 和 `node Surge/tests/wechat.test.mjs` 后仅发布三个生成文件；`--check` 不写入。Surge每24小时检查本仓库独立脚本更新。需 Surge iOS 5.10+ / Mac 5.6+，无JQ/WebView依赖，未手机实测。保留[作者及接口参考声明](../licenses/ddgksf2013-WeChat-NOTICE.txt)。[功能与参数说明](../AdBlock/WeChat.md)。

风鸟输出 `Surge/AdBlock/RiskBird.sgmodule` 和 `Surge/upstream/RiskBird.sources.json`。仅两项 HTTPS 完整路径的空 JSON 本地响应、一个精确 MITM 主机；来源中推荐老板执行脚本明确排除，不下载或镜像其正文。元信息保留作者、转换参考、hash、所选接口及排除原因，不将索引或模板许可扩大到其他插件代码。未知域名、路径、动作、配置段或新增脚本变化须先审查，失败保留已有产物，`--check` 不写入。每六小时检查上游，通过 `node Surge/tests/riskbird.test.mjs` 后只发布模块和来源记录；无远程脚本更新链。需 Surge iOS 5.9.1+ / Mac 5.5.1+，未手机实测。[使用说明](../AdBlock/RiskBird.md)及[署名声明](../licenses/RiskBird-NOTICE.txt)。

需要调整 Surge 内的显示名称或描述时，修改对应构建脚本中的 `#!name` / `#!desc` 文案，保留 JavaScript 引号和逗号。不要只修改自动生成的 `.sgmodule`，因为后续同步会覆盖它。

GitHub Actions 会定期运行本脚本；下载的原作者脚本不在构建时直接执行。网易云另对本仓库生成的衍生脚本运行隔离合成样本测试，不请求业务接口；检查通过不等于最新版 App 实机验证。

汽水音乐兼容性测试：`node Surge/tests/soda-music.test.mjs`。验证两个精确主机与端点边界、抖音评论和共享配置等负例、JQ 内容、上游变化/下载失败不覆盖成品，以及本机 Surge 原生语法；CI 先构建再测试，全部通过后才发布。[修复说明](../AdBlock/SodaMusic.md)。
