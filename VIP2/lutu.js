/*
微信公众号：ios黑科技
官方网站：s7aa.cn

圈X:

[rewrite_local]

#LUTU解锁VIP无限看
^https:\/\/api\.(.+)\.(cn|com)\/.+  url script-request-header lutu.js

[mitm]
hostname = api.jyjnsc.com,api.syclzg.cn

下载地址
https://s-lutu.me
注册填写邀请码  U08VVA0，延续VIP 时间！

*/


var modifiedHeaders = $request.headers;

modifiedHeaders['Authorization'] = 'Bearer YYE-FVSmZruoleaTu_0nAwRB4125-2PD-kVyKR7g0XNRNFlkyZOpEenvYz9RAIoV';


$done({headers : modifiedHeaders});
