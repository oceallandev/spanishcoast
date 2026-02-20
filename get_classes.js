import fs from 'fs';
const style = fs.readFileSync('style.css', 'utf8');
const lines = style.split('\n');
const results_cta_matches = lines.map((l, i) => l.includes('.results-cta') ? i + 1 + ': ' + l : null).filter(Boolean);
console.log(results_cta_matches.join('\n'));
