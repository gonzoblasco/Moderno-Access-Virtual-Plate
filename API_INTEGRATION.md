# 📖 TNG PRO S201 - API Integration Guide

This document describes how to programmatically communicate with a TNG PRO S201 access control plate (or its virtual simulator). The plate uses a legacy **CGI-based API** over HTTP.

---

## 1. Connection & Authentication

The plate requires **HTTP Basic Authentication** for all requests.

- **Default Username:** `admin`
- **Default Password:** `admin`
- **Protocol:** `HTTP` (Port 80 by default)

**Example Header:**
`Authorization: Basic YWRtaW46YWRtaW4=`

---

## 2. Core API Endpoints

### 🚪 Remote Door Opening
To open a door (activate a relay), use the `man.cgi` endpoint with the `door_on` type.

- **URL:** `/man.cgi?type=door_on&securitystate={mask}`
- **Method:** `GET`
- **Parameter \`securitystate\`:** An 8-character string of `0`s and `1`s representing the 8 possible relays.
    - `10000000` -> Open Door 1
    - `01000000` -> Open Door 2
    - `11000000` -> Open Door 1 and 2 simultaneously

**Example Request (cURL):**
```bash
curl -u admin:admin "http://192.168.0.66/man.cgi?type=door_on&securitystate=10000000"
```

### ⚙️ System Status
To retrieve hardware info, network settings, and firmware version.

- **URL:** `/status.cgi`
- **Method:** `GET`
- **Response Format:** Custom Variable format (parsed by the web UI).
- **Common Variables to Parse:**
    - `status.cgi$ver`: Firmware version.
    - `status.cgi$mac`: Hardware MAC Address.
    - `status.cgi$ip`: Current IP Address.

### 👥 User Management
To retrieve the list of registered users.

- **URL:** `/if.cgi?redirect=database.htm&failure=fail.htm&type=go_user_page&page={N}&sort=1`
- **Method:** `GET`
- **Parameter \`page\`:** Page number (starts at 0, usually 20 users per page).
- **Response Format:** HTML Table. Integration systems must parse the `<tr>` and `<td>` elements.
- **Parsing Logic:** Look for `<a>` tags with `type=want_emp`. The `id` parameter in the link is the internal User ID.

### 📝 Access Logs
To retrieve the history of events (openings, alarms).

- **URL:** `/if.cgi?redirect=AccLog.htm&failure=fail.htm&type=go_log_page&page={N}`
- **Method:** `GET`
- **Response Format:** HTML Table.

---

## 3. Implementation Example (Node.js)

```javascript
const axios = require('axios');

const config = {
  auth: {
    username: 'admin',
    password: 'admin'
  }
};

async function openDoor(ip, doorNumber) {
  const mask = '0'.repeat(8).split('');
  mask[doorNumber - 1] = '1';
  const securitystate = mask.join('');
  
  try {
    const response = await axios.get(`http://${ip}/man.cgi?type=door_on&securitystate=${securitystate}`, config);
    console.log('Door Opening Command Sent:', response.status === 200 ? 'Success' : 'Failed');
  } catch (error) {
    console.error('Error connecting to the plate:', error.message);
  }
}

// Usage: openDoor('192.168.0.66', 1);
```

---

## 4. Error Handling

| Status Code | Meaning |
|-------------|---------|
| 200 OK | Request accepted (check response body for specific errors). |
| 401 Unauthorized | Invalid credentials. |
| 404 Not Found | Endpoint not supported or invalid path. |
| 500 Error | Internal hardware failure or malformed CGI parameters. |

> [!NOTE]
> The Moderno Access Virtual Plate simulator supports all these endpoints with the same behavior as the physical hardware, allowing for safe integration testing.
