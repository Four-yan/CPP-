import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { useMonthlyData } from '../hooks/useMonthlyData';
import { generateMonthlySummary } from '../lib/ai';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  BarChart3,
  Sparkles,
  X,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

/* ==================== 常量 ==================== */
const CATEGORY_COLORS = [
  '#534AB7', // primary
  '#6B61D1',
  '#877EE5',
  '#3C3584',
  '#252054',
  '#A39DF2',
  '#BFB9FA',
  '#1D9E75', // success
  '#E24B4A', // danger
  '#EF9F27', // warning
];

/* ==================== 子组件 ==================== */
function MonthPicker({
  monthLabel,
  onPrev,
  onNext,
}: {
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 py-[16px]">
      <button
        onClick={onPrev}
        className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-secondary transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <h2 className="text-[16px] font-medium text-text-primary min-w-[100px] text-center">
        {monthLabel}
      </h2>
      <button
        onClick={onNext}
        className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-secondary transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

function OverviewCards({
  expense,
  income,
  balance,
}: {
  expense: number;
  income: number;
  balance: number;
}) {
  const now = new Date();
  const currentDays = now.getDate();
  const avgExpense = expense / (currentDays || 1);

  const Card = ({
    label,
    value,
    isDanger,
  }: {
    label: string;
    value: string;
    isDanger?: boolean;
  }) => (
    <div className="bg-bg-secondary rounded-card p-[16px]">
      <p className="text-[12px] text-text-secondary mb-1">{label}</p>
      <p className={`text-[20px] font-medium ${isDanger ? 'text-danger' : 'text-text-primary'}`}>
        {value}
      </p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card label="总支出" value={`¥${expense.toFixed(2)}`} />
      <Card label="总收入" value={`¥${income.toFixed(2)}`} />
      <Card label="结余" value={`¥${balance.toFixed(2)}`} isDanger={balance < 0} />
      <Card label="日均支出" value={`¥${avgExpense.toFixed(2)}`} />
    </div>
  );
}

function CategoryPie({
  byCategory,
}: {
  byCategory: Record<string, number>;
}) {
  const data = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return <EmptySection title="支出分类" icon={<PieIcon className="w-5 h-5 text-text-secondary" />} />;
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <PieIcon className="w-5 h-5 text-primary" />
        <h2 className="font-medium text-text-primary">分类占比</h2>
      </div>
      <div className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown) => `¥${Number(value).toFixed(2)}`}
              contentStyle={{ borderRadius: '10px', fontSize: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendLineChart({
  byDay,
}: {
  byDay: Record<string, number>;
}) {
  const [range, setRange] = useState<'7' | '30'>('7');

  const chartData = useMemo(() => {
    const days: { date: string; amount: number }[] = [];
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (range === '7' ? 6 : 29));

    for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      days.push({ date: key.slice(5), amount: byDay[key] || 0 });
    }
    return days;
  }, [byDay, range]);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="font-medium text-text-primary">支出趋势</h2>
        </div>
        <div className="flex bg-bg-secondary rounded-button p-[2px]">
          <button
            onClick={() => setRange('7')}
            className={`px-3 py-1 text-[12px] font-medium rounded-button transition-colors ${range === '7' ? 'bg-bg-primary text-primary shadow-sm' : 'text-text-secondary'
              }`}
          >
            近7天
          </button>
          <button
            onClick={() => setRange('30')}
            className={`px-3 py-1 text-[12px] font-medium rounded-button transition-colors ${range === '30' ? 'bg-bg-primary text-primary shadow-sm' : 'text-text-secondary'
              }`}
          >
            近30天
          </button>
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => {
                const parts = v.split('-');
                return parts[1] + '/' + parts[0];
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `¥${v}`}
            />
            <Tooltip
              formatter={(value: unknown) => [`¥${Number(value).toFixed(2)}`, '支出']}
              contentStyle={{ borderRadius: '10px', fontSize: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--color-primary)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CategoryRanking({
  byCategory,
}: {
  byCategory: Record<string, number>;
}) {
  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);

  const ranked = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
    }));

  if (ranked.length === 0) {
    return <EmptySection title="分类排行" icon={<BarChart3 className="w-5 h-5 text-primary" />} />;
  }

  // A simple function to map category name to emoji if we can't find one. 
  // We'll just use a generic one or infer from the name since we don't have the full mapping array here.
  const getEmoji = (name: string) => {
    if (name.includes('餐饮') || name.includes('吃')) return '🍜';
    if (name.includes('交通') || name.includes('车')) return '🚗';
    if (name.includes('购物') || name.includes('买')) return '🛍';
    if (name.includes('娱乐') || name.includes('玩')) return '🎮';
    return '📝';
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h2 className="font-medium text-text-primary">分类排行</h2>
      </div>
      <div className="space-y-4">
        {ranked.map((item, index) => {
          const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          return (
            <div key={item.category} className="flex items-center gap-3">
              <span className="text-[20px]">{getEmoji(item.category)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[14px] text-text-primary">{item.category}</span>
                  <span className="text-[14px] font-medium text-text-primary">
                    ¥{item.amount.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-[#EEEDFE] rounded-capsule h-[6px] overflow-hidden">
                  <div
                    className="h-full rounded-capsule transition-all duration-500 bg-[#534AB7]"
                    style={{ width: `${Math.min(item.pct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AISummary({
  monthLabel,
  data,
  prevExpense,
  prevIncome,
}: {
  monthLabel: string;
  data: ReturnType<typeof useMonthlyData>['currentData'];
  prevExpense: number;
  prevIncome: number;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSummary(null);
    const timer = setTimeout(async () => {
      const topCategories = Object.entries(data.byCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, amount]) => ({
          name,
          amount,
          pct: data.expense > 0 ? (amount / data.expense) * 100 : 0,
        }));

      const noteEntries = Object.entries(data.byCategory);
      const note =
        noteEntries.length > 0
          ? noteEntries.map(([c, a]) => `${c} ¥${a.toFixed(0)}`).join('、')
          : '暂无支出';

      const aiData = {
        totalExpense: data.expense,
        totalIncome: data.income,
        balance: data.balance,
        byCategory: data.byCategory,
        prevMonthExpense: prevExpense,
        prevMonthIncome: prevIncome,
        topCategories,
        note,
      };

      const result = await generateMonthlySummary(aiData);
      setSummary(result);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [monthLabel, data, prevExpense, prevIncome]);

  return (
    <>
      <div className="mt-8 bg-bg-secondary rounded-card p-[16px]">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-medium text-text-primary">AI 月度总结</h2>
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 bg-border-default rounded animate-pulse w-3/4" />
            <div className="h-4 bg-border-default rounded animate-pulse w-full" />
            <div className="h-4 bg-border-default rounded animate-pulse w-5/6" />
          </div>
        ) : summary ? (
          <button
            onClick={() => setShowModal(true)}
            className="text-[14px] text-text-secondary leading-relaxed text-left touch-active w-full"
          >
            {summary.length > 120 ? summary.slice(0, 120) + '...' : summary}
          </button>
        ) : (
          <p className="text-[14px] text-text-tertiary">暂无数据</p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 fade-enter" onClick={() => setShowModal(false)}>
          <div
            className="bg-bg-primary rounded-t-modal w-full max-h-[80vh] overflow-auto slide-up pb-[var(--safe-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-center pt-3 pb-1">
              <div className="w-[32px] h-[4px] bg-border-strong rounded-full" />
            </div>
            <div className="flex items-center justify-between px-[20px] py-[12px] border-b border-border-default">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-medium text-text-primary">{monthLabel} AI 分析</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center touch-active"
              >
                <X className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
            <div className="p-[20px]">
              <p className="text-[14px] text-text-primary leading-relaxed whitespace-pre-wrap">
                {summary}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ==================== 工具组件 ==================== */
function EmptySection({
  title,
  icon,
}: {
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="font-medium text-text-primary">{title}</h2>
      </div>
      <p className="text-center text-text-tertiary py-8 text-[14px]">暂无数据</p>
    </div>
  );
}

/* ==================== 主页面 ==================== */
export default function StatsPage() {
  const { transactions, budgets } = useApp();
  const {
    monthLabel,
    currentData,
    prevData,
    goToPrev,
    goToNext,
  } = useMonthlyData(transactions, budgets);

  return (
    <div className="flex flex-col h-screen bg-bg-primary pb-[100px] overflow-y-auto">
      <div className="px-[20px]">
        {/* 1. 月度切换 */}
        <MonthPicker monthLabel={monthLabel} onPrev={goToPrev} onNext={goToNext} />

        {/* 2. 概览卡片 */}
        <OverviewCards
          expense={currentData.expense}
          income={currentData.income}
          balance={currentData.balance}
        />

        {/* 3. 分类饼图 */}
        <CategoryPie
          byCategory={currentData.byCategory}
        />

        {/* 4. 支出趋势折线图 */}
        <TrendLineChart byDay={currentData.byDay} />

        {/* 5. 分类排行 */}
        <CategoryRanking
          byCategory={currentData.byCategory}
        />

        {/* 6. AI 月度总结 */}
        <AISummary
          monthLabel={monthLabel}
          data={currentData}
          prevExpense={prevData.expense}
          prevIncome={prevData.income}
        />
      </div>
    </div>
  );
}
