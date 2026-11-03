/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stage: "#0c0b10",
        surface: "#1c1b1b",
        "surface-2": "#242424",
        "surface-3": "#353534",
        cream: "#ffffff",
        muted: "#b3b3b3",
        dim: "#71717a",
        spotlight: "#f71e4d",
        rose: "#ff4d79",
        violet: "#9b51e0",
      },
      fontFamily: {
        display: ["Plus Jakarta Sans", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
