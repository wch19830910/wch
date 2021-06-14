hostname =  49.234.36.200:9091,wq.jd.com， *.iqiyi.com,www.52pojie.cn,sf-integral-sign-in.weixinjia.net,mcs-mimp-web.sf-express.com,www.bilibili.com,live.bilibili.com,tieba.baidu.com,music.163.com,wapside.189.cn,e.189.cn,h5.ele.me,api.m.jd.com,api.gaoqingdianshi.com,api.inews.qq.com,as.xiaojukeji.com,user-api-prd-mx.wandafilm.com,app.bilibili.com,weather-data.apple.com,api.weather.com,api.tuhu.cn,youhui.95516.com,*.zhuishushenqi.com,api.momosyb.com,choujiang-server.deering.cn,appsmall.rtmap.com,wox2019.woxshare.com,getconfig-globalapi.zymk.cn,hongbao.youzikuaibao.com,mobile.app.autohome.com.cn,jdread-api.jd.com,m.weibo.cn,m.client.10010.com,www.2xtj7.cn,www.baimaa.com,www.hnmiaosu.cc,ph0001.hezyq.com,wq.02gk.com,dk.ne72.com,appv8.qukantianxia.com,appv7.qukantx.com,mobile01.91quzou.com,mk.immomo.com,*.video.qq.com,*.xjxjappss.com,*.xjxjapps.com,*.xxjjappss.com,*.xjwdapps.com,*.leleapps.com,*.leyiapps.com,*.hpplay.cn,*.gqbyh.com,apiwz.midukanshu.com, api.1sapp.com, frodo.douban.com, luckman.suning.com, passport.suning.com, sign.suning.com, gameapi.suning.com, m.ctrip.com, 110.43.90.61, zt.wps.cn, m-bean.kaola.com, daojia.jd.com, app.nio.com, wxprdapplet.gac-nio.com, node.kg.qq.com, api.dushu.io, pm.m.fenqile.com, maicai.api.ddxq.mobi, group.baicizhan.com, api.everphoto.cn, i.meituan.com, promotion.waimai.meituan.com, wx.10086.cn, www.maomicd.com, act.10010.com, api-takumi.mihoyo.com, m.gdoil.cn, credits.bz.mgtv.com, *.csdn.net, *.acfun.cn, apk.tw, *.bilibili.com, api.dongqiudi.com, *.feng.com, www.flyertea.com, *.m.163.com, user.qunar.com, *.rr.tv, *.smzdm.com, *.v2ex.com, mobwsa.ximalaya.com, *.you.163.com, *.rrys2020.com, ios.zmzapi.com,app*.jegotrip.com.cn, task.jegotrip.com.cn,api.umer.com.cn,wq.jd.com,www.mydigit.cn,api.weibo.cn,pay.sc.weibo.com,kd.youth.cn,ios.baertt.com,newsapi.sina.cn,draw.jdfcloud.com,nebula.kuaishou.com,operation-api.jimistore.com,mqqapi.reader.qq.com,commontgw6.reader.qq.com,eventv3.reader.qq.com,mobile.app.autohome.com.cn,openapi.autohome.com.cn,veishop.iboxpay.com,qmyd.yichengw.cn,alipaymini.189.cn, alipaymini.189.cn:8043,yuedongzu.yichengw.cn,api.sxsjyzm.com,account.huami.com,magicisland.58.com,xzd.hswchangdu.com,ftoy-api.58.com,napi.zuoyebang.com,napi.zuoyebang.com, www.52pojie.cn，nebula.kuaishou.com, activity.m.kuaishou.com, *.amemv.com，passport.suning.com, luckman.suning.com, sign.suning.com, mobwsa.ximalaya.com，*.video.qq.com，gameapi.suning.com，c.tieba.baidu.com，ifac*.iqiyi.com，*.smzdm.com，xiaoshuo.qm989.com，*.csdn.net，activity-1.m.duiba.com.cn，daojia.jd.com，i.meituan.com，credits.bz.mgtv.com，music.163.com
  
#作业帮学分签到
https://napi.zuoyebang.com/napi/signin/signinpage url script-request-body https://raw.githubusercontent.com/photonmang/quantumultX/master/Task/zyb.js

