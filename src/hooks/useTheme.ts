export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeColor = 'purple' | 'green' | 'orange';

export interface ThemeState {
  mode: ThemeMode;
  color: ThemeColor;
}

export const DEFAULT_THEME: ThemeState = {
  mode: 'light',
  color: 'purple',
};

export const THEME_COLORS: Record<ThemeColor, { primary: string; primaryLight: string; primaryDark: string }> = {
  purple: { primary: '#6366f1', primaryLight: '#818cf8', primaryDark: '#4f46e5' },
  green: { primary: '#10b981', primaryLight: '#34d399', primaryDark: '#059669' },
  orange: { primary: '#f59e0b', primaryLight: '#fbbf24', primaryDark: '#d97706' },
};

/** 从 IndexedDB 读取主题设置 */
export async function loadThemeFromDB(): Promise<ThemeState> {
  try {
    const { db } = await import('../lib/db');
    const modeSetting = await db.settings.where('key').equals('theme_mode').first();
    const colorSetting = await db.settings.where('key').equals('theme_color').first();
    return {
      mode: (modeSetting?.value as ThemeMode) || 'light',
      color: (colorSetting?.value as ThemeColor) || 'purple',
    };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

/** 保存主题设置到 IndexedDB */
export async function saveThemeToDB(mode: ThemeMode, color: ThemeColor): Promise<void> {
  try {
    const { db } = await import('../lib/db');
    await db.settings.put({ key: 'theme_mode', value: mode });
    await db.settings.put({ key: 'theme_color', value: color });
  } catch {
    /* noop */
  }
}

/** 获取系统颜色偏好 */
export function getSystemColorScheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * 根据 mode + color 应用主题到 DOM
 */
export function applyTheme(mode: ThemeMode, color: ThemeColor): void {
  const html = document.documentElement;
  const systemScheme = getSystemColorScheme();
  const actualMode = mode === 'system' ? systemScheme : mode;

  // dark class 控制 Tailwind dark: 变体
  if (actualMode === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  // CSS 变量 — 浅色/深色共用同一套变量名，值不同
  const colors = THEME_COLORS[color];
  const isDark = actualMode === 'dark';

  const root = html.style;
  root.setProperty('--color-primary', isDark ? colors.primaryLight : colors.primary);
  
  // 移除无效的遗留 CSS 变量设置，背景、文字颜色均由 index.css 的 .dark 控制

  // 更新 meta theme-color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#0f172a' : colors.primary);
  }
}

/** 监听系统颜色变化 */
export function onSystemColorChange(callback: (scheme: 'light' | 'dark') => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent | MediaQueryList) => {
    callback(e.matches ? 'dark' : 'light');
  };
  mq.addEventListener?.('change', handler);
  // 兼容旧版浏览器
  mq.addListener?.(handler as (...args: unknown[]) => void);
  return () => {
    mq.removeEventListener?.('change', handler);
    mq.removeListener?.(handler as (...args: unknown[]) => void);
  };
}
