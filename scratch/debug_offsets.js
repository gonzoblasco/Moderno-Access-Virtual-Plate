const fs = require('fs');
const buffer = fs.readFileSync('TNG PRO C2P-Ver1.9-0328-2017.web');

const indexOffset = buffer.indexOf('index.htm');
console.log('indexOffset:', indexOffset, '(0x' + indexOffset.toString(16) + ')');

const size = buffer.readUInt32LE(indexOffset + 22);
const offset = buffer.readUInt32LE(indexOffset + 26);

console.log('Size:', size);
console.log('Offset:', offset);

const dataStart = 2462;
console.log('First bytes at dataStart + offset:', buffer.slice(dataStart + offset, dataStart + offset + 2).toString('hex'));
