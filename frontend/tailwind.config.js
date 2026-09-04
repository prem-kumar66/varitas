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
          900: "#171717",
          800: "#1F1F1F",
          700: "#2D2D2D",
          600: "#404040",
          500: "#555555",
        },
        gold: {
          50:  "#FFF1F2",
          200: "#FECDD3",
          400: "#C8102E",
          500: "#A50E25",
          600: "#8B0B1F",
        },
        emerald: {
          400: "#34D399",
          600: "#059669",
        },
        crimson: {
          400: "#E31B23",
          600: "#C8102E",
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
