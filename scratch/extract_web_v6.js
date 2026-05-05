const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const buffer = fs.readFileSync('TNG PRO C2P-Ver1.9-0328-2017.web');
const outputDir = 'public';

const indexOffset = buffer.indexOf('index.htm');
let currentPos = indexOffset;
const files = [];
while (currentPos < buffer.length) {
    const filename = buffer.slice(currentPos, currentPos + 16).toString().replace(/\0/g, '');
    if (!filename || filename.length === 0 || !filename.includes('.')) break;
    const size = buffer.readUInt32LE(currentPos + 18);
    const offset = buffer.readUInt32LE(currentPos + 22);
    files.push({ filename, size, offset });
    currentPos += 32;
}

const dataStart = 2462;
const dataBuffer = buffer.slice(dataStart);

files.forEach((file, i) => {
    try {
        const chunk = dataBuffer.slice(file.offset);
        if (chunk[0] === 0x1f && chunk[1] === 0x8b) {
            // It is GZIP
            // We need to find where the GZIP stream ends. 
            // Since the offsets are uncompressed, they don't help with compressed size.
            // But we know that CHIYU files are just GZIP streams concatenated.
            // gunzipSync usually decompresses the first stream and stops.
            const decompressed = zlib.gunzipSync(chunk);
            fs.writeFileSync(path.join(outputDir, file.filename), decompressed);
            console.log(`Extracted ${file.filename} (GZIP, ${decompressed.length} bytes)`);
        } else {
            // It is RAW
            const rawData = chunk.slice(0, file.size);
            fs.writeFileSync(path.join(outputDir, file.filename), rawData);
            console.log(`Extracted ${file.filename} (RAW, ${file.size} bytes)`);
        }
    } catch (e) {
        console.log(`Failed ${file.filename}: ${e.message}`);
    }
});
