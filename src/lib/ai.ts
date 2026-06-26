/* ==================== 类型定义 ==================== */

import type { Transaction } from '../types';
import { tryMatchFromRules } from './categoryLearner';

export interface ParsedTransaction {
  amount: number;
  type: 'expense' | 'income';
  category: string;
  note: string;
  date: string;
}

export type ParseResult = ParsedTransaction[];

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | any[];
}

export type BudgetStyle = 'gentle' | 'strict' | 'funny';

/* ==================== 配置 ==================== */

const AGENTS_API_BASE = 'https://apihub.agnes-ai.com/v1';
const MODEL_NAME = 'agnes-2.0-flash';
const API_KEY = import.meta.env.VITE_AGENTS_API_KEY || '';

const PARSE_SYSTEM_PROMPT = `你是一个记账助手。用户用自然语言描述一笔或多笔账单，你需要解析并返回 JSON 数组。

规则：
- 一句话可能包含多笔账，必须分别识别，每笔单独一个对象
- 金额必须是数字类型，不能是字符串
- type 判断：含"花了/买了/付了/消费/支出"等 → expense；含"工资/收入/收到/到账/兼职"等 → income
- category 从以下选择：餐饮/交通/购物/娱乐/医疗/工资/兼职/理财/其他
- note 简短描述这笔账，不超过10个字
- date 默认今天：{today}

返回格式（只返回 JSON 数组，不要任何其他内容）：
[
  { "amount": 200, "type": "expense", "category": "餐饮", "note": "吃饭", "date": "{today}" },
  { "amount": 4000, "type": "income", "category": "工资", "note": "本月工资", "date": "{today}" }
]

如果完全无法理解，返回：
[{ "error": "无法理解，请重新描述" }]`;

const CHAT_SYSTEM_PROMPT = (context: string) =>
  `你是一个贴心的个人财务助理，说话风格亲切幽默，偶尔可以开玩笑。
用户的财务数据：${context}
帮助用户分析消费、提供建议、回答财务问题。
回复简洁，不超过100字。`;

const BUDGET_SYSTEM_PROMPT = (style: BudgetStyle) => {
  const prompts: Record<BudgetStyle, string> = {
    gentle: '你是一个温柔的财务助手，用温和提醒的语气告诉用户超支风险。',
    strict: '你是一个严厉的财务管家，用严肃甚至带点威胁的语气警告用户注意预算。',
    funny: '你是一个搞笑的财务助手，用段子、表情包风格的语言提醒用户别乱花钱。',
  };
  return prompts[style];
};

/* ==================== 核心函数 ==================== */

/**
 * 调用 Agents AI API 解析自然语言为交易记录
 * 失败时优雅降级为本地 mock 解析
 */
export async function parseTransaction(text: string): Promise<ParsedTransaction[]> {
  // 0. 先尝试本地规则匹配（省钱！）
  const ruleResult = await tryMatchFromRules(text);
  if (ruleResult) {
    return [{
      amount: ruleResult.amount,
      type: ruleResult.type,
      category: ruleResult.category,
      note: ruleResult.note,
      date: ruleResult.date,
    }];
  }

  // 1. 先尝试调用 AI API
  try {
    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = PARSE_SYSTEM_PROMPT.replace(/\{today\}/g, today);
    const result = await callAgentsAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ]);

    const parsed = parseJsonFromResponse(result);
    if (Array.isArray(parsed)) {
      if (parsed[0]?.error) {
        throw new Error(parsed[0].error);
      }
      
      const transactions = parsed.map(json => {
        if (typeof json.amount !== 'number' || json.amount <= 0) {
          throw new Error('解析的金额不合法');
        }
        let finalType: 'expense' | 'income' = 'expense';
        const rawType = String(json.type).toLowerCase();
        if (rawType === 'income' || rawType === '收入') {
          finalType = 'income';
        }

        let finalDate = todayISO();
        if (typeof json.date === 'string') {
          const parsedDate = new Date(json.date);
          if (!isNaN(parsedDate.getTime())) {
            finalDate = parsedDate.toISOString().split('T')[0];
          }
        }

        return {
          amount: json.amount,
          type: finalType,
          category: (json.category as string) || '其他',
          note: (json.note as string) || '',
          date: finalDate,
        };
      });
      return transactions;
    }
  } catch (err) {
    if (err instanceof Error && err.message !== '解析的金额不合法' && err.message !== 'Agents API error: 401') {
      // API 解析过程中的业务错误，直接抛出
      throw err;
    }
    // 降级到 mock
  }

  // 2. Mock 降级解析
  return mockParseTransaction(text);
}

