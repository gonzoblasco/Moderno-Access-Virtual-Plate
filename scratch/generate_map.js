const fs = require('fs');

const tags = fs.readFileSync('scratch/tags.txt', 'utf8').split('\n');
const mapLines = [];

tags.forEach(line => {
    if (!line.trim()) return;
    const tag = line.split("'")[1];
    if (!tag) return;

    let value = "''";
    
    // Sensible defaults based on name
    if (tag.includes('ip') || tag.includes('gateway') || tag.includes('netmask')) value = "'0.0.0.0'";
    if (tag.includes('port')) value = "'80'";
    if (tag.includes('pwd') || tag.includes('Password')) value = "''";
    if (tag.includes('mac')) value = "'00:00:00:00:00:00'";
    if (tag.includes('_Staus') || tag.includes('status')) value = "'0'";
    if (tag.includes('language')) value = "'0'";
    if (tag.includes('_list') || tag.includes('_table') || tag.includes('_times') || tag.includes('group_time_zones')) {
        // HTML blocks
        value = "''";
    }
    
    // Existing known mappings
    if (tag === 'status.cgi$proname') value = '`"${config.board.name}"`';
    if (tag === 'status.cgi$log_pw_on') value = "'checked'";
    if (tag === 'status.cgi$fmver') value = "'C2P-Ver1.9'";
    if (tag === 'status.cgi$hwver') value = "'2.0'";
    if (tag === 'status.cgi$module_type') value = "'SEMAC-D2'";
    if (tag === 'status.cgi$uptime') value = "'12 days, 04:22:11'";
    if (tag === 'status.cgi$Max_User') value = "'20000'";
    if (tag === 'man.cgi$serial_no') value = "'TNG-PRO-20170328'";
    if (tag === 'status.cgi$soft_status') value = "'Connected'";
    if (tag === 'status.cgi$control_mode') value = "'Online'";

    mapLines.push(`        '${tag}': ${value},`);
});

fs.writeFileSync('scratch/full_map.js', 'const fullSsiMap = {\n' + mapLines.join('\n') + '\n};\n');
console.log('Map generated in scratch/full_map.js');
