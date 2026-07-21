const express = require('express');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const auth = require('basic-auth');
const dotenv = require('dotenv');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

dotenv.config();

const app = express();

// Rate Limiting: 100 requests per minute per IP
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' }
});
app.use(limiter);

app.use(cors()); // Enable CORS for local web integration
const upload = multer({ dest: path.join(__dirname, 'scratch/uploads/') });
const PORT = process.env.PORT || 8080;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const WEB_DIR = path.join(__dirname, 'public');

// Helper for case-insensitive file lookup (safe: constrained to WEB_DIR)
function getCorrectFilePath(filename) {
    // Prevent path traversal: reject any path with '..' or absolute paths
    if (filename.includes('..') || path.isAbsolute(filename)) {
        return null;
    }
    
    const filePath = path.join(WEB_DIR, filename);
    
    // Verify the resolved path is still under WEB_DIR
    if (!filePath.startsWith(WEB_DIR)) {
        return null;
    }
    
    if (fs.existsSync(filePath)) return filePath;

    // Try case-insensitive match
    try {
        const files = fs.readdirSync(WEB_DIR);
        const lowerFilename = filename.toLowerCase();
        const matched = files.find(f => f.toLowerCase() === lowerFilename);
        if (matched) return path.join(WEB_DIR, matched);
    } catch (e) {}
    
    return null;
}

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cloud / Local Web Integration Configuration
// Cloud / Local Web Integration Configuration
const initialConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SERIAL_NUMBER = process.env.SERIAL_NUMBER || initialConfig.board?.serial || '084764(112334)';
let MODERNO_API_URL = process.env.MODERNO_API_URL || initialConfig.board?.modernoApiUrl || 'https://access.moderno.com.ar';
let WEBHOOK_URL = process.env.WEBHOOK_URL || `${MODERNO_API_URL}/api/webhooks/hardware-event`;

function updateCloudUrls(newUrl, newPort) {
    if (!newUrl) return;
    let url = newUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
    }
    if (newPort && newPort !== '80' && newPort !== '443') {
        url = url.replace(/\/$/, '');
        if (!url.includes(':', url.indexOf('//') + 2)) {
            url = `${url}:${newPort}`;
        }
    }
    if (!process.env.MODERNO_API_URL || true) MODERNO_API_URL = url;
    if (!process.env.WEBHOOK_URL) WEBHOOK_URL = `${MODERNO_API_URL}/api/webhooks/hardware-event`;
    console.log(`[Cloud] API URL updated to: ${MODERNO_API_URL}`);
}

const { validateConfig } = require('./config.schema');

// Simulation State
function getConfig() {
    const rawConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const validation = validateConfig(rawConfig);
    
    if (!validation.valid) {
        console.error('[Config] Validation failed:', validation.errors);
        // Return raw config anyway for backward compatibility, but log warnings
    }
    
    return validation.valid ? validation.data : rawConfig;
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
        console.warn(`[Simulator] Could not write config.json (expected in Vercel serverless environment): ${err.message}`);
    }
}

// Authentication Middleware - ENABLED BY DEFAULT
const authMiddleware = (req, res, next) => {
    const mode = process.env.MODE || 'authorized';
    
    // Skip auth only in explicit 'unauthorized' mode (local dev only)
    if (mode === 'unauthorized') {
        return next();
    }
    
    const credentials = auth(req);
    if (!credentials || credentials.name !== process.env.BOARD_USER || credentials.pass !== process.env.BOARD_PASS) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="TNG PRO WebServer"');
        res.end('Access denied');
        return;
    }
    next();
};

let activeUserEditId = null;

// --- Cloud Bridge Integration ---

async function reportEventToCloud(action, user, door) {
    if (!WEBHOOK_URL) {
        console.log(`[Simulator] No WEBHOOK_URL defined. Event: ${action} - ${user}`);
        return;
    }
    console.log(`[Cloud] Sending webhook: ${action} - ${user} -> ${WEBHOOK_URL}`);
    try {
        await axios.post(WEBHOOK_URL, {
            serial: SERIAL_NUMBER,
            timestamp: new Date().toISOString(),
            user: user,
            action: action,
            door: door
        }, { timeout: 2000 });
    } catch (err) {
        console.error(`[Webhook Error] Failed to send to ${WEBHOOK_URL}: ${err.message}`);
    }
}

