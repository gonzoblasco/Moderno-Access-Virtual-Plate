const fs = require('fs');

let serverCode = fs.readFileSync('server.js', 'utf8');
const mapCode = fs.readFileSync('scratch/full_map.js', 'utf8');

// Replace the map declaration in serverCode
const ssiStart = serverCode.indexOf('const ssiMap = {');
const ssiEnd = serverCode.indexOf('};', ssiStart) + 2;

const dynamicCode = `
    const ssiMap = Object.assign({}, fullSsiMap, {
        'status.cgi$proname': \`"\${config.board.name}"\`,
        'if.cgi$Reg': config.users.length,
        'if.cgi$ava_user': 20000 - config.users.length,
        'if.cgi$LogCount': \`\${config.logs.length}/0\`,
        'man.cgi$door_table': '<tr><td colspan="5" align="center">No doors configured in simulator</td></tr>'
    });
`;

const patch = mapCode + '\n' + dynamicCode;

serverCode = serverCode.substring(0, ssiStart) + patch + serverCode.substring(ssiEnd);

fs.writeFileSync('server.js', serverCode);
console.log('server.js patched');
