const fs = require('fs');
const buffer = fs.readFileSync('TNG PRO C2P-Ver1.9-0328-2017.web');

const start = 0x5d;
for (let i = 0; i < 32; i++) {
    if (buffer.readUInt32LE(start + i) === 761) {
        console.log(`Size 761 found at offset +${i}`);
    }
    if (buffer.readUInt32LE(start + i) === 0) {
        // console.log(`Offset 0 found at offset +${i}`);
    }
}
