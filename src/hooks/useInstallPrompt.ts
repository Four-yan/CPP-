import { useState, useEffect, useRef, useCallback } from 'react';

interface InstallPromptEvent {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt(): {
  showInstallBanner: boolean;
  installBannerDismissed: boolean;
  deferredPrompt: InstallPromptEvent | null;
  handleInstall: () => void;
  dismissInstallBanner: () => void;
} {
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // 如果用户已手动安装过，不再提示
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // 检查是否已关闭过
    try {
      if (localStorage.getItem('install_banner_dismissed') === '1') {
        setInstallBannerDismissed(true);
        return;
      }
    } catch {
      /* noop */
    }

    // 3秒后弹出安装提示
    timerRef.current = window.setTimeout(() => {
      setShowInstallBanner(true);
    }, 3000);

    // 监听 beforeinstallprompt 事件
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as InstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismissInstallBanner = useCallback(() => {
    setShowInstallBanner(false);
    setInstallBannerDismissed(true);
    try {
      localStorage.setItem('install_banner_dismissed', '1');
    } catch {
      /* noop */
    }
  }, []);

  return {
    showInstallBanner,
    installBannerDismissed,
    deferredPrompt,
    handleInstall,
    dismissInstallBanner,
  };
}
