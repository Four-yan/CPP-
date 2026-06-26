import Dexie, { type Table } from 'dexie';
import type { Transaction, Budget, AccountBook, Setting } from '../types';

export class JizhangDB extends Dexie {
  transactions!: Table<Transaction>;
  budgets!: Table<Budget>;
  accountBooks!: Table<AccountBook>;
  settings!: Table<Setting>;

  constructor() {
    super('JizhangDB');
    this.version(1).stores({
      transactions: '++id, date, type, category, accountBook, createdAt',
      budgets: '++id, category, period, accountBook',
      accountBooks: '++id, name, createdAt',
      settings: 'key',
    });
    this.version(2).stores({
      budgets: '++id, category, limit, period',
    }).upgrade(tx => {
      // Optional upgrade logic if necessary
    });
  }
}

export const db = new JizhangDB();
