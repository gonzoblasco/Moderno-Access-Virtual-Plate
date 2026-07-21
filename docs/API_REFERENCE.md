# API Reference

Todos los endpoints requieren **HTTP Basic Authentication** (excepto archivos estáticos).

**Credentials por defecto:**
- Username: `admin`
- Password: `admin`

**Base URL:** `http://localhost:8080`

---

## Endpoints de Estado

### `GET /status.htm`

**Descripción:** Página HTML visual con el estado completo del sistema. Replica la UI original de la placa TNG PRO.

**Auth:** Requerida

**Response:** `text/html`

**Ejemplo:**
```bash
curl -u admin:admin http://localhost:8080/status.htm
```

**Contenido:**
- Nombre del producto, serial, firmware
- Dirección IP, máscara, gateway
- Cantidad de usuarios registrados
- Logs de acceso/sistema
- Estado de puertas

---

### `GET /status.cgi`

**Descripción:** Estado del sistema en formato de variables CGI (texto plano). Ideal para integración programática.

**Auth:** Requerida

**Response:** `text/plain`

**Variables retornadas:**
```
var ver="2.09.00,Mar 28 2017(HW1.2)"
var mac="00:0e:e3:08:47:64"
var ip="192.168.0.66"
var mask="255.255.255.0"
var gateway="192.168.0.1"
var users=49
var logs=182
var uptime="3600 seconds"
var serial="TNG20260506"
```

**Ejemplo:**
```bash
curl -u admin:admin http://localhost:8080/status.cgi
```

**Caso especial - `?a=new_log&b={index}`:**
Retorna un log específico en formato CSV:
```
{user_id},{user_name},{date},{time},IN,{door},{action},{index}
```

---

## Endpoints de Control

### `GET /man.cgi?type=door_on&securitystate={mask}`

**Descripción:** Abrir puerta(s) activando relay(s).

**Auth:** Requerida

**Parámetros:**
- `type`: `"door_on"`
- `securitystate`: Máscara de 8 bits (string de 0s y 1s)
  - `10000000` → Abrir puerta 1 (relay 1)
  - `01000000` → Abrir puerta 2 (relay 2)
  - `11000000` → Abrir ambas puertas

**Response:** `application/json`
```json
{
  "success": true,
  "type": "door_on",
  "relay": 1,
  "securitystate": "10000000",
  "message": "Relay 1 opened"
}
```

**Ejemplos:**
```bash
# Abrir puerta 1
curl -u admin:admin "http://localhost:8080/man.cgi?type=door_on&securitystate=10000000"

# Abrir puerta 2
curl -u admin:admin "http://localhost:8080/man.cgi?type=door_on&securitystate=01000000"

# Abrir ambas
curl -u admin:admin "http://localhost:8080/man.cgi?type=door_on&securitystate=11000000"
```

**Efectos secundarios:**
- Crea un log entry en `config.json`
- Dispara webhook a cloud (si está configurado)

---

## Endpoints de Usuarios y Logs

### `GET /if.cgi?type=go_user_page&page={n}`

**Descripción:** Lista paginada de usuarios registrados.

**Auth:** Requerida

**Parámetros:**
- `type`: `"go_user_page"`
- `page`: Número de página (0-indexed, 20 usuarios por página)

**Response:** `text/html`

**Formato:** Tabla HTML con columnas:
| ID | Name | Card | PIN | Type | Status |

**Ejemplo:**
```bash
curl -u admin:admin "http://localhost:8080/if.cgi?type=go_user_page&page=0"
```

---

### `GET /if.cgi?type=go_log_page&page={n}`

**Descripción:** Lista paginada de logs de acceso.

**Auth:** Requerida

**Parámetros:**
- `type`: `"go_log_page"`
- `page`: Número de página (0-indexed, 20 logs por página)

**Response:** `text/html`

**Formato:** Tabla HTML con columnas:
| Date | Time | Card | User | Action | Door |

**Ejemplo:**
```bash
curl -u admin:admin "http://localhost:8080/if.cgi?type=go_log_page&page=0"
```

---

### `GET /if.cgi?type=user_data&MarkID={id}&username={name}&CardID={card}&Password={pin}`

**Descripción:** Crear o actualizar un usuario.

**Auth:** Requerida

**Parámetros:**
- `type`: `"user_data"`
- `MarkID`: ID del usuario (para update) o nuevo ID (para create)
- `username`: Nombre del usuario
- `CardID`: Número de tarjeta (opcional)
- `Password`: PIN (opcional)

**Response:** `text/plain` → `"OK"`

**Efectos secundarios:**
- Crea/actualiza usuario en `config.json`
- Crea log entry ("User Created" o "User Updated")
- Dispara webhook a cloud

**Ejemplo:**
```bash
# Crear usuario nuevo
curl -u admin:admin "http://localhost:8080/if.cgi?type=user_data&MarkID=100&username=Juan+Perez&CardID=12345678&Password=1234"

# Actualizar usuario existente
curl -u admin:admin "http://localhost:8080/if.cgi?type=user_data&MarkID=100&username=Juan+Perez+Actualizado"
```

---

### `GET /if.cgi?type=user_delete&id={id}`

