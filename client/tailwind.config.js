/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        felt: '#1B4332',       // deep green felt
        feltLight: '#2D6A4F',
        feltDark: '#0D2B1F',
        gold: '#C9A84C',
        goldLight: '#E8C97A',
        cardWhite: '#F8F4E8',
        cardShadow: '#1A1A2E',
        teamRed: '#C0392B',
        teamBlue: '#2980B9',
        uiBg: '#0D1B2A',
        uiPanel: '#162032',
        uiBorder: '#2A3F57',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        card: ['"Playfair Display"', 'serif'],
      },
      animation: {
        'card-play': 'cardPlay 0.3s ease-out',
        'card-deal': 'cardDeal 0.4s ease-out',
        'trick-collect': 'trickCollect 0.5s ease-in',
        'pulse-glow': 'pulseGlow 1.5s ease-in-out infinite',
      },
      keyframes: {
        cardPlay: {
          '0%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.05)' },
          '100%': { transform: 'translateY(0) scale(1)' },
        },
        cardDeal: {
          '0%': { opacity: '0', transform: 'translateY(-40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        trickCollect: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.5)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(201,168,76,0.4)' },
          '50%': { boxShadow: '0 0 20px 6px rgba(201,168,76,0.8)' },
        },
      },
    },
  },
  plugins: [],
};
