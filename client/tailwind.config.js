/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // MTG-inspired colors
        'mtg-white': '#FFFBD5',
        'mtg-blue': '#0E68AB',
        'mtg-black': '#150B00',
        'mtg-red': '#D3202A',
        'mtg-green': '#00733E',
        'mtg-colorless': '#C8C8C8',
        'mtg-gold': '#E0C862',
      },
    },
  },
  plugins: [],
}