import { exportTransactionToCSV } from '../lib/csvExporter';
interface Props {
  isOnline: boolean;
  wasOffline: boolean;
  transactions: import('../types').Transaction[];
}

export default function OfflineBanner({ isOnline, wasOffline, transactions }: Props) {
  // 刚恢复在线时短暂显示恢复提示
  if (isOnline && wasOffline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[200] bg-green-500 text-white text-center text-xs py-2 px-4 shadow-md animate-slide-down">
        已恢复网络连接
      </div>
    );
  }

  // 离线状态：显示橙色警告条
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-white text-center text-xs py-2 px-4 shadow-md">
        当前处于离线模式，部分功能可能不可用
      </div>
    );
  }

  // 有数据时才显示导出按钮
  if (transactions.length > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[200] bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 text-center text-xs py-1.5 px-4 shadow-sm">
        <button
          onClick={() => exportTransactionToCSV(transactions)}
          className="text-primary hover:text-indigo-600 font-medium transition-colors"
        >
          导出数据（CSV）
        </button>
      </div>
    );
  }

  return null;
}
