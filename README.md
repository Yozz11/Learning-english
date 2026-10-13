# English Coach

App personal para aprender inglés: test de nivel, perfil por habilidades y un profesor IA que me conoce.

**Etapa 1 completa y probada en local.** Falta desplegarla (necesita mi cuenta de Cloudflare).

## Qué hace hoy

- **Login** con una contraseña (cookie HttpOnly firmada con HMAC; no se guarda la contraseña en la base).
- **Test de nivel adaptativo**: gramática, vocabulario, lectura y escritura. Empieza en B1 y busca el
  borde entre lo que sé y lo que no, así que dura entre **11 y 20 preguntas** en vez de siempre lo mismo.
  Devuelve nivel A1–C2 por habilidad, fortalezas, debilidades y errores detectados.
- **Perfil** por habilidad con nivel, aciertos y errores repetidos.
- **Profesor IA configurable** (nombre, personaje, personalidad, humor, formalidad, severidad, forma de
  corregir, uso del español, modo debate). Todo se edita desde la app, nada está fijo en el código.
- **Tu profe es quien tú elijas**: seis arquetipos listos (entrenador, profesora, amistad, mentor, rival,
  detective) que rellenan personalidad y ajustes de una vez, o un personaje escrito por ti. El personaje
  entra en el prompt, así que cambia de verdad cómo te habla.
- **Avatar**: seis dibujos de la app o una imagen tuya. La foto se recorta cuadrada y se reduce a 256 px
  en el propio teléfono (no se sube a ningún servicio de archivos).
- **Voz**: lee sus respuestas en voz alta con las voces que ya trae el dispositivo
  (`speechSynthesis`), una distinta por personaje. Sin descargas y sin costo. La app sugiere una voz
  parecida al personaje, pero la puedes cambiar a mano.
- **Charla** con el profesor que elijas: cada uno tiene su propia conversación y su ficha manda en el
  prompt. Habla contigo como una persona real —con opiniones, anécdotas y humor— y el aprendizaje pasa
  por debajo: corrige como máximo 1 o 2 errores por mensaje, solo cuando importan, repitiendo la frase
  bien dentro de su respuesta y dejando una nota aparte, sin parar la charla. Guarda los errores que
  repito para insistir después. El resumen de la conversación se regenera solo cada 6 mensajes. En el
  escritorio, a la derecha se ve la ficha del profesor con tu nivel y tus errores recientes.
- **Entrenar o charlar**: al elegir un profesor puedes conversar (lo de arriba) o **entrenar**, que es una
  sesión de práctica con ese mismo profesor: te pone un ejercicio corto a la vez (traducir, completar,
  responder), espera tu respuesta, te corrige y sigue. Son historiales aparte, así la conversación y la
  práctica no se mezclan. Las dos salidas están en la ficha y, en el escritorio, al pasar el mouse por
  la tarjeta.
- **Inicio** con la biblioteca de profesores: buscador, pestañas que filtran y ordenan, y una tarjeta por
  profesor con su frase y su contador de mensajes. Tocar una tarjeta abre su ficha completa.
- **Subir**: mandas un audio, un PDF, una foto o un texto y te devuelve lo que dice escrito, y opcionalmente
  traducido al español, con un par de notas de lo que conviene mirar. El archivo no se guarda en ningún
  sitio: va a la IA y se tira. En la base solo queda el texto, para releerlo sin gastar cuota otra vez.
  Hasta 12 MB por archivo y una llamada de la IA del día por archivo.
- **PWA** oscura, pensada para el celular (instalable desde el navegador).
- **Límites que me protegen**: la IP que falla 5 veces el login queda 15 minutos bloqueada, y las
  llamadas a la IA del día tienen tope (`AI_DAILY_LIMIT`): al pasarlo la app lo dice claro y no gasta cuota.

Todavía no: listening, speaking ni pronunciación (etapa 2), y el chat responde completo, sin streaming.

Sobre los personajes: los que trae la app son inventados para este proyecto. El que tú quieras (con su
cara) lo describes con tus palabras y los cargas desde tu copia (ver abajo): así el repositorio se queda
limpio y el personaje personal vive solo en tu configuración.

Para cargar de una vez tus propios personajes existe un script **que no va al repositorio**: vive en
`private/` (carpeta ignorada por git) y escribe directo en la base de datos.

```sh
cp private/personajes.ejemplo.json private/personajes.json   # tus datos, fuera de git
node private/cargar-personajes.mjs --local                   # o --remoto para producción
```

La primera vez que abres la app, la biblioteca se estrena sola: si ya tenías una ficha de profe guardada
se convierte en tu primer personaje; si no, se crean los seis personajes inventados para este proyecto.

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

Otros comandos: `npm run typecheck`, `npm run build`, `npm run test:api` y `npm run test:ui` (las pruebas
levantan su propio servidor y su propia base: no tocan la base local ni gastan cuota de IA). Las de
interfaz comparan las medidas con el plano de `docs/referencia/` (que vive fuera de git). Las de API
prueban además el proveedor de Gemini contra un Gemini de mentira en local (`GEMINI_BASE_URL`), así que
los reintentos y los archivos pegados al mensaje se prueban de verdad, sin salir a internet.

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
| `GEMINI_BASE_URL` | Solo para las pruebas: apunta a un Gemini de mentira en local. En producción no se pone. |
| `AI_DAILY_LIMIT` | Tope de llamadas a la IA por día (por defecto 200). Al pasarlo, la app avisa en vez de gastar cuota. |

Para generar un `SESSION_SECRET` nuevo: `openssl rand -base64 32`.

## Subir a GitHub

El repositorio ya está en `git@github.com:Yozz11/Learning-english.git` (rama `main`) y se autentica por
SSH con `~/.ssh/id_ed25519`. Para publicar cambios:

```sh
git status
git add -A
git commit -m "lo que cambié"
git push
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
git).

Antes de tocar la base de producción, sacar copia: `npm run db:export --workspace api` (o
`wrangler d1 export english-coach --remote --output copia.sql`). El archivo queda fuera de git.

## Música de fondo

La app tiene un jazz suave de fondo (volumen bajito, activable desde el botón flotante de nota
musical). Música: «Feelin Good» de Kevin MacLeod ([incompetech.com](https://incompetech.com)),
licencia [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).
