# Moderno Access Virtual Plate

[![Tests](https://img.shields.io/badge/tests-20%20passed-brightgreen)]()
[![Vulnerabilities](https://img.shields.io/badge/vulnerabilities-0-brightgreen)]()
[![License](https://img.shields.io/badge/license-ISC-blue)]()

Simulador local de placa de control de acceso **TNG PRO S201** compatible con Moderno Access. Permite probar integraciones sin necesidad de hardware físico.

## 🚀 Quick Start

```bash
# 1. Clonar e instalar
git clone https://github.com/Breacorp/Moderno-Access-Virtual-Plate.git
cd Moderno-Access-Virtual-Plate
npm install

# 2. Configurar (copiar template)
cp .env.example .env

# 3. Iniciar
npm start

# 4. Probar
curl -u admin:admin http://localhost:8080/status.cgi
```

Accede a `http://localhost:8080` para ver el panel de control.

---

## ✨ Características

- **Endpoints CGI compatibles** con hardware TNG PRO / SEMAC / CHIYU
- **Panel web premium** para monitoreo en tiempo real
- **Auth HTTP Basic** habilitada por defecto
- **Rate limiting** (100 req/min por IP)
- **Cloud bridge** opcional para sync con Moderno Access API
- **Configuración flexible** vía `config.json` y `.env`
- **Validación de schema** con Zod
- **Tests automatizados** con Jest + Supertest

---

## 📡 Endpoints Principales

| Endpoint | Descripción | Auth |
|----------|-------------|------|
| `GET /status.htm` | Estado visual (HTML UI) | ✅ |
| `GET /status.cgi` | Estado para software (CGI vars) | ✅ |
| `GET /man.cgi?type=door_on&securitystate=10000000` | Abrir puerta 1 | ✅ |
| `GET /if.cgi?type=go_log_page&page=0` | Logs paginados | ✅ |
| `GET /if.cgi?type=go_user_page&page=0` | Usuarios paginados | ✅ |
| `GET /simulator` | UI interactiva de testing | ❌ |

Ver [`docs/API_REFERENCE.md`](./docs/API_REFERENCE.md) para documentación completa.

---

## 🔧 Configuración

### Variables de Entorno (.env)

```env
PORT=8080
BOARD_TYPE=TNG PRO

# Seguridad (CAMBIAR en producción!)
MODE=authorized
BOARD_USER=admin
BOARD_PASS=<contraseña-segura>

# Hardware
SERIAL_NUMBER=TNG20260506
RELAYS=2
LATENCY_MS=0

# Cloud Integration (opcional)
WEBHOOK_URL=http://localhost:3000/api/webhook
```

### Configuración del Board (config.json)

```json
{
  "board": {
    "name": "TNG PRO S201",
    "serial": "TNG20260506",
    "mac": "00:0e:e3:08:47:64"
  },
  "doors": [
    { "id": 1, "name": "Entrada Principal", "status": "closed" }
  ],
  "users": [...],
  "logs": [...]
}
```

---

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm test -- --coverage
```

**Estado actual:** 20 tests passing, ~53% coverage en `server.js`

---

## 📚 Documentación

| Doc | Descripción |
|-----|-------------|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Arquitectura interna y componentes |
| [`docs/API_REFERENCE.md`](./docs/API_REFERENCE.md) | Referencia completa de endpoints |
| [`docs/SETUP.md`](./docs/SETUP.md) | Guía de instalación y troubleshooting |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Cómo contribuir al proyecto |
| [`SECURITY.md`](./SECURITY.md) | Políticas de seguridad |
| [`CHANGELOG.md`](./CHANGELOG.md) | Historial de cambios |

---

## 🔒 Seguridad

- **Auth básica requerida** para todos los endpoints CGI
- **Rate limiting** contra brute-force (100 req/min)
- **Credenciales en `.env`** (nunca commitear)
- **0 vulnerabilidades** npm audit

⚠️ **No exponer directamente a internet**. Usar VPN, SSH tunnel, o reverse proxy con SSL.

Ver [`SECURITY.md`](./SECURITY.md) para detalles.

---

## 🛠️ Comandos

| Comando | Descripción |
|---------|-------------|
| `npm start` | Iniciar servidor (producción) |
| `npm run dev` | Iniciar con auto-reload (desarrollo) |
| `npm test` | Ejecutar tests |
| `npm audit` | Verificar vulnerabilidades |
| `npm audit fix` | Auto-fix vulnerabilities |

---

## 🤝 Contribuir

1. Fork el repositorio
2. Crear branch feature (`git checkout -b feature/mi-feature`)
3. Tests passing (`npm test`)
4. Commit descriptivo
5. Push y abrir PR

Ver [`CONTRIBUTING.md`](./CONTRIBUTING.md) para guía detallada.

---

## 📦 Dependencias Principales

- `express` ^5.2.1 - Web framework
- `express-rate-limit` ^8.6.0 - Rate limiting
- `zod` ^4.4.3 - Validación de schema
- `basic-auth` ^2.0.1 - HTTP Basic Auth
- `axios` ^1.16.0 - Cloud sync HTTP client
- `dotenv` ^17.4.2 - Variables de entorno

**Dev Dependencies:**
- `jest` ^30.4.2 - Testing framework
- `supertest` ^7.2.2 - HTTP testing

---

## 📄 License

ISC

---

## 🙏 Agradecimientos

- TNG Technology por el hardware original
- Moderno Access por la API cloud
- Contributors y maintainers

---

**Hecho con ❤️ para la comunidad de desarrollo de control de acceso**
