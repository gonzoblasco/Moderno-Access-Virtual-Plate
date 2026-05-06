const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const inputFile = process.argv[2] || 'TNG PRO C2P-Ver1.9-0328-2017.web';
const buffer = fs.readFileSync(inputFile);
const dirs = ['public', 'firmware_web'];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

const indexOffset = buffer.indexOf('index.htm');
let currentPos = indexOffset;
const files = [];
while (currentPos < buffer.length) {
    const filename = buffer.slice(currentPos, currentPos + 16).toString().replace(/\0/g, '');
    if (!filename || filename.length === 0 || !filename.includes('.')) break;
    const size = buffer.readUInt32LE(currentPos + 20);
    const offset = buffer.readUInt32LE(currentPos + 24);
    files.push({ filename, size, offset });
    currentPos += 32;
}

const dataStart = 2462;
const dataBuffer = buffer.slice(dataStart);

files.forEach((file, i) => {
    try {
        const chunk = dataBuffer.slice(file.offset);
        let content;
        if (chunk[0] === 0x1f && chunk[1] === 0x8b) {
            content = zlib.gunzipSync(chunk);
        } else {
            content = chunk.slice(0, file.size);
        }
        
        dirs.forEach(dir => {
            fs.writeFileSync(path.join(dir, file.filename), content);
        });
        console.log(`Extracted ${file.filename} (${content.length} bytes)`);
    } catch (e) {
        console.log(`Failed ${file.filename}: ${e.message}`);
    }
});
