const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const buffer = fs.readFileSync('TNG PRO C2P-Ver1.9-0328-2017.web');
const outputDir = 'public';

const indexOffset = buffer.indexOf('index.htm');
let currentPos = indexOffset;
const filenames = [];
while (currentPos < buffer.length) {
    const filename = buffer.slice(currentPos, currentPos + 16).toString().replace(/\0/g, '');
    if (!filename || filename.length === 0 || !filename.includes('.')) break;
    filenames.push(filename);
    currentPos += 32;
}

const dataStart = 2462;
const dataBuffer = buffer.slice(dataStart);

// CHIYU files are concatenated GZIPs. 
// We can use zlib.gunzipSync on a buffer that has trailing data, and it will often work.
// But we need to move the pointer correctly.

let currentOffset = 0;
filenames.forEach((filename, i) => {
    try {
        const chunk = dataBuffer.slice(currentOffset);
        // We find the GZIP header
        const headerIndex = chunk.indexOf(Buffer.from([0x1f, 0x8b, 0x08]));
        if (headerIndex === -1) {
            console.log(`Could not find GZIP header for ${filename}`);
            return;
        }
        
        const actualChunk = chunk.slice(headerIndex);
        // gunzipSync might not tell us how many bytes it consumed.
        // So we use a trick: try to decompress and catch errors, or use the filenames to guess.
        const decompressed = zlib.gunzipSync(actualChunk);
        fs.writeFileSync(path.join(outputDir, filename), decompressed);
        console.log(`Extracted ${filename} (${decompressed.length} bytes)`);
        
        // To find the next offset, we need to know how many COMPRESSED bytes were consumed.
        // Since we don't know, we'll scan for the NEXT GZIP header for the next file.
        // This is what my previous scan script tried to do but maybe it missed some.
        
        // Actually, let's just use the next filename's GZIP header.
        // The first GZIP is at currentOffset + headerIndex.
        // We need to move currentOffset past this one.
    } catch (e) {
        console.log(`Failed ${filename}: ${e.message}`);
    }
    
    // Move to the next GZIP header
    const nextHeader = dataBuffer.indexOf(Buffer.from([0x1f, 0x8b, 0x08]), currentOffset + 3);
    if (nextHeader !== -1) {
        currentOffset = nextHeader;
    } else {
        currentOffset = dataBuffer.length;
    }
});