async function syncWithCloud() {
    if (!MODERNO_API_URL) return;
    
    console.log(`[Cloud] Syncing user list from ${MODERNO_API_URL}...`);
    try {
        const response = await axios.get(`${MODERNO_API_URL}/api/public/devices/${SERIAL_NUMBER}/sync`, { timeout: 5000 });
        
        if (response.data && response.data.users) {
            const config = getConfig();
            const cloudUsers = response.data.users;
            
            // Basic diff check to avoid unnecessary writes
            if (JSON.stringify(config.users) !== JSON.stringify(cloudUsers)) {
                console.log(`[Cloud] Sync Success! Found ${cloudUsers.length} users. Updating local database...`);
                config.users = cloudUsers;
                config.board.name = response.data.board.name;
                saveConfig(config);
            } else {
                console.log(`[Cloud] Already in sync. (${cloudUsers.length} users)`);
            }
        }
    } catch (err) {
        console.error(`[Cloud Sync Error] ${err.message}`);
    }
}

function openDoorLocally(doorName, userName) {
    const config = getConfig();
    const log = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        user: userName,
        action: 'Open Door',
        door: doorName
    };
    config.logs.unshift(log);
    saveConfig(config);
    
    // If it's a local action, we'd normally trigger relays here
    console.log(`[Hardware] Door ${doorName} opened by ${userName}`);
    
    // If this was triggered locally, we should report it to cloud
    reportEventToCloud('Open Door', userName, doorName);
}

// Polling Interval (every 15 seconds to avoid saturation during dev)
setInterval(syncWithCloud, 15000);
syncWithCloud(); // Initial sync on startup

