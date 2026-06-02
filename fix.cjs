const fs = require('fs');
const files = [
  'src/pages/hospitalAuth/HospitalDashboard.tsx', 
  'src/pages/hospitalAuth/HospitalProfile.tsx', 
  'src/pages/hospitalAuth/HospitalSettings.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/item\s+xs=\{([0-9]+)\}\s+sm=\{([0-9]+)\}\s+md=\{([0-9]+)\}/g, 'size={{ xs: $1, sm: $2, md: $3 }}');
  content = content.replace(/item\s+xs=\{([0-9]+)\}\s+md=\{([0-9]+)\}/g, 'size={{ xs: $1, md: $2 }}');
  content = content.replace(/item\s+xs=\{([0-9]+)\}/g, 'size={{ xs: $1 }}');
  fs.writeFileSync(file, content);
  console.log('Fixed', file);
});
