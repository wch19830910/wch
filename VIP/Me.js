hostname =  vip1.kuwo.cn，note.youdao.com，api1.dobenge.cn，newdrugs.dxy.cn，cn1.invit.vip，*.wtzw.com,account.wps.cn,biz.caiyunapp.com，

#自用插件合辑 2021/5/30

#酷我音乐vip解锁（by nobyda）
^https?:\/\/vip1\.kuwo\.cn\/(vip\/v2\/user\/vip|vip\/spi/mservice) url script-response-body https://raw.githubusercontent.com/NobyDa/Script/master/Surge/JS/Kuwo.js
^https?:\/\/musicpay\.kuwo\.cn\/music\.pay\?uid\=\d+ url 302 http://musicpay.kuwo.cn/music.pay?uid=2

#樊登读书 解锁会员的课程音频 畅游知识的海洋（20201026）
https://api.dushu.io/Album/Info url script-response-body https://raw.githubusercontent.com/ddgksf2013/Cuttlefish/master/Crack/fdds.js
#樊登读书解锁付费书籍(少年歌行pro製作，轉載請保留出處信息)
^https:\/\/gateway-api.*.com\/innovation-orchestration\/api\/ebook\/v100\/ebookInfo url script-response-body https://raw.githubusercontent.com/sngxpro/QuantumultX/master/fdds/sngxfd.js
#樊登读书解锁付费课程(少年歌行pro製作，轉載請保留出處信息)
^https:\/\/api.dushu365.com\/* url script-response-body https://raw.githubusercontent.com/sngxpro/QuantumultX/master/fdds/sngxfdkc.js
^https:\/\/gateway-api.*.com(\/resource-orchestration-system\/knowledge\/v100\/mainList|\/resource-orchestration-system\/program\/content) url script-response-body https://raw.githubusercontent.com/sngxpro/QuantumultX/master/fdds/sngxfdkc.js

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