// --- SSI Processor ---
function processSSI(html, config) {
    const fullSsiMap = {
        // CGI / Setup Defaults
        'man.cgi$get_event_group': '0',
        'man.cgi$event_hold': '10,10,10,10,10',
        'man.cgi$alarm_list': '0,0,0,0,0,0,0,0,0,0,0,0,0,0',
        'man.cgi$ipc_list': '0,0,0,0,0,0,0,0,0,0,0,0,0,0',
        'man.cgi$event_list_g1': '0,0,0,0,0,0,0,0,0,0,0,0,0,0',
        'man.cgi$event_list_g2': '0,0,0,0,0,0,0,0,0,0,0,0,0,0',
        'man.cgi$event_list_g3': '0,0,0,0,0,0,0,0,0,0,0,0,0,0',
        'man.cgi$lift_status': '0',
        'man.cgi$door_status': '0',
        'man.cgi$BF50_Staus': '0',
        'man.cgi$Control_M_Staus': '0',
        'man.cgi$Door_num_Staus': '0',
        'man.cgi$fire_Staus': '0',
        'man.cgi$group_list': '',
        'man.cgi$timezone_list': '',
        'man.cgi$holiday_list': '',
        'man.cgi$group_time_zones': '',
        'man.cgi$timezone_times': '0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
        'man.cgi$timezone_id': '1',
        
        // IF CGI / User Defaults
        'man.cgi$door_status': '<tr><td>D1</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td></tr><tr><td>D2</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td></tr><tr><td>D3</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td></tr><tr><td>D4</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td></tr><tr><td>D5</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td></tr>',
        'man.cgi$lift_table_status': '<tr><td>L1</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td></tr><tr><td>L2</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td></tr>',
        'if.cgi$maxusernum': '20000',
        'if.cgi$fc_card_snc': '0',
        'if.cgi$reg_state': '0',
        'if.cgi$maxuser': '20000',
        'if.cgi$emp_title': 'User Record',
        'if.cgi$Verify': '0',
        'if.cgi$user_group_0': '0',
        'if.cgi$user_group_1': '0',
        'if.cgi$user_group_2': '0',
        'if.cgi$user_group_3': '0',
        'if.cgi$usertype': '0',
        'if.cgi$valid_sy': '2026',
        'if.cgi$valid_sm': '1',
        'if.cgi$valid_sd': '1',
        'if.cgi$valid_ey': '2030',
        'if.cgi$valid_em': '12',
        'if.cgi$valid_ed': '31',
        'if.cgi$valid_shour': '0',
        'if.cgi$valid_smin': '0',
        'if.cgi$valid_ehour': '23',
        'if.cgi$valid_emin': '59',
        'if.cgi$radio_activate': 'checked',
        'if.cgi$radio_deactivate': '',
        'if.cgi$Card_Valid_Disable': '',
        'if.cgi$Card_Valid_Enable': 'checked',
        'if.cgi$Event_List': '1,2,3',
        
        // Status Defaults
        'man.cgi$time_zone': '',
        'man.cgi$TZListID': '1',
        'status.cgi$weblog_set': '1',
        'status.cgi$logo_set': '0',
        'status.cgi$logo_show': 'logo.png',
        'status.cgi$weblog_show': 'logo.png',
        'status.cgi$HEX_DEC': '0',
        'status.cgi$Security_Status': config.board.securityState || '2,2,2,2,2,2,2,2',
        'status.cgi$modelname': '3',
        'status.cgi$control_mode_number': '0',
        'status.cgi$lift_ms': '0',
        'status.cgi$language': '2',
        'status.cgi$web_mode': '0',
        'status.cgi$log_pw_on': 'checked',
        'status.cgi$end_log': config.logs.length.toString(),
        'status.cgi$ver': '2.09.00,Mar 28 2017(HW1.2)',
        'status.cgi$hwver': '1.2',
        'status.cgi$uptime': '0 days, 04:22:11',
        'status.cgi$mac': '00:0e:e3:08:47:64',
        'status.cgi$ip': config.network?.ip || '192.168.0.66',
        'status.cgi$mask': config.network?.mask || '255.255.255.0',
        'status.cgi$gateway': config.network?.gateway || '192.168.0.1',
        'status.cgi$pdns': '8.8.8.8',
        'status.cgi$sdns': '8.8.4.4',
        'status.cgi$ntp_server': 'time.stdtime.gov.tw',
        'status.cgi$timezone': '0',
        'status.cgi$dst_enable': '0',
    };

    let logRows = '';
    config.logs.forEach((log, index) => {
        const d = new Date(log.timestamp);
        const dateStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
        const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
        
        let actionClass = 'log-info';
        if (log.action.includes('Open')) actionClass = 'log-success';
        if (log.action.includes('Update') || log.action.includes('Create')) actionClass = 'log-warning';
        
        logRows += `<TR align="center">
            <TD>${dateStr} ${timeStr}</TD>
            <TD>${log.card || '00000000'}</TD>
            <TD>${log.user}</TD>
            <TD>${log.action.includes('Open') ? 'OK' : 'Denied'}</TD>
            <TD>${log.door}</TD>
        </TR>`;
    });

    let doorRows = '';
    config.doors.forEach(door => {
        doorRows += `<TR align="center"><TD>${door.id}</TD><TD>${door.name}</TD><TD>${door.status}</TD><TD><a href="man.cgi?type=door_on&securitystate=1" target="Status"><button type="button">Open Door</button></a></TD><TD>Normal</TD></TR>`;
    });

    const activeUser = config.users.find(u => u.id === activeUserEditId) || { id: '', name: '', card: '', pin: '' };

    let userRows = '';
    config.users.forEach((user, index) => {
        const bgcolor = index % 2 === 0 ? '#999F9F' : '#99CFCF';
        userRows += `<tr bgcolor='${bgcolor}'>
            <td nowrap><font size=1 face=Arial><INPUT TYPE='CHECKBOX' NAME='SELECT' VALUE='${user.id}'>${index + 1}.</font></td>
            <td ALIGN=CENTER nowrap><A target='Status' HREF='if.cgi?redirect=EmpRcd.htm&failure=fail.htm&type=want_emp&id=${user.id} ' >${user.id}</A></td>
            <td ALIGN=CENTER nowrap>${user.name}</td>
            <td ALIGN=CENTER>${user.type || 'Normal'}</td>
            <td><font size=1 face=Arial color=#000000><P ALIGN=CENTER><img src=${user.active !== false ? 'v.gif' : 'no.gif'}></P></font></td>
            <td><P ALIGN=CENTER><img src=${user.pin ? 'v.gif' : 'no.gif'}></P></td>
            <td><P ALIGN=CENTER><img src=${user.card ? 'v.gif' : 'no.gif'}></P></td>
            <td><P ALIGN=CENTER><font size=1 face=Arial color=#000000>${user.bypass || '1'}</font></P></td>
        </tr>`;
    });

    const ssiMap = Object.assign({}, fullSsiMap, {
        'status.cgi$proname': `"${config.board.name}"`,
        'if.cgi$Reg': config.users.length.toString(),
        'if.cgi$ava_user': (20000 - config.users.length).toString(),
        'if.cgi$maxuser': '20000',
        'if.cgi$maxusernum': config.users.length.toString(),
        'if.cgi$LogCount': `${config.logs.length}/0`,
        'if.cgi$prev_emp': '',
        'if.cgi$next_emp': '',
        'if.cgi$TID': '00:0e:e3:08:47:64',
        'if.cgi$wan_ip': '192.168.0.66',
        'if.cgi$wan_netmask': '255.255.255.0',
        'if.cgi$wan_gateway': '192.168.0.1',
        'man.cgi$serial_no': '084764(112334)',
        'man.cgi$wan_mac_addr': '00:0e:e3:08:47:64',
        'status.cgi$outdate': '2017/03/28',
        'status.cgi$md5_signal': '',
        'status.cgi$fmver': '2.09.00',
        'status.cgi$hwver': '1.2',
        'status.cgi$module_type': 'S201',
        'status.cgi$pdns': config.board.pdns || '168.95.1.1',
        'status.cgi$ap_tcps_port': config.board.modernoApiPort || '443',
        'status.cgi$ap_tcpc1': config.board.modernoApiUrl || 'access.moderno.com.ar',
        'status.cgi$soft_status': 'Online',
        'status.cgi$http_block': config.board.httpPort || '80',
        'status.cgi$mini52_type': '1',
        'status.cgi$mini52_fwver': '1.0.0',
        'status.cgi$uptime': new Date().toLocaleString(),
        'status.cgi$lift_ms_name': 'Master',
        'status.cgi$next_semac': 'None',
        'status.cgi$antipb': 'Disabled',
        'status.cgi$antifd': 'Enabled',
        'dhcpc.cgi$hostname': config.board.hostname || 'TNG-Board',
        'man.cgi$lift_status': config.board.lifts === '1' ? '1' : '0',
        'status.cgi$language_set': '1,1,1',
        'status.cgi$add_list': '0,0,0',
        'status.cgi$del_list': '0,0,0',
        'status.cgi$web_language': '2',
        'status.cgi$BYPASS_MODE': '0',
        'status.cgi$dhcp_off': 'checked',
        'status.cgi$dhcp_on': '',
        'dhcpc.cgi$hostname': 'TNG-PRO-VIRTUAL',
        'status.cgi$wan_fix_ip1': '192', 'status.cgi$wan_fix_ip2': '168', 'status.cgi$wan_fix_ip3': '1', 'status.cgi$wan_fix_ip4': '100',
        'status.cgi$wan_fix_netmask1': '255', 'status.cgi$wan_fix_netmask2': '255', 'status.cgi$wan_fix_netmask3': '255', 'status.cgi$wan_fix_netmask4': '0',
        'status.cgi$wan_fix_gateway1': '192', 'status.cgi$wan_fix_gateway2': '168', 'status.cgi$wan_fix_gateway3': '1', 'status.cgi$wan_fix_gateway4': '1',
        'status.cgi$pdns1': '8', 'status.cgi$pdns2': '8', 'status.cgi$pdns3': '8', 'status.cgi$pdns4': '8',
        'man.cgi$door_table': doorRows || '<tr><td colspan="5" align="center">No doors configured</td></tr>',
        'if.cgi$logid': logRows || '<tr><td colspan="8" align="center">No logs available</td></tr>',
        'if.cgi$Userlogdata': logRows || '<tr><td colspan="8" align="center">No logs available</td></tr>',
        'if.cgi$syslog': logRows || '<tr><td colspan="8" align="center">No logs available</td></tr>',
        'if.cgi$userid': userRows || '<tr><td colspan="8" align="center">No Users</td></tr>',
        'if.cgi$id': activeUser.id || '',
        'if.cgi$markid': activeUser.id || '',
        'if.cgi$user_name': activeUser.name || '',
        'if.cgi$Password': activeUser.pin || '',
        'if.cgi$card_snc': activeUser.card || '',
        'status.cgi$end_log': config.logs.length.toString(),
        'man.cgi$log_tail': config.logs.length.toString(),
        // Hardware Settings from real config
        'status.cgi$dhcp_on': config.network?.dhcp ? 'checked' : '',
        'status.cgi$dhcp_off': !config.network?.dhcp ? 'checked' : '',
        'status.cgi$wan_fix_ip1': (config.network?.ip || '192.168.0.66').split('.')[0],
        'status.cgi$wan_fix_ip2': (config.network?.ip || '192.168.0.66').split('.')[1],
        'status.cgi$wan_fix_ip3': (config.network?.ip || '192.168.0.66').split('.')[2],
        'status.cgi$wan_fix_ip4': (config.network?.ip || '192.168.0.66').split('.')[3],
        'status.cgi$wan_fix_netmask1': (config.network?.mask || '255.255.255.0').split('.')[0],
        'status.cgi$wan_fix_netmask2': (config.network?.mask || '255.255.255.0').split('.')[1],
        'status.cgi$wan_fix_netmask3': (config.network?.mask || '255.255.255.0').split('.')[2],
        'status.cgi$wan_fix_netmask4': (config.network?.mask || '255.255.255.0').split('.')[3],
        'status.cgi$wan_fix_gateway1': (config.network?.gateway || '192.168.0.1').split('.')[0],
        'status.cgi$wan_fix_gateway2': (config.network?.gateway || '192.168.0.1').split('.')[1],
        'status.cgi$wan_fix_gateway3': (config.network?.gateway || '192.168.0.1').split('.')[2],
        'status.cgi$wan_fix_gateway4': (config.network?.gateway || '192.168.0.1').split('.')[3],
    });

    return html.replace(/<!-#([a-zA-Z0-9.]+)\$([a-zA-Z0-9_]+)-->/g, (match, script, variable) => {
        const key = `${script}\$${variable}`;
        if (ssiMap[key] !== undefined) {
            return ssiMap[key];
        }
        return '0'; 
    });
}

