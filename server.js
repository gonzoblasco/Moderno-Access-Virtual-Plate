const express = require('express');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const auth = require('basic-auth');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const WEB_DIR = path.join(__dirname, 'public');

app.use(morgan('dev'));
app.use(express.json());

// Simulation State
function getConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
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

// SSI Processor
function processSSI(html, config) {
    const ssiMap = {
        'status.cgi$proname': `"${config.board.name}"`,
        'status.cgi$log_pw_on': '"checked"',
        'status.cgi$web_mode': '0',
        'status.cgi$language': '0', // 0: English, 1: CHS, 2: CHT
        'status.cgi$fmver': '"C2P-Ver1.9"',
        'status.cgi$hwver': '"2.0"',
        'status.cgi$module_type': '"SEMAC-D2"',
        'status.cgi$uptime': '"12 days, 04:22:11"',
        'status.cgi$modelname': '2',
        'status.cgi$Max_User': '20000',
        'status.cgi$outdate': '"03/28/2017"',
        'status.cgi$md5_signal': '""',
        'status.cgi$pdns': '"8.8.8.8"',
        'status.cgi$ap_tcps_port': '1001',
        'status.cgi$ap_tcpc1': '"0.0.0.0"',
        'status.cgi$soft_status': '"Connected"',
        'status.cgi$http_block': '80',
        'status.cgi$control_mode': '"Online"',
        'status.cgi$antipb': '"Disable"',
        'status.cgi$antifd': '"Disable"',
        'status.cgi$next_semac': '"None"',
        'status.cgi$lift_ms_name': '"None"',
        'man.cgi$serial_no': '"TNG-PRO-20170328"',
        'man.cgi$wan_mac_addr': '"00:11:22:33:44:55"',
        'man.cgi$lift_status': '0',
        'if.cgi$TID': '"TNG_WEB_01"',
        'if.cgi$wan_ip': '"192.168.1.50"',
        'if.cgi$wan_netmask': '"255.255.255.0"',
        'if.cgi$wan_gateway': '"192.168.1.1"',
        'if.cgi$Reg': config.users.length,
        'if.cgi$ava_user': 20000 - config.users.length,
        'if.cgi$LogCount': `${config.logs.length}/0`
    };

    return html.replace(/<!-#([a-zA-Z0-9.]+)\$([a-zA-Z0-9_]+)-->/g, (match, script, variable) => {
        const key = `${script}\$${variable}`;
        return ssiMap[key] !== undefined ? ssiMap[key] : match;
    });
}

// Serve authentic files with SSI processing
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

// CGI Endpoints
app.get('/status.cgi', authMiddleware, (req, res) => {
    const config = getConfig();
    res.send(`proname="${config.board.name}"&securitystate=${config.board.securityState}&fmver="C2P-Ver1.9"`);
});

app.get('/man.cgi', authMiddleware, (req, res) => {
    const config = getConfig();
    const { type, securitystate, redirect } = req.query;

    if (type === 'door_on' && securitystate) {
        config.board.securityState = securitystate;
        config.logs.push({
            timestamp: new Date().toISOString(),
            user: 'Remote Admin',
            action: 'OPEN DOOR',
            door: 'All (Security State Change)'
        });
        saveConfig(config);
    }

    if (redirect) {
        return res.redirect(redirect);
    }
    res.send('OK');
});

app.get('/if.cgi', authMiddleware, (req, res) => {
    const { redirect } = req.query;
    if (redirect) return res.redirect(redirect);
    res.send('OK');
});

// Static Assets (Images, CSS, JS)
app.use(express.static(WEB_DIR));

// Simulation Control API (Moderno Access Dashboard)
app.get('/api/simulator/status', (req, res) => {
    res.json(getConfig());
});

app.post('/api/simulator/mode', (req, res) => {
    process.env.MODE = req.body.mode;
    res.json({ success: true, mode: process.env.MODE });
});

app.listen(PORT, () => {
    console.log(`Authentic TNG PRO WebServer Simulator running at http://localhost:${PORT}`);
    console.log(`Serving firmware assets from: ${WEB_DIR}`);
});
