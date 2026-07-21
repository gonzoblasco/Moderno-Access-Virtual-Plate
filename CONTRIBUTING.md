# Contributing Guide

Gracias por querer contribuir al Moderno Access Virtual Plate! Esta guía te ayudará a empezar.

## Cómo Contribuir

### 1. Reportar Bugs

Antes de abrir un issue, verificar:
- [ ] El bug existe en la última versión (`main` branch)
- [ ] No hay un issue existente reportándolo
- [ ] Tenés los pasos para reproducirlo

**Template de Bug Report:**
```markdown
**Descripción:** Qué está fallando

**Pasos para reproducir:**
1. `curl -u admin:admin http://localhost:8080/endpoint`
2. Ver error...

**Comportamiento esperado:** Qué debería pasar

**Environment:**
- Node version: v18.x
- OS: macOS/Linux/Windows
- npm version: 9.x

**Logs:** (si aplica)
```

### 2. Sugerir Features

Abrir un issue con label `enhancement`. Incluir:
- **Use case:** Por qué es útil
- **Ejemplo:** Cómo se usaría
- **Alternativas:** Otras soluciones consideradas

### 3. Pull Requests

**Antes de enviar:**
- [ ] Tests passing (`npm test`)
- [ ] `npm audit` → 0 vulnerabilities
- [ ] Código formateado (si aplica)
- [ ] Docs actualizadas (si cambia comportamiento)

**Proceso:**
1. Fork del repositorio
2. Crear branch feature (`git checkout -b feature/mi-feature`)
3. Commits atómicos y descriptivos
4. Push a tu fork
5. Abrir PR desde GitHub

**Template de PR:**
```markdown
## Descripción
Qué cambios incluye este PR

## Cambios
- [x] Feature X implementada
- [ ] Tests agregados
- [ ] Docs actualizadas

## Testing
Cómo probaste los cambios:
```bash
npm test
curl -u admin:admin http://localhost:8080/nuevo-endpoint
```

## Checklist
- [ ] Tests passing
- [ ] Sin nuevas vulnerabilidades
- [ ] Sigue convenciones del proyecto
```

---

## Convenciones de Código

### JavaScript / Node.js

- **Estilo:** Seguir código existente (no hay linter configurado aún)
- **Imports:** CommonJS (`require`) para consistencia
- **Async/Await:** Preferir sobre callbacks
- **Errores:** Try/catch con logging descriptivo

Ejemplo:
```javascript
// ✅ Bien
async function getUser(id) {
    try {
        const config = getConfig();
        const user = config.users.find(u => u.id === id);
        if (!user) throw new Error(`User ${id} not found`);
        return user;
    } catch (err) {
        console.error(`[getUser] Error: ${err.message}`);
        throw err;
    }
}

// ❌ Evitar
function getUser(id, callback) {
    // Callbacks anidados...
}
```

### Endpoints CGI

- **Nomenclatura:** Mantener nombres originales (`status.cgi`, `man.cgi`, etc.)
- **Auth:** Aplicar `authMiddleware` a todos los endpoints nuevos
- **Response:** JSON para APIs, HTML para UIs legacy
- **Logging:** Usar prefijo `[endpoint]` en logs

Ejemplo:
```javascript
app.get('/mi-endpoint.cgi', authMiddleware, (req, res) => {
    console.log('[mi-endpoint] Request received');
    
    const { param } = req.query;
    const config = getConfig();
    
    // Validar
    if (!param) {
        return res.status(400).json({ error: 'Missing param' });
    }
    
    // Procesar
    const result = processSomething(param, config);
    
    // Responder
    res.json({ success: true, data: result });
});
```

### Tests

- **Framework:** Jest + Supertest
- **Ubicación:** `tests/*.test.js`
- **Cobertura mínima:** 80% en server.js
- **Auth tests:** Siempre probar con/sin credenciales

Ejemplo:
```javascript
const request = require('supertest');
const app = require('../server');

describe('GET /mi-endpoint.cgi', () => {
    it('requires auth', async () => {
        const res = await request(app).get('/mi-endpoint.cgi');
        expect(res.status).toBe(401);
    });

    it('returns data with auth', async () => {
        const res = await request(app)
            .get('/mi-endpoint.cgi?param=value')
            .auth('admin', 'admin');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
```

---

## Arquitectura

Ver [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) para detalles internos.

**Componentes clave:**
- `server.js` → Core Express app
- `config.schema.js` → Validación Zod
- `config.json` → Estado persistente
- `.env` → Configuración ambiente

**Flujo típico:**
```
Request → Rate Limit → Auth → Handler → Config Update → Webhook → Response
```

---

## Release Process

1. **Version bump** en `package.json` (SemVer)
2. **CHANGELOG.md** actualizado
3. **Tests** passing
4. **PR** aprobado y mergeado
5. **Tag** en GitHub (`v1.2.3`)
6. **Release notes** en GitHub Releases

---

## Código de Conducta

- **Respeto:** Tratar a todos con respeto
- **Constructivo:** Críticas al código, no a las personas
- **Inclusivo:** Lenguaje inclusivo en issues y PRs
- **Paciencia:** Mantainers responden cuando pueden

---

## Preguntas Frecuentes

### ¿Por qué CGI en 2026?

Compatibilidad con hardware legacy TNG PRO. El simulador replica el comportamiento exacto para testing de integraciones existentes.

### ¿Puedo agregar una UI moderna?

Sí! Hay un issue abierto (#42) para React/Vue dashboard. Comentar ahí si querés colaborar.

### ¿Cómo pruebo sin hardware real?

El simulador ES el hardware real (virtualizado). Usar `npm start` y curl/Postman para testing.

### ¿Los webhooks son obligatorios?

No. Si `WEBHOOK_URL` no está definido, los eventos solo se loguean localmente.

---

## Recursos

- [API Reference](./docs/API_REFERENCE.md)
- [Setup Guide](./docs/SETUP.md)
- [Security Policy](./SECURITY.md)
- [README](../README.md)

---

**Gracias por contribuir!** 🎉
