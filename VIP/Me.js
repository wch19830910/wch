hostname =  vip1.kuwo.cn，musicpay.kuwo.cn，note.youdao.com，*.snssdk.com，api1.dobenge.cn，newdrugs.dxy.cn，cn1.invit.vip，*.wtzw.com ，account.wps.cn ，*.amemv.com，gateway-api.*.com,api.*.com，biz.caiyunapp.com，

#自用插件合辑 2021/5/30

#酷我音乐vip解锁（by nobyda）
^https?:\/\/vip1\.kuwo\.cn\/(vip\/v2\/user\/vip|vip\/spi/mservice) url script-response-body https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/Kuwo.js
^https?:\/\/musicpay\.kuwo\.cn\/music\.pay\?uid\=\d+ url 302 http://musicpay.kuwo.cn/music.pay?uid=2


#酷我音乐 解锁皮肤主题（20210425）
^https?:\/\/vip1\.kuwo\.cn\/(vip\/v2\/theme)  url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/theme.js

#作业帮 解锁付费音频资源（20210407）by photonmang
https://mall.zuoyebang.com/mall/goods/audio/voice/list?audioId=\d+ url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/zyb.js
https://apivip.zybang.com/vipols/vip/viphomev1?.+ url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/zyb.js

#百度云倍速播放和会员专属清晰度Crack功能 （20210310）
https:\/\/pan\.baidu\.com\/rest\/2\.0\/membership\/user url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/bdcloud.js

#樊登读书 解锁会员的课程音频 畅游知识的海洋（20201026）
https://api.dushu.io/Album/Info url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/fdds.js
#樊登读书解锁付费书籍(少年歌行pro製作，轉載請保留出處信息)
^https:\/\/gateway-api.*.com\/innovation-orchestration\/api\/ebook\/v100\/ebookInfo url script-response-body https://raw.githubusercontent.com/sngxpro/QuantumultX/master/fdds/sngxfd.js
#樊登读书解锁付费课程(少年歌行pro製作，轉載請保留出處信息)
^https:\/\/api.dushu365.com\/* url script-response-body https://raw.githubusercontent.com/sngxpro/QuantumultX/master/fdds/sngxfdkc.js
^https:\/\/gateway-api.*.com(\/resource-orchestration-system\/knowledge\/v100\/mainList|\/resource-orchestration-system\/program\/content) url script-response-body https://raw.githubusercontent.com/sngxpro/QuantumultX/master/fdds/sngxfdkc.js

#智能证件照相机 (by @superuv)
^https:\/\/app\.xunjiepdf\.com\/api\/v4\/virtualactregister url script-response-body https://raw.githubusercontent.com/nzw9314/QuantumultX/master/Script/znzj.js

#美图秀秀 你笑的真好看（20201124）
https://api.xiuxiu.meitu.com/v1/user/show.json url response-body vip_type":0 response-body vip_type":1

#人人视频 (by@george Jiang & R)
^https:\/\/api\.rr\.tv(\/user\/privilege\/list|\/ad\/getAll|\/rrtv-video\/v4plus\/season\/detail) url script-response-body https://raw.githubusercontent.com/nzw9314/QuantumultX/master/Script/rrtv.js

#有道云笔记VIP (ByAlex0510)
https://note.youdao.com/yws/(mapi/payment|api/self) url script-response-body https://raw.githubusercontent.com/nzw9314/QuantumultX/master/Script/ydybj.js

#皮皮虾 去广告去水印
^https?://.*\.snssdk\.com/bds/(feed/stream|comment/cell_reply|cell/cell_comment|cell/detail|ward/list|user/favorite|user/cell_coment|user/cell_userfeed|user/publish_list) url script-response-body https://raw.githubusercontent.com/Liquor030/Sub_Ruleset/master/Script/Super.js

#水印精灵 vip (By Alex0510)
^https:\/\/api1\.dobenge\.cn\/api\/user\/getuserinfo url script-response-body https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/syjl.js

#菜谱大全 解锁VIP功能（20200906）
https?:\/\/api\.jiaonizuocai\.com url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/cpdq.js

#克拉壁纸 解锁付费壁纸（20200903）仅适用旧版 V4.7.3
^https:\/\/claritywallpaper\.com\/clarity\/api\/(userInfo|special\/queryByCatalogAll) url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/clarity.js

#用药助手解锁专业版 (By Primovist)
^https?:\/\/(i|newdrugs)\.dxy\.cn\/(snsapi\/username\/|app\/user\/(pro\/stat\?|init\?timestamp=)) url script-response-body https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/yyzs.js

#去微博应用内广告 (By yichahucha)
^https?://(sdk|wb)app.uve.weibo.com(/interface/sdk/sdkad.php|/wbapplua/wbpullad.lua) url script-response-body https://raw.githubusercontent.com/yichahucha/surge/master/wb_launch.js
^https?://m?api\.weibo\.c(n|om)/2/(statuses/(unread|extend|positives/get|(friends|video)(/|_)(mix)?timeline)|stories/(video_stream|home_list)|(groups|fangle)/timeline|profile/statuses|comments/build_comments|photo/recommend_list|service/picfeed|searchall|cardlist|page|!/photos/pic_recommend_status|video/tiny_stream_video_list|photo/info) url script-response-body https://raw.githubusercontent.com/yichahucha/surge/master/wb_ad.js

#电子请柬制作 - 婚礼邀请函制作必备APP 破解vip（少年歌行pro製作）
^https:\/\/cn1\.invit\.vip\/users\/info url script-response-body https://raw.githubusercontent.com/sngxpro/QuantumultX/master/qing/qing.js

#万年历 解锁会员权限 出门看下黄历今天是个好日子（20201028）
https://r.51wnl-cq.com/Api/User/GetExtInfo url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/wnl.js

#彩云天气 解锁会员权限（20201121）
https?:\/\/biz\.caiyunapp\.com\/(membership_rights|v2\/user) url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/caiyun.js

#七猫小说解锁vip
https://(.+)\.wtzw\.com/.+ url script-response-body https://github.com/sngxpro/QuantumultX/raw/master/qimao/sngxqmxs.js

#WPS解锁  超级会员、wps会员、稻壳会员 (By eHpo)
^https?:\/\/account\.wps\.cn\/api\/users url script-response-body https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/Wps.js

#抖音去广告水印(by choler )
^https?:\/\/.+?\.amemv\.com\/aweme\/v\d\/(feed|aweme\/post|follow\/feed|nearby\/feed|search\/item|general\/search\/single|hot\/search\/video\/list)\/ url script-request-header https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/Aweme.js
^https?:\/\/.+?\.amemv\.com\/aweme\/v\d\/(feed|aweme\/post|follow\/feed|nearby\/feed|search\/item|general\/search\/single|hot\/search\/video\/list)\/ url script-response-body https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/Aweme.js
