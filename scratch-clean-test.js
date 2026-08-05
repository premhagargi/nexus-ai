let raw = '0:"Here is the information retrieved from your workspace documents:\\n\\nSource: [Kyro Master Documentation.docx]"';
if (raw.startsWith('0:"')) {
  try {
    raw = JSON.parse(raw.slice(2));
  } catch (e) {
    console.error('parse error:', e);
  }
}
console.log('CLEANED TEXT:');
console.log(raw);
