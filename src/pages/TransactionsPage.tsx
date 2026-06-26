import { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import type { Transaction } from '../types';
import { useApp } from '../store/AppContext';
import { Plus, Trash2, Calendar, Filter } from 'lucide-react';

/* ==================== 分类配置 ==================== */
const EXPENSE_CATEGORIES = [
  { name: '餐饮', emoji: '🍜' },
  { name: '交通', emoji: '🚗' },
  { name: '购物', emoji: '🛍' },
  { name: '娱乐', emoji: '🎮' },
  { name: '医疗', emoji: '💊' },
  { name: '居住', emoji: '🏠' },
  { name: '学习', emoji: '📚' },
  { name: '人情', emoji: '🎁' },
  { name: '其他', emoji: '📝' },
];

const INCOME_CATEGORIES = [
  { name: '工资', emoji: '💼' },
  { name: '兼职', emoji: '💻' },
  { name: '投资', emoji: '📈' },
  { name: '其他', emoji: '📝' },
];

/* ==================== 主页面 ==================== */
export default function TransactionsPage() {
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []);
  const accountBooks = useLiveQuery(() => db.accountBooks.toArray(), []);
  const { deleteTransaction, updateTransactions } = useApp();

  const isLoading = transactions === undefined;

  const [selectedBook, setSelectedBook] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(formatCurrentMonth());
  const [showFilter, setShowFilter] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const openAddModal = () => {
    setEditingTx(null);
    setShowModal(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setShowModal(true);
  };

  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    }
    if (showFilter) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showFilter]);

  const groupedTransactions = useMemo(() => {
    let list = transactions ?? [];

    if (selectedBook) {
      list = list.filter((t) => t.accountBook === selectedBook);
    }
    if (selectedMonth) {
      list = list.filter((t) => t.date.startsWith(selectedMonth));
    }

    const groups: Record<string, Transaction[]> = {};
    for (const t of list) {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    }
    return groups;
  }, [transactions, selectedBook, selectedMonth]);

  const filteredTransactions = Object.values(groupedTransactions).flat();
  const totalExpense = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const books = (accountBooks || []).map((b) => b.name);

  return (
    <div className="flex flex-col h-screen bg-bg-tertiary">
      <header className="sticky top-0 z-40 bg-bg-primary">
        <div className="flex items-center justify-between h-[60px] px-[20px]">
          <h1 className="text-[20px] font-medium text-text-primary">账单明细</h1>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="relative p-2 text-text-secondary touch-active"
          >
            <Filter className="w-5 h-5" />
            {(selectedBook || selectedMonth) && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
        </div>

        {/* 汇总 */}
        <div className="flex px-[20px] pb-[16px]">
          <div className="flex-1">
            <span className="text-[12px] text-text-secondary">总支出</span>
            <div className="text-[24px] font-medium text-danger leading-tight mt-1">
              -¥{totalExpense.toFixed(2)}
            </div>
          </div>
          <div className="flex-1">
            <span className="text-[12px] text-text-secondary">总收入</span>
            <div className="text-[24px] font-medium text-success leading-tight mt-1">
              +¥{totalIncome.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="h-[0.5px] bg-border-default mx-[20px]" />

        {/* 筛选面板 */}
        {showFilter && (
          <div ref={filterRef} className="absolute left-0 right-0 top-full bg-bg-primary border-b border-border-default px-[20px] py-[16px] space-y-[16px] shadow-sm z-50">
            <div>
              <label className="text-[12px] text-text-secondary mb-2 block">月份</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full h-[44px] px-[12px] bg-bg-secondary border-none rounded-[10px] text-[14px] text-text-primary outline-none"
              >
                {getAvailableMonths(transactions ?? []).map((m) => (
                  <option key={m} value={m}>{formatMonthLabel(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-text-secondary mb-2 block">账本</label>
              <select
                value={selectedBook}
                onChange={(e) => setSelectedBook(e.target.value)}
                className="w-full h-[44px] px-[12px] bg-bg-secondary border-none rounded-[10px] text-[14px] text-text-primary outline-none"
              >
                <option value="">全部账本</option>
                {books.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            {(selectedBook || selectedMonth) && (
              <button
                onClick={() => { setSelectedBook(''); setSelectedMonth(formatCurrentMonth()); }}
                className="text-[14px] text-primary"
              >
                重置筛选
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto pb-[100px]">
        {isLoading ? (
          <div className="p-[20px] space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <div className="w-[40px] h-[40px] rounded-[10px] bg-bg-secondary animate-pulse" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-1/2 bg-bg-secondary animate-pulse rounded" />
                  <div className="h-3 w-1/4 bg-bg-secondary animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(groupedTransactions).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
            <Calendar className="w-12 h-12 mb-4" />
            <p className="text-[14px]">还没有账单记录</p>
          </div>
        ) : (
          <div className="bg-bg-primary h-full">
            {Object.entries(groupedTransactions)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, items]) => {
                const dayTotal = items.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0);
                return (
                  <div key={date}>
                    <div className="bg-bg-secondary px-[20px] py-[8px] flex justify-between items-center sticky top-0 z-10">
                      <span className="text-[12px] text-text-secondary font-medium">
                        {date === formatToday() ? '今天' : formatDateLabel(date)}
                      </span>
                      <span className="text-[12px] text-text-tertiary">
                        {dayTotal !== 0 ? (dayTotal > 0 ? `+¥${dayTotal.toFixed(2)}` : `-¥${Math.abs(dayTotal).toFixed(2)}`) : ''}
                      </span>
                    </div>
                    <div>
                      {items.map((tx) => (
                        <TransactionItem
                          key={tx.id}
                          transaction={tx}
                          onEdit={() => openEditModal(tx)}
                          onDelete={() => handleDelete(tx.id!)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </main>

      <button
        onClick={openAddModal}
        className="fixed right-[20px] bottom-[80px] w-[56px] h-[56px] rounded-full bg-primary text-white shadow-md flex items-center justify-center touch-active z-30"
      >
        <Plus className="w-8 h-8" />
      </button>

      {showModal && (
        <AddTransactionModal
          onClose={() => setShowModal(false)}
          accountBooks={books}
          initialData={editingTx}
        />
      )}
    </div>
  );

  function handleDelete(id: number) {
    deleteTransaction(id);
    updateTransactions();
  }
}

/* ==================== 单条账单 Item ==================== */
function TransactionItem({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isIncome = transaction.type === 'income';
  const categoryInfo = getCategoryInfo(transaction.category, isIncome);

  return (
    <div
      onClick={onEdit}
      className="flex items-center gap-[12px] h-[64px] px-[20px] bg-bg-primary active:bg-bg-tertiary transition-colors cursor-pointer"
    >
      <div className={`w-[40px] h-[40px] rounded-[10px] flex items-center justify-center text-[20px] flex-shrink-0 ${isIncome ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
        {categoryInfo.emoji}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-[14px] text-text-primary font-medium truncate">
          {transaction.note || transaction.category}
        </p>
        <p className="text-[12px] text-text-secondary mt-0.5 truncate">
          {transaction.category}
          {transaction.accountBook !== '默认账本' ? ` · ${transaction.accountBook}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-[16px] font-medium flex-shrink-0 ${isIncome ? 'text-success' : 'text-danger'}`}>
          {isIncome ? '+' : '-'}¥{transaction.amount.toFixed(2)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 text-text-tertiary hover:text-danger rounded-button transition-colors touch-active"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

import { createPortal } from 'react-dom';

/* ==================== 手动添加模态框 ==================== */
function AddTransactionModal({
  onClose,
  accountBooks,
  initialData,
}: {
  onClose: () => void;
  accountBooks: string[];
  initialData: Transaction | null;
}) {
  const { addTransaction, updateTransaction, updateTransactions } = useApp();
  const [type, setType] = useState<'expense' | 'income'>(initialData?.type || 'expense');
  const [amount, setAmount] = useState(initialData ? String(initialData.amount) : '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [note, setNote] = useState(initialData?.note || '');
  const [date, setDate] = useState(initialData?.date || formatToday());
  const [book, setBook] = useState(initialData?.accountBook || accountBooks[0] || '默认账本');
  const [saving, setSaving] = useState(false);

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    if (!category) return;

    setSaving(true);
    try {
      if (initialData && initialData.id) {
        await updateTransaction({
          id: initialData.id,
          createdAt: initialData.createdAt,
          amount: numAmount,
          category,
          note,
          date,
          accountBook: book,
          type,
        });
      } else {
        await addTransaction({
          amount: numAmount,
          category,
          note,
          date,
          accountBook: book,
          type,
        });
      }
      await updateTransactions();
      onClose();
    } catch {
      // handled by context
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 fade-enter" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto bg-bg-primary rounded-t-modal shadow-xl flex flex-col h-[85vh] slide-up pb-[var(--safe-bottom)]">
        {/* Drag handle */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-[32px] h-[4px] bg-border-strong rounded-full" />
        </div>

        <div className="flex items-center justify-between px-[20px] py-[12px]">
          <button onClick={onClose} className="text-[14px] text-text-secondary h-[44px]">取消</button>
          <h2 className="text-[16px] font-medium text-text-primary">{initialData ? '编辑账单' : '记一笔'}</h2>
          <button
            onClick={handleSave}
            disabled={saving || !amount || !category}
            className="text-[14px] font-medium text-primary disabled:opacity-40 h-[44px]"
          >
            {saving ? '保存中' : '保存'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-[20px] py-[16px] space-y-[24px]">
          {/* Type Toggle */}
          <div className="flex bg-bg-secondary p-[4px] rounded-[10px]">
            <button
              onClick={() => { setType('expense'); setCategory(''); }}
              className={`flex-1 h-[36px] text-[14px] font-medium rounded-[8px] transition-all touch-active ${type === 'expense' ? 'bg-bg-primary text-danger shadow-sm' : 'text-text-secondary'}`}
            >支出</button>
            <button
              onClick={() => { setType('income'); setCategory(''); }}
              className={`flex-1 h-[36px] text-[14px] font-medium rounded-[8px] transition-all touch-active ${type === 'income' ? 'bg-bg-primary text-success shadow-sm' : 'text-text-secondary'}`}
            >收入</button>
          </div>

          {/* Amount */}
          <div className="flex items-baseline justify-center border-b border-border-default pb-[12px]">
            <span className="text-[24px] text-text-primary mr-2">¥</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-[48px] font-medium text-text-primary bg-transparent outline-none w-full text-center placeholder:text-border-strong"
            />
          </div>

          {/* Categories */}
          <div>
            <div className="grid grid-cols-5 gap-y-[16px]">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  className="flex flex-col items-center gap-[6px] touch-active"
                >
                  <div className={`w-[44px] h-[44px] rounded-[14px] flex items-center justify-center text-[24px] transition-colors ${category === cat.name
                    ? (type === 'expense' ? 'bg-danger text-white' : 'bg-success text-white')
                    : 'bg-bg-secondary text-text-primary'
                    }`}>
                    {cat.emoji}
                  </div>
                  <span className={`text-[12px] ${category === cat.name ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Note & Date */}
          <div className="space-y-[16px]">
            <div className="flex items-center">
              <span className="text-[14px] text-text-secondary w-[60px]">备注</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="写点什么..."
                maxLength={50}
                className="flex-1 h-[44px] bg-bg-secondary px-[12px] rounded-[10px] text-[14px] text-text-primary outline-none"
              />
            </div>

            <div className="flex items-center">
              <span className="text-[14px] text-text-secondary w-[60px]">日期</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 h-[44px] bg-bg-secondary px-[12px] rounded-[10px] text-[14px] text-text-primary outline-none"
              />
            </div>

            {accountBooks.length > 1 && (
              <div className="flex items-center">
                <span className="text-[14px] text-text-secondary w-[60px]">账本</span>
                <select
                  value={book}
                  onChange={(e) => setBook(e.target.value)}
                  className="flex-1 h-[44px] bg-bg-secondary px-[12px] rounded-[10px] text-[14px] text-text-primary outline-none"
                >
                  {accountBooks.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

/* ==================== 工具函数 ==================== */
function getCategoryInfo(name: string, isIncome: boolean) {
  const list = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const found = list.find((c) => c.name === name);
  return found ?? { name: '其他', emoji: '📝' };
}

function formatCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${parseInt(m)}月`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const month = d.getMonth() + 1;
  return `${month}月${day}日 周${weekdays[d.getDay()]}`;
}

function getAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>();
  for (const t of transactions) {
    months.add(t.date.slice(0, 7));
  }
  months.add(formatCurrentMonth());
  return Array.from(months).sort().reverse();
}
