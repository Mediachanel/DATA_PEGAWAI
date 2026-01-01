module.exports = {
  content: [
    './dashboard/**/*.html',
    './peta.php'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: '#12B7A6',
        cpns: '#06B6D4',
        pppk: '#22C55E',
        pro: '#14B8A6',
        pjlp: '#8B5CF6',
        card: '#ffffff'
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(15,23,42,.25)'
      }
    }
  }
};



