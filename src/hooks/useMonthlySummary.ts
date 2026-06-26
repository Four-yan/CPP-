import { useMemo } from 'react';
import type { Transaction } from '../types';

export function useMonthlySummary(transactions: Transaction[]) {
  return useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let expense = 0, income = 0;
    let prevExpense = 0, prevIncome = 0;
    const byCategory: Record<string, number> = {};
    let count = 0;

    for (const t of transactions) {
      const d = new Date(t.date);
      const m = d.getMonth();
      const y = d.getFullYear();

      if (m === currentMonth && y === currentYear) {
        count++;
        if (t.type === 'expense') {
          expense += t.amount;
          byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        } else {
          income += t.amount;
        }
      } else if (m === prevMonth && y === prevYear) {
        if (t.type === 'expense') prevExpense += t.amount;
        else prevIncome += t.amount;
      }
    }

    const expenseChange = prevExpense === 0 ? (expense > 0 ? 100 : 0) : ((expense - prevExpense) / prevExpense) * 100;
    const incomeChange = prevIncome === 0 ? (income > 0 ? 100 : 0) : ((income - prevIncome) / prevIncome) * 100;

    return { 
      expense, 
      income, 
      balance: income - expense, 
      byCategory, 
      count,
      expenseChange,
      incomeChange
    };
  }, [transactions]);
}
