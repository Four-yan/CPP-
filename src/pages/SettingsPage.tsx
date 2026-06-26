import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { Plus, Trash2, Palette, Shield, Bell, Sun, Moon, Monitor, Brain, Edit2, ChevronRight, ChevronDown, Download } from 'lucide-react';
import { type BudgetAlert } from '../hooks/useBudgetAlert';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { requestPermission, getWeeklyReportTime, setWeeklyReportTime } from '../lib/notifications';
import {
  loadThemeFromDB,
  saveThemeToDB,
  applyTheme,
  onSystemColorChange,
  type ThemeMode,
  type ThemeColor,
  THEME_COLORS,
} from '../hooks/useTheme';
import {
  getCategoryRules,
  type CategoryRule,
} from '../lib/categoryLearner';

const BUDGET_STYLES: { value: string; label: string; emoji: string; desc: string }[] = [
  { value: 'gentle', label: '温柔', emoji: '🥺', desc: '轻声细语地提醒你' },
  { value: 'normal', label: '普通', emoji: '⚠️', desc: '客观的数据展示' },
  { value: 'strict', label: '严厉', emoji: '🚨', desc: '毒舌管家模式' },
  { value: 'funny', label: '搞笑', emoji: '💀', desc: '段子手风格' },
];

const CATEGORY_EMOJIS: Record<string, string> = {
  餐饮: '🍜', 交通: '🚗', 购物: '🛍', 娱乐: '🎮', 医疗: '💊', 居住: '🏠',
  学习: '📚', 人情: '🎁', 其他: '📝', 工资: '💼', 兼职: '💻', 理财: '📈',
};
const getCategoryEmoji = (cat: string) => CATEGORY_EMOJIS[cat] || '💰';

