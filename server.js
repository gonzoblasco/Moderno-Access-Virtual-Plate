const express = require('express');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const auth = require('basic-auth');
const dotenv = require('dotenv');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors()); // Enable CORS for local web integration
const upload = multer({ dest: path.join(__dirname, 'scratch/uploads/') });
const PORT = process.env.PORT || 8080;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const WEB_DIR = path.join(__dirname, 'public');

app.use(morgan('dev'));
app.use(express.json());

// Cloud / Local Web Integration Configuration
// Cloud / Local Web Integration Configuration
const SERIAL_NUMBER = process.env.SERIAL_NUMBER || '084764(112334)';
const MODERNO_API_URL = process.env.MODERNO_API_URL || 'http://localhost:10000'; // Default port for Moderno Access backend
const WEBHOOK_URL = process.env.WEBHOOK_URL || `${MODERNO_API_URL}/api/webhooks/hardware-event`;

// Simulation State
function getConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
        console.warn(`[Simulator] Could not write config.json (expected in Vercel serverless environment): ${err.message}`);
    }
}

// Authentication Middleware
const authMiddleware = (req, res, next) => {
    if (process.env.MODE === 'unauthorized') {
        const credentials = auth(req);
        if (!credentials || credentials.name !== process.env.BOARD_USER || credentials.pass !== process.env.BOARD_PASS) {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="TNG PRO WebServer"');
            res.end('Access denied');
            return;
        }
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
        'status.cgi$pdns': '8.8.8.8',
        'status.cgi$ap_tcps_port': '443',
        'status.cgi$ap_tcpc1': 'access.moderno.com.ar',
        'status.cgi$soft_status': 'Connected',
        'status.cgi$http_block': '443',
        'status.cgi$control_mode': 'Cloud Mode',
        'status.cgi$antipb': 'Disabled',
        'status.cgi$antifd': 'Enabled',
        'status.cgi$next_semac': 'None',
        'status.cgi$lift_ms_name': 'Master',
        'status.cgi$Max_User': '20000',
        'status.cgi$mini52_type': '',
        'status.cgi$mini52_fwver': '',
        'status.cgi$uptime': new Date().toLocaleString(),
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
    const filePath = path.join(WEB_DIR, 'index.htm');
    if (fs.existsSync(filePath)) {
        let html = fs.readFileSync(filePath, 'utf8');
        html = processSSI(html, getConfig());
        res.send(html);
    } else {
        res.status(404).send('index.htm not found');
    }
});

app.get(/\.htm$/, authMiddleware, (req, res) => {
    const filename = path.basename(req.path);
    const filePath = path.join(WEB_DIR, filename);

    if (fs.existsSync(filePath)) {
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

    if (a === 'new_log') {
        const config = getConfig();
        const clientLogCount = parseInt(b);
        const serverLogCount = config.logs.length;
        
        // If there are no new logs, return a small value so the client keeps polling
        if (serverLogCount <= clientLogCount) {
            return res.send('0');
        }
        
        // Get the most recent log that the client hasn't seen yet
        // Since we use unshift(), the newest log is at index 0
        const latestLog = config.logs[0];
        const user = config.users.find(u => u.name === latestLog.user) || { id: '0', name: latestLog.user };
        
        const now = new Date(latestLog.timestamp);
        const dateStr = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        // CSV Format for autolog.htm: UserID, UserName, Date, Time, IN/OUT, Door, Note, NextTail
        const response = `${user.id || '0'},${user.name},${dateStr},${timeStr},IN,${latestLog.door},${latestLog.action},${serverLogCount}`;
        
        return res.send(response);
    }

    if (params.redirect) {
        return res.redirect(params.redirect);
    }
    res.send('OK');
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

        if (!securitystate || securitystate.length !== 8 || !/^[01]+$/.test(securitystate)) {
            console.error(`[man.cgi] Error: Invalid securitystate '${securitystate}'`);
            return res.status(400).json({ error: "Invalid securitystate format. Must be 8 characters of 0 and 1." });
        }

        const activeIndex = securitystate.indexOf('1');
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
    const { type, id, MarkID, username, CardID, Password } = params;
    const config = getConfig();

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

app.listen(PORT, () => {
    console.log(`Authentic TNG PRO WebServer Simulator running at http://localhost:${PORT}`);
});

module.exports = app;
