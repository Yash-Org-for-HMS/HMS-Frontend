import fs from "fs";
import path from "path";

const layoutsDir = path.join("d:", "HMS", "frontend", "src", "layouts");

const layouts = [
  { file: "AdminLayout.tsx", title: "HMS | Super Admin", component: "AdminLayout" },
  { file: "HospitalLayout.tsx", title: "HMS | Hospital Admin", component: "HospitalLayout" },
  { file: "ReceptionLayout.tsx", title: "HMS | Reception", component: "ReceptionLayout" },
  { file: "DoctorLayout.tsx", title: "HMS | Doctor", component: "DoctorLayout" },
  { file: "LabLayout.tsx", title: "HMS | Lab & Radiology", component: "LabLayout" },
  { file: "NurseLayout.tsx", title: "HMS | Nurse", component: "NurseLayout" },
];

for (const { file, title, component } of layouts) {
  const filePath = path.join(layoutsDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file}, does not exist`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, "utf-8");

  // Ensure useEffect is imported
  if (!content.includes("useEffect")) {
    content = content.replace(/import\s+{\s*useState\s*}\s+from\s+["']react["'];/, 'import { useState, useEffect } from "react";');
    if (!content.includes("useEffect")) {
        // Fallback if useState isn't there alone
        content = content.replace(/import\s+React\s*,?\s*{([^}]*)}\s+from\s+["']react["'];/, (match, p1) => {
            return `import React, { ${p1}, useEffect } from "react";`;
        });
        if (!content.includes("useEffect")) {
            content = 'import { useEffect } from "react";\n' + content;
        }
    }
  }

  // Inject useEffect
  const componentRegex = new RegExp(`export default function ${component}\\(\\) {`);
  if (!content.includes(`document.title = "${title}"`)) {
    content = content.replace(componentRegex, `export default function ${component}() {\n  useEffect(() => {\n    document.title = "${title}";\n  }, []);\n`);
  }

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`Updated ${file}`);
}
