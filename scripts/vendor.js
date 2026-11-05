// Copies browser libraries from node_modules into www/vendor (runs after `npm install`).
const fs = require('fs'), p = require('path');
const files = ['pdfjs-dist/build/pdf.min.js', 'pdfjs-dist/build/pdf.worker.min.js', 'pdf-lib/dist/pdf-lib.min.js',
  'jszip/dist/jszip.min.js', 'xlsx/dist/xlsx.full.min.js', 'mammoth/mammoth.browser.min.js', '@pdf-lib/fontkit/dist/fontkit.umd.min.js'];
fs.mkdirSync('www/vendor', { recursive: true });
for (const f of files) {
  const src = p.join('node_modules', f);
  if (!fs.existsSync(src)) { console.error('Missing ' + src); process.exit(1); }
  fs.copyFileSync(src, p.join('www/vendor', p.basename(f)));
}
console.log('Vendored ' + files.length + ' libraries into www/vendor');
