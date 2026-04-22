/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        serif: ['"IBM Plex Serif"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#14181C',
          soft: '#2B3138',
          muted: '#5A6169',
        },
        paper: {
          DEFAULT: '#FDFDFC',
          warm: '#F6F4EF',
          rule: '#E3E0D8',
        },
        myndig: {
          DEFAULT: '#1E3A5F',
          soft: '#3B5A7F',
          tint: '#EDF1F6',
        },
        accent: {
          sand: '#C9B88A',
          brick: '#8A3030',
        },
        status: {
          ok: '#2E7D32',
          warn: '#C9711B',
          fail: '#8A3030',
        },
      },
      maxWidth: {
        prose: '42rem',
        wide: '68rem',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
