# AI记账助手

基于 AI 的智能记账 PWA 应用 — 语音输入、截图识账、智能分类学习、深色模式。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/jizhang)

## 功能特性

- **AI 自然语言记账** — 说"午饭花了32块"即可自动记录
- **语音输入** — 长按麦克风按钮，实时识别中文
- **截图识账** — 上传账单截图，AI 自动识别金额和分类
- **智能分类学习** — 自动记忆"关键词→分类"映射，越用越聪明
- **月度统计看板** — 饼图、趋势图、分类排行、AI 月度总结
- **预算预警** — 支持多种风格，超限即时推送通知
- **深色模式** — 3 种主题色 × 3 种明暗模式
- **PWA 离线可用** — 可安装到手机主屏幕

## 技术栈

React 19 + TypeScript + Vite 8 + TailwindCSS 4 + Dexie (IndexedDB) + recharts + Vite PWA

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制环境变量模板并填入你的 AI API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```
VITE_AGENTS_API_KEY=your_api_key_here
```

> API Key 申请地址：https://apihub.agnes-ai.com

### 3. 本地开发

```bash
npm run dev
```

打开 http://localhost:5173

### 4. 构建生产版本

```bash
npm run build
```

输出目录：`dist/`

### 5. 预览生产构建

```bash
npm run preview
```

## Vercel 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/jizhang)

### 部署步骤

1. 将项目推送到 GitHub / GitLab / Bitbucket
2. 点击上方的 "Deploy" 按钮
3. 在 Vercel 控制台添加环境变量：
   - `VITE_AGENTS_API_KEY` → 填入你的 API Key
4. 点击 Deploy

### Vercel 配置

项目已内置 `vercel.json`，支持 SPA 路由重定向。无需额外配置。

## 项目结构

```
src/
├── components/          # 共享组件
│   ├── BottomNav.tsx    # 底部导航栏
│   ├── Dashboard.tsx    # 首页仪表盘
│   ├── ErrorBoundary.tsx
│   └── OfflineBanner.tsx
├── hooks/               # 自定义 Hooks
│   ├── useBudgetAlert.ts
│   ├── useInstallPrompt.ts
│   ├── useMonthlyData.ts
│   ├── useOnlineStatus.ts
│   ├── useSpeechRecognition.ts
│   ├── useTheme.ts
│   └── useMonthlySummary.ts
├── lib/                 # 工具库
│   ├── ai.ts            # AI API 调用
│   ├── categoryLearner.ts  # 智能分类学习
│   ├── csvExporter.ts   # CSV 导出
│   ├── db.ts            # IndexedDB (Dexie)
│   ├── imageRecognition.ts  # 截图识账
│   └── notifications.ts    # 推送通知
├── pages/               # 页面组件
│   ├── HomePage.tsx
│   ├── ChatPage.tsx
│   ├── TransactionsPage.tsx
│   ├── StatsPage.tsx
│   └── SettingsPage.tsx
├── store/               # 状态管理
│   └── AppContext.tsx
├── types/               # TypeScript 类型
│   └── index.ts
└── main.tsx             # 入口
public/
└── sw.js                # Service Worker (Push 通知)
```

## 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `VITE_AGENTS_API_KEY` | AI API 密钥，用于自然语言解析和智能问答 | 是 |

## 浏览器支持

- Chrome / Edge 90+（推荐，支持语音输入和推送通知）
- Safari 15+
- Firefox 90+（语音输入部分支持）

> 语音输入和推送通知在移动端 Chrome/Safari 上体验最佳。
