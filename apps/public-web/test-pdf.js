const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = 'C:\\Users\\fab24\\.gemini\\antigravity\\brain\\02bb2d0f-3fc7-4859-8a9b-dc71f9abe684\\.tempmediaStorage\\b08686b19b23d38e.pdf';

if (!fs.existsSync(pdfPath)) {
  console.error('File not found:', pdfPath);
  process.exit(1);
}

const dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function (data) {
  console.log('--- START PDF TEXT ---');
  console.log(data.text);
  console.log('--- END PDF TEXT ---');
}).catch(err => {
  console.error(err);
});
