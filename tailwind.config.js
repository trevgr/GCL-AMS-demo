/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],

  safelist: [
    "bg-gray-200",
    "text-gray-800",

    "bg-red-600",
    "bg-orange-500",
    "bg-amber-400",

    "bg-green-500",
    "bg-emerald-700",

    "text-white",
    "text-slate-900",
  ],

  theme: {
    extend: {},
  },
  plugins: [],
};
