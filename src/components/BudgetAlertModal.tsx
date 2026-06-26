import { useEffect, useState } from 'react';
import type { BudgetAlert } from '../hooks/useBudgetAlert';

interface Props {
  alert: BudgetAlert | null;
  style: 'gentle' | 'normal' | 'strict' | 'funny' | string;
  onClose: () => void;
}

// 四种风格文案生成
function getMessage(alert: BudgetAlert, style: string): { title: string; body: string; emoji: string } {
  const { category, spent, limit, percentage, isOver } = alert;
  const spentStr = `¥${spent.toFixed(0)}`;
  const limitStr = `¥${limit.toFixed(0)}`;

  if (style === 'gentle') return {
    emoji: '🥺',
    title: isOver ? `${category}预算超啦！` : `${category}快到预算了`,
    body: isOver
      ? `宝贝，${category}已花了 ${spentStr}，超出预算 ${limitStr} 了，下次省着点哦～`
      : `宝贝，${category}预算已用了 ${percentage}%（${spentStr}/${limitStr}），省着点哦 🥺`
  };

  if (style === 'normal') return {
    emoji: '⚠️',
    title: `${category}预算提醒`,
    body: isOver
      ? `${category}本月已支出 ${spentStr}，超出预算 ${limitStr}，请注意控制消费。`
      : `⚠️ ${category}消费已达预算的 ${percentage}%（${spentStr}/${limitStr}），注意控制。`
  };

  if (style === 'strict') return {
    emoji: '🚨',
    title: isOver ? '超支警告！！' : '快超了警告！',
    body: isOver
      ? `🚨 你个败家玩意！${category}已经花了 ${spentStr}，预算才 ${limitStr}，给我住手！`
      : `🚨 你个败家玩意！${category}快花超了！已用 ${percentage}%，再乱花揍你！`
  };

  // funny
  return {
    emoji: '💀',
    title: isOver ? '钱包：我死了' : '钱包：我撑不住了',
    body: isOver
      ? `💀 钱包已阵亡！${category}花了 ${spentStr}，预算 ${limitStr} 早就没了，主人你咋这样！`
      : `💀 钱包：我撑不住了... ${category}已燃烧 ${percentage}%（${spentStr}/${limitStr}），求你别花了！`
  };
}

export default function BudgetAlertModal({ alert, style, onClose }: Props) {
  const [shake, setShake] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (alert) {
      setVisible(true);
      // 入场后触发抖动
      const t1 = setTimeout(() => setShake(true), 300);
      const t2 = setTimeout(() => setShake(false), 1000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      setVisible(false);
    }
  }, [alert]);

  if (!alert) return null;

  const { title, body, emoji } = getMessage(alert, style);
  const isOver = alert.isOver;

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '32px 24px 24px',
          maxWidth: '340px',
          width: '100%',
          textAlign: 'center',
          transform: shake ? 'none' : visible ? 'scale(1)' : 'scale(0.8)',
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          animation: shake ? 'budgetShake 0.5s ease' : 'none',
          border: isOver ? '2px solid #E24B4A' : '2px solid #EF9F27',
        }}
      >
        {/* emoji 大图标 */}
        <div style={{ fontSize: '56px', marginBottom: '12px', lineHeight: 1 }}>
          {emoji}
        </div>

        {/* 进度环 */}
        <div style={{ margin: '0 auto 16px', position: 'relative', width: '80px', height: '80px' }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#F1EFE8" strokeWidth="8"/>
            <circle
              cx="40" cy="40" r="34" fill="none"
              stroke={isOver ? '#E24B4A' : alert.percentage >= 80 ? '#EF9F27' : '#534AB7'}
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - Math.min(alert.percentage, 100) / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 600,
            color: isOver ? '#E24B4A' : '#534AB7'
          }}>
            {Math.min(alert.percentage, 999)}%
          </div>
        </div>

        {/* 标题 */}
        <div style={{
          fontSize: '18px', fontWeight: 600,
          color: isOver ? '#E24B4A' : '#1A1A1A',
          marginBottom: '10px'
        }}>
          {title}
        </div>

        {/* 正文 */}
        <div style={{
          fontSize: '14px', color: '#6B6A66',
          lineHeight: 1.6, marginBottom: '24px'
        }}>
          {body}
        </div>

        {/* 按钮 */}
        <button
          onClick={handleClose}
          style={{
            width: '100%', padding: '12px',
            borderRadius: '12px',
            background: isOver ? '#E24B4A' : '#534AB7',
            color: 'white', border: 'none',
            fontSize: '15px', fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          {isOver ? '知道了，我会克制的' : '好的，注意了'}
        </button>

        {/* 自动关闭提示 */}
        <div style={{ fontSize: '12px', color: '#A09F9B', marginTop: '10px' }}>
          点击任意处关闭
        </div>
      </div>

      {/* 抖动动画 keyframes */}
      <style>{`
        @keyframes budgetShake {
          0%,100%{transform:translateX(0) scale(1)}
          15%{transform:translateX(-8px) scale(1.02)}
          30%{transform:translateX(8px) scale(1.02)}
          45%{transform:translateX(-6px) scale(1.01)}
          60%{transform:translateX(6px) scale(1.01)}
          75%{transform:translateX(-3px)}
          90%{transform:translateX(3px)}
        }
      `}</style>
    </div>
  );
}
