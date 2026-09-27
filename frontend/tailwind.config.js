/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Core Brand ──
        primary: 'var(--color-primary)',
        'primary-dim': 'var(--color-primary-dim)',
        'primary-glow': 'var(--color-primary-glow)',
        // ── Functional ──
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
        // ── Surfaces ──
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        'surface-3': 'var(--color-surface-3)',
        // ── Text ──
        text: 'var(--color-text)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        // ── Borders ──
        border: 'var(--color-border)',
        'border-green': 'var(--color-border-green)',
      },
      fontFamily: {
        sans: ['var(--font-main)', 'Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      // ── Radii ──
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      // ── Glass Material ──
      backdropBlur: {
        sm: 'var(--glass-blur-sm)',
        DEFAULT: 'var(--glass-blur)',
        lg: 'var(--glass-blur-lg)',
        xl: '64px',
      },
      backgroundColor: {
        'glass-surface': 'var(--glass-surface)',
        'glass-surface-hover': 'var(--glass-surface-hover)',
        'glass-subtle': 'var(--glass-bg-2)',
      },
      borderColor: {
        'glass-border': 'var(--glass-border)',
        'glass-border-hover': 'var(--color-border-green)',
        'glass-highlight': 'var(--glass-highlight)',
      },
      // ── Shadows & Glows ──
      boxShadow: {
        'elevation-1': 'var(--shadow-elevation-1)',
        'elevation-2': 'var(--shadow-elevation-2)',
        'elevation-3': 'var(--shadow-elevation-3)',
        contact: 'var(--shadow-contact)',
        'glow-sm': 'var(--glow-primary-sm)',
        'glow-md': 'var(--glow-primary-md)',
        'glow-lg': 'var(--glow-primary-lg)',
        'glow-white-sm': 'var(--glow-white-sm)',
        'glow-white-md': 'var(--glow-white-md)',
      },
      // ── Motion ──
      transitionTimingFunction: {
        cinematic: 'var(--motion-easing-cinematic)',
      },
      transitionDuration: {
        'motion-fast': 'var(--motion-duration-fast)',
        'motion-normal': 'var(--motion-duration-normal)',
        'motion-slow': 'var(--motion-duration-slow)',
      },
      // ── Animations ──
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'pulse-green': 'pulseGreen 3s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        shimmer: 'shimmer 3s linear infinite',
        'liquid-refraction': 'liquid-refraction 200ms ease-out',
        'volumetric-pulse': 'volumetric-pulse 4s ease-in-out infinite',
        'volumetric-rotate': 'volumetric-rotate 8s linear infinite',
        'illumination-pulse': 'illumination-pulse 3s ease-in-out infinite',
        'dust-float': 'dustFloat 4s ease-out infinite',
        'blob-float': 'blobFloat 12s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
