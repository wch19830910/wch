# 米家（开屏与推荐去广告）

[安装模块](https://raw.githubusercontent.com/wch19830910/wch/main/Surge/AdBlock/MiHome.sgmodule)

基于奶思／fmz200 的原生 Surge 米家模块，保留其完整三条功能规则。文件名为 `MiHome.sgmodule`，在 Surge 内显示中文名称。没有远程 JavaScript，也不需要 JQ。

## 功能范围

- 拦截小米广告配置域名 `sdkconfig.ad.xiaomi.com`。
- 对 `home.mi.com` 上的四类推荐接口返回空 JSON：`banner` 横幅、`carousel/banners` 轮播、`myTab` 推荐位及 `openingBanner` 开屏。
- 对 `resource/realtime/openingBanner` 开屏接口返回空 JSON。
- MITM 只追加 `home.mi.com`，不添加泛域名。

这是开屏和推荐广告处理，不是底栏、商城及“我的”页面完整重做。规则没有直接匹配设备控制、自动化、登录或摄像头流接口，但未进行最新版米家实机验证，不能保证所有设备与功能兼容。广告配置域名的拒绝对所有 App 向该域名发起的请求生效，并不限定于米家。

## 安装和使用

需要 Surge iOS 5.9.1+ 或 Surge Mac 5.5.1+。在 Surge 的模块页面选择从 URL 安装，粘贴上方地址并启用。开启重写及 MITM，安装并信任 MITM 证书，然后完全退出米家再打开。相同 App 只启用一份净化模块；本模块不依赖脚本开关。

若仍显示旧广告，可先完全退出 App 后重开、清理应用缓存。原作者另有部分 App 需要重装才能清除旧广告的通用提示；请先尝试上述步骤，重装前自行确认账号和本地数据。若设备控制、摄像头或其他功能出现异常，停用本模块并重开米家，再判断问题是否随模块停用而消失。

## 远程更新

- GitHub Actions 的 **Update MiHome** 每 6 小时检查 fmz200 原始模块；验证和范围测试通过、内容变化时，自动发布模块和来源快照。
- 未知规则、扩大域名或接口范围、下载失败、测试失败时停止发布，保留上次成品；新增功能需先审查后接入。
- Surge 按远程模块机制检查更新，也可在模块页面手动更新。此模块没有单独的远程脚本更新。
- GitHub 定时任务可能延迟；公开仓库连续 60 天无活动时可能需在 Actions 页面重新启用。
- 修改显示名称或描述，请编辑 `Surge/scripts/build-mihome.mjs` 后运行对应工作流。只修改自动生成模块会被下次同步覆盖。

## 来源与验证

- [奶思原始模块](https://raw.githubusercontent.com/fmz200/wool_scripts/main/Surge/module/split/partM/Mijia.sgmodule)
- [fmz200 仓库](https://github.com/fmz200/wool_scripts)
- 本模块、快照、构建及测试按 [GPL-3.0](../licenses/fmz200-GPL-3.0.txt) 发布，保留作者、来源和修改声明，无任何保证；其他独立模块许可不因此改变。

构建只读取公开规则，不访问米家账户或业务接口。测试验证广告路径匹配、部分设备与正常页面路径不匹配、未知上游拒绝接入及失败时保留旧文件；本机有 Surge CLI 时另做原生配置校验，Linux CI 明确跳过该项。检查通过不等于已在最新米家及实际设备上验证，不保证移除所有广告。
