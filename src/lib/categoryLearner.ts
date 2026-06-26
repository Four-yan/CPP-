/**
 * 智能分类学习器
 * 记录用户确认的"关键词→分类"映射，加速后续解析
 */

import { db } from '../lib/db';
import type { ParsedTransaction } from './ai';

const RULES_KEY = 'categoryRules';

export interface CategoryRule {
  keyword: string;
  category: string;
}

/** 从 IndexedDB 读取所有分类规则 */
export async function getCategoryRules(): Promise<CategoryRule[]> {
  try {
    const setting = await db.settings.where('key').equals(RULES_KEY).first();
    if (!setting?.value) return [];
    return JSON.parse(setting.value) as CategoryRule[];
  } catch {
    return [];
  }
}

/** 保存分类规则到 IndexedDB */
async function saveCategoryRules(rules: CategoryRule[]): Promise<void> {
  await db.settings.put({ key: RULES_KEY, value: JSON.stringify(rules) });
}

/** 添加一条规则（去重） */
export async function addCategoryRule(keyword: string, category: string): Promise<CategoryRule[]> {
  const rules = await getCategoryRules();
  const idx = rules.findIndex((r) => r.keyword.toLowerCase() === keyword.toLowerCase());
  if (idx >= 0) {
    rules[idx].category = category;
  } else {
    rules.push({ keyword: keyword.trim(), category });
  }
  await saveCategoryRules(rules);
  return rules;
}

/** 删除一条规则 */
export async function removeCategoryRule(keyword: string): Promise<CategoryRule[]> {
  const rules = await getCategoryRules();
  const filtered = rules.filter((r) => r.keyword.toLowerCase() !== keyword.toLowerCase());
  await saveCategoryRules(filtered);
  return filtered;
}

/** 清空所有规则 */
export async function clearCategoryRules(): Promise<CategoryRule[]> {
  await saveCategoryRules([]);
  return [];
}

/**
 * 根据规则匹配分类
 * 优先匹配最长关键词（避免 "咖啡" 匹配到 "拿铁咖啡" 的子串）
 */
export function matchCategory(text: string): CategoryRule | null {
  const rules = getCategoryRulesSync();
  if (!rules.length) return null;

  const lower = text.toLowerCase();
  let best: CategoryRule | null = null;
  let longestLen = 0;

  for (const rule of rules) {
    if (lower.includes(rule.keyword.toLowerCase()) && rule.keyword.length > longestLen) {
      best = rule;
      longestLen = rule.keyword.length;
    }
  }

  return best;
}

/** 同步缓存的规则列表（首次加载后缓存） */
let cachedRules: CategoryRule[] = [];
let cacheLoaded = false;

/** 异步初始化规则缓存 */
export async function initCategoryRulesCache(): Promise<void> {
  cachedRules = await getCategoryRules();
  cacheLoaded = true;
}

/** 同步获取缓存的规则（需先调用 initCategoryRulesCache） */
function getCategoryRulesSync(): CategoryRule[] {
  if (!cacheLoaded) return [];
  return cachedRules;
}

/**
 * 在 parseTransaction 之前调用，用本地规则快速匹配
 * 如果匹配成功，返回 ParsedTransaction（带 _fromCache 标记）
 */
export async function tryMatchFromRules(text: string): Promise<(ParsedTransaction & { _fromRules: true }) | null> {
  if (!cacheLoaded) await initCategoryRulesCache();

  const rule = matchCategory(text);
  if (!rule) return null;

  // 从文本中提取金额
  const amountMatch = text.match(/(\d+\.?\d*)/);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1]);
  if (amount <= 0) return null;

  // 判断收入/支出
  const incomeKeywords = ['工资', '薪水', '奖金', '提成', '补贴', '兼职', '副业', '理财', '基金', '股票', '利息', '分红'];
  const isIncome = incomeKeywords.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));

  return {
    amount,
    type: isIncome ? 'income' : 'expense',
    category: rule.category,
    note: text.replace(amountMatch[0], '').trim() || rule.keyword,
    date: new Date().toISOString().split('T')[0],
    _fromRules: true,
  };
}

/**
 * 用户确认账单后，自动学习关键词→分类映射
 */
export async function learnFromTransaction(text: string, parsed: ParsedTransaction): Promise<void> {
  // 提取文本中的关键词（去掉金额和常见数字）
  const cleaned = text.replace(/(\d+\.?\d*)/g, '').replace(/[，,.!！？\s]/g, '').trim();
  if (!cleaned || cleaned.length < 1) return;

  const rules = await getCategoryRules();
  // 检查是否已有该关键词规则
  const exists = rules.some((r) => r.keyword.toLowerCase() === cleaned.toLowerCase());
  if (!exists) {
    rules.push({ keyword: cleaned, category: parsed.category });
    await saveCategoryRules(rules);
    // 更新缓存
    if (cacheLoaded) cachedRules = rules;
  }
}
