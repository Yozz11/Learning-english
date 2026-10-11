# English Coach

App personal para aprender inglés: test de nivel, perfil por habilidades y un profesor IA que me conoce.

**Etapa 1 completa y probada en local.** Falta desplegarla (necesita mi cuenta de Cloudflare).

## Qué hace hoy

- **Login** con una contraseña (cookie HttpOnly firmada con HMAC; no se guarda la contraseña en la base).
- **Test de nivel adaptativo**: gramática, vocabulario, lectura y escritura. Empieza en B1 y busca el
  borde entre lo que sé y lo que no, así que dura entre **11 y 20 preguntas** en vez de siempre lo mismo.
  Devuelve nivel A1–C2 por habilidad, fortalezas, debilidades y errores detectados.
- **Perfil** por habilidad con nivel, aciertos y errores repetidos.
- **Profesor IA configurable** (nombre, personalidad, humor, formalidad, severidad, forma de corregir,
  uso del español, modo debate, personaje). Todo se edita desde la app, nada está fijo en el código.
- **Charla** con el profesor: corrige como máximo 1 o 2 errores por mensaje, prioriza los que repito y
  los guarda para insistir después. El resumen de la conversación se regenera solo cada 6 mensajes.
- **Inicio** que decide qué me toca: completar el perfil, hacer el test, reforzar lo más flojo o charlar.
- **PWA** oscura, pensada para el celular (instalable desde el navegador).

Todavía no: listening, speaking ni pronunciación (etapa 2), y el chat responde completo, sin streaming.

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

Sin API key de Gemini la app usa un proveedor de prueba (`AI_PROVIDER=mock`) que responde con textos
fijos. Así se puede probar todo el flujo sin gastar cuota (la escritura siempre da B1, es lo esperado).

Otros comandos: `npm run typecheck` y `npm run build`.

## Variables y secretos

Se configuran en `api/.dev.vars` (local, ignorado por git) y como secrets de Cloudflare en producción.
Nunca se suben al repositorio.

| Nombre | Para qué |
|---|---|
| `APP_PASSPHRASE` | La contraseña con la que entro a la app. |
| `SESSION_SECRET` | Firma la cookie de sesión. |
| `AI_PROVIDER` | `gemini` o `mock`. |
| `GEMINI_API_KEY` | Solo si `AI_PROVIDER=gemini`. |
| `GEMINI_MODEL` | Por defecto `gemini-3.6-flash`. |

Para generar un `SESSION_SECRET` nuevo: `openssl rand -base64 32`.

## Subir a GitHub

El repositorio ya está inicializado y con commits, pero todavía no tiene remoto.

```sh
# 1) pegar mi llave pública en GitHub -> Settings -> SSH keys
cat ~/.ssh/id_ed25519.pub

# 2) crear el repo (privado) y conectarlo
git remote add origin git@github.com:MI-USUARIO/english-coach.git
git push -u origin main
```

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

Antes de desplegar: cambiar la contraseña (la de desarrollo está en `api/.dev.vars`, que no se sube a
git) y rotar cualquier API key que se haya pegado en un chat.
