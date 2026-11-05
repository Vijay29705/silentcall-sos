import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import fs from 'fs';

const mammoth = require('mammoth');

// Extract DOCX
const docxPath = 'C:/Users/kishore murugan/.gemini/antigravity/brain/0b24ed24-005e-4341-9f8c-2aa439c936ce/.user_uploaded/media_1793703120203_9baba99b.docx';
const outPath = 'C:/Users/kishore murugan/.gemini/antigravity/brain/0b24ed24-005e-4341-9f8c-2aa439c936ce/docx_extracted.txt';

mammoth.extractRawText({ path: docxPath })
  .then(r => {
    fs.writeFileSync(outPath, r.value);
    console.log('DOCX extracted, length:', r.value.length);
  })
  .catch(e => console.error('DOCX error:', e));