// Routes
app.get(['/', '/index.htm'], authMiddleware, (req, res) => {
    const filePath = getCorrectFilePath('index.htm');
    if (filePath) {
        let html = fs.readFileSync(filePath, 'utf8');
        html = processSSI(html, getConfig());
        res.send(html);
    } else {
        res.status(404).send('index.htm not found');
    }
});

app.get(/\.htm$/, authMiddleware, (req, res) => {
    const filename = path.basename(req.path);
    const filePath = getCorrectFilePath(filename);

    if (filePath) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        let html = fs.readFileSync(filePath, 'utf8');
        html = processSSI(html, getConfig());
        res.send(html);
    } else {
        res.status(404).send('File not found in firmware assets');
    }
});

app.all('/status.cgi', authMiddleware, (req, res) => {
    const params = Object.assign({}, req.query, req.body);
    const { a, b, c } = params;
    const config = getConfig();

    // Handle new_log requests (original functionality)
    if (a === 'new_log') {
        const clientLogIndex = parseInt(b);
        const serverLogCount = config.logs.length;
        
        if (serverLogCount <= clientLogIndex) {
            return res.send('0');
        }
        
        const logToReturn = config.logs[serverLogCount - 1 - clientLogIndex];
        if (!logToReturn) return res.send('0');

        const user = config.users.find(u => u.name === logToReturn.user) || { id: '0', name: logToReturn.user };
        const now = new Date(logToReturn.timestamp);
        const dateStr = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        const response = `${user.id || '0'},${user.name},${dateStr},${timeStr},IN,${logToReturn.door},${logToReturn.action},${clientLogIndex + 1}`;
        return res.send(response);
    }

    // Handle config updates (original functionality)
    if (params.type === 'config') {
        const logMsg = `[${new Date().toISOString()}] Config update: ${JSON.stringify(params)}\n`;
        fs.appendFileSync(path.join(__dirname, 'scratch/cgi_log.txt'), logMsg);
        
        if (!config.board) config.board = {};
        
        config.board.modernoApiUrl = params.TF_peer_ip || config.board.modernoApiUrl;
        config.board.modernoApiPort = params.TF_port || config.board.modernoApiPort;
        config.board.httpPort = params.http_block_value || config.board.httpPort;
        config.board.id = params.id || config.board.id;
        config.board.hostname = params.dhcp_name || config.board.hostname;
        config.board.lastUpdate = new Date().toISOString();
        
        saveConfig(config);
        updateCloudUrls(config.board.modernoApiUrl, config.board.modernoApiPort);
        
        // Preserve redirect behavior for firmware UI flows
        if (params.redirect) {
            return res.redirect(params.redirect);
        }
        return res.send('OK');
    }

    if (params.redirect) {
        return res.redirect(params.redirect);
    }
    
    // Default: return CGI variables for status (new functionality)
    res.type('text/plain').send(`
var ver="${config.board.version}"
var mac="${config.board.mac}"
var ip="${config.network?.ip || '192.168.0.66'}"
var mask="${config.network?.mask || '255.255.255.0'}"
var gateway="${config.network?.gateway || '192.168.0.1'}"
var users=${config.users.length}
var logs=${config.logs.length}
var uptime="${Math.floor(process.uptime())} seconds"
var serial="${config.board.serial}"
    `.trim());
});

