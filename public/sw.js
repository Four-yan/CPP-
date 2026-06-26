/**
 * Service Worker — 处理推送通知
 * 由 vite-plugin-pwa injectManifest 策略构建
 */

const PUSH_NOTIFICATION_TITLE = 'AI记账助手';

// 拦截 push 事件
self.addEventListener('push', (event) => {
  let data = {
    title: PUSH_NOTIFICATION_TITLE,
    body: '您有一条新的账单提醒',
    icon: '/pwa-192x192.png',
    url: '/',
  };

  if (event.data) {
    try {
      data = { ...data, ...JSON.parse(event.data.text()) };
    } catch {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon,
    badge: '/pwa-192x192.png',
    tag: 'jizhang-push',
    requireInteraction: false,
    actions: [
      { action: 'open', title: '查看' },
      { action: 'close', title: '关闭' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, notificationOptions));
});

// 点击通知
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      self.clients.openWindow(event.notification.data?.url || '/'),
    );
  }
});

// 通知关闭
self.addEventListener('notificationclose', () => {
  // 可选：记录用户关闭行为
});
