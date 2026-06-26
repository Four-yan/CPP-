import { ArrowUp, ArrowDown, Wallet, TrendingUp } from "lucide-react"; // Trigger HMR
import type { Transaction, AccountBook } from "../types";
import { useMonthlySummary } from "../hooks/useMonthlySummary";

interface DashboardProps {
  transactions: Transaction[];
  accountBooks: AccountBook[];
}

export default function Dashboard({
  transactions,
  accountBooks,
}: DashboardProps) {
  const summary = useMonthlySummary(transactions);

  return (
    <div className="space-y-[16px]">
      {/* Header */}
      <div className="bg-primary rounded-[14px] p-[20px] text-white shadow-md relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-black/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10">
          <p className="text-[14px] opacity-80">本月结余</p>
          <p className="text-[36px] font-medium mt-1 mb-6">
            ¥{summary.balance.toFixed(2)}
          </p>
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <div className="w-[28px] h-[28px] rounded-full bg-white/20 flex items-center justify-center">
                <ArrowUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-[12px] opacity-80">收入</p>
                  {summary.incomeChange !== 0 && (
                    <span className="text-[10px] opacity-60">
                      ({summary.incomeChange > 0 ? "+" : ""}
                      {summary.incomeChange.toFixed(0)}%)
                    </span>
                  )}
                </div>
                <p className="text-[14px] font-medium">
                  ¥{summary.income.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-[28px] h-[28px] rounded-full bg-black/20 flex items-center justify-center">
                <ArrowDown className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-[12px] opacity-80">支出</p>
                  {summary.expenseChange !== 0 && (
                    <span className="text-[10px] opacity-60">
                      ({summary.expenseChange > 0 ? "+" : ""}
                      {summary.expenseChange.toFixed(0)}%)
                    </span>
                  )}
                </div>
                <p className="text-[14px] font-medium">
                  ¥{summary.expense.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-[16px]">
        <div className="bg-bg-primary rounded-[14px] p-[16px] shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-[12px] text-text-secondary">账本数</span>
          </div>
          <p className="text-[24px] font-medium text-text-primary">
            {accountBooks.length}
          </p>
        </div>
        <div className="bg-bg-primary rounded-[14px] p-[16px] shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-danger" />
            <span className="text-[12px] text-text-secondary">本月笔数</span>
          </div>
          <p className="text-[24px] font-medium text-text-primary">
            {summary.count}
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      {Object.keys(summary.byCategory).length > 0 && (
        <div className="bg-bg-primary rounded-[14px] p-[16px] shadow-sm">
          <h3 className="font-medium text-text-primary mb-4">支出分类</h3>
          <div className="space-y-[12px]">
            {Object.entries(summary.byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => (
                <div
                  key={category}
                  className="flex items-center justify-between"
                >
                  <span className="text-[14px] text-text-secondary">
                    {category}
                  </span>
                  <span className="text-[14px] font-medium text-text-primary">
                    ¥{amount.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-bg-primary rounded-[14px] p-[16px] shadow-sm">
        <h3 className="font-medium text-text-primary mb-4">最近记录</h3>
        {transactions.length === 0 ? (
          <p className="text-center text-text-tertiary py-8 text-[14px]">
            暂无记录，去记账吧
          </p>
        ) : (
          <div className="divide-y divide-[#F8F7F4]">
            {transactions.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-[12px]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-text-primary truncate">
                    {t.note || t.category}
                  </p>
                  <p className="text-[12px] text-text-secondary mt-1">
                    {t.date} · {t.category}
                  </p>
                </div>
                <span
                  className={`text-[16px] font-medium ${
                    t.type === "income" ? "text-success" : "text-text-primary"
                  }`}
                >
                  {t.type === "income" ? "+" : "-"}¥{t.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