app.all('/man.cgi', authMiddleware, (req, res) => {
    const params = Object.assign({}, req.query, req.body);
    const { type, securitystate } = params;

    console.log(`[man.cgi] Query received:`, params);

    if (type === 'door_status') {
        const config = getConfig();
        let table = '<table border="1">';
        config.doors.forEach(d => {
            table += `<tr align="center"><td>D${d.id}</td><td>${d.status === 'open' ? 'OPEN' : 'OK'}</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td><td>OK</td></tr>`;
        });
        table += '</table>';
        return res.send(table);
    }

    if (type === 'door_on') {
        console.log(`[man.cgi] Type: ${type}, securitystate: ${securitystate}`);

        let state = securitystate;
        if (!state) state = '10000000';
        if (state.length < 8) state = state.padEnd(8, '0');
        const activeIndex = state.indexOf('1');
        if (activeIndex === -1) {
            console.error(`[man.cgi] Error: No active relay found in securitystate`);
            return res.status(400).json({ error: "Invalid securitystate. No relay active." });
        }

        const relay = activeIndex + 1;
        console.log(`[man.cgi] Relay detected: ${relay}`);

        openDoorLocally(`Door ${relay}`, 'Remote Admin');

        if (params.redirect === 'scrt.htm') {
            return res.send(`<html><body><h2>Door opened successfully</h2></body></html>`);
        }

        return res.status(200).json({
            success: true,
            type: "door_on",
            relay: relay,
            securitystate: securitystate,
            message: `Relay ${relay} opened`
        });
    }

    if (type === 'set_net') {
        const config = getConfig();
        if (!config.network) config.network = {};
        config.network.dhcp = params.dhcp === '1';
        config.network.ip = `${params.ip1}.${params.ip2}.${params.ip3}.${params.ip4}`;
        config.network.mask = `${params.mask1}.${params.mask2}.${params.mask3}.${params.mask4}`;
        config.network.gateway = `${params.gateway1}.${params.gateway2}.${params.gateway3}.${params.gateway4}`;
        saveConfig(config);
        console.log(`[Config] Network updated: ${config.network.ip}`);
    }

    if (type === 'reboot') {
        console.log(`[System] Rebooting simulator...`);
        setTimeout(() => process.exit(0), 1000); // Simulate reboot by exiting (PM2 or Vercel will restart it)
    }

    if (params.redirect) {
        return res.redirect(params.redirect);
    }
    res.send('OK');
});

