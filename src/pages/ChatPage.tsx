import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { parseTransaction, chat, parseTransactionFromImage } from '../lib/ai';
import { learnFromTransaction, tryMatchFromRules } from '../lib/categoryLearner';
import type { Transaction } from '../types';
import type { TransactionType } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import {
  useBudgetAlert,
  type BudgetAlert,
} from '../hooks/useBudgetAlert';
import BudgetAlertModal from '../components/BudgetAlertModal';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { showFallbackNotification } from '../lib/notifications';
import {
  Send,
  Mic,
  Bot,
  User,
  Check,
  X,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Volume2,
  MoreVertical,
  AlertCircle,
  Camera
} from 'lucide-react';

export interface PendingTxState {
  id: string;
  tx: {
    amount: number;
    category: string;
    note: string;
    type: TransactionType;
    date: string;
    accountBook: string;
  };
  status: 'pending' | 'confirmed' | 'cancelled';
}

/** 一条聊天消息 */
interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  pendingTransactions?: PendingTxState[];
}

const WELCOME_MESSAGE: ChatMessage = {
  id: -1,
  role: 'assistant',
  content:
    '你好！我是你的AI记账助手 💰\n\n你可以直接告诉我：\n• 午饭花了32块\n• 打车50元，报销\n• 收到工资8000\n\n也可以问我：\n• "这个月花了多少？"\n• "帮我分析哪里花多了"',
};

let messageIdCounter = 0;

/** 语音提示已在 localStorage 中存储过 */
function hasSeenVoiceHint(): boolean {
  try {
    return localStorage.getItem('voice_hint_seen') === '1';
  } catch {
    return false;
  }
}

function markVoiceHintSeen(): void {
  try {
    localStorage.setItem('voice_hint_seen', '1');
  } catch {
    /* noop */
  }
}

