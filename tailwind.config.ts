import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:    { DEFAULT: '#1a3358', light: '#2b4a7a', dark: '#0f1f36' },
        gold:    { DEFAULT: '#b8963e', light: '#d4a94e', dark: '#8a6e2a' },
        cream:   { DEFAULT: '#faf8f3', dark: '#f0ece0' },
      },
      fontFamily: {
        serif: ['EB Garamond', 'Georgia', 'serif'],
        sans:  ['Source Sans 3', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
