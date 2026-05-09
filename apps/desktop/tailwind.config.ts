import type { Config } from 'tailwindcss';
import { tokens } from './src/renderer/theme/tokens';

export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      borderRadius: tokens.radius,
    },
  },
} satisfies Config;
