import { Link, useLocation } from 'react-router-dom';
import { Home, MessageSquare, ListTodo, BarChart3, Settings as SettingsIcon } from 'lucide-react';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/chat', label: '聊天', icon: MessageSquare },
  { path: '/transactions', label: '账单', icon: ListTodo },
  { path: '/stats', label: '统计', icon: BarChart3 },
  { path: '/settings', label: '设置', icon: SettingsIcon },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-primary border-t border-border-default z-50 pb-[var(--safe-bottom)] bottom-nav">
      <div className="max-w-xl mx-auto flex justify-around items-center h-[56px] px-2">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`relative flex flex-col items-center justify-center gap-1 flex-1 h-full touch-active ${isActive ? 'text-primary' : 'text-[#A09F9B]'
                }`}
            >
              <Icon
                className={`w-[22px] h-[22px] transition-transform duration-150 ${isActive ? 'scale-110' : 'scale-100'
                  }`}
              />
              <span className="text-[10px] leading-none font-medium">{label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-[3px] h-[3px] rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
