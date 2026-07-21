# Security Policy

## Autenticación Requerida

Este simulador implementa **HTTP Basic Authentication** para todos los endpoints CGI. Por defecto, la autenticación está **habilitada** (`MODE=authorized`).

### Configuración Segura

1. **Nunca commitear `.env`** - El archivo `.env` contiene credenciales reales y debe estar en `.gitignore`.
2. **Usar `.env.example`** - Este archivo template está incluido en el repo sin credenciales sensibles.
3. **Generar contraseñas seguras** - Usar al menos 16 caracteres con mezcla de mayúsculas, minúsculas, números y símbolos.

### Modos de Operación

| MODE | Descripción | Uso Recomendado |
|------|-------------|-----------------|
| `authorized` | Auth requerida para endpoints CGI | Producción, testing remoto |
| `online` | Auth + cloud sync habilitado | Integración con Moderno cloud |
| `unauthorized` | Sin autenticación | Desarrollo local aislado únicamente |

## Vulnerabilidades

Mantenemos 0 vulnerabilidades conocidas:

```bash
npm audit              # Verificar estado
npm audit fix          # Auto-fix cuando es posible
npm audit fix --force # Forzar fixes (puede breaking)
```

## Exposición a Internet

**No exponer este simulador directamente a internet.** Está diseñado para:
- Desarrollo local (`localhost`)
- Redes privadas (LAN)
- Testing detrás de reverse proxy con SSL

Si necesitas acceso remoto:
1. Usar VPN o SSH tunnel
2. Agregar HTTPS con certificado válido
3. Implementar rate limiting y fail2ban

## Rate Limiting

El servidor incluye rate limiting básico (100 requests/minuto por IP). Para entornos de producción, considerar:
- Reducir límite a 60 req/min
- Agregar autenticación por API key además de Basic Auth
- Implementar logging de intentos fallidos

## Reportar Vulnerabilidades

Si encontrás un problema de seguridad, reportarlo de forma responsable abriendo un issue en GitHub o contactando directamente al maintainer. No divulgar públicamente hasta que sea resuelto.
