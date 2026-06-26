import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useMemo } from 'react';

export interface BudgetAlert {
  category: string;
  spent: number;
  limit: number;
  percentage: number;
  isOver: boolean; // true = 超出100%，false = 仅超出阈值
}

export function useBudgetAlert() {
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-06"

  const transactions = useLiveQuery(
    () => db.transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense')
      .toArray()
  );

  const budgets = useLiveQuery(() => db.budgets.toArray());
  const alertEnabledSetting = useLiveQuery(() => db.settings.get('alertEnabled'));
  const thresholdSetting = useLiveQuery(() => db.settings.get('budgetThreshold'));

  const alerts = useMemo(() => {
    // 默认开启，阈值80
    const isEnabled = alertEnabledSetting?.value !== 'false';
    const threshold = thresholdSetting?.value ? parseInt(thresholdSetting.value) : 80;

    if (!isEnabled || !transactions || !budgets) return [];
    
    // 按分类汇总本月支出
    const spentByCategory: Record<string, number> = {};
    transactions.forEach(t => {
      spentByCategory[t.category] = (spentByCategory[t.category] || 0) + Number(t.amount);
    });

    // 对比预算，找出超过设定阈值的
    const result: BudgetAlert[] = [];
    budgets.forEach(b => {
      const spent = spentByCategory[b.category] || 0;
      const percentage = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      if (percentage >= threshold) {
        result.push({
          category: b.category,
          spent,
          limit: b.limit,
          percentage: Math.round(percentage),
          isOver: percentage >= 100
        });
      }
    });
    
    // 按超支严重程度排序
    return result.sort((a, b) => b.percentage - a.percentage);
  }, [transactions, budgets, alertEnabledSetting, thresholdSetting]);

  return { alerts, hasAlerts: alerts.length > 0 };
}
