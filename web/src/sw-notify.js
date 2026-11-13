// 判断页面地址是否与通知来源页面一致（忽略查询参数和 hash）
function isSamePage(clientUrl, targetUrl) {
  try {
    const client = new URL(clientUrl);
    const target = new URL(targetUrl);
    return client.origin === target.origin && client.pathname === target.pathname;
  } catch {
    return false;
  }
}

// 系统通知点击处理：关闭通知，聚焦（或重新打开）页面，并通知页面执行点击回调
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  notification.close();

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      if (clientList.length) {
        // 优先通知来源页面，其次已聚焦窗口，最后取第一个窗口
        const samePageList = data.url
          ? clientList.filter((item) => isSamePage(item.url, data.url))
          : [];
        const client =
          samePageList.find((item) => item.focused) ||
          samePageList[0] ||
          clientList.find((item) => item.focused) ||
          clientList[0];
        try {
          await client.focus();
        } catch {}
        try {
          client.postMessage({
            type: 'hello-notification-click',
            id: data.id,
          });
        } catch {}
        return;
      }

      // 页面已全部关闭时，重新打开通知来源页面
      if (data.url) {
        try {
          await self.clients.openWindow(data.url);
        } catch {}
      }
    })(),
  );
});
