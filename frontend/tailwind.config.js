/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a'
        },
        dark: {
          800: '#1a1a2e',
          900: '#0f0f1a'
        },
        profit: '#22c55e',
        loss: '#ef4444'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    }
  },
  plugins: []
}
