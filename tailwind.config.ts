import type { Config } from 'tailwindcss'
export default { darkMode: 'class', content: ['./app/**/*.tsx', './components/**/*.tsx'],
  theme: { extend: { fontFamily: { sans: ['var(--font-cairo)', 'sans-serif'] } } }, plugins: [] } satisfies Config
