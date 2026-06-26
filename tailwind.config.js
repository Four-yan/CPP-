export default {
  // Trigger full rebuild to clear JIT cache
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        txt: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        danger: '#E24B4A',
        success: '#1D9E75',
        warning: '#EF9F27',
      },
      borderRadius: {
        'button': '10px',
        'card': '14px',
        'modal': '20px',
        'capsule': '999px',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Hiragino Sans GB"', 
          '"Microsoft YaHei"', 'sans-serif'
        ],
      }
    },
  },
  plugins: [],
}