/**
 * 传入图片 Base64，调用 Vision API 解析账单
 */
export async function parseTransactionFromImage(base64Image: string): Promise<ParsedTransaction[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = PARSE_SYSTEM_PROMPT.replace(/\{today\}/g, today);
    const result = await callAgentsAPI([
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: [
          { type: 'text', text: '请解析这张账单截图中的金额和消费分类，按照系统要求的 JSON 格式返回。如果不是账单，返回 error。' },
          { type: 'image_url', image_url: { url: base64Image } }
        ]
      },
    ]);

    const parsed = parseJsonFromResponse(result);
    if (Array.isArray(parsed)) {
      if (parsed[0]?.error) throw new Error(parsed[0].error);
      
      const transactions = parsed.map(json => {
        let finalType: 'expense' | 'income' = 'expense';
        const rawType = String(json.type).toLowerCase();
        if (rawType === 'income' || rawType === '收入') finalType = 'income';

        let finalDate = todayISO();
        if (typeof json.date === 'string') {
          const parsedDate = new Date(json.date);
          if (!isNaN(parsedDate.getTime())) finalDate = parsedDate.toISOString().split('T')[0];
        }

        return {
          amount: json.amount,
          type: finalType,
          category: (json.category as string) || '其他',
          note: (json.note as string) || '图片账单',
          date: finalDate,
        };
      });
      return transactions;
    }
  } catch (err) {
    if (err instanceof Error) throw err;
  }
  throw new Error('抱歉，目前图片识别失败或您的模型不支持视觉功能。');
}

/**
 * 通用聊天函数
 * @param messages 历史消息
 * @param context 账单上下文摘要
 * @param transactions 最近交易记录（用于问答）
 */
export async function chat(
  messages: ChatMessage[],
  context: string = '暂无数据',
  transactions?: Transaction[],
): Promise<string> {
  // 检测是否为特殊命令
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (lastUserMsg && typeof lastUserMsg.content === 'string') {
    const cmdResult = handleCommands(lastUserMsg.content, transactions);
    if (cmdResult) return cmdResult;
  }

  const fullMessages: ChatMessage[] = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT(context) },
    ...messages,
  ];

  try {
    if (!API_KEY) {
      return '抱歉，本地环境缺失 API Key，请检查根目录下是否存在 .env 文件并配置了 VITE_AGENTS_API_KEY。';
    }
    return await callAgentsAPI(fullMessages);
  } catch (err) {
    console.error('AI API 调用失败:', err);
    return `抱歉，我现在有点忙，请稍后再试～ [系统原因: ${err instanceof Error ? err.message : String(err)}]`;
  }
}

