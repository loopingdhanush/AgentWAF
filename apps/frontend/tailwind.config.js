/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#FBFBFA",
      },
      boxShadow: {
        subtle:
          "0 1px 2px 0 rgba(24, 24, 27, 0.04), 0 1px 3px 0 rgba(24, 24, 27, 0.06)",
        panel:
          "0 1px 3px 0 rgba(24, 24, 27, 0.04), 0 8px 24px -8px rgba(24, 24, 27, 0.10)",
      },
      fontFamily: {
        sans: ['"Roboto"', '"Helvetica Neue"', "Arial", "sans-serif"],
        mono: ['"Roboto Mono"', '"Google Sans Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
