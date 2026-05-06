const express = require('express');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const auth = require('basic-auth');
const dotenv = require('dotenv');
const multer = require('multer');

dotenv.config();

const app = express();
const upload = multer({ dest: path.join(__dirname, 'scratch/uploads/') });
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
    const fullSsiMap = {
        'bfset.cgi$control_by_softwar': '',
        'dhcpc.cgi$hostname': '',
        'if.cgi$Card_Valid_Disable': '',
        'if.cgi$Card_Valid_Enable': '',
        'if.cgi$Event_List': '',
        'if.cgi$LogCount': '',
        'if.cgi$Password': '',
        'if.cgi$Reg': '',
        'if.cgi$TID': '',
        'if.cgi$Userlogdata': '',
        'if.cgi$Verify': '',
        'if.cgi$ava_user': '',
        'if.cgi$card_snc': '',
        'if.cgi$emp_title': '',
        'if.cgi$fc_card_snc': '',
        'if.cgi$hmnext_emp': '',
        'if.cgi$hmprev_emp': '',
        'if.cgi$hmuserid': '',
        'if.cgi$id': '',
        'if.cgi$logid': '',
        'if.cgi$markid': '',
        'if.cgi$maxuser': '',
        'if.cgi$maxusernum': '',
        'if.cgi$mlogid': '',
        'if.cgi$next_emp': '',
        'if.cgi$prev_emp': '',
        'if.cgi$radio_activate': '',
        'if.cgi$radio_deactivate': '',
        'if.cgi$reg_state': '',
        'if.cgi$syslog': '',
        'if.cgi$user_group_0': '',
        'if.cgi$user_group_1': '',
        'if.cgi$user_group_2': '',
        'if.cgi$user_group_3': '',
        'if.cgi$user_name': '',
        'if.cgi$userid': '',
        'if.cgi$usertype': '',
        'if.cgi$valid_ed': '',
        'if.cgi$valid_ehour': '',
        'if.cgi$valid_em': '',
        'if.cgi$valid_emin': '',
        'if.cgi$valid_ey': '',
        'if.cgi$valid_sd': '',
        'if.cgi$valid_shour': '',
        'if.cgi$valid_sm': '',
        'if.cgi$valid_smin': '',
        'if.cgi$valid_sy': '',
        'if.cgi$wan_gateway': '0.0.0.0',
        'if.cgi$wan_ip': '0.0.0.0',
        'if.cgi$wan_netmask': '0.0.0.0',
        'man.cgi$BF50_Staus': '0',
        'man.cgi$Control_M_Staus': '0',
        'man.cgi$Door_num_Staus': '0',
        'man.cgi$GListID': '',
        'man.cgi$TZListID': '',
        'man.cgi$adjust_backward': '',
        'man.cgi$adjust_forward': '',
        'man.cgi$admin_key_pwd': '',
        'man.cgi$alarm_list': '',
        'man.cgi$allow_door_0': '',
        'man.cgi$allow_door_1': '',
        'man.cgi$allow_door_2': '',
        'man.cgi$allow_door_3': '',
        'man.cgi$allow_door_4': '',
        'man.cgi$allow_door_5': '',
        'man.cgi$allow_door_6': '',
        'man.cgi$allow_door_7': '',
        'man.cgi$common_key_pwd': '',
        'man.cgi$dis_sntp_server': '',
        'man.cgi$door_id': '',
        'man.cgi$door_name': '',
        'man.cgi$door_rest_link': '',
        'man.cgi$door_status': '0',
        'man.cgi$door_switch': '',
        'man.cgi$door_table': '',
        'man.cgi$doors': '',
        'man.cgi$dst_bias': '',
        'man.cgi$dst_end_day': '',
        'man.cgi$dst_end_month': '',
        'man.cgi$dst_off': '',
        'man.cgi$dst_on': '',
        'man.cgi$dst_start_day': '',
        'man.cgi$dst_start_month': '',
        'man.cgi$en_sntp_server': '',
        'man.cgi$event_hold': '',
        'man.cgi$event_list_g1': '',
        'man.cgi$event_list_g2': '',
        'man.cgi$event_list_g3': '',
        'man.cgi$extra_sntp_server': '',
        'man.cgi$fire_Staus': '0',
        'man.cgi$get_event_group': '',
        'man.cgi$get_smtp_switch': '',
        'man.cgi$group': '',
        'man.cgi$group_list': '',
        'man.cgi$group_time_zones': '',
        'man.cgi$group_timezone_0': '',
        'man.cgi$group_timezone_1': '',
        'man.cgi$group_timezone_2': '',
        'man.cgi$group_timezone_3': '',
        'man.cgi$group_timezone_4': '',
        'man.cgi$group_timezone_5': '',
        'man.cgi$group_timezone_6': '',
        'man.cgi$group_timezone_7': '',
        'man.cgi$holiday': '',
        'man.cgi$ipc_list': '',
        'man.cgi$lift_enable': '',
        'man.cgi$lift_list': '',
        'man.cgi$lift_status': '0',
        'man.cgi$lift_table_status': '',
        'man.cgi$log_tail': '',
        'man.cgi$mail_domainname': '',
        'man.cgi$mail_return': '',
        'man.cgi$mail_server': '',
        'man.cgi$mail_to': '',
        'man.cgi$reg_key_pwd': '',
        'man.cgi$serial_no': 'TNG-PRO-20170328',
        'man.cgi$smtp_mail_from': '',
        'man.cgi$smtp_name': '',
        'man.cgi$smtp_pw': '',
        'man.cgi$sntp_tz': '',
        'man.cgi$time_zone': '',
        'man.cgi$times': '',
        'man.cgi$timezone_id': '',
        'man.cgi$timezone_list': '',
        'man.cgi$timezone_times': '',
        'man.cgi$user_group': '',
        'man.cgi$wan_mac_addr': '00:00:00:00:00:00',
        'man.cgi$wp_ip': '0.0.0.0',
        'man.cgi$wp_port': '80',
        'status.cgi$Accessories1': '0',
        'status.cgi$Accessories2': '0',
        'status.cgi$Accessories3': '0',
        'status.cgi$BYPASS_MODE': '0',
        'status.cgi$DEC_ON': '0',
        'status.cgi$HEX_DEC': '0',
        'status.cgi$HEX_ON': '0',
        'status.cgi$LOGO_Default': '0',
        'status.cgi$LOGO_OFF': '0',
        'status.cgi$Lift_Type1': '0',
        'status.cgi$Lift_Type2': '0',
        'status.cgi$Log_1': '0',
        'status.cgi$Log_2': '0',
        'status.cgi$Log_3': '0',
        'status.cgi$Log_4': '0',
        'status.cgi$Log_5': '0',
        'status.cgi$Log_6': '0',
        'status.cgi$Log_7': '0',
        'status.cgi$Log_8': '0',
        'status.cgi$Max_User': '20000',
        'status.cgi$Security_Status': '0',
        'status.cgi$add_list': '',
        'status.cgi$admin_name': '0',
        'status.cgi$admin_pwd': '0',
        'status.cgi$anti_fd_pwd': '0',
        'status.cgi$anti_pb_period': '0',
        'status.cgi$antifd': '0',
        'status.cgi$antipb': '0',
        'status.cgi$ap_tcpc1': '0',
        'status.cgi$ap_tcps_port': '0',
        'status.cgi$bf50_card_list': '',
        'status.cgi$blacklist_sw_off': '0',
        'status.cgi$blacklist_sw_on': '0',
        'status.cgi$both_relay_control': '0',
        'status.cgi$camara_id_in': '0',
        'status.cgi$camara_id_out': '0',
        'status.cgi$camara_inout_1': '0',
        'status.cgi$camara_inout_2': '0',
        'status.cgi$camara_inout_3': '0',
        'status.cgi$camara_inout_4': '0',
        'status.cgi$camara_inout_5': '0',
        'status.cgi$camara_inout_6': '0',
        'status.cgi$camara_inout_7': '0',
        'status.cgi$camara_inout_8': '0',
        'status.cgi$cctv_ip': '0',
        'status.cgi$cctv_port': '0',
        'status.cgi$control_mode': 'Online',
        'status.cgi$control_mode_number': '0',
        'status.cgi$del_list': '',
        'status.cgi$dhcp_off': '0',
        'status.cgi$dhcp_on': '0',
        'status.cgi$dis_anti_forced': '0',
        'status.cgi$dis_anti_pass_back': '0',
        'status.cgi$dis_fast_reg_card': '0',
        'status.cgi$door_num4': '0',
        'status.cgi$door_num8': '0',
        'status.cgi$en_anti_follow': '0',
        'status.cgi$en_anti_forced': '0',
        'status.cgi$en_anti_pass_back': '0',
        'status.cgi$en_fast_reg_card': '0',
        'status.cgi$end_log': '0',
        'status.cgi$facility_id_format': '0',
        'status.cgi$fcode_A1': '0',
        'status.cgi$fcode_A3': '0',
        'status.cgi$fcode_A5': '0',
        'status.cgi$fcode_A7': '0',
        'status.cgi$fcode_B1': '0',
        'status.cgi$fcode_B3': '0',
        'status.cgi$fcode_B5': '0',
        'status.cgi$fcode_B7': '0',
        'status.cgi$fcode_C1': '0',
        'status.cgi$fcode_C3': '0',
        'status.cgi$fmver': 'C2P-Ver1.9',
        'status.cgi$http_block': '0',
        'status.cgi$hwver': '2.0',
        'status.cgi$in_relay_control': '0',
        'status.cgi$ip_name': '0',
        'status.cgi$ip_own_define_0': '0',
        'status.cgi$ip_own_define_1': '0',
        'status.cgi$ip_own_define_2': '0',
        'status.cgi$ip_own_define_3': '0',
        'status.cgi$ip_own_define_4': '0',
        'status.cgi$ip_own_define_5': '0',
        'status.cgi$ip_own_define_6': '0',
        'status.cgi$ip_own_define_7': '0',
        'status.cgi$ip_own_define_type_selsct': '0',
        'status.cgi$ip_own_define_type_selsct_0': '0',
        'status.cgi$ip_own_define_type_selsct_1': '0',
        'status.cgi$ip_own_define_type_selsct_2': '0',
        'status.cgi$ip_own_define_type_selsct_3': '0',
        'status.cgi$ip_own_define_type_selsct_4': '0',
        'status.cgi$ip_own_define_type_selsct_5': '0',
        'status.cgi$ip_own_define_type_selsct_6': '0',
        'status.cgi$ip_own_define_type_selsct_7': '0',
        'status.cgi$ip_pw': '0',
        'status.cgi$ip_type': '0',
        'status.cgi$ip_type_select': '0',
        'status.cgi$language': '0',
        'status.cgi$language_set': '0',
        'status.cgi$lift_m': '0',
        'status.cgi$lift_ms': '0',
        'status.cgi$lift_ms_name': '0',
        'status.cgi$lift_s': '0',
        'status.cgi$log_pw_off': '0',
        'status.cgi$log_pw_on': 'checked',
        'status.cgi$logo_set': '0',
        'status.cgi$logo_show': '0',
        'status.cgi$md5_signal': '0',
        'status.cgi$mini52_fwver': '0',
        'status.cgi$mini52_type': '0',
        'status.cgi$modelname': '0',
        'status.cgi$module_type': 'SEMAC-D2',
        'status.cgi$next_semac': '0',
        'status.cgi$one_door': '0',
        'status.cgi$out_relay_control': '0',
        'status.cgi$outdate': '0',
        'status.cgi$pdns': '0',
        'status.cgi$pdns1': '0',
        'status.cgi$pdns2': '0',
        'status.cgi$pdns3': '0',
        'status.cgi$pdns4': '0',
        'status.cgi$productname': '0',
        'status.cgi$proname': `"${config.board.name}"`,
        'status.cgi$raw_id_format': '0',
        'status.cgi$semac_ip1': '0',
        'status.cgi$semac_ip2': '0',
        'status.cgi$semac_ip3': '0',
        'status.cgi$semac_ip4': '0',
        'status.cgi$soft_status': 'Connected',
        'status.cgi$success_info': '0',
        'status.cgi$sw_mode': '0',
        'status.cgi$trun_web': '0',
        'status.cgi$two_door': '0',
        'status.cgi$uptime': '12 days, 04:22:11',
        'status.cgi$user_0_name': '0',
        'status.cgi$user_0_pwd': '0',
        'status.cgi$user_name': '0',
        'status.cgi$user_pwd': '0',
        'status.cgi$wan_fix_gateway1': '0',
        'status.cgi$wan_fix_gateway2': '0',
        'status.cgi$wan_fix_gateway3': '0',
        'status.cgi$wan_fix_gateway4': '0',
        'status.cgi$wan_fix_ip1': '0',
        'status.cgi$wan_fix_ip2': '0',
        'status.cgi$wan_fix_ip3': '0',
        'status.cgi$wan_fix_ip4': '0',
        'status.cgi$wan_fix_netmask1': '0',
        'status.cgi$wan_fix_netmask2': '0',
        'status.cgi$wan_fix_netmask3': '0',
        'status.cgi$wan_fix_netmask4': '0',
        'status.cgi$we_in_v': '0',
        'status.cgi$web_language': '0',
        'status.cgi$web_mode': '0',
        'status.cgi$weblog_set': '0',
};


    const ssiMap = Object.assign({}, fullSsiMap, {
        'status.cgi$proname': `"${config.board.name}"`,
        'if.cgi$Reg': config.users.length,
        'if.cgi$ava_user': 20000 - config.users.length,
        'if.cgi$LogCount': `${config.logs.length}/0`,
        'man.cgi$door_table': '<tr><td colspan="5" align="center">No doors configured in simulator</td></tr>'
    });


    return html.replace(/<!-#([a-zA-Z0-9.]+)\$([a-zA-Z0-9_]+)-->/g, (match, script, variable) => {
        const key = `${script}\$${variable}`;
        if (ssiMap[key] !== undefined) {
            return ssiMap[key];
        }
        return '0'; // Default fallback for all unmapped tags to prevent JS SyntaxError
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

app.post('/man.cgi', authMiddleware, upload.single('filename'), (req, res) => {
    const { type, redirect, failure } = req.body;

    if (type === 'file_upload' && req.file) {
        console.log(`Received firmware upload: ${req.file.originalname}`);
        if (req.file.originalname.endsWith('.web')) {
            try {
                // Extract the .web file contents into public/ and firmware_web/
                require('child_process').execSync(`node scratch/final_extraction.js "${req.file.path}"`);
                console.log('Firmware Web assets successfully extracted and applied!');
            } catch (e) {
                console.error('Failed to extract firmware:', e.message);
                if (failure) return res.redirect(failure);
            }
        }
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