app.all('/if.cgi', authMiddleware, (req, res) => {
    const params = Object.assign({}, req.query, req.body);
    const { type, id, MarkID, username, CardID, Password, page = 0 } = params;
    const config = getConfig();
    const PAGE_SIZE = 20;

    // Handle log page view (honor redirect for legacy UI flows)
    if (type === 'go_log_page') {
        const start = parseInt(page) * PAGE_SIZE;
        const logs = config.logs.slice(start, start + PAGE_SIZE);
        
        // If redirect is specified, render the template with current data via SSI
        if (params.redirect) {
            // Only allow .htm/.html redirects to prevent path traversal
            if (!params.redirect.match(/\.html?$/i)) {
                return res.status(400).send('Invalid redirect target');
            }
            const filePath = getCorrectFilePath(params.redirect);
            if (filePath) {
                let html = fs.readFileSync(filePath, 'utf8');
                html = processSSI(html, getConfig());
                return res.type('text/html').send(html);
            }
            return res.status(404).send('Redirect target not found');
        }
        
        // Standalone HTML table for direct API calls
        let html = `<html><head><title>Access Logs</title></head><body>
<h2>Access Logs (Page ${page})</h2>
<table border="1" cellpadding="5">
<tr><th>Date</th><th>Time</th><th>Card</th><th>User</th><th>Action</th><th>Door</th></tr>`;
        
        logs.forEach(log => {
            const d = new Date(log.timestamp);
            const dateStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
            const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
            html += `<tr><td>${dateStr}</td><td>${timeStr}</td><td>${log.card || '00000000'}</td><td>${log.user}</td><td>${log.action}</td><td>${log.door}</td></tr>`;
        });
        
        html += `</table>
<p>Total: ${config.logs.length} logs | Page ${page} of ${Math.ceil(config.logs.length / PAGE_SIZE) || 1}</p>
</body></html>`;
        return res.type('text/html').send(html);
    }
    
    // Handle user page view (honor redirect for legacy UI flows)
    if (type === 'go_user_page') {
        const start = parseInt(page) * PAGE_SIZE;
        const users = config.users.slice(start, start + PAGE_SIZE);
        
        // If redirect is specified, render the template with current data via SSI
        if (params.redirect) {
            // Only allow .htm/.html redirects to prevent path traversal
            if (!params.redirect.match(/\.html?$/i)) {
                return res.status(400).send('Invalid redirect target');
            }
            const filePath = getCorrectFilePath(params.redirect);
            if (filePath) {
                let html = fs.readFileSync(filePath, 'utf8');
                html = processSSI(html, getConfig());
                return res.type('text/html').send(html);
            }
            return res.status(404).send('Redirect target not found');
        }
        
        // Standalone HTML table for direct API calls
        let html = `<html><head><title>User List</title></head><body>
<h2>Registered Users (Page ${page})</h2>
<table border="1" cellpadding="5">
<tr><th>ID</th><th>Name</th><th>Card</th><th>PIN</th><th>Type</th><th>Status</th></tr>`;
        
        users.forEach(user => {
            html += `<tr><td>${user.id}</td><td>${user.name}</td><td>${user.card || '-'}</td><td>${user.pin || '-'}</td><td>${user.type || 'Normal'}</td><td>${user.active !== false ? 'Active' : 'Inactive'}</td></tr>`;
        });
        
        html += `</table>
<p>Total: ${config.users.length} users | Page ${page} of ${Math.ceil(config.users.length / PAGE_SIZE) || 1}</p>
</body></html>`;
        return res.type('text/html').send(html);
    }

    // Existing handlers
    if (type === 'user_edit' || type === 'want_emp') {
        activeUserEditId = parseInt(id || MarkID);
    } else if (type === 'user_delete') {
        const deletedUser = config.users.find(u => u.id === parseInt(id));
        config.users = config.users.filter(u => u.id !== parseInt(id));
        saveConfig(config);
        reportEventToCloud('User Deleted', deletedUser ? deletedUser.name : 'Unknown', `ID: ${id}`);
    } else if (type === 'user_data') {
        const userId = parseInt(MarkID);
        const userIndex = config.users.findIndex(u => u.id === userId);
        const userData = {
            id: userId,
            name: username || 'New User',
            card: CardID || '00000000',
            pin: Password || '0000'
        };

        if (userIndex > -1) {
            config.users[userIndex] = userData;
        } else {
            config.users.push(userData);
        }

        config.logs.unshift({
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            user: 'System',
            action: userIndex > -1 ? 'User Updated' : 'User Created',
            door: `User ${userId}`
        });

        saveConfig(config);
        reportEventToCloud(userIndex > -1 ? 'User Updated' : 'User Created', username || 'New User', `ID: ${userId}`);
    } else if (type === 'search_emp') {
        const query = params.UserID || params.CardID || params.UserName;
        console.log(`[Search] Searching for user: ${query}`);
    } else if (type === 'clock_setup') {
        console.log(`[Clock] System time updated to: ${params.year}/${params.month}/${params.day} ${params.hour}:${params.min}`);
    } else if (type === 'set_pass') {
        console.log(`[Security] Admin password change requested`);
        if (!config.board) config.board = {};
        config.board.password = params.new_pass;
        saveConfig(config);
    }

    if (params.redirect) {
        return res.redirect(params.redirect);
    }
    res.send('OK');
});

