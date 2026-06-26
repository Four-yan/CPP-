/** AI 从图片中识别出的账单信息 */
export interface RecognizedReceipt {
  amount: number;
  merchant: string;
  date: string;
  items: string[];
}

/** 图片识别结果（可能是错误） */
export type ImageParseResult = RecognizedReceipt | { error: string };

const AGENTS_API_BASE = 'https://apihub.agnes-ai.com/v1';
const MODEL_NAME = 'agnes-2.0-flash';
const API_KEY = import.meta.env.VITE_AGENTS_API_KEY || '';

const IMAGE_RECOGNITION_PROMPT = `这是一张账单/收据/支付截图。请识别其中的消费信息并返回 JSON：
{
  "amount": 总金额数字,
  "merchant": "商家名称",
  "date": "日期 YYYY-MM-DD",
  "items": ["商品1", "商品2"]
}

如果图片中没有清晰的消费信息，返回：{ "error": "无法识别消费信息" }
只返回 JSON，不要其他内容。`;

/**
 * 将图片文件转为 base64（data URL）
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 压缩图片 — 避免 base64 过大导致 API 超限
 */
function compressImage(base64: string, maxDimension = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

/**
 * 调用 AI Vision 识别图片中的消费信息
 */
export async function recognizeReceipt(imageFile: File): Promise<ImageParseResult> {
  try {
    let base64 = await fileToBase64(imageFile);
    base64 = await compressImage(base64);

    const response = await fetch(`${AGENTS_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: IMAGE_RECOGNITION_PROMPT },
              { type: 'image_url', image_url: { url: base64 } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';

    // 提取 JSON
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          json = JSON.parse(match[0]);
        } catch {
          /* ignore */
        }
      }
    }

    if (json?.error) {
      return { error: json.error as string };
    }

    if (
      json &&
      typeof json.amount === 'number' &&
      json.amount > 0
    ) {
      return {
        amount: json.amount,
        merchant: (json.merchant as string) || '未知商家',
        date: (json.date as string) || new Date().toISOString().split('T')[0],
        items: Array.isArray(json.items)
          ? (json.items as string[]).filter(Boolean)
          : [],
      };
    }

    return { error: '未能从图片中识别到消费信息' };
  } catch {
    return { error: '识别失败，请重试或手动输入' };
  }
}
