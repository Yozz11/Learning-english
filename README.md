# English Coach

App personal para aprender inglés: test de nivel, perfil por habilidades y un profesor IA que me conoce.

Etapa 1 (en construcción): PWA + test de nivel + perfil + chat con el profesor.

## Estructura

- `shared/` — tipos y constantes que usan el frontend y el backend (el contrato).
- `api/` — Cloudflare Worker (API + sirve la web compilada). Base de datos D1.
- `web/` — React + TypeScript + Vite, instalable como PWA.

## Requisitos

- Node 20+ (en este equipo está en `~/.local`, no en pacman).
- Una cuenta de Cloudflare (para desplegar).

## Desarrollo local

```sh
npm install

# 1) crear la base de datos local y cargar los datos base
npm run db:local

# 2) API en http://127.0.0.1:8787
npm run dev:api

# 3) web en http://127.0.0.1:5173 (proxy /api -> 8787)
npm run dev:web
```

Sin API key de Gemini la app usa un proveedor de prueba (`AI_PROVIDER=mock`) que
responde con textos fijos. Así se puede probar todo el flujo sin gastar cuota.

## Variables y secretos

Se configuran en `api/.dev.vars` (local, ignorado por git) y como secrets de
Cloudflare en producción. Nunca se suben al repositorio.

| Nombre | Para qué |
|---|---|
| `APP_PASSPHRASE` | La contraseña con la que entro a la app. |
| `SESSION_SECRET` | Firma la cookie de sesión. |
| `AI_PROVIDER` | `gemini` o `mock`. |
| `GEMINI_API_KEY` | Solo si `AI_PROVIDER=gemini`. |
| `GEMINI_MODEL` | Por defecto `gemini-3.6-flash`. |

## Despliegue (cuando toque)

```sh
npx wrangler login
npx wrangler d1 create english-coach      # copiar el database_id a api/wrangler.jsonc
npm run db:remote
wrangler secret put APP_PASSPHRASE
wrangler secret put SESSION_SECRET
wrangler secret put GEMINI_API_KEY
npm run build && npm run deploy --workspace api
```
