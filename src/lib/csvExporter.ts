import type { Transaction } from '../types';

/**
 * 将交易记录导出为 CSV 文件
 */
export function exportTransactionToCSV(transactions: Transaction[]): void {
  const BOM = '\uFEFF';
  const headers = ['日期', '类型', '分类', '金额', '备注', '账本'];
  const rows = transactions
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((t) => [
      t.date,
      t.type === 'income' ? '收入' : '支出',
      t.category,
      t.type === 'income' ? t.amount.toFixed(2) : `-${t.amount.toFixed(2)}`,
      t.note || '',
      t.accountBook,
    ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `账单明细_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
