import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './store/AppContext';
import { applyTheme } from './hooks/useTheme';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import BottomNav from './components/BottomNav';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import TransactionsPage from './pages/TransactionsPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';

// 同步初始化主题（防止 FOUC）
try {
  const saved = localStorage.getItem('theme_mode');
  const colorSaved = localStorage.getItem('theme_color');
  if (saved && colorSaved) {
    applyTheme(saved as 'light' | 'dark' | 'system', colorSaved as 'purple' | 'green' | 'orange');
  } else {
    applyTheme('light', 'purple');
  }
} catch {
  applyTheme('light', 'purple');
}

/** 路由切换动画包装 */
function AnimatedRoutes({ location }: { location: import('react-router-dom').Location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<div key="home" className="page-enter"><HomePage /></div>} />
      <Route path="/chat" element={<div key="chat" className="page-enter"><ChatPage /></div>} />
      <Route path="/transactions" element={<div key="transactions" className="page-enter"><TransactionsPage /></div>} />
      <Route path="/stats" element={<div key="stats" className="page-enter"><StatsPage /></div>} />
      <Route path="/settings" element={<div key="settings" className="page-enter"><SettingsPage /></div>} />
    </Routes>
  );
}

/** 带离线横幅和安装引导的包装 */
function AppShell() {
  const { transactions } = useApp();
  const location = useLocation();
  return <AnimatedRoutesWithBanner transactions={transactions} location={location} />;
}

function AnimatedRoutesWithBanner({ transactions, location }: { transactions: import('./types').Transaction[]; location: import('react-router-dom').Location }) {
  const { isOnline, wasOffline } = useOnlineStatus();
  const { showInstallBanner, deferredPrompt, handleInstall, dismissInstallBanner } = useInstallPrompt();
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

  return (
    <>
      <OfflineBanner isOnline={isOnline} wasOffline={wasOffline} transactions={transactions} />

      {/* PWA 安装引导 */}
      {showInstallBanner && !isInstalled && (
        <div className="fixed bottom-20 left-4 right-4 z-[150] max-w-xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-4 card-enter">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">📲</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">添加到主屏幕</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  安装后无需浏览器即可快速打开，支持离线使用
                </p>
                <div className="flex gap-2 mt-2">
                  {deferredPrompt ? (
                    <button
                      onClick={handleInstall}
                      className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors"
                    >
                      立即安装
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">
                      在浏览器菜单中选择"添加到主屏幕"
                    </span>
                  )}
                  <button
                    onClick={dismissInstallBanner}
                    className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    以后再说
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-main)', transition: 'background 0.3s' }}>
        <AnimatedRoutes location={location} />
        <BottomNav />
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppProvider>
          <AppShell />
        </AppProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
