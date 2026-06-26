import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Transaction, Budget, AccountBook, Setting } from '../types';
import { db } from '../lib/db';

interface AppState {
  transactions: Transaction[];
  budgets: Budget[];
  accountBooks: AccountBook[];
  settings: Setting[];
  loading: boolean;
  error: string | null;
}

interface AppContextType extends AppState {
  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  updateTransaction: (t: Transaction) => Promise<void>;
  updateTransactions: () => Promise<void>;
  addBudget: (b: Omit<Budget, 'id'>) => Promise<void>;
  deleteBudget: (id: number) => Promise<void>;
  updateBudgets: () => Promise<void>;
  addAccountBook: (a: Omit<AccountBook, 'id' | 'createdAt'>) => Promise<void>;
  deleteAccountBook: (id: number) => Promise<void>;
  updateAccountBooks: () => Promise<void>;
  saveSetting: (key: string, value: string) => Promise<void>;
  getSetting: (key: string) => Promise<string>;
  updateSettings: () => Promise<void>;
  setError: (error: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    transactions: [],
    budgets: [],
    accountBooks: [],
    settings: [],
    loading: false,
    error: null,
  });

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const updateTransactions = useCallback(async () => {
    const transactions = await db.transactions.orderBy('date').reverse().toArray();
    setState((prev) => ({ ...prev, transactions }));
  }, []);

  const updateBudgets = useCallback(async () => {
    const budgets = await db.budgets.toArray();
    setState((prev) => ({ ...prev, budgets }));
  }, []);

  const updateAccountBooks = useCallback(async () => {
    const accountBooks = await db.accountBooks.toArray();
    setState((prev) => ({ ...prev, accountBooks }));
  }, []);

  const updateSettings = useCallback(async () => {
    const settings = await db.settings.toArray();
    setState((prev) => ({ ...prev, settings }));
  }, []);

  const addTransaction = useCallback(
    async (t: Omit<Transaction, 'id' | 'createdAt'>) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const id = await db.transactions.add({
          ...t,
          createdAt: Date.now(),
        });
        await updateTransactions();
        setState((prev) => ({ ...prev, loading: false }));
        return id;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '添加记录失败';
        console.error('addTransaction failed:', err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errMsg,
        }));
        throw new Error(errMsg);
      }
    },
    [updateTransactions],
  );

  const deleteTransaction = useCallback(
    async (id: number) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await db.transactions.delete(id);
        await updateTransactions();
        setState((prev) => ({ ...prev, loading: false }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : '删除记录失败',
        }));
      }
    },
    [updateTransactions],
  );

  const updateTransaction = useCallback(
    async (t: Transaction) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await db.transactions.put(t);
        await updateTransactions();
        setState((prev) => ({ ...prev, loading: false }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : '更新记录失败',
        }));
      }
    },
    [updateTransactions],
  );

  const addBudget = useCallback(
    async (b: Omit<Budget, 'id'>) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await db.budgets.add(b);
        await updateBudgets();
        setState((prev) => ({ ...prev, loading: false }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : '添加预算失败',
        }));
      }
    },
    [updateBudgets],
  );

  const deleteBudget = useCallback(
    async (id: number) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await db.budgets.delete(id);
        await updateBudgets();
        setState((prev) => ({ ...prev, loading: false }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : '删除预算失败',
        }));
      }
    },
    [updateBudgets],
  );

  const addAccountBook = useCallback(
    async (a: Omit<AccountBook, 'id' | 'createdAt'>) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await db.accountBooks.add({
          ...a,
          createdAt: Date.now(),
        });
        await updateAccountBooks();
        setState((prev) => ({ ...prev, loading: false }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : '添加账本失败',
        }));
      }
    },
    [updateAccountBooks],
  );

  const deleteAccountBook = useCallback(
    async (id: number) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await db.accountBooks.delete(id);
        await updateAccountBooks();
        setState((prev) => ({ ...prev, loading: false }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : '删除账本失败',
        }));
      }
    },
    [updateAccountBooks],
  );

  const saveSetting = useCallback(
    async (key: string, value: string) => {
      await db.settings.put({ key, value });
      await updateSettings();
    },
    [updateSettings],
  );

  const getSetting = useCallback(
    async (key: string): Promise<string> => {
      const setting = await db.settings.where('key').equals(key).first();
      return setting?.value ?? '';
    },
    [],
  );

  return (
    <AppContext.Provider
      value={{
        ...state,
        addTransaction,
        deleteTransaction,
        updateTransaction,
        updateTransactions,
        addBudget,
        deleteBudget,
        updateBudgets,
        addAccountBook,
        deleteAccountBook,
        updateAccountBooks,
        saveSetting,
        getSetting,
        updateSettings,
        setError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
