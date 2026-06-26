export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id?: number;
  amount: number;
  category: string;
  note: string;
  date: string;
  accountBook: string;
  type: TransactionType;
  createdAt: number;
}

export interface Budget {
  id?: number;
  category: string;
  limit: number;
  period: 'monthly' | 'weekly';
  accountBook: string;
}

export interface AccountBook {
  id?: number;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: string;
}
