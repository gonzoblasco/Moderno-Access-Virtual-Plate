const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.htm') || f.endsWith('.js'));
const tags = new Set();
files.forEach(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const matches = content.match(/<!-#([a-zA-Z0-9.]+)\$([a-zA-Z0-9_]+)-->/g);
    if (matches) {
        matches.forEach(m => {
            const inner = m.replace('<!-#', '').replace('-->', '');
            tags.add(inner);
        });
    }
});
const sortedTags = Array.from(tags).sort();
const mapCode = sortedTags.map(tag => `        '${tag}': '0',`).join('\n');
fs.writeFileSync(path.join(__dirname, 'tags.txt'), mapCode);
console.log(`Found ${sortedTags.length} unique tags.`);
