# Setup Guide

## Requisitos Previos

- Node.js v18 o superior
- npm o pnpm
- Git (para clonar el repo)

## Instalación Rápida

```bash
# 1. Clonar repositorio
git clone https://github.com/Breacorp/Moderno-Access-Virtual-Plate.git
cd Moderno-Access-Virtual-Plate

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env con tus credenciales

# 4. Iniciar servidor
npm start

# 5. Verificar
curl -u admin:admin http://localhost:8080/status.cgi
```

---

## Configuración Detallada

### Paso 1: Variables de Entorno (.env)

Copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

Editar `.env`:

```env
# Puerto del servidor
PORT=8080

# Tipo de placa simulada
BOARD_TYPE=TNG PRO

# Seguridad (IMPORTANTE: cambiar en producción)
MODE=authorized
BOARD_USER=admin
BOARD_PASS=<generar-contraseña-segura>

# Hardware simulation
SERIAL_NUMBER=TNG20260506
RELAYS=2
LATENCY_MS=0

# Cloud Integration (opcional)
WEBHOOK_URL=http://localhost:3000/api/webhook
# MODERNO_API_URL=https://access.moderno.com.ar
```

**Notas de seguridad:**
- `MODE=authorized` → Requiere auth para todos los endpoints CGI
- `MODE=unauthorized` → Sin auth (SOLO desarrollo local)
- **Nunca commitear `.env`** al repositorio

### Paso 2: Configuración del Board (config.json)

El archivo `config.json` contiene el estado completo del simulador:

```json
{
  "board": {
    "name": "TNG PRO S201",
    "version": "2.09.00,Mar 28 2017(HW1.2)",
    "securityState": "10000000",
    "serial": "TNG20260506",
    "mac": "00:0e:e3:08:47:64"
  },
  "doors": [
    { "id": 1, "name": "Entrada Principal", "status": "closed" },
    { "id": 2, "name": "Salida Emergencia", "status": "closed" }
  ],
  "users": [...],
  "logs": [...]
}
```

**Importante:** El validador Zod verifica este schema al startup. Si hay errores, se loguean pero el servidor continúa (backward compatibility).

### Paso 3: Iniciar el Servidor

**Producción:**
```bash
npm start
```

**Desarrollo (auto-reload):**
```bash
npm run dev
```

**Verificación:**
```bash
# Sin auth (debería fallar si MODE=authorized)
curl http://localhost:8080/status.cgi
# → 401 Unauthorized

# Con auth
curl -u admin:admin http://localhost:8080/status.cgi
# → var ver="2.09.00..."
```

---

## Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Iniciar servidor en modo producción |
| `npm run dev` | Iniciar con auto-reload (desarrollo) |
| `npm test` | Ejecutar tests con coverage |
| `npm run test:watch` | Tests en watch mode |
| `npm audit` | Verificar vulnerabilidades |
| `npm audit fix` | Auto-fix vulnerabilities |

---

## Troubleshooting

### Error: `EADDRINUSE: address already in use :::8080`

El puerto 8080 ya está en uso. Soluciones:

```bash
# Opción 1: Matar proceso existente
lsof -i :8080
kill -9 <PID>

# Opción 2: Cambiar puerto en .env
PORT=8081
```

### Error: `Cannot find module 'zod'`

Dependencias no instaladas correctamente:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Error: `[Config] Validation failed`

El `config.json` tiene datos inválidos. Verificar:

```bash
node -e "console.log(require('./config.schema').validateConfig(require('./config.json')))"
```

Errores comunes:
- `securityState` no es string de 8 bits (`"10000000"`)
- `mac` no sigue formato `XX:XX:XX:XX:XX:XX`
- IPs inválidas en `network`

### Error: `[Cloud Sync Error] Invalid URL`

La URL de Moderno API es inválida. Verificar `.env`:

```env
MODERNO_API_URL=https://access.moderno.com.ar
# No usar http:// sin SSL en producción
```

### Auth no funciona

Verificar que `MODE` no sea `"unauthorized"`:

```bash
grep MODE .env
# Debería ser: MODE=authorized
```

Si es `unauthorized`, todas las requests pasan sin auth.

### Rate limit excedido

Error 429 después de muchas requests rápidas:

```bash
# Esperar 60 segundos o
# Aumentar límite en server.js (línea ~18)
max: 100  # → 200
```

---

## Desarrollo

### Estructura del Proyecto

```
moderno-access-sim/
├── server.js              # Core del simulador
├── config.json            # Estado persistente
├── config.schema.js       # Validación Zod
├── .env                   # Variables de entorno (no commitear)
├── .env.example           # Template seguro
├── package.json           # Dependencias y scripts
├── docs/
│   ├── ARCHITECTURE.md    # Arquitectura interna
│   ├── API_REFERENCE.md   # Docs de endpoints
│   └── SETUP.md           # Esta guía
├── tests/
│   ├── endpoints.test.js  # Tests de APIs
│   └── auth.test.js       # Tests de autenticación
├── public/                # Archivos estáticos (UI legacy)
├── scratch/uploads/       # Subidas temporales (.gitignore)
└── real_plate_clone/      # Configs reales de hardware
```

### Agregar Nuevo Endpoint

1. Definir ruta en `server.js` (antes de `express.static`)
2. Aplicar `authMiddleware` si corresponde
3. Validar parámetros
4. Retornar respuesta apropiada

Ejemplo:
```javascript
app.get('/mi-endpoint', authMiddleware, (req, res) => {
    const { param } = req.query;
    const config = getConfig();
    
    // Lógica...
    
    res.json({ success: true });
});
```

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage

# Test específico
npm test -- endpoints.test.js
```

### Debugging

**Con VS Code:**
Agregar `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Simulator",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/server.js"
    }
  ]
}
```

**Logging:**
El servidor usa `console.log` extensivamente. Para reducir ruido:
```bash
# Solo errores
NODE_ENV=production npm start
```

---

## Producción

### Checklist Pre-Deploy

- [ ] `MODE=authorized` en `.env`
- [ ] `BOARD_PASS` con contraseña segura (16+ caracteres)
- [ ] `npm audit` → 0 vulnerabilities
- [ ] Tests passing (`npm test`)
- [ ] CORS restringido (si aplica)
- [ ] Rate limiting configurado
- [ ] Logs rotados externamente
- [ ] Backup de `config.json` programado

### Deploy con Docker (Opcional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

```bash
docker build -t moderno-sim .
docker run -p 8080:8080 --env-file .env moderno-sim
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name sim.tudominio.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Rate limiting adicional
        limit_req zone=one burst=10 nodelay;
    }
}
```

---

## Soporte

- **Issues:** GitHub Issues del repositorio
- **API Docs:** [`API_REFERENCE.md`](./API_REFERENCE.md)
- **Arquitectura:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Seguridad:** [`SECURITY.md`](../SECURITY.md)
