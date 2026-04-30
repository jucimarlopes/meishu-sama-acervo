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
        navy: {
          DEFAULT: '#1e73be',
          light:   '#4a73b9',
          dark:    '#0d62a6',
        },
        gold: {
          DEFAULT: '#f6a623',
          light:   '#f8b84e',
          dark:    '#d4891a',
        },
        cream: {
          DEFAULT: '#e8f6ff',
          dark:    '#d4ecfa',
        },
        fmo: {
          blue:        '#1e73be',
          'blue-dark': '#0d62a6',
          'blue-deep': '#0e3b59',
          'blue-mid':  '#3b8fd3',
          orange:      '#f6a623',
          text:        '#2a2e35',
          'text-muted':'#5f6670',
          'text-light':'#6b7280',
        },
      },
      fontFamily: {
        sans:  ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'Apple Color Emoji', 'Segoe UI Emoji', 'sans-serif'],
        serif: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
