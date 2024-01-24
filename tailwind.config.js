/** @type {import('tailwindcss').Config} */
module.exports = {
  content: {
    files: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    transform: require('typewind/transform').typewindTransforms,
  },
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['business'],
  },
}
