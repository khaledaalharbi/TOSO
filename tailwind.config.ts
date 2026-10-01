import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1729",
        brand: { 400: "#54d3b8", 500: "#20b89a", 600: "#129278" },
      },
      fontFamily: {
        sans: ["Tajawal", "Tahoma", "sans-serif"],
        mono: ['"Geist Mono"', "Tajawal", "ui-monospace", "monospace"],
      },
      boxShadow: {
        hard: "4px 4px 0 0 rgba(13, 23, 41, 0.9)",
        "hard-sm": "2px 2px 0 0 rgba(13, 23, 41, 0.9)",
      },
    },
  },
  plugins: [],
};

export default config;
