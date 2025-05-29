// 抓取华住会 Cookie 保存到 Surge 本地

if ($request.headers["Cookie"]) {
  $persistentStore.write($request.headers["Cookie"], "huazhu_cookie");
  $notification.post("✅ 华住 Cookie 保存成功", "", "下次将自动签到");
}
$done();
