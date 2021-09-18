hostname =vip1.kuwo.cn，note.youdao.com，api1.dobenge.cn，biz.caiyunapp.com，*.wtzw.com，account.wps.cn，commerce-i18n-api.faceu.mobi,commerce-api.faceu.mobi, api.weibo.cn, mapi.weibo.com, *.uve.weibo.com

#自用插件合辑 2021/5/30

#酷我音乐vip解锁（by nobyda）
^https?:\/\/vip1\.kuwo\.cn\/(vip\/v2\/user\/vip|vip\/spi/mservice) url script-response-body https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/Kuwo.js
^https?:\/\/musicpay\.kuwo\.cn\/music\.pay\?uid\=\d+ url 302 http://musicpay.kuwo.cn/music.pay?uid=2

#有道云笔记VIP (ByAlex0510)
https://note.youdao.com/yws/(mapi/payment|api/self) url script-response-body https://raw.githubusercontent.com/nzw9314/QuantumultX/master/Script/ydybj.js

#水印精灵 vip (By Alex0510)
^https:\/\/api1\.dobenge\.cn\/api\/user\/getuserinfo url script-response-body https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/syjl.js

#彩云天气 解锁会员权限（20201121）
https?:\/\/biz\.caiyunapp\.com\/(membership_rights|v2\/user) url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/caiyun.js

#七猫小说解锁vip
https://(.+)\.wtzw\.com/.+ url script-response-body https://github.com/sngxpro/QuantumultX/raw/master/qimao/sngxqmxs.js

#WPS解锁  超级会员、wps会员、稻壳会员 (By eHpo)
^https?:\/\/account\.wps\.cn\/api\/users url script-response-body https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/Wps.js

#轻颜相机
^https:\/\/commerce-.*api\.faceu\.mobi\/commerce\/v1\/subscription\/user_info url script-response-body https://raw.githubusercontent.com/songyangzz/QuantumultX/master/ulike/ulike.js

# 微博去广告(By yichahucha)
^https?://(sdk|wb)app\.uve\.weibo\.com(/interface/sdk/sdkad.php|/wbapplua/wbpullad.lua) url script-response-body https://raw.githubusercontent.com/yichahucha/surge/master/wb_launch.js
^https?://m?api\.weibo\.c(n|om)/2/(statuses/(unread|extend|positives/get|(friends|video)(/|_)(mix)?timeline)|stories/(video_stream|home_list)|(groups|fangle)/timeline|profile/statuses|comments/build_comments|photo/recommend_list|service/picfeed|searchall|cardlist|page|!/(photos/pic_recommend_status|live/media_homelist)|video/tiny_stream_video_list|photo/info|remind/unread_count) url script-response-body https://raw.githubusercontent.com/yichahucha/surge/master/wb_ad.js
