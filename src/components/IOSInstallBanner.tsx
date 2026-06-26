import { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';

export default function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 检查是否为 iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // 检查是否已安装 (standalone)
    const isStandalone = (window.navigator as any).standalone === true;
    const hasDismissed = localStorage.getItem('dismissedIOSBanner');

    if (isIOS && !isStandalone && !hasDismissed) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="bg-bg-primary border border-border-default rounded-[12px] p-4 mb-4 shadow-sm relative">
      <button 
        className="absolute top-2 right-2 text-text-tertiary hover:text-text-secondary"
        onClick={() => {
          localStorage.setItem('dismissedIOSBanner', 'true');
          setShow(false);
        }}
      >
        <X className="w-4 h-4" />
      </button>
      <h3 className="text-[14px] font-medium text-text-primary mb-1 pr-6">📱 添加到主屏幕，体验更流畅，还能收到预算提醒</h3>
      
      <div className="bg-bg-secondary rounded-[8px] p-3 flex flex-col gap-2 mt-3">
        <div className="flex items-center gap-2 text-[12px] text-text-primary">
          <span className="bg-primary/10 text-primary w-4 h-4 rounded-full flex items-center justify-center text-[10px]">1</span>
          <span>在 Safari 点击底部</span>
          <Share className="w-4 h-4 text-blue-500" />
          <span>分享按钮</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-text-primary">
          <span className="bg-primary/10 text-primary w-4 h-4 rounded-full flex items-center justify-center text-[10px]">2</span>
          <span>滑动菜单并选择</span>
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-border-default">
            <PlusSquare className="w-3 h-3 text-text-primary" />
            <span className="text-[10px]">添加到主屏幕</span>
          </div>
        </div>
      </div>
    </div>
  );
}
