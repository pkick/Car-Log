const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Every color is a CSS variable holding RGB channels (see :root in src/index.css), so
      // opacity modifiers like bg-accent/12 work on all of them.
      colors: {
        page: token('page'),
        surface: token('surface'),
        ink: token('ink'),
        slate: token('slate'),
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          'on-dark': token('accent-on-dark'),
        },
        teal: token('teal'),
        amber: token('amber'),
        green: {
          DEFAULT: token('green'),
          'on-dark': token('green-on-dark'),
        },
        red: token('red'),
        white: token('white'),
      },
      // Color opacity modifiers (bg-ink/42, text-page/62, ...) only generate CSS for keys in
      // theme.opacity, and the default scale is steps of 5. These are the off-scale values the
      // design uses; add any new one here or the class silently renders nothing.
      opacity: {
        '2.5': '0.025',
        3: '0.03',
        4: '0.04',
        '4.5': '0.045',
        6: '0.06',
        8: '0.08',
        9: '0.09',
        12: '0.12',
        14: '0.14',
        16: '0.16',
        18: '0.18',
        24: '0.24',
        42: '0.42',
        52: '0.52',
        62: '0.62',
      },
      fontFamily: {
        archivo: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      fontSize: {
        // rem-based (16px root) so the Settings > UI text size slider can scale
        // every text size at once by changing the root font-size.
        xs: ['0.75rem', '1.3'],
        sm: ['0.8125rem', '1.4'],
        base: ['0.875rem', '1.5'],
        lg: ['1rem', '1.6'],
        xl: ['1.125rem', '1.6'],
        '2xl': ['1.125rem', '1'],
        '3xl': ['1.375rem', '1'],
        '4xl': ['1.5rem', '1'],
        '5xl': ['1.75rem', '1'],
        '6xl': ['2rem', '1'],
        '7xl': ['2.375rem', '1'],
        '8xl': ['2.625rem', '1'],
      },
      spacing: {
        0.5: '2px',
        1: '4px',
        '1.5': '6px',
        2: '8px',
        '2.25': '9px',
        '2.5': '10px',
        3: '12px',
        '3.5': '14px',
        4: '16px',
        '4.5': '18px',
        5: '20px',
        '5.5': '22px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
        12: '48px',
        14: '56px',
        16: '64px',
        18: '72px',
        20: '80px',
        22: '88px',
        24: '96px',
        26: '104px',
        28: '112px',
        34: '136px',
        40: '160px',
        56: '224px',
      },
      borderRadius: {
        2: '2px',
        '2.5': '10px',
        5: '5px',
        7: '7px',
        8: '8px',
        9: '9px',
        10: '10px',
        12: '12px',
        14: '14px',
        control: '8px',
        card: '10px',
        modal: '14px',
      },
      boxShadow: {
        btn: '0 8px 20px -10px rgba(18, 18, 18, 0.6)',
        button: '0 8px 20px -10px rgba(18, 18, 18, 0.6)',
        dropdown: '0 22px 48px -18px rgba(18, 18, 18, 0.34)',
        modal: '0 40px 90px -30px rgba(18, 18, 18, 0.6)',
        drawer: '-24px 0 48px -24px rgba(18, 18, 18, 0.35)',
        fab: '0 12px 24px -12px rgba(47, 107, 216, 0.8)',
        knob: '0 1px 3px rgba(18, 18, 18, 0.3)',
      },
      // Dialog motion, used with the motion-safe: variant so prefers-reduced-motion turns it off.
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'dialog-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'drawer-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease both',
        'dialog-in': 'dialog-in 0.18s ease both',
        'drawer-in': 'drawer-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
}
