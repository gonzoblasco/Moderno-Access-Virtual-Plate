# Changelog

Todos los cambios notables a este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Rate limiting (100 req/min por IP) con `express-rate-limit`
- Validación de schema con Zod para `config.json`
- Tests automatizados con Jest + Supertest (20 tests, ~53% coverage)
- Documentación completa:
  - `docs/ARCHITECTURE.md` - Arquitectura interna
  - `docs/API_REFERENCE.md` - Referencia de endpoints
  - `docs/SETUP.md` - Guía de instalación y troubleshooting
  - `CONTRIBUTING.md` - Guía para contribuidores
  - `SECURITY.md` - Políticas de seguridad
- `.env.example` con template seguro
- Endpoints CGI completos:
  - `/status.cgi` ahora retorna variables CGI reales (no solo "OK")
  - `/if.cgi?type=go_log_page` retorna tabla HTML con logs paginados
  - `/if.cgi?type=go_user_page` retorna tabla HTML con usuarios paginados

### Changed
- **BREAKING:** Auth habilitada por defecto (`MODE=authorized`)
- Vulnerabilidades npm: 6 → 0 (axios, multer, body-parser, morgan, form-data, qs)
- Handler `/status.cgi` unificado: mantiene compatibilidad con `?a=new_log` y agrega response default
- `.gitignore` actualizado para excluir `.env.local`, `scratch/uploads/*`, `*.log`

### Fixed
- `/status.cgi` respondía "OK" para requests sin parámetros
- `/if.cgi` no renderizaba logs/users pages correctamente
- Cloud sync fallaba silenciosamente sin validación de URL
- Config validation errors no se logueaban adecuadamente

### Removed
- Handler duplicado de `/status.cgi`

### Security
- Auth básica requerida por defecto para todos los endpoints CGI
- Rate limiting contra brute-force attacks
- `.env` con credenciales explícitamente excluido del repo

---

## [1.0.0] - 2026-07-21

### Initial Release

Simulador funcional de placa TNG PRO S201 con:
- Endpoints CGI compatibles con hardware original
- Panel web UI legacy
- Cloud bridge para sync con Moderno Access
- Configuración vía `config.json` y `.env`
- Simulación de latencia y estados de seguridad

**Known Issues:**
- 6 vulnerabilidades npm (axios, multer, etc.)
- Auth opcional por defecto (inseguro)
- Endpoints `/status.cgi` e `/if.cgi` incompletos
- Sin tests automatizados
- Documentación mínima

---

## Notas de Versión

### Próximas Mejoras (Backlog)

- [ ] Web UI moderna (React/Vue) reemplazando HTML legacy
- [ ] WebSocket para eventos en tiempo real
- [ ] SQLite en lugar de JSON file storage
- [ ] Rotación automática de logs
- [ ] Dockerfile para deploy containerizado
- [ ] CLI tool para operaciones comunes
- [ ] GitHub Actions CI/CD
- [ ] Mock modes para simular fallas de red/hardware

---

## Convenciones

**Tipos de cambio:**
- **Added:** Nuevas features
- **Changed:** Cambios en comportamiento existente
- **Deprecated:** Features que serán removidas
- **Removed:** Features eliminadas
- **Fixed:** Bug fixes
- **Security:** Parches de seguridad

**Versionado:**
- `MAJOR.MINOR.PATCH`
- MAJOR: Cambios incompatibles
- MINOR: Features nuevas (backward compatible)
- PATCH: Bug fixes (backward compatible)
