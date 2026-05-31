import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--tw-bg)',
        card: 'var(--tw-card)',
        'card-hover': 'var(--tw-card-hover)',
        primary: 'var(--tw-primary)',
        accent: 'var(--tw-accent)',
        elevated: 'var(--tw-elevated)',
        'border-base': 'var(--tw-border)',
        'input-bg': 'var(--tw-input-bg)',
        'input-border': 'var(--tw-input-border)',
        'text-secondary': 'var(--tw-secondary)',
        risk: {
          informativo: '#22c55e',
          preventivo: '#eab308',
          alerta: '#f97316',
          emergencia: '#ef4444',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        ui: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-danger': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
