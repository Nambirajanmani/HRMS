/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class", // Enables dark mode via 'class'
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
    extend: {
      colors: {
        // Primary brand colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Custom design tokens
        border: '#e5e7eb',        // gray-200
        background: '#ffffff',    // white
        foreground: '#111827',    // gray-900
        ring: '#3b82f6',          // blue-500
        muted: '#6b7280',         // gray-500
        success: '#22c55e',       // green-500
        warning: '#f59e0b',       // amber-500
        error: '#ef4444',         // red-500
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0, 0, 0, 0.06)',
        strong: '0 4px 20px rgba(0, 0, 0, 0.1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        slideUp: 'slideUp 0.4s ease-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),     // Better form styles
    require('@tailwindcss/typography'), // Prose for rich text
    require('@tailwindcss/aspect-ratio'), // Aspect ratios for media
  ],
};
