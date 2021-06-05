hostname =  49.234.36.200:9091, www.52pojie.cn，nebula.kuaishou.com, activity.m.kuaishou.com, *.amemv.com，passport.suning.com, luckman.suning.com, sign.suning.com, mobwsa.ximalaya.com，*.video.qq.com，gameapi.suning.com，c.tieba.baidu.com，ifac*.iqiyi.com，*.smzdm.com，xiaoshuo.qm989.com，*.csdn.net，activity-1.m.duiba.com.cn，daojia.jd.com，i.meituan.com，credits.bz.mgtv.com，music.163.com
  
  

#威锋网-在威锋网APP下使用账号密码方式登录
^http:\/\/49.234.36.200:9091\/v1\/auth\/signin url script-request-body https://raw.githubusercontent.com/chavyleung/scripts/master/feng/feng.cookie.js

#吾爱破解
https:\/\/www\.52pojie\.cn\/home\.php\? url script-request-header https://raw.githubusercontent.com/NobyDa/Script/master/52pojie-DailyBonus/52pojie.js

#百度贴吧
https?:\/\/c\.tieba\.baidu\.com\/c\/s\/login url script-request-header https://raw.githubusercontent.com/NobyDa/Script/master/BDTieBa-DailyBonus/TieBa.js

#爱奇艺
^https?:\/\/iface(\d)?\.iqiyi\.com\/ url script-request-header https://raw.githubusercontent.com/NobyDa/Script/master/iQIYI-DailyBonus/iQIYI.js

#CSDN
^https:\/\/passport.csdn.net\/v2\/api\/app\/login\/checkAndRefreshToken url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/csdn/csdn.cookie.js
^https:\/\/gw.csdn.net\/mini-app\/v2\/lucky_draw\/login\/sign_in\? url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/csdn/csdn.cookie.js

#海底捞
^https:\/\/activity-1\.m\.duiba\.com\.cn\/signactivity\/doSign$ url script-request-body https://raw.githubusercontent.com/chavyleung/scripts/master/haidilao/hdl.js

#京东到家
^https:\/\/daojia.jd.com/client(.*?)functionId=signin(.*?)userSigninNew url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/jddj/jddj.cookie.js

#美团
^https:\/\/i.meituan.com\/evolve\/signin\/signpost\/ url script-request-body https://raw.githubusercontent.com/chavyleung/scripts/master/meituan/meituan.cookie.js

#芒果TV
^https:\/\/credits.bz.mgtv.com\/user\/creditsTake url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/mgtv/mgtv.cookie.js

#网易云音乐
^https:\/\/music.163.com\/weapi\/user\/level url script-request-body https://raw.githubusercontent.com/chavyleung/scripts/master/neteasemusic/neteasemusic.cookie.js

#七猫小说
^https:\/\/xiaoshuo\.qm989\.com url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/qimao/qmnovel.js

#什么值得买
^https:\/\/www\.smzdm\.com\/?.? url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/smzdm/quanx/smzdm.cookie.js

#苏宁易购
^https:\/\/passport.suning.com\/ids\/login$ url script-request-body https://raw.githubusercontent.com/chavyleung/scripts/master/suning/suning.cookie.js
^https:\/\/luckman.suning.com\/luck-web\/sign\/api\/clock_sign.do url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/suning/suning.cookie.js
^https:\/\/sign.suning.com\/sign-web\/m\/promotion\/sign\/doSign.do url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/suning/suning.cookie.js
^https:\/\/gameapi.suning.com\/sngame-web\/(api\/signin\/private\/customerSignOperation.do|gateway\/api\/queryPrize.do) url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/suning/suning.cookie.js

#腾讯视频
^https:\/\/access.video.qq.com\/user\/auth_refresh url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/videoqq/videoqq.cookie.js

#喜马拉雅
^https?:\/\/.*\/mobile\-user\/homePage\/.* url script-request-header https://raw.githubusercontent.com/sngxpro/AutoSyncScript/chavyleung/ximalaya/ximalaya.cookie.js

#酸奶机场签到
^https://shyni.xyz/user/checkin url script-request-header https://raw.githubusercontent.com/sngxpro/scripts/main/snjc/jc.cookie.js

#抖音极速版
luckycat/aweme/v1/task/sign_in/detail? url script-request-header https://raw.githubusercontent.com/Ariszy/Private-Script/master/Scripts/dyjsb.js
luckycat/aweme/v1/task/done/read? url script-request-header https://raw.githubusercontent.com/Ariszy/Private-Script/master/Scripts/dyjsb.js
luckycat/aweme/v1/task/walk/step_submit? - script-request-header https://raw.githubusercontent.com/Ariszy/Private-Script/master/Scripts/dyjsb.js

#快手视频
https:\/\/activity\.m\.kuaishou\.com\/rest\/wd\/taskCenter\/\w+\/module\/list url script-request-header https://raw.githubusercontent.com/GoodHolidays/Scripts/master/Task/kuaishou.js
https:\/\/nebula\.kuaishou\.com\/nebula\/task\/earning\? url script-request-header https://raw.githubusercontent.com/GoodHolidays/Scripts/master/Task/kuaishou.js
