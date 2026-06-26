import { useState, useCallback } from 'react';
import type { Transaction, Budget } from '../types';

interface MonthData {
  expense: number;
  income: number;
  balance: number;
  byCategory: Record<string, number>;
  byDay: Record<string, number>; // 'YYYY-MM-DD' -> amount (expense only)
  transactions: Transaction[];
  count: number;
}

export function useMonthlyData(
  transactions: Transaction[],
  budgets: Budget[],
) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // 0-indexed

  const goToPrev = useCallback(() => {
    setViewYear((y) => {
      const m = y === viewYear ? viewMonth - 1 : 11;
      if (m < 0) return y - 1;
      return y;
    });
    setViewMonth((m) => (m <= 0 ? 11 : m - 1));
  }, [viewYear, viewMonth]);

  const goToNext = useCallback(() => {
    setViewYear((y) => {
      const m = y === viewYear ? viewMonth + 1 : 0;
      if (m > 11) return y + 1;
      return y;
    });
    setViewMonth((m) => (m >= 11 ? 0 : m + 1));
  }, [viewYear, viewMonth]);

  const getDataForMonth = useCallback(
    (year: number, month: number): MonthData => {
      const filtered = transactions.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });

      const expense = filtered
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);
      const income = filtered
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0);

      const byCategory: Record<string, number> = {};
      const byDay: Record<string, number> = {};
      for (const t of filtered) {
        if (t.type === 'expense') {
          byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
          byDay[t.date] = (byDay[t.date] || 0) + t.amount;
        }
      }

      return { expense, income, balance: income - expense, byCategory, byDay, transactions: filtered, count: filtered.length };
    },
    [transactions],
  );

  const currentData = getDataForMonth(viewYear, viewMonth);

  // Previous month data for comparison
  const getPrevMonth = (year: number, month: number) => {
    if (month === 0) return { year: year - 1, month: 11 };
    return { year, month: month - 1 };
  };
  const prev = getPrevMonth(viewYear, viewMonth);
  const prevData = getDataForMonth(prev.year, prev.month);

  const compareChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const monthLabel = `${viewYear}年${viewMonth + 1}月`;

  return {
    viewYear,
    viewMonth,
    monthLabel,
    currentData,
    prevData,
    goToPrev,
    goToNext,
    expenseChange: compareChange(currentData.expense, prevData.expense),
    incomeChange: compareChange(currentData.income, prevData.income),
    balanceChange: compareChange(currentData.balance, prevData.balance),
    budgets,
  };
}
