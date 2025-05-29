// 华住签到脚本 for Surge
// 作者: @chatgpt
// 更新时间: 2025-05-29

const signInUrl = 'https://appgw.huazhu.com/game/sign_in?date=' + Math.floor(Date.now() / 1000);
const headers = {
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://cdn.huazhu.com',
  'Referer': 'https://cdn.huazhu.com/',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.59 NetType/WIFI Language/zh_CN miniProgram/wx286efc12868f2559',
  'Client-Platform': 'WX-MP',
  'Cookie': $persistentStore.read("huazhu_cookie")
};

$httpClient.get({ url: signInUrl, headers: headers }, function (error, response, data) {
  if (error) {
    $notification.post("华住签到", "签到请求失败", error);
    $done();
  } else {
    try {
      let result = JSON.parse(data);
      if (result && result.msg === "成功") {
        $notification.post("华住签到成功", "", `获得奖励: ${result.data?.reward || "未知"}`);
      } else {
        $notification.post("华住签到失败", "", result.msg || "未知错误");
      }
    } catch (e) {
      $notification.post("华住签到异常", "", e.message);
    }
    $done();
  }
});

// 监听请求时记录 cookie（例如拦截你打开小程序签到时的请求）
if ($request.headers['Cookie']) {
  $persistentStore.write($request.headers['Cookie'], "huazhu_cookie");
  $notification.post("华住 Cookie 保存成功", "", "");
}
$done();