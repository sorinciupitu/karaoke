/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stage: "#17121F",
        surface: "#211A2C",
        "surface-2": "#2A2138",
        cream: "#F4EDE4",
        muted: "#9A93A8",
        spotlight: "#FFC24B",
        violet: "#B98CFF",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
