hostname =  49.234.36.200:9091, www.52pojie.cn，c.tieba.baidu.com，ifac*.iqiyi.com
  
  

#威锋网-在威锋网APP下使用账号密码方式登录
^http:\/\/49.234.36.200:9091\/v1\/auth\/signin url script-request-body https://raw.githubusercontent.com/chavyleung/scripts/master/feng/feng.cookie.js

#吾爱破解
https:\/\/www\.52pojie\.cn\/home\.php\? url script-request-header https://raw.githubusercontent.com/NobyDa/Script/master/52pojie-DailyBonus/52pojie.js

#百度贴吧
https?:\/\/(c\.tieba\.baidu\.com|180\.97\.\d+\.\d+)\/c\/s\/login url script-request-header TieBa.js

#爱奇艺
^https?:\/\/iface(\d)?\.iqiyi\.com\/ url script-request-header https://raw.githubusercontent.com/NobyDa/Script/master/iQIYI-DailyBonus/iQIYI.js