**Descripción:** Eliminar un usuario.

**Auth:** Requerida

**Parámetros:**
- `type`: `"user_delete"`
- `id`: ID del usuario a eliminar

**Response:** `text/plain` → `"OK"`

**Efectos secundarios:**
- Elimina usuario de `config.json`
- Dispara webhook a cloud

**Ejemplo:**
```bash
curl -u admin:admin "http://localhost:8080/if.cgi?type=user_delete&id=100"
```

---

### `GET /if.cgi?type=want_emp&id={id}`

**Descripción:** Marcar usuario como activo para edición.

**Auth:** Requerida

**Parámetros:**
- `type`: `"want_emp"`
- `id`: ID del usuario

**Response:** Redirección o `"OK"`

---

## Endpoints de Configuración

### `GET /if.cgi?type=config&{params}`

**Descripción:** Actualizar configuración del board.

**Auth:** Requerida

**Parámetros soportados:**
- `TF_peer_ip`: Moderno API URL
- `TF_port`: Moderno API port
- `http_block_value`: HTTP port
- `id`: Board ID
- `dhcp_name`: Hostname

**Response:** `text/plain` → `"OK"`

**Efectos secundarios:**
- Actualiza `config.board` en `config.json`
- Loguea cambio en `scratch/cgi_log.txt`
- Actualiza URLs de cloud

---

### `GET /if.cgi?type=clock_setup&year={y}&month={m}&day={d}&hour={h}&min={m}`

**Descripción:** Actualizar reloj del sistema.

**Auth:** Requerida

**Response:** `text/plain` → `"OK"` (loguea en consola)

---

### `GET /if.cgi?type=set_pass&new_pass={password}`

**Descripción:** Cambiar contraseña de admin.

**Auth:** Requerida

**Response:** `text/plain` → `"OK"`

**Nota:** Actualmente solo loguea el intento, no implementa cambio real.

---

## Endpoints de Simulación

### `GET /simulator`

**Descripción:** UI interactiva para simular lecturas de tarjetas con keyfobs virtuales.

**Auth:** No requerida

**Response:** `text/html`

**Características:**
- Muestra primeros 10 usuarios como keyfobs clickeables
- Log de eventos en tiempo real
- Botones para simular swipe de cada usuario

**Ejemplo:**
```bash
curl http://localhost:8080/simulator
```

---

### `POST /api/simulate-wiegand`

**Descripción:** Simular lectura de tarjeta Wiegand.

**Auth:** No requerida

**Body:** `application/json`
```json
{
  "cardNumber": "12345678",
  "name": "Juan Perez"
}
```

**Response:** `application/json`
```json
{
  "success": true
}
```

**Efectos secundarios:**
- Crea log entry con timestamp actual
- Guarda en `config.json`

**Ejemplo:**
```bash
curl -X POST http://localhost:8080/api/simulate-wiegand \
  -H "Content-Type: application/json" \
  -d '{"cardNumber":"12345678","name":"Test User"}'
```

---

## Archivos de Configuración

### `/database.cfg`, `/userdata.cfg`, `/userlist.txt`

**Descripción:** Descarga archivos de configuración reales (desde `real_plate_clone/`).

**Auth:** No requerida

**Response:** File download

---

## Códigos de Error

| HTTP Status | Significado |
|-------------|-------------|
| 200 OK | Request exitosa (verificar body para errores específicos) |
| 401 Unauthorized | Credenciales inválidas o faltantes |
| 404 Not Found | Endpoint no existe |
| 429 Too Many Requests | Rate limit excedido |
| 500 Internal Server Error | Error interno del simulador |

---

## Ejemplo de Integración Completa (Node.js)

```javascript
const axios = require('axios');

const PLATE_URL = 'http://localhost:8080';
const AUTH = { username: 'admin', password: 'admin' };

async function getStatus() {
    const res = await axios.get(`${PLATE_URL}/status.cgi`, { auth: AUTH });
    // Parsear variables CGI del response
    return res.data;
}

async function openDoor(doorNumber) {
    const mask = '0'.repeat(8).split('');
    mask[doorNumber - 1] = '1';
    const securitystate = mask.join('');
    
    const res = await axios.get(
        `${PLATE_URL}/man.cgi?type=door_on&securitystate=${securitystate}`,
        { auth: AUTH }
    );
    return res.data;
}

async function getUsers(page = 0) {
    const res = await axios.get(
        `${PLATE_URL}/if.cgi?type=go_user_page&page=${page}`,
        { auth: AUTH }
    );
    // Parsear HTML table
    return res.data;
}

async function createUser(name, card, pin) {
    const res = await axios.get(
        `${PLATE_URL}/if.cgi?type=user_data&MarkID=${Date.now()}&username=${encodeURIComponent(name)}&CardID=${card}&Password=${pin}`,
        { auth: AUTH }
    );
    return res.status === 200;
}

// Usage
(async () => {
    console.log('Status:', await getStatus());
    console.log('Opening door 1:', await openDoor(1));
    console.log('Users:', await getUsers(0));
    console.log('Created user:', await createUser('Test', '12345678', '1234'));
})();
```
