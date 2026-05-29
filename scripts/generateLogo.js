const fs = require('fs');
const path = require('path');

const imagePath = 'd:/PURECUTS Inventory/purecuts_logo_no_bg-cropped.png';
const outputPath = path.join(__dirname, '../src/lib/logoBase64.ts');

const imageBytes = fs.readFileSync(imagePath);
const base64String = imageBytes.toString('base64');

const content = `// Auto-generated - Logo as base64 data URI
export const LOGO_BASE64 = "data:image/png;base64,${base64String}";
`;

fs.writeFileSync(outputPath, content);
console.log('Logo base64 generated successfully');
