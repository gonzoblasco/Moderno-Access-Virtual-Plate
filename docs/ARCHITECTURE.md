# Arquitectura del Simulador

## Visión General

Moderno-Access-Virtual-Plate es un simulador de la placa de control de acceso **TNG PRO S201** que replica el comportamiento del hardware físico para permitir desarrollo y testing de integraciones sin necesidad del dispositivo real.

## Stack Tecnológico

```
Node.js (v18+) → Express 5 → CGI API Simulator
                    ↓
            JSON File Storage (config.json)
                    ↓
            Cloud Bridge (Webhooks + Sync)
```

## Componentes Principales

### 1. Server (server.js)

**Responsabilidad:** Core del simulador, maneja todas las requests HTTP.

**Estructura:**
- **Middleware Stack:**
  - `express-rate-limit` (100 req/min por IP)
  - `cors()` (habilitado para integración web local)
  - `morgan('dev')` (logging de requests)
  - `express.json()` + `express.urlencoded()` (body parsers)
  - `authMiddleware` (HTTP Basic Auth - habilitado por defecto)
  - `express.static(WEB_DIR)` (archivos estáticos del UI original)

- **Rutas CGI:**
  - `/status.cgi` - Estado del sistema (variables CGI)
  - `/man.cgi` - Comandos manuales (abrir puertas, relays)
  - `/if.cgi` - Funciones internas (usuarios, logs, configuración)

- **Rutas Especiales:**
  - `/status.htm` - UI visual de estado (HTML legacy)
  - `/simulator` - UI moderna de testing con keyfobs virtuales
  - `/api/simulate-wiegand` - Endpoint para simular lecturas de tarjetas

### 2. Configuración (config.json)

**Schema validado con Zod:**

```javascript
{
  board: {
    name: string,           // "TNG PRO S201"
    version: string,        // "2.09.00,Mar 28 2017(HW1.2)"
    securityState: string,  // 8-bit mask "10000000"
    serial: string,         // "TNG20260506"
    mac: string,            // "00:0e:e3:08:47:64"
    modernoApiUrl: string,  // URL cloud sync
  },
  doors: Door[],            // [{ id, name, status }]
  users: User[],            // [{ id, name, card, pin, type, active }]
  logs: Log[],              // [{ id, timestamp, user, action, door, card }]
  network?: { ip, mask, gateway }
}
```

**Persistencia:** Archivo JSON en disco. Cada modificación (abrir puerta, crear usuario) actualiza el archivo.

### 3. Autenticación

**Modos:**
- `authorized` (default): HTTP Basic Auth requerido para todos los endpoints CGI
- `unauthorized`: Sin auth (solo desarrollo local aislado)
- `online`: Auth + cloud sync habilitado

**Middleware:**
```javascript
const authMiddleware = (req, res, next) => {
    if (MODE === 'unauthorized') return next();
    // Validar credentials contra BOARD_USER / BOARD_PASS
};
```

### 4. Cloud Bridge

**Funcionalidades:**
- **Sync de usuarios:** Polling cada 15s a `MODERNO_API_URL/api/public/devices/${SERIAL_NUMBER}/sync`
- **Reporte de eventos:** Webhook POST a `WEBHOOK_URL` cuando ocurren eventos (apertura, usuario creado/actualizado)

**Endpoints Cloud:**
```
GET  /api/public/devices/:serial/sync  → Lista de usuarios
POST /api/webhooks/hardware-event      → Evento de hardware
```

### 5. Rate Limiting

**Configuración:**
- Window: 60 segundos
- Max: 100 requests por IP
- Mensaje: `{ error: 'Too many requests' }`

## Flujo de Request Típico

```
1. Client → GET /man.cgi?type=door_on&securitystate=10000000
2. Rate Limiter → ¿IP dentro del límite? (Sí)
3. Auth Middleware → ¿Credentials válidas? (Sí)
4. Handler /man.cgi → Parsear parámetros
5. openDoorLocally() → 
   - Actualizar config.logs
   - Guardar config.json
   - Reportar evento a cloud (webhook)
6. Response → { success: true, relay: 1 }
```

## Endpoints Detallados

Ver [`API_REFERENCE.md`](./API_REFERENCE.md) para documentación completa de cada endpoint.

## Estados de Puertas

Cada puerta tiene 3 estados posibles:
- `closed` - Normal, cerrada
- `open` - Abierta (relay activado)
- `locked` - Bloqueada (no se puede abrir)

El `securityState` del board es una máscara de 8 bits:
- `10000000` - Relay 1 activo (Puerta 1)
- `01000000` - Relay 2 activo (Puerta 2)
- `11000000` - Ambos relays activos

## Logs

Formato de log entry:
```json
{
  "id": "1753123456789",
  "timestamp": "2026-07-21T18:42:10.434Z",
  "user": "Juan Perez",
  "action": "Open Door",
  "door": "Entrada Principal",
  "card": "00000000"
}
```

**Rotación:** No implementada automáticamente. Se recomienda limpiar periódicamente en producción.

## Consideraciones de Seguridad

1. **Auth siempre habilitada** en producción (`MODE=authorized`)
2. **Nunca exponer directamente a internet** - usar VPN o SSH tunnel
3. **Credenciales en .env**, nunca en el repo
4. **Rate limiting** protege contra brute-force básico
5. **CORS habilitado** solo para desarrollo local

## Extensiones Futuras

- [ ] WebSocket para push de eventos en tiempo real
- [ ] SQLite en lugar de JSON file para escalabilidad
- [ ] Rotación automática de logs
- [ ] Web UI moderna (React/Vue) reemplazando HTML legacy
- [ ] Dockerfile para deploy containerizado
- [ ] CLI tool para operaciones comunes
