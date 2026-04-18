/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
      },
      borderRadius: {
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
