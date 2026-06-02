const fs = require('fs');
const path = require('path');

const dir = 'd:\\HMS\\frontend\\src\\pages';

function getFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('Form.tsx')) {
        arrayOfFiles.push(path.join(dirPath, '/', file));
      }
    }
  });
  
  return arrayOfFiles;
}

const formFiles = getFiles(dir);

formFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace size={{ xs: 12, sm: 6, md: 4 }} and similar variants
  content = content.replace(/size=\{\{\s*xs:\s*12,\s*sm:\s*\d+,\s*md:\s*\d+\s*\}\}/g, 'size={{ xs: 12 }}');
  content = content.replace(/size=\{\{\s*xs:\s*12,\s*md:\s*\d+\s*\}\}/g, 'size={{ xs: 12 }}');
  
  // Replace item xs={12} md={6}
  content = content.replace(/item\s+xs=\{12\}\s+md=\{\d+\}/g, 'item xs={12}');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Processed', file);
});

console.log('All forms updated to vertical full-width style!');
