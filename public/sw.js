/**
 * Service Worker — 处理推送通知和预缓存
 * 由 vite-plugin-pwa injectManifest 策略构建
 */
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// 注入点：Vite PWA 会将打包生成的静态资源列表替换到这里
precacheAndRoute(self.__WB_MANIFEST);

// 缓存 API 请求 (原本在 vite.config.ts 中)
registerRoute(
  /^https:\/\/api\..*/i,
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

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
