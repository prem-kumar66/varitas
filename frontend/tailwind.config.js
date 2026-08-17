/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0A0908",
          800: "#0F0E0D",
          700: "#171614",
          600: "#22201D",
          500: "#2E2B27",
        },
        gold: {
          50:  "#FAF3E0",
          200: "#E5D5A8",
          400: "#C9A961",
          500: "#B08D3F",
          600: "#8B6F2E",
        },
        emerald: {
          400: "#34D399",
          600: "#059669",
        },
        crimson: {
          400: "#F87171",
          600: "#DC2626",
        },
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