#哔哩哔哩 Cookie
^https:\/\/(www|live)\.bilibili\.com\/?.? url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/bilibili/bilibili.cookie.js

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

#饿了么Cookie获取, 打开APP,点击我的,点击左上角的签到,进入页面即可
^https:\/\/h5\.ele\.me\/restapi\/eus\/v\d\/current_user$ url script-request-header https://raw.githubusercontent.com/songyangzz/QuantumultX/master/elem/elemGetCookies.js

#京东到家
^https:\/\/daojia.jd.com/client(.*?)functionId=signin(.*?)userSigninNew url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/jddj/jddj.cookie.js


#万达电影
^https:\/\/user-api-prd-mx\.wandafilm\.com url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/wanda/wanda.cookie.js

#樊登读书
^https://api\.dushu\.io/CheckIn url script-request-body https://raw.githubusercontent.com/chavyleung/scripts/master/fandeng/fandeng.cookie.js

# WPS
^https:\/\/zt.wps.cn\/2018\/docer_check_in\/api\/act_list url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/wps/wps.cookie.js

#途虎养车Cookie（打开途虎APP：依次打开 我的->每日免费领积分）
https://api.tuhu.cn/User/GetUserCurrentAndNextGradeInfo url script-request-header https://raw.githubusercontent.com/photonmang/quantumultX/master/tuhu/tuhu.Cookie.js

#天天挖矿
^https:\/\/operation-api\.jimistore\.com\/* url script-request-header https://raw.githubusercontent.com/XidNDD/2020scripts/master/ttwbxcxSign.js

#云闪付
https://youhui.95516.com/newsign/public/app/index.html url script-request-header https://gitee.com/passerby-b/javascript/raw/master/unipay.js

#美团
^https:\/\/i.meituan.com\/evolve\/signin\/signpost\/ url script-request-body https://raw.githubusercontent.com/chavyleung/scripts/master/meituan/meituan.cookie.js

#芒果TV
^https:\/\/credits.bz.mgtv.com\/user\/creditsTake url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/mgtv/mgtv.cookie.js

#网易云音乐,当失效时需浏览器访问并登录:https://music.163.com/m/login ，再访问: https://music.163.com/#/user/level提示: 获取会话: 成功!
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

#腾讯视频，获取 Cookie:手机浏览器访问: https://film.qq.com/，随便选 1 部电影观看
^https:\/\/access.video.qq.com\/user\/auth_refresh url script-request-header https://raw.githubusercontent.com/chavyleung/scripts/master/videoqq/videoqq.cookie.js


#喜马拉雅
^https?:\/\/.*\/mobile\-user\/homePage\/.* url script-request-header https://raw.githubusercontent.com/sngxpro/AutoSyncScript/chavyleung/ximalaya/ximalaya.cookie.js

#酸奶机场签到
^https://shyni.xyz/user/checkin url script-request-header https://raw.githubusercontent.com/sngxpro/scripts/main/snjc/jc.cookie.js

#抖音极速版
luckycat/aweme/v1/task/sign_in/detail? url script-request-header https://raw.githubusercontent.com/Ariszy/Private-Script/master/Scripts/dyjsb.js
luckycat/aweme/v1/task/done/read? url script-request-header https://raw.githubusercontent.com/Ariszy/Private-Script/master/Scripts/dyjsb.js
luckycat/aweme/v1/task/walk/step_submit? - script-request-header https://raw.githubusercontent.com/Ariszy/Private-Script/master/Scripts/dyjsb.js

#京喜农场
^https\:\/\/wq\.jd\.com\/cubeactive\/farm\/dotask url script-request-header https://raw.githubusercontent.com/whyour/hundun/master/quanx/jx_nc.cookie.js

#快手视频
https:\/\/activity\.m\.kuaishou\.com\/rest\/wd\/taskCenter\/\w+\/module\/list url script-request-header https://raw.githubusercontent.com/GoodHolidays/Scripts/master/Task/kuaishou.js
https:\/\/nebula\.kuaishou\.com\/nebula\/task\/earning\? url script-request-header https://raw.githubusercontent.com/GoodHolidays/Scripts/master/Task/kuaishou.js
