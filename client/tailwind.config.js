/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ios: {
          dark: '#1c1c1e',
          lightgray: '#a5a5a5',
          darkgray: '#333333',
          orange: '#ff9f0a',
          orangeActive: '#f18e00'
        },
        triage: {
          slate: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          critical: '#ef4444',
          high: '#f97316',
          moderate: '#eab308',
          resolved: '#10b981'
        }
      },
      animation: {
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
