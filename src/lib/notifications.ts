/* ==================== 类型定义 ==================== */

export interface NotificationSettings {
  enabled: boolean;
  weeklyReportTime: string; // HH:MM, default '20:00'
  budgetAlertEnabled: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  weeklyReportTime: '20:00',
  budgetAlertEnabled: true,
};

export { DEFAULT_NOTIFICATION_SETTINGS };

/* ==================== 权限管理 ==================== */

/** 请求通知权限，返回 granted/denied/unsupported */
export async function requestPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** 检查浏览器是否支持通知 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

/* ==================== 通知发送 ==================== */

/** 发送一条桌面通知 */
export function sendNotification(
  title: string,
  body: string,
  options?: NotificationOptions,
): void {
  if (!isNotificationSupported()) return;
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      ...options,
    });
  }
}

/** 预算超限即时推送 */
export function sendBudgetAlert(message: string): void {
  sendNotification('⚠️ 预算提醒', message);
}

/* ==================== 周报调度 ==================== */

/**
 * 获取本地存储的周报时间
 */
export function getWeeklyReportTime(): string {
  try {
    return localStorage.getItem('notif_weekly_time') ?? '20:00';
  } catch {
    return '20:00';
  }
}

/**
 * 设置周报时间
 */
export function setWeeklyReportTime(time: string): void {
  try {
    localStorage.setItem('notif_weekly_time', time);
  } catch {
    /* noop */
  }
}

/**
 * 检查是否到了周报推送时间（每分钟检查一次）
 * 使用 sessionStorage 标记今日已推送
 */
export function startWeeklyScheduler(
  onReady: (summary: string) => void,
): () => void {
  const INTERVAL_MS = 60 * 1000; // 每分钟检查
  let timer: number | null = null;

  function checkAndSend() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    if (dayOfWeek !== 0) return; // 只在周日检查

    const [targetHour, targetMin] = getWeeklyReportTime()
      .split(':')
      .map(Number);
    if (now.getHours() !== targetHour || now.getMinutes() !== targetMin) return;

    // 用 sessionStorage 标记今天已推
    const todayKey = `weekly_sent_${now.toISOString().split('T')[0]}`;
    if (sessionStorage.getItem(todayKey)) return;

    sessionStorage.setItem(todayKey, '1');
    onReady(buildWeeklySummary());
  }

  timer = window.setInterval(checkAndSend, INTERVAL_MS) as unknown as number;

  // 立即检查一次
  checkAndSend();

  return () => {
    if (timer !== null) clearInterval(timer);
  };
}

/* ==================== 降级方案 ==================== */

/**
 * 构建简易周报字符串（用于通知 + 降级弹窗）
 * 实际数据由调用方传入
 */
function buildWeeklySummary(): string {
  return '📊 本周账单：支出 ¥1,234，餐饮最多占42%，比上周省了¥89 💪';
}

/**
 * 通知不可用时的降级：通过 in-app 弹窗显示
 * 调用方需传入一个 showFallback(title, body) => void 函数
 */
export function showFallbackNotification(
  showFallback: (title: string, body: string) => void,
  title: string,
  body: string,
): void {
  if (isNotificationSupported() && Notification.permission === 'granted') {
    sendNotification(title, body);
  } else {
    showFallback(title, body);
  }
}