export default function SettingsPage() {
  const { accountBooks, addAccountBook, deleteAccountBook, saveSetting, getSetting, updateTransactions } = useApp();
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📒');
  const [newColor, setNewColor] = useState('#534AB7');

  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const alertEnabledSetting = useLiveQuery(() => db.settings.get('alertEnabled'));
  const alertStyleSetting = useLiveQuery(() => db.settings.get('alertStyle'));
  const budgetThresholdSetting = useLiveQuery(() => db.settings.get('budgetThreshold'));

  const budgetEnabled = alertEnabledSetting?.value !== 'false';
  const alertStyle = alertStyleSetting?.value || 'strict';
  const budgetThreshold = budgetThresholdSetting?.value || '80';

  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthTransactions = useLiveQuery(
    () => db.transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense')
      .toArray()
  ) || [];

  const getSpentForCategory = useCallback((category: string) => {
    return currentMonthTransactions
      .filter(t => t.category === category)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [currentMonthTransactions]);

  const handleAddNewBudget = async () => {
    const limit = parseInt(newBudgetLimit);
    if (!newBudgetCategory.trim() || isNaN(limit) || limit < 0) return;
    await db.budgets.add({ category: newBudgetCategory.trim(), limit, period: 'monthly', accountBook: 'default' });
    setNewBudgetCategory('');
    setNewBudgetLimit('');
  };

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [weeklyTime, setWeeklyTime] = useState(getWeeklyReportTime());
  const [budgetAlertEnabled, setBudgetAlertEnabled] = useState(true);
  const [notifSupport, setNotifSupport] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown');

  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [themeColor, setThemeColor] = useState<ThemeColor>('purple');
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [editingRule, setEditingRule] = useState<{ keyword: string; category: string } | null>(null);
  const [editKeyword, setEditKeyword] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    getCategoryRules().then((rules) => setCategoryRules(rules));
  }, []);

  useEffect(() => {
    loadThemeFromDB().then(({ mode, color }) => {
      setThemeMode(mode);
      setThemeColor(color);
    });

    let dispose: (() => void) | null = null;
    if (typeof window !== 'undefined') {
      dispose = onSystemColorChange(() => {
        if (themeMode === 'system') {
          applyTheme('system', themeColor);
        }
      });
    }
    return () => dispose?.();
  }, [themeMode, themeColor]);

  const handleSaveNotifSettings = () => {
    const settings = { enabled: notifEnabled, weeklyReportTime: weeklyTime, budgetAlertEnabled };
    localStorage.setItem('notif_settings', JSON.stringify(settings));
    setWeeklyReportTime(weeklyTime);
  };

  const handleToggleNotif = async () => {
    if (!notifEnabled) {
      const result = await requestPermission();
      if (result !== 'granted') {
        setNotifSupport(result);
        return;
      }
    }
    const next = !notifEnabled;
    setNotifEnabled(next);
    handleSaveNotifSettings();
  };

  const handleToggleBudgetAlert = () => {
    const next = !budgetAlertEnabled;
    setBudgetAlertEnabled(next);
    handleSaveNotifSettings();
  };

  const handleThemeChange = useCallback(async (mode: ThemeMode, color: ThemeColor) => {
    setThemeMode(mode);
    setThemeColor(color);
    applyTheme(mode, color);
    await saveThemeToDB(mode, color);
  }, []);

  const startEditRule = (rule: CategoryRule) => {
    setEditingRule(rule);
    setEditKeyword(rule.keyword);
    setEditCategory(rule.category);
  };

  const saveRule = async () => {
    if (!editingRule || !editKeyword.trim() || !editCategory.trim()) return;
    const { removeCategoryRule: removeRule, getCategoryRules: getRules } = await import('../lib/categoryLearner');
    await removeRule(editingRule.keyword);
    const updated = await getRules();
    setCategoryRules(updated);
    setEditingRule(null);
  };

  const deleteRule = async (keyword: string) => {
    const { removeCategoryRule: removeRule, getCategoryRules: getRules } = await import('../lib/categoryLearner');
    await removeRule(keyword);
    setCategoryRules(await getRules());
  };

  const clearAllRules = async () => {
    if (!confirm('确定清空所有学习记录？')) return;
    const { clearCategoryRules: clear, getCategoryRules: getRules } = await import('../lib/categoryLearner');
    await clear();
    setCategoryRules(await getRules());
  };

  const handleExportCSV = async () => {
    const { db } = await import('../lib/db');
    const allTx = await db.transactions.toArray();
    if (allTx.length === 0) {
      alert('没有可以导出的账单数据哦～');
      return;
    }
    const headers = ['ID', '日期', '收支类型', '分类', '金额', '账本', '备注'];
    const rows = allTx.map(tx => [
      tx.id,
      tx.date,
      tx.type === 'expense' ? '支出' : '收入',
      tx.category,
      tx.amount.toFixed(2),
      tx.accountBook,
      tx.note || ''
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');
    
    // Add BOM for Excel UTF-8 compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `记账数据导出_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const colors = ['#534AB7', '#ec4899', '#f97316', '#eab308', '#1D9E75', '#14b8a6', '#06b6d4', '#3b82f6'];
  const icons = ['📒', '💰', '💳', '🏦', '📱', '🪙', '💎', '🧮', '🗂️', '📋'];

  const handleAddBook = () => {
    if (!newName.trim()) return;
    addAccountBook({ name: newName.trim(), icon: newIcon, color: newColor });
    setNewName('');
  };

  const handleToggleBudget = async () => {
    await db.settings.put({ key: 'alertEnabled', value: String(!budgetEnabled) });
  };

  const handleStyleChange = async (style: string) => {
    await db.settings.put({ key: 'alertStyle', value: style });
  };

  const handleThresholdChange = async (val: string) => {
    await db.settings.put({ key: 'budgetThreshold', value: val });
  };

  const startEditBudget = (category: string, limit: number) => {
    setEditingCategory(category);
    setEditValue(String(limit));
  };

  const saveBudgetLimit = async (category: string, id?: number) => {
    const val = parseInt(editValue);
    if (isNaN(val) || val <= 0) return;
    if (id) {
      await db.budgets.update(id, { limit: val });
    } else {
      await db.budgets.add({ category, limit: val, period: 'monthly', accountBook: 'default' });
    }
    setEditingCategory(null);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const SettingRow = ({ icon, title, section, isLast }: { icon: React.ReactNode, title: string, section: string, isLast?: boolean }) => {
    const isExpanded = expandedSection === section;
    return (
      <button
        onClick={() => toggleSection(section)}
        className={`w-full flex items-center justify-between px-[20px] py-[16px] bg-bg-primary hover:bg-bg-secondary transition-colors ${!isLast && !isExpanded ? 'border-b border-border-default' : ''}`}
      >
        <div className="flex items-center gap-[16px]">
          <div className="w-[32px] h-[32px] rounded-[10px] bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
          <span className="text-[14px] text-text-primary">{title}</span>
        </div>
        {isExpanded ? <ChevronDown className="w-5 h-5 text-text-tertiary" /> : <ChevronRight className="w-5 h-5 text-text-tertiary" />}
      </button>
    );
  };

  const handleClearAllData = async () => {
    if (!window.confirm('⚠️ 警告：这将彻底清除您所有的账单记录（此操作不可逆），确定要清空吗？')) return;
    try {
      const { db } = await import('../lib/db');
      await db.transactions.clear();
      await updateTransactions();
      alert('账单记录已全部清空！');
    } catch (err) {
      alert('清空失败：' + (err as Error).message);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-tertiary overflow-y-auto pb-[100px]">
      <div className="px-[20px] py-[20px]">
        <h1 className="text-[24px] font-medium text-text-primary mb-[24px]">设置</h1>

        {/* Group 1 */}
        <div className="bg-bg-primary rounded-card overflow-hidden shadow-sm mb-[24px]">
          <SettingRow icon={<Palette className="w-4 h-4" />} title="外观主题" section="theme" />
          {expandedSection === 'theme' && (
            <div className="px-[20px] pb-[16px] bg-bg-secondary border-b border-border-default space-y-4 pt-[8px]">
              <div>
                <p className="text-[12px] text-text-secondary mb-2">显示模式</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'light' as ThemeMode, icon: <Sun className="w-4 h-4" />, label: '浅色' },
                    { value: 'dark' as ThemeMode, icon: <Moon className="w-4 h-4" />, label: '深色' },
                    { value: 'system' as ThemeMode, icon: <Monitor className="w-4 h-4" />, label: '系统' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => handleThemeChange(item.value, themeColor)}
                      className={`flex flex-col items-center gap-1.5 py-2 rounded-button transition-colors ${themeMode === item.value
                          ? 'bg-primary text-white'
                          : 'bg-bg-primary text-text-secondary'
                        }`}
                    >
                      {item.icon}
                      <span className="text-[12px] font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[12px] text-text-secondary mb-2">主题色</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(THEME_COLORS) as [ThemeColor, typeof THEME_COLORS.purple][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => handleThemeChange(themeMode, key)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-button transition-colors ${themeColor === key
                          ? 'bg-primary/10 border border-primary/30'
                          : 'bg-bg-primary border border-border-default'
                        }`}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.primary }} />
                      <span className={`text-[12px] font-medium ${themeColor === key ? 'text-primary' : 'text-text-secondary'}`}>
                        {key === 'purple' ? '经典紫' : key === 'green' ? '清新绿' : '活力橙'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <SettingRow icon={<Bell className="w-4 h-4" />} title="推送通知" section="notif" />
          {expandedSection === 'notif' && (
            <div className="px-[20px] py-[16px] bg-bg-secondary border-b border-border-default space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-text-primary">允许通知</span>
                <button
                  onClick={handleToggleNotif}
                  className={`w-10 h-6 rounded-full transition-colors relative ${notifEnabled ? 'bg-primary' : 'bg-border-strong'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${notifEnabled ? 'translate-x-4' : ''}`} />
                </button>
              </div>
              {notifEnabled && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[14px] text-text-primary">每周报告时间</span>
                  <input
                    type="time"
                    value={weeklyTime}
                    onChange={(e) => {
                      setWeeklyTime(e.target.value);
                      handleSaveNotifSettings();
                    }}
                    className="bg-bg-primary text-[14px] text-text-primary px-3 py-1 rounded-[6px] outline-none"
                  />
                </div>
              )}
            </div>
          )}

          <SettingRow icon={<Shield className="w-4 h-4" />} title="预算预警" section="budget" />
          {expandedSection === 'budget' && (
            <div className="px-[20px] py-[16px] bg-bg-secondary border-b border-border-default space-y-4">
              <div className="flex items-center justify-between border-b border-border-default pb-4">
                <span className="text-[14px] text-text-primary">启用预算预警</span>
                <button
                  onClick={handleToggleBudget}
                  className={`w-10 h-6 rounded-full transition-colors relative ${budgetEnabled ? 'bg-primary' : 'bg-border-strong'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${budgetEnabled ? 'translate-x-4' : ''}`} />
                </button>
              </div>

              {budgetEnabled && (
                <div className="space-y-4 pt-2">
                  {/* 触发阈值 */}
                  <div>
                    <p className="text-[14px] text-text-primary mb-3">触发阈值</p>
                    <div className="flex gap-2">
                      {['70', '80', '90'].map(val => (
                        <button
                          key={val}
                          onClick={() => handleThresholdChange(val)}
                          className={`flex-1 py-1.5 rounded-[8px] text-[14px] font-medium transition-colors ${
                            budgetThreshold === val
                              ? 'bg-primary text-white'
                              : 'bg-bg-primary text-text-secondary border border-border-default'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 预警风格选择 */}
                  <div>
                    <p className="text-[14px] text-text-primary mb-3">警报风格</p>
                    <div className="grid grid-cols-2 gap-3">
                      {BUDGET_STYLES.map((style) => (
                        <button
                          key={style.value}
                          onClick={() => handleStyleChange(style.value)}
                          className={`flex flex-col items-start p-3 rounded-[12px] border transition-all text-left ${
                            alertStyle === style.value
                              ? 'bg-primary/10 border-primary shadow-sm'
                              : 'bg-bg-primary border-border-default hover:bg-bg-secondary'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg leading-none">{style.emoji}</span>
                            <span className={`text-[14px] font-medium ${
                              alertStyle === style.value ? 'text-primary' : 'text-text-primary'
                            }`}>
                              {style.label}
                            </span>
                          </div>
                          <p className="text-[12px] text-text-secondary leading-snug">{style.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 预警类目及额度设置 */}
                  <div>
                    <p className="text-[14px] text-text-primary mb-2">预警类目与额度</p>
                    <div className="bg-white rounded-[14px] border border-border-default overflow-hidden">
                      {/* 输入区 */}
                      <div className="p-3 border-b border-border-default/50">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="分类名称，如：餐饮"
                            value={newBudgetCategory}
                            onChange={(e) => setNewBudgetCategory(e.target.value)}
                            className="flex-[1.5] px-3 h-10 bg-bg-secondary rounded-[10px] text-[14px] text-text-primary outline-none placeholder:text-text-tertiary min-w-0"
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="月限额"
                            value={newBudgetLimit}
                            onChange={(e) => setNewBudgetLimit(e.target.value)}
                            className="flex-1 px-3 h-10 bg-bg-secondary rounded-[10px] text-[14px] text-text-primary outline-none placeholder:text-text-tertiary min-w-0"
                          />
                          <button
                            onClick={handleAddNewBudget}
                            disabled={!newBudgetCategory.trim() || !newBudgetLimit.trim()}
                            className="w-[72px] h-10 rounded-[10px] bg-primary text-white text-[14px] font-medium flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed touch-active"
                          >
                            + 添加
                          </button>
                        </div>
                      </div>

                      {/* 表头 */}
                      <div className="bg-[#F1EFE8] h-8 flex items-center px-4 text-[12px] text-text-secondary">
                        <div className="flex-[3]">分类</div>
                        <div className="flex-[2]">月限额</div>
                        <div className="flex-[2]">已用</div>
                        <div className="flex-[1] text-center">操作</div>
                      </div>

                      {/* 列表 */}
                      {budgets.length === 0 ? (
                        <div className="h-[80px] flex items-center justify-center text-[13px] text-text-tertiary border-t border-border-default/50">
                          暂无预警设置，在上方添加分类
                        </div>
                      ) : (
                        <div className="flex flex-col border-t border-border-default/50">
                          {budgets.map((b, idx) => {
                            const spent = getSpentForCategory(b.category);
                            const isOver = spent > b.limit;
                            return (
                              <div key={b.id} className={`h-[48px] flex items-center px-4 ${idx !== budgets.length - 1 ? 'border-b border-border-default border-opacity-50' : ''}`}>
                                <div className="flex-[3] flex items-center gap-2 overflow-hidden pr-2">
                                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[14px] flex-shrink-0">
                                    {getCategoryEmoji(b.category)}
                                  </div>
                                  <span className="text-[14px] text-text-primary truncate">{b.category}</span>
                                </div>
                                <div className="flex-[2] text-[14px] font-medium text-primary truncate pr-1">
                                  ¥{b.limit}
                                </div>
                                <div className={`flex-[2] text-[14px] font-medium truncate pr-1 ${isOver ? 'text-danger' : 'text-success'}`}>
                                  ¥{spent.toFixed(0)}
                                </div>
                                <div className="flex-[1] flex justify-center">
                                  <button
                                    onClick={async () => {
                                      if(window.confirm(`确定要删除「${b.category}」的预算预警吗？`)) {
                                        if (b.id) await db.budgets.delete(b.id);
                                      }
                                    }}
                                    className="w-[28px] h-[28px] flex items-center justify-center rounded-[8px] border border-border-default text-text-tertiary hover:bg-danger/10 hover:border-transparent hover:text-danger transition-colors touch-active"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <SettingRow icon={<Brain className="w-4 h-4" />} title="智能分类学习" section="learning" />
          {expandedSection === 'learning' && (
            <div className="px-[20px] py-[16px] bg-bg-secondary border-b border-border-default">
              {categoryRules.length === 0 ? (
                <p className="text-[12px] text-text-tertiary">暂无学习记录</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {categoryRules.map((rule) => (
                    <div key={rule.keyword} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] text-text-primary">{rule.keyword}</span>
                        <span className="text-text-tertiary text-xs">→</span>
                        <span className="text-[14px] text-primary">{rule.category}</span>
                      </div>
                      <button onClick={() => deleteRule(rule.keyword)} className="p-1 text-text-tertiary hover:text-danger">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <SettingRow icon={<Plus className="w-4 h-4" />} title="账本管理" section="books" isLast />
          {expandedSection === 'books' && (
            <div className="px-[20px] py-[16px] bg-bg-secondary space-y-4 rounded-b-card">
              <div className="space-y-2">
                {accountBooks.map((book) => (
                  <div key={book.id} className="flex items-center justify-between p-3 bg-bg-primary rounded-[10px]">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{book.icon}</span>
                      <span className="text-[14px] text-text-primary">{book.name}</span>
                    </div>
                    {accountBooks.length > 1 && (
                      <button onClick={() => book.id && deleteAccountBook(book.id)} className="p-1 text-text-tertiary hover:text-danger">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="新账本名称"
                  className="flex-1 px-3 py-2 bg-bg-primary rounded-[10px] text-[14px] text-text-primary outline-none"
                />
                <button
                  onClick={handleAddBook}
                  disabled={!newName.trim()}
                  className="px-4 py-2 bg-primary text-white rounded-[10px] text-[14px] disabled:opacity-50 touch-active"
                >
                  添加
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Group 2 (Danger) */}
        <div className="bg-bg-primary rounded-card overflow-hidden shadow-sm mb-[40px]">
          <button 
            onClick={handleExportCSV}
            className="w-full h-[56px] flex items-center justify-center text-[14px] text-primary hover:bg-bg-secondary transition-colors font-medium border-b border-border-default gap-2"
          >
            <Download className="w-4 h-4" />
            导出所有账单 (CSV)
          </button>
          <button 
            onClick={handleClearAllData}
            className="w-full h-[56px] flex items-center justify-center text-[14px] text-danger hover:bg-bg-secondary transition-colors font-medium touch-active"
          >
            清除所有数据
          </button>
        </div>

        {/* Version */}
        <p className="text-center text-[12px] text-text-tertiary">Version 1.0.0</p>
      </div>
    </div>
  );
}
