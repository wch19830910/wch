# 风鸟（首页广告与推荐精简）

[安装远程模块](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/RiskBird.sgmodule)

针对企业查询 App 风鸟／RiskBird，只处理已经核对的两项首页接口。文件名为 `RiskBird.sgmodule`，在 Surge 内显示中文功能名称。使用两条原生本地 JSON 响应，无远程 JavaScript，也不需要 JQ。

## 功能范围

| 项目 | 对应接口 | 行为 |
|---|---|---|
| 首页轮播图 | `m.riskbird.com/prod-qbb-api/user/getBannerList` | 返回 HTTP 200、空 JSON 对象 |
| 首页热门企业推荐 | `m.riskbird.com/prod-qbb-api/searchHotEnt` | 返回 HTTP 200、空 JSON 对象 |

“热门企业”属于正常推荐内容精简，启用后该区域的数据也会被置空，不能仅描述为过滤商业广告。两条规则仅匹配精确 HTTPS 主机与完整路径，允许其后的查询参数，不扩大到整个企业查询接口。MITM 只追加 `m.riskbird.com`。

本版不包含“查老板”的推荐老板处理；原来源为该功能引用的脚本在本次核对时下载受限，未取得可审查正文，所以没有凭脚本名称猜测其字段处理。当前也没有接入专用开屏、“我的”页面横幅或会员功能改写，不称为完整净化。

## 安装与使用

需要 **Surge iOS 5.9.1+ 或 Surge Mac 5.5.1+**。在 Surge 的模块页面选择从 URL 安装，粘贴上方地址并启用。开启重写和 MITM，安装并信任 MITM 证书，再完全退出风鸟并重开。模块自身不依赖脚本开关。

相同 App 只保留一份处理这些接口的模块，避免重复响应。页面或查询功能异常时，先停用此模块并重开 App，检查是否恢复。尚未在最新版风鸟手机实测，不保证所有广告都能移除。

## 远程更新

- **Update RiskBird** 每六小时读取已审核的 QingRex 风鸟来源配置，构建和测试通过后发布模块及来源元信息。
- 只接入上述两项。未知域名、路径、动作、配置段或新增执行脚本需要先复核，失败保留已有成品；不会自动恢复被排除的推荐老板脚本。
- Surge 按远程模块机制检查更新，也可手动更新。没有另一个远程脚本更新链。
- GitHub 定时任务可能延迟，公开仓库长期无活动时可能被暂停，届时在 Actions 页面重新启用。
- 修改显示名称或描述，请编辑 `Surge/scripts/build-riskbird.mjs`；直接改生成模块会被下次同步覆盖。

## 来源与验证

- [QingRex 风鸟 Surge 转换配置](https://raw.githubusercontent.com/QingRex/LoonKissSurge/main/Surge/风鸟去广告.sgmodule)，标注原作者可莉／iKeLee。
- [可莉资源索引](https://github.com/luestr/ProxyResource)。
- [来源与独立整理声明](../licenses/RiskBird-NOTICE.txt)。来源元信息在 `Surge/upstream/RiskBird.sources.json`，只记录所选接口、来源 hash 和排除原因，不镜像完整插件或原作者 JavaScript。

构建读取公开配置，不请求企业查询、登录、支付等业务接口。验证使用合成 URL 和响应配置，检查精确匹配、普通业务与相似路径不匹配、未知上游保护、失败及只检查模式不写文件。本机安装 Surge CLI 时另做原生配置校验；Linux CI 明确跳过该本机检查。这些检查不等于手机广告效果验证。
