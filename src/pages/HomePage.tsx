import { useState } from 'react'; // Trigger HMR
import { useApp } from '../store/AppContext';
import Dashboard from '../components/Dashboard';
import IOSInstallBanner from '../components/IOSInstallBanner';
import { RefreshCw } from 'lucide-react';

export default function HomePage() {
  const { transactions, accountBooks, updateTransactions, updateAccountBooks } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await updateTransactions();
    await updateAccountBooks();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F7F4]">
      <header className="sticky top-0 z-40 bg-bg-primary border-b border-border-default h-[60px] flex items-center justify-between px-[20px] flex-shrink-0">
        <h1 className="text-[16px] font-medium text-text-primary">CPP记账</h1>
        <button
          onClick={handleRefresh}
          className="p-2 -mr-2 text-text-secondary hover:text-primary transition-colors touch-active"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
        </button>
      </header>
      <main className="flex-1 overflow-y-auto pb-[100px] px-[16px] pt-[16px]">
        <IOSInstallBanner />
        <Dashboard transactions={transactions} accountBooks={accountBooks} />
      </main>
    </div>
  );
}
