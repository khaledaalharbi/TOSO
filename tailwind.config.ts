import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1729",
        brand: { 400: "#54d3b8", 500: "#20b89a", 600: "#129278" },
      },
      boxShadow: { glow: "0 20px 60px rgba(16, 96, 106, .18)" },
    },
  },
  plugins: [],
};

export default config;
