const fs = require('fs');
const path = require('path');

const source = require.resolve('exceljs/dist/exceljs.min.js');
const targetDirectory = path.join(__dirname, '..', 'public', 'vendor', 'exceljs');
const target = path.join(targetDirectory, 'exceljs.min.js');

fs.mkdirSync(targetDirectory, { recursive: true });
fs.copyFileSync(source, target);
console.log('Prepared browser dependencies in public/vendor.');