export default function ChatPage() {
  const { addTransaction, accountBooks, updateTransactions, transactions } = useApp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [showVoiceHint, setShowVoiceHint] = useState(false);
  const [fallbackNotif, setFallbackNotif] = useState<{ title: string; body: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // reset input
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (!base64) return;

      const userMsgId = ++messageIdCounter;
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: 'user', content: '[已上传账单图片]' },
      ]);
      setLoading(true);

      try {
        const parsed = await parseTransactionFromImage(base64);
        const pendingTxs: PendingTxState[] = parsed.map((p, i) => ({
          id: `img-${Date.now()}-${i}`,
          tx: {
            ...p,
            date: p.date || new Date().toISOString().split('T')[0],
            accountBook: activeBook,
          },
          status: 'pending'
        }));
        const promptContent = pendingTxs.length === 1 
          ? '📝 识别图片账单：请确认：' 
          : `📝 识别图片账单：识别到 ${pendingTxs.length} 笔账单，请逐一确认：`;
          
        setMessages((prev) => [
          ...prev,
          { id: ++messageIdCounter, role: 'assistant', content: promptContent, pendingTransactions: pendingTxs },
        ]);
        await new Promise((r) => setTimeout(r, 400));
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { id: ++messageIdCounter, role: 'assistant', content: err instanceof Error ? err.message : '图片解析失败。' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // 获取最近 N 条交易（用于智能问答）
  const recentTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  }, [transactions]);

  // 语音输入
  const handleVoiceComplete = useCallback((text: string) => {
    // 将识别结果填入输入框并自动发送
    setInput(text);
    // 稍后自动发送
    setTimeout(() => {
      setInput('');
      // 复用 handleSend 的逻辑
      handleVoiceSend(text);
    }, 300);
  }, []);

  const { isListening, transcript, interimText, isSupported, start: startListening, stop: stopListening } = useSpeechRecognition(handleVoiceComplete);

  // 首次使用显示语音提示
  useEffect(() => {
    if (!isSupported && !hasSeenVoiceHint()) {
      setShowVoiceHint(true);
      markVoiceHintSeen();
    }
  }, [isSupported]);

  // 预算预警
  const { alerts: budgetAlerts } = useBudgetAlert();
  const [currentAlert, setCurrentAlert] = useState<BudgetAlert | null>(null);
  const shownAlertsRef = useRef<Set<string>>(new Set());
  
  const alertStyleSetting = useLiveQuery(() => db.settings.get('alertStyle'));
  const alertEnabledSetting = useLiveQuery(() => db.settings.get('alertEnabled'));

  // 有新预警时弹窗 + 推送通知
  useEffect(() => {
    const alertEnabled = alertEnabledSetting?.value !== 'false';
    if (!alertEnabled) return;

    for (const alert of budgetAlerts) {
      // 通过分类名和百分比十位数组合作为唯一 key，例如 "餐饮-8" 表示 80%~89% 阶段弹过一次
      const key = `${alert.category}-${Math.floor(alert.percentage / 10)}`;
      if (!shownAlertsRef.current.has(key)) {
        shownAlertsRef.current.add(key);
        const timer = setTimeout(() => setCurrentAlert(alert), 500);
        
        // 同时推送桌面通知
        const msg = `⚠️ ${alert.category}消费已达预算${alert.percentage}%`;
        showFallbackNotification((title, body) => setFallbackNotif({ title, body }), '预算提醒', msg);
        
        return () => clearTimeout(timer);
      }
    }
  }, [budgetAlerts, alertEnabledSetting]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeBook = accountBooks[0]?.name || '默认账本';

  /** 处理聊天命令（本地问答，不调用 AI） */
  function handleChatCommand(text: string, txList: Transaction[]): string | null {
    const t = text.trim();

    if (/我?\s*(上\s*个|这\s*个|去\s*个)?\s*月\s*花\s*了\s*多少|本月支出/i.test(t)) {
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();
      const total = txList
        .filter((tx) => {
          const d = new Date(tx.date);
          return tx.type === 'expense' && d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((s, tx) => s + tx.amount, 0);
      const count = txList.filter((tx) => {
        const d = new Date(tx.date);
        return tx.type === 'expense' && d.getMonth() === month && d.getFullYear() === year;
      }).length;
      return `本月总支出 ¥${total.toFixed(2)}，共 ${count} 笔。`;
    }

    if (/分析|哪里花多|消费报告|账单分析/i.test(t)) {
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();
      const monthlyTx = txList.filter((tx) => {
        const d = new Date(tx.date);
        return tx.type === 'expense' && d.getMonth() === month && d.getFullYear() === year;
      });

      if (monthlyTx.length === 0) return '本月还没有支出记录哦～';

      const byCategory: Record<string, number> = {};
      for (const tx of monthlyTx) {
        byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount;
      }
      const sorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
      const total = monthlyTx.reduce((s, tx) => s + tx.amount, 0);

      let result = `📊 本月消费分析（共 ¥${total.toFixed(2)}）：\n\n`;
      for (const [cat, amt] of sorted) {
        const pct = ((amt / total) * 100).toFixed(1);
        const flag = parseFloat(pct) > 30 ? ' ⚠️' : parseFloat(pct) > 15 ? ' 🔸' : '';
        result += `  ${cat}：¥${amt.toFixed(2)} (${pct}%）${flag}\n`;
      }
      if (sorted.length > 0) {
        const [topCat, topAmt] = sorted[0];
        result += `\n💡 最多支出是「${topCat}」，占了 ${((topAmt / total) * 100).toFixed(1)}%。`;
      }
      return result;
    }

    const modifyIdx = /改\s*(第)?(\d+)\s*笔\s*.*(改|变成|变|改成|换)\s*钱?\s*(\d+\.?\d*)/.exec(t);
    if (modifyIdx) {
      const idx = parseInt(modifyIdx[2]) - 1;
      const newAmount = parseFloat(modifyIdx[4]);
      const sorted = [...txList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (idx >= 0 && idx < sorted.length) {
        return `找到第 ${idx + 1} 笔：${sorted[idx].category} ¥${sorted[idx].amount.toFixed(2)}（${sorted[idx].date}）\n请将金额改为 ¥${newAmount.toFixed(2)}。注意：修改功能需要在确认卡片中操作，我无法直接修改已记账的记录。`;
      }
      return `目前只有 ${sorted.length} 笔记录，找不到第 ${idx + 1} 笔哦。`;
    }

    const catModify = /(\d+\s*(天前|天之前|周前|个月前))?.*?(外卖|打车|咖啡|奶茶|吃饭|购物|娱乐|医疗|居住|学习|交通)(.*)改.*(变成|变|改成|换)\s*(\d+\.?\d*)/.exec(t);
    if (catModify) {
      const category = catModify[3];
      const newAmount = parseFloat(catModify[6]);
      const found = txList
        .filter((tx) => tx.category === category)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (found.length > 0) {
        const tx = found[0];
        return `找到「${category}」记录：¥${tx.amount.toFixed(2)}（${tx.date}）\n请将金额改为 ¥${newAmount.toFixed(2)}。注意：修改功能需要在确认卡片中操作。`;
      }
      return `没有找到「${category}」相关的记录。`;
    }

    if (/多少\s*笔|总共|记录数/i.test(t)) {
      return `你一共有 ${txList.length} 笔记录。`;
    }

    return null;
  }

  /** 语音识别完成后直接发送 */
  const handleVoiceSend = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);

    try {
      const ruleResult = await tryMatchFromRules(text);
      if (ruleResult) {
        const pendingTxs: PendingTxState[] = [{
          id: `rule-${Date.now()}-0`,
          tx: {
            ...ruleResult,
            date: ruleResult.date || new Date().toISOString().split('T')[0],
            accountBook: activeBook,
          },
          status: 'pending'
        }];

        const confirmMsgId = ++messageIdCounter;
        setMessages((prev) => [
          ...prev,
          { id: confirmMsgId, role: 'assistant', content: '📝 根据学习记录自动分类：', pendingTransactions: pendingTxs },
        ]);
        await new Promise((r) => setTimeout(r, 400));
        setLoading(false);
        return;
      }

      const cmdResult = handleChatCommand(text, recentTransactions);
      if (cmdResult) {
        setMessages((prev) => [...prev, { id: ++messageIdCounter, role: 'assistant', content: cmdResult }]);
        setLoading(false);
        return;
      }

      const parsed = await parseTransaction(text);
      const pendingTxs: PendingTxState[] = parsed.map((p, i) => ({
        id: `ai-${Date.now()}-${i}`,
        tx: {
          ...p,
          date: p.date || new Date().toISOString().split('T')[0],
          accountBook: activeBook,
        },
        status: 'pending'
      }));
      const promptContent = pendingTxs.length === 1 
        ? '请确认这笔记录：' 
        : `识别到 ${pendingTxs.length} 笔账单，请逐一确认：`;

      const confirmMsgId = ++messageIdCounter;
      setMessages((prev) => [
        ...prev,
        { id: confirmMsgId, role: 'assistant', content: promptContent, pendingTransactions: pendingTxs },
      ]);
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: ++messageIdCounter, role: 'assistant', content: err instanceof Error ? err.message : '解析出错，请重试。' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, activeBook, recentTransactions]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsgId = ++messageIdCounter;
    const userMessage: ChatMessage = { id: userMsgId, role: 'user', content: text };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    inputRef.current?.focus();

    try {
      const ruleResult = await tryMatchFromRules(text);
      if (ruleResult) {
        const pendingTxs: PendingTxState[] = [{
          id: `rule-${Date.now()}-0`,
          tx: {
            ...ruleResult,
            date: ruleResult.date || new Date().toISOString().split('T')[0],
            accountBook: activeBook,
          },
          status: 'pending'
        }];

        const confirmMsgId = ++messageIdCounter;
        const confirmMsg: ChatMessage = {
          id: confirmMsgId,
          role: 'assistant',
          content: '📝 根据学习记录自动分类：',
          pendingTransactions: pendingTxs,
        };

        setMessages((prev) => [...prev, confirmMsg]);
        await new Promise((r) => setTimeout(r, 400));
        setLoading(false);
        return;
      }

      const cmdResult = handleChatCommand(text, recentTransactions);
      if (cmdResult) {
        setMessages((prev) => [
          ...prev,
          { id: ++messageIdCounter, role: 'assistant', content: cmdResult },
        ]);
        setLoading(false);
        return;
      }

      // 检查输入是否包含任何数字（判断是否可能是一笔记账）
      // 如果完全没有数字，那么它肯定是一句日常聊天，直接跳过账单解析
      const hasNumber = /\d/.test(text) || /[一二两三四五六七八九十百千万亿]/.test(text);

      if (hasNumber) {
        // 尝试解析为账单
        const parsed = await parseTransaction(text);
        const pendingTxs: PendingTxState[] = parsed.map((p, i) => ({
          id: `ai-${Date.now()}-${i}`,
          tx: {
            ...p,
            date: p.date || new Date().toISOString().split('T')[0],
            accountBook: activeBook,
          },
          status: 'pending'
        }));
        const promptContent = pendingTxs.length === 1 
          ? '请确认这笔记录：' 
          : `识别到 ${pendingTxs.length} 笔账单，请逐一确认：`;

        setMessages((prev) => [...prev, {
          id: ++messageIdCounter,
          role: 'assistant',
          content: promptContent,
          pendingTransactions: pendingTxs,
        }]);
        setLoading(false);
        return;
      }

      // 如果完全没有数字，则视为日常聊天交给 AI 处理
      const chatHistory = messages
        .filter((m) => m.id !== -1 && !m.pendingTransactions)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));
      
      chatHistory.push({ role: 'user', content: text });

      const txSummary = recentTransactions
        .map((t) => `${t.date} ${t.type === 'income' ? '+' : '-'}¥${t.amount} ${t.category} ${t.note}`)
        .join('\n');
      const aiReply = await chat(
        chatHistory as any[],
        txSummary || '暂无数据',
        recentTransactions,
      );

      setMessages((prev) => [
        ...prev,
        { id: ++messageIdCounter, role: 'assistant', content: aiReply },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: ++messageIdCounter, role: 'assistant', content: err instanceof Error ? err.message : '解析出错，请重试。' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, activeBook, recentTransactions, messages]);

  const checkAllProcessed = useCallback((msgId: number, currentMessages: ChatMessage[]) => {
    const msg = currentMessages.find((m) => m.id === msgId);
    if (!msg || !msg.pendingTransactions) return;

    const allProcessed = msg.pendingTransactions.every(ptx => ptx.status !== 'pending');
    if (allProcessed) {
      const confirmedTxs = msg.pendingTransactions.filter(ptx => ptx.status === 'confirmed').map(ptx => ptx.tx);
      if (confirmedTxs.length > 0) {
        const totalExpense = confirmedTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const totalIncome = confirmedTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const summary = `✅ 已记录 ${confirmedTxs.length} 笔${confirmedTxs.length > 1 ? `，共支出 ¥${totalExpense.toFixed(2)}，收入 ¥${totalIncome.toFixed(2)}` : ''}`;
        setMessages((prev) => [
          ...prev,
          {
            id: ++messageIdCounter,
            role: 'assistant',
            content: summary,
          },
        ]);
      }
    }
  }, []);

  const handleConfirm = useCallback(
    async (msgId: number, txId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      if (!msg?.pendingTransactions) return;
      const ptx = msg.pendingTransactions.find(p => p.id === txId);
      if (!ptx || ptx.status !== 'pending') return;

      const tx = ptx.tx;
      try {
        await addTransaction({
          amount: tx.amount,
          category: tx.category,
          note: tx.note,
          date: tx.date,
          accountBook: tx.accountBook,
          type: tx.type,
        });

        const userInputMsg = messages.find((m) => m.role === 'user' && m.id === msgId - 1);
        if (userInputMsg) {
          await learnFromTransaction(userInputMsg.content, tx);
        }

        await updateTransactions();
        
        // iOS 26 PWA Notification request timing
        const hasPrompted = localStorage.getItem('hasPromptedNotif');
        if (!hasPrompted && 'Notification' in window && Notification.permission === 'default') {
          setTimeout(() => {
            if (window.confirm('开启通知，超预算时第一时间提醒你')) {
              Notification.requestPermission().then(perm => {
                if (perm === 'granted') {
                  import('../lib/db').then(({ db }) => {
                    db.settings.put({ key: 'alertEnabled', value: 'true' });
                  });
                }
              });
            }
            localStorage.setItem('hasPromptedNotif', 'true');
          }, 500);
        }

        setMessages((prev) => {
          const next = prev.map(m => {
            if (m.id === msgId && m.pendingTransactions) {
              return {
                ...m,
                pendingTransactions: m.pendingTransactions.map(p => p.id === txId ? { ...p, status: 'confirmed' as const } : p)
              };
            }
            return m;
          });
          checkAllProcessed(msgId, next);
          return next;
        });

      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { id: ++messageIdCounter, role: 'assistant', content: `❌ 记录失败：${err instanceof Error ? err.message : String(err)}` },
        ]);
      }
    },
    [messages, addTransaction, updateTransactions, checkAllProcessed],
  );

  const handleCancel = useCallback((msgId: number, txId: string) => {
    setMessages((prev) => {
      const next = prev.map(m => {
        if (m.id === msgId && m.pendingTransactions) {
          return {
            ...m,
            pendingTransactions: m.pendingTransactions.map(p => p.id === txId ? { ...p, status: 'cancelled' as const } : p)
          };
        }
        return m;
      });
      checkAllProcessed(msgId, next);
      return next;
    });
  }, [checkAllProcessed]);

  async function checkBudgetAfterAdd(category: string, amount: number) {
    // 预算预警现在是完全响应式的，通过 dexie-react-hooks 的 useLiveQuery 自动触发
    // 不需要手动在此处检查
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="flex flex-col h-screen bg-bg-tertiary pb-[calc(56px+env(safe-area-inset-bottom))]">
      {/* 顶部 Header */}
      <header className="sticky top-0 z-40 bg-bg-primary border-b border-border-default h-[60px] flex items-center justify-between px-[20px]">
        <div className="flex flex-col">
          <h1 className="text-[20px] font-medium text-text-primary leading-tight">AI 记账助手</h1>
          <span className="text-[12px] text-text-secondary leading-tight">{activeBook}</span>
        </div>
        <button className="text-text-secondary">
          <MoreVertical className="w-5 h-5" />
        </button>
      </header>

      {/* 消息区 */}
      <main className="flex-1 overflow-y-auto pb-4">
        <div className="px-[20px] py-4 space-y-[12px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-enter`}
            >
              <div
                className={`max-w-[76%] rounded-[14px] px-[14px] py-[10px] text-[14px] font-normal leading-[1.6] break-words shadow-sm ${msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-[4px]'
                    : 'bg-bg-primary text-text-primary border-[0.5px] border-border-default rounded-bl-[4px]'
                  }`}
              >
                {msg.content}
                {msg.pendingTransactions && (
                  <div className="mt-3 space-y-3">
                    {msg.pendingTransactions.map(ptx => (
                      <ConfirmationCard
                        key={ptx.id}
                        tx={ptx.tx}
                        status={ptx.status}
                        onConfirm={() => handleConfirm(msg.id, ptx.id)}
                        onCancel={() => handleCancel(msg.id, ptx.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex w-full justify-start animate-fade-enter">
              <div className="max-w-[76%] rounded-[14px] rounded-bl-[4px] px-[14px] py-[10px] bg-bg-primary border-[0.5px] border-border-default shadow-sm">
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* 预算警告内嵌示例（已废弃） */}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* 底部输入区 */}
      <footer className="bg-bg-primary border-t border-border-default pb-[var(--safe-bottom)]">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-[8px] px-[20px] py-[12px]"
        >
          <button
            type="button"
            onTouchStart={(e) => { e.preventDefault(); startListening(); }}
            onTouchEnd={stopListening}
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onMouseLeave={() => { if (isListening) stopListening(); }}
            disabled={!isSupported}
            className={`flex items-center justify-center w-[36px] h-[36px] rounded-full flex-shrink-0 transition-colors ${isListening ? 'bg-danger text-white voice-listening' : 'bg-bg-secondary text-text-secondary'
              }`}
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center justify-center w-[36px] h-[36px] rounded-full flex-shrink-0 text-text-secondary bg-bg-secondary transition-colors touch-active"
          >
            <Camera className="w-4 h-4" />
          </button>
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleImageUpload} 
          />

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入或按住语音..."
            className="flex-1 bg-bg-secondary h-[44px] rounded-[20px] px-4 text-[16px] text-text-primary placeholder:text-text-tertiary outline-none"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex items-center justify-center w-[36px] h-[36px] rounded-full bg-primary text-white flex-shrink-0 disabled:opacity-50 touch-active"
          >
            <Send className="w-4 h-4 -ml-0.5" />
          </button>
        </form>
      </footer>

      {/* 全屏预算预警弹窗 */}
      <BudgetAlertModal
        alert={currentAlert}
        style={alertStyleSetting?.value || 'strict'}
        onClose={() => setCurrentAlert(null)}
      />
    </div>
  );
}

/* ==================== 子组件：账单确认卡片 ==================== */

function ConfirmationCard({
  tx,
  status,
  onConfirm,
  onCancel,
}: {
  tx: PendingTxState['tx'];
  status: PendingTxState['status'];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isIncome = tx.type === 'income';
  const isConfirmed = status === 'confirmed';
  const isCancelled = status === 'cancelled';
  
  if (isCancelled) return null;

  const iconColor = isIncome ? 'text-success' : 'text-danger';
  const Icon = isConfirmed ? Check : (isIncome ? ArrowUpCircle : ArrowDownCircle);

  return (
    <div className={`bg-bg-primary border border-border-default rounded-card overflow-hidden flex flex-col w-full ${isConfirmed ? 'opacity-70 grayscale' : ''}`}>
      <div className="flex justify-between items-start px-[18px] py-[16px]">
        <div className="flex flex-col">
          <span className={`text-[24px] font-medium leading-none ${isConfirmed ? 'text-text-secondary' : iconColor}`}>
            {isIncome ? '+' : '-'}¥{tx.amount.toFixed(2)}
          </span>
          <div className="flex gap-2 mt-3 items-center">
            <span className={`px-2 py-0.5 rounded-capsule text-[12px] ${isConfirmed ? 'bg-bg-secondary text-text-secondary' : 'bg-primary/10 text-primary'}`}>
              {tx.category}
            </span>
            {tx.note && (
              <span className={`px-2 py-0.5 rounded-capsule text-[12px] truncate max-w-[80px] ${isConfirmed ? 'bg-bg-secondary text-text-secondary' : 'bg-primary/10 text-primary'}`}>
                {tx.note}
              </span>
            )}
          </div>
          <span className="text-[12px] text-text-secondary mt-2">
            {tx.date}
          </span>
        </div>
        <div className={`w-[44px] h-[44px] rounded-button flex items-center justify-center flex-shrink-0 ml-2 ${isConfirmed ? 'bg-bg-secondary text-success' : 'bg-primary/10 text-primary'}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>

      {!isConfirmed && (
        <div className="flex gap-2 px-[18px] pb-[16px]">
          <button
            onClick={onCancel}
            className="flex-1 h-[44px] rounded-button border border-border-default text-text-secondary text-[14px] bg-transparent touch-active"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-[44px] rounded-button bg-primary text-white text-[14px] font-medium touch-active"
          >
            确认记录
          </button>
        </div>
      )}
    </div>
  );
}