// --- CGI ENDPOINTS (before static middleware) ---

app.use(express.static(WEB_DIR));

// Serve real configuration files for cloning/backup
app.get(['/database.cfg', '/userdata.cfg', '/userlist.txt'], (req, res) => {
    const filename = path.basename(req.path);
    const filePath = path.join(__dirname, 'real_plate_clone', filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('Config file not found');
    }
});

// --- SIMULATOR ---
app.get('/simulator', (req, res) => {
    const config = getConfig();
    const users = config.users.slice(0, 10);
    let userButtons = users.map(u => `
        <div class="keyfob" onclick="swipeCard('${u.card}', '${u.name}')">
            <div class="chip"></div>
            <span class="user-name">${u.name}</span>
            <span class="card-id">${u.card}</span>
        </div>
    `).join('');
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>TNG Simulator</title>
        <style>
            body { background: #0a0a0a; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; width: 100%; max-width: 1000px; }
            .keyfob { background: #1a1a1a; border: 2px solid #333; padding: 20px; border-radius: 15px; cursor: pointer; text-align: center; }
            .keyfob:hover { border-color: #007bff; }
            .chip { width: 40px; height: 30px; background: gold; border-radius: 5px; margin: 0 auto 10px; }
            .user-name { font-weight: bold; display: block; color: #007bff; }
            .log { margin-top: 40px; width: 100%; max-width: 1000px; background: #000; padding: 20px; height: 200px; overflow-y: auto; font-family: monospace; border: 1px solid #222; }
        </style>
    </head>
    <body>
        <h1>WIEGAND SIMULATOR</h1>
        <div class="grid">${userButtons}</div>
        <div id="log" class="log"></div>
        <script>
            async function swipeCard(cardNumber, name) {
                const log = document.getElementById('log');
                log.innerHTML = '[' + new Date().toLocaleTimeString() + '] Swiping ' + name + '...<br>' + log.innerHTML;
                const res = await fetch('/api/simulate-wiegand', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cardNumber, name })
                });
                const data = await res.json();
                if (data.success) log.innerHTML = '<span style="color:green">SUCCESS</span><br>' + log.innerHTML;
            }
        </script>
    </body>
    </html>`);
});

app.post('/api/simulate-wiegand', express.json(), (req, res) => {
    const { cardNumber, name } = req.body;
    const config = getConfig();
    config.logs.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        user: name,
        action: 'Access Granted',
        door: 'Reader 1'
    });
    saveConfig(config);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Authentic TNG PRO WebServer Simulator running at http://localhost:${PORT}`);
});

module.exports = app;