/** 处理本地命令（不调用 AI，零成本） */
function handleCommands(text: string, transactions?: Transaction[]): string | null {
  if (!transactions || transactions.length === 0) return null;

  const t = text.trim();

  // "我上个月花了多少？" / "这个月花了多少？"
  if (/我?\s*(上\s*个|这\s*个|去\s*个)?\s*月\s*花\s*了\s*多少/i.test(t) || /本月支出/i.test(t)) {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const total = transactions
      .filter((tx) => {
        const d = new Date(tx.date);
        return tx.type === 'expense' && d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((s, tx) => s + tx.amount, 0);
    return `本月总支出 ¥${total.toFixed(2)}，共 ${transactions.filter((tx) => { const d = new Date(tx.date); return tx.type === 'expense' && d.getMonth() === month && d.getFullYear() === year; }).length} 笔。`;
  }

  // "帮我分析哪里花多了" / "消费分析"
  if (/分析|哪里花多|消费报告|账单分析/i.test(t)) {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthlyTx = transactions.filter((tx) => {
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

  // "把第N笔改成XX元" / "修改第X笔"
  const modifyMatch = /改\s*(第)?(\d+)\s*笔\s*.*(改|变成|变|改成|换)\s*钱?\s*(\d+\.?\d*)/.exec(t);
  if (modifyMatch) {
    const idx = parseInt(modifyMatch[2]) - 1;
    const newAmount = parseFloat(modifyMatch[4]);
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (idx >= 0 && idx < sorted.length) {
      return `找到第 ${idx + 1} 笔：${sorted[idx].category} ¥${sorted[idx].amount.toFixed(2)}（${sorted[idx].date}）\n请将金额改为 ¥${newAmount.toFixed(2)}。注意：修改功能需要在确认卡片中操作，我无法直接修改已记账的记录。`;
    }
    return `目前只有 ${sorted.length} 笔记录，找不到第 ${idx + 1} 笔哦。`;
  }

  // "昨天那笔外卖改成300元"
  const timeModifyMatch = /(\d+\s*(天前|天之前|周前|个月前))?.*?(外卖|打车|咖啡|奶茶|吃饭|购物|娱乐|医疗|居住|学习|交通)(.*)改.*(变成|变|改成|换)\s*(\d+\.?\d*)/.exec(t);
  if (timeModifyMatch) {
    const category = timeModifyMatch[3];
    const newAmount = parseFloat(timeModifyMatch[6]);
    const found = transactions
      .filter((tx) => tx.category === category)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (found.length > 0) {
      const tx = found[0];
      return `找到「${category}」记录：¥${tx.amount.toFixed(2)}（${tx.date}）\n请将金额改为 ¥${newAmount.toFixed(2)}。注意：修改功能需要在确认卡片中操作。`;
    }
    return `没有找到「${category}」相关的记录。`;
  }

  return null;
}

/**
 * 预算检查 — 调用 AI 生成个性化警告
 * @param category 支出分类
 * @param spent 已花费
 * @param limit 预算上限
 * @param style 风格（从设置读取）
 */
export async function checkBudget(
  category: string,
  spent: number,
  limit: number,
  style: BudgetStyle = 'gentle',
): Promise<string | null> {
  const ratio = spent / limit;
  if (ratio < 0.8) return null; // 未超 80%，不提醒

  const systemPrompt = BUDGET_SYSTEM_PROMPT(style);
  const userPrompt = `我在"${category}"上已经花了 ¥${spent.toFixed(2)}，预算是 ¥${limit.toFixed(2)}，用了 ${(ratio * 100).toFixed(0)}%。请给我一句个性化的提醒。`;

  try {
    const reply = await callAgentsAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    return reply;
  } catch {
    // 降级为静态文案
    return fallbackBudgetWarning(category, spent, limit, ratio, style);
  }
}

/* ==================== 月度总结 ==================== */

export interface MonthlySummaryData {
  totalExpense: number;
  totalIncome: number;
  balance: number;
  byCategory: Record<string, number>;
  prevMonthExpense: number;
  prevMonthIncome: number;
  topCategories: { name: string; amount: number; pct: number }[];
  note: string;
}

/** 调用 AI 生成月度消费分析总结 */
export async function generateMonthlySummary(
  data: MonthlySummaryData,
): Promise<string> {
  const prompt = `请根据以下月度财务数据生成一段简短的消费分析和建议（100-200字，口语化、亲切）：

总消费：¥${data.totalExpense.toFixed(2)}
总收入：¥${data.totalIncome.toFixed(2)}
结余：¥${data.balance.toFixed(2)}
上月消费：¥${data.prevMonthExpense.toFixed(2)}
上月收入：¥${data.prevMonthIncome.toFixed(2)}
主要支出分类：
${data.topCategories.map((c) => `- ${c.name}：¥${c.amount.toFixed(2)}（占比${c.pct.toFixed(1)}%）`).join('\n')}
备注：${data.note}

请直接输出分析文案，包含：1）总体消费评价 2）重点分类点评 3）一条实用理财建议。不要标题和问候语。`;

  try {
    const result = await callAgentsAPI([
      {
        role: 'system',
        content:
          '你是一个贴心的个人财务顾问，擅长用通俗易懂的语言分析消费数据并给出建议。语气亲切自然，像朋友聊天。',
      },
      { role: 'user', content: prompt },
    ]);
    return result.trim();
  } catch {
    return fallbackMonthlySummary(data);
  }
}

/* ==================== 内部实现 ==================== */

/** 调用 Agents AI API（OpenAI 兼容格式） */
async function callAgentsAPI(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${AGENTS_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`Agents API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/** 从 AI 响应中提取 JSON */
function parseJsonFromResponse(text: string): Record<string, unknown> | null {
  try {
    // 尝试直接解析
    return JSON.parse(text);
  } catch {
    // 尝试从 markdown code block 中提取
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

/** Mock 解析器 — API 失败时的降级方案 */
function mockParseTransaction(text: string): ParsedTransaction[] {
  const cleaned = text.replace(/[，,。.!！?？\s]+/g, ' ').trim();

  // 分类关键词映射
  const categoryMap: Record<string, string[]> = {
    餐饮: ['早餐', '午餐', '晚餐', '早饭', '午饭', '晚饭', '夜宵', '咖啡', '奶茶', '外卖', '吃饭', '吃', '快餐', '小吃', '零食', '水果', '买菜'],
    交通: ['地铁', '公交', '打车', '网约车', '出租车', '高铁', '火车', '机票', '加油', '停车', '出行', '共享单车'],
    购物: ['购物', '买东西', '淘宝', '京东', '快递', '超市', '便利店', '衣服', '鞋子', '包包', '化妆品', '日用品'],
    娱乐: ['电影', '游戏', '旅游', 'KTV', '按摩', '健身', '运动', '娱乐'],
    医疗: ['医疗', '看病', '买药', '挂号', '体检', '牙科'],
    居住: ['房租', '水电', '物业', '燃气', '网费', '话费', '装修', '家具'],
    学习: ['书', '课程', '培训', '教育', '学费'],
    工资: ['工资', '薪水', '奖金', '提成', '补贴'],
    兼职: ['兼职', '副业', '接单'],
    理财: ['理财', '基金', '股票', '利息', '分红', '收益'],
  };

  // 提取金额时，先排除掉日期相关的数字（比如：25号、6月），避免误判为金额
  const textWithoutDate = cleaned.replace(/\d+\s*(号|日|月|年)/g, '');
  const amountMatches = textWithoutDate.match(/(\d+\.?\d*)/g);
  
  if (!amountMatches || amountMatches.length === 0) {
    throw new Error('没看懂金额，再说清楚一点？');
  }

  // 构建多笔记录
  const results: ParsedTransaction[] = [];
  
  for (let i = 0; i < amountMatches.length; i++) {
    const amount = parseFloat(amountMatches[i]);
    if (amount <= 0) continue;
    
    // 我们用整个句子来找最高匹配的分类
    // 对于单个模型，可能不准，但这是 mock fallback，能做到这样已经很好了
    let type: 'expense' | 'income' = 'expense';
    const incomeKeys = ['工资', '兼职', '理财'];
    for (const key of incomeKeys) {
      if (categoryMap[key]?.some((kw) => cleaned.includes(kw))) {
        type = 'income';
        break;
      }
    }

    let matchedCategory = '其他';
    let longestLen = 0;
    for (const [cat, keywords] of Object.entries(categoryMap)) {
      if (type === 'income' && !incomeKeys.includes(cat)) continue;
      for (const kw of keywords) {
        if (cleaned.includes(kw) && kw.length > longestLen) {
          longestLen = kw.length;
          matchedCategory = cat;
        }
      }
    }

    results.push({
      amount,
      type,
      category: matchedCategory,
      note: text.replace(amountMatches[i], '').trim().substring(0, 10) || matchedCategory,
      date: todayISO(),
    });
  }

  if (results.length === 0) {
    throw new Error('未能识别到有效金额。');
  }

  return results;
}

/** 预算检查静态降级文案 */
function fallbackBudgetWarning(
  category: string,
  spent: number,
  limit: number,
  ratio: number,
  style: BudgetStyle,
): string {
  const remaining = limit - spent;
  switch (style) {
    case 'gentle':
      return `💕 温馨提醒：${category}已经花了 ¥${spent.toFixed(0)}，预算 ¥${limit.toFixed(0)}，还剩 ¥${remaining.toFixed(0)} 哦，要节约一点~`;
    case 'strict':
      return `🚨 ${category}已花 ¥${spent.toFixed(0)} / ¥${limit.toFixed(0)}！再花我就揍你屁股！`;
    case 'funny':
      return `😱 兄弟/姐妹，${category}都快把钱包掏空了！¥${spent.toFixed(0)} 啊！你的钱是大风刮来的吗？🌬️`;
  }
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** AI 不可用时的降级月度总结 */
function fallbackMonthlySummary(data: MonthlySummaryData): string {
  const top = data.topCategories[0];
  const expChange =
    data.prevMonthExpense > 0
      ? (((data.totalExpense - data.prevMonthExpense) / data.prevMonthExpense) * 100).toFixed(1)
      : '0';
  const arrow = parseFloat(expChange) > 0 ? '上升' : '下降';

  return `本月总支出 ¥${data.totalExpense.toFixed(2)}，较上月${arrow} ${Math.abs(parseFloat(expChange))}%。${top ? `最多支出是「${top.name}」，花了 ¥${top.amount.toFixed(2)}，占总支出 ${top.pct.toFixed(1)}%。` : ''}建议关注大额支出项，合理分配预算，每月存下收入的 20% 以上哦！`;
}
