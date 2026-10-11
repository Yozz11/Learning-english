# Etapa 2 con WebAssembly: investigación

**Fecha:** 11 de octubre de 2026
**Estado:** solo investigación. **No se ha cambiado nada del código de la app.**
**Origen:** a raíz de la ola de "puertos web" que circula en TikTok/Instagram (octubre 2026) y de la pregunta
de si esa misma técnica se puede aplicar al English Coach.

---

## 1. Resumen en 5 líneas

1. La técnica de esos sitios virales es: **compilar binario → WebAssembly → servir estáticos**. Cero
   servidor, cero instalación, corre en el navegador de cualquiera.
2. Esa misma técnica resuelve justo lo que nos faltaba en la etapa 2: **micrófono, voz y pronunciación
   sin pagar APIs**.
3. Concretamente: **whisper.cpp compilado a WASM** (transcribe en el dispositivo) + **Piper WASM** (voz
   neural) → listening, speaking y pronunciación dejan de ser imposibles.
4. El límite real no es el navegador, es **el hardware**: la transcripción en CPU por WASM va a ~2–3×
   tiempo real con `tiny` y **no alcanza** con `base`. Hay que medirlo en el equipo y en el celular.
5. Recomendación: **medir primero con demos públicas (fase 0)**, sin tocar el proyecto. El LLM local en
   esta laptop *no* es viable hoy (no hay WebGPU en Firefox/Linux), así que el texto sigue con Gemini.

---

## 2. Qué es exactamente el fenómeno viral

No es streaming, no son "puertos abiertos" y no hay servidor de juego. Son juegos corriendo **dentro de
la pestaña**:

| Pieza | Qué se usa |
|---|---|
| Compilación | Emscripten (C/C++ → WASM + SDL), Unity WebGL, Godot HTML5, Ruffle (Flash) |
| Motor de ejecución | WebAssembly (WASM SIMD), WebGL/WebGPU, Web Audio |
| Hosting | GitHub Pages, Netlify, Cloudflare Pages (estático puro) |
| Distribución | Un enlace. Sin instalar, sin cuenta. Además empaquetable como PWA |

El detonante de la ola de octubre 2026 es **IA + decompilación**: reconstruir el código de un juego pasó
de meses a días, así que salieron de golpe Halo CE, Black Ops, Vice City, Skate 3, GTA V… Kotaku lo
describió como *"vibe-coded browser ports work perfectly, unfortunately"*.

**El detalle que importa para nosotros:** el port de GTA V lo bajaron **en horas** por copyright, con el
repo completo. Existe un catálogo comunitario de 534 ports (`Carter54git/Ultimate-Catalog-Of-Web-Game-Ports`),
y el patrón es que los de contenido con dueño desaparecen.

> **Lo que copiamos:** la técnica (WASM + hosting estático + PWA).
> **Lo que NO copiamos:** el contenido con derechos de autor. Bajar juegos de pago = te vuelan el repo.

---

## 3. Cómo se aplica al English Coach

La app hoy tiene backend (Worker + D1) porque asumía que todo lo pesado pasaba en el servidor. Con WASM,
**lo pesado pasa en el navegador** y aparecen capacidades nuevas:

| Pieza | Hoy (etapa 1) | Con WASM en el navegador | Veredicto |
|---|---|---|---|
| **Hablar / pronunciación** | imposible sin API paga | **whisper.cpp WASM** transcribe el micrófono localmente; se compara contra la frase objetivo | 🟢 desbloquea la etapa 2 |
| **Listening** | n/a | **Piper WASM** (voz neural offline) o `speechSynthesis` del navegador | 🟢 viable |
| **Profesor IA (texto)** | Gemini free tier | LLM local (wllama/WebLLM) | 🔴 no en esta laptop |
| **Datos** | Cloudflare D1 (servidor) | SQLite WASM + OPFS, o IndexedDB | 🟡 opcional |
| **Hosting** | Worker + D1 (límite CPU 10 ms) | Cloudflare Pages estático, o GitHub Pages | 🟢 más simple y gratis |
| **Offline** | no | PWA con modelos cacheados | 🟢 se logra |

---

## 4. Reconocimiento de voz (el punto crítico)

### 4.1 whisper.cpp en WASM

El ejemplo oficial `whisper.wasm` de ggml.org dice textualmente:

> *"The performance is not great but you should be able to achieve **x2 or x3 real-time** for the `tiny`
> and `base` models on a modern CPU and browser (transcribe 60 seconds of audio in ~20-30 seconds)."*

Y advierte: **solo funciona con WASM SIMD** (Firefox ✔), soporta hasta `small` pero "más allá el consumo
de memoria y el rendimiento son insatisfactorios", solo sampling *greedy*, y **máximo 120 s de audio**
por archivo.

| Modelo | Disco (GGML) | Disco Q5_1 | RAM en uso | WER inglés | Velocidad |
|---|---|---|---|---|---|
| `tiny` (39 M) | 75 MB | ~31 MB | ~273 MB | ~7.6 % | ~10× (nativo) / 2–3× en WASM |
| `base` (74 M) | 142 MB | ~57 MB | ~388 MB | ~5.0 % | ~7× (nativo) / **~1.2× en WASM = no alcanza** |
| `small` (244 M) | 466 MB | ~182 MB | ~852 MB | ~3.4 % | ~4× (nativo), en WASM no sirve |

⚠️ **Firefox no carga archivos de más de 256 MB.** Con `tiny`/`base` no hay problema; con `large` sí.

### 4.2 El factor que lo decide todo: WebGPU

Un artículo medido (Forasoft, 2026) con `base` en una laptop media:

```
CPU + WASM  → real-time factor 1.2  → NO alcanza para vivo (línea roja = 1.0)
GPU + WebGPU → real-time factor 0.25 → cómodo (4× más rápido)
```

Traducción: **con WebGPU la transcripción se vuelve usable; sin WebGPU estás en el piso.** Y aquí
chocamos con la realidad del equipo:

| Plataforma | WebGPU |
|---|---|
| Firefox 141+ en **Windows** | ✔ por defecto (julio 2025) |
| Firefox en **Linux** | ✘ solo en Nightly; en estable hay que forzar `dom.webgpu.enabled` (no soportado) |
| Firefox en **macOS** | ✔ desde 145 (macOS Tahoe, ARM) |
| Chrome/Edge en Linux | 🟡 rollout por driver, con flags; en Wayland puede pedir `--ozone-platform=x11` |
| **Chrome Android 121+ (Android 12+)** | ✔ **sí** |

En esta laptop solo hay **Firefox** instalado, así que hoy estaríamos en el camino lento. El celular
Android, en cambio, sí tendría WebGPU. (Nota aparte: instalar Chromium en esta máquina depende de
arreglar el mirror v3 de pacman.)

### 4.3 La alternativa interesante: Moonshine

[Moonshine](https://github.com/moonshine-ai/moonshine) (Useful Sensors / OtterAI) está hecho
**específicamente para esto**: reconocimiento en vivo en hardware limitado, **inglés únicamente**.

| Modelo | Latencia | Comparación |
|---|---|---|
| Moonshine v2 Tiny | **50 ms** | 5.8× más rápido que Whisper Tiny (289 ms) |
| Moonshine v2 Small | 148 ms | 13.1× más rápido que Whisper Small |
| Moonshine v2 Medium | 258 ms | 43.7× más rápido que Whisper Large v3 |

- `tiny` = 27 M params, `base` = 61 M → **más chicos que los Whisper equivalentes** (37.8 M / 72.6 M).
- Diseñado para streaming: no arrastra la ventana fija de 30 s de Whisper, por eso tiene latencia sub-segundo.
- Está en HuggingFace (`onnx-community`), o sea que se puede usar vía **Transformers.js**.
  La demo "Moonshine Web" de Xenova descarga **~120 MB por WASM** o ~150 MB por WebGPU.
- Límites: **solo inglés** (no problema para nosotros, es una app de inglés) y sin timestamps.

> **Para nuestra app Moonshine encaja mejor que Whisper**: queremos frases cortas, en inglés, y queremos
> respuesta rápida. Whisper queda como plan B si necesitamos timestamps para la pronunciación.

### 4.4 Pronunciación: cómo se puntúa de verdad

En la industria esto se hace con **GOP** (Goodness of Pronunciation) sobre **alineación forzada** a nivel
de fonema, y se mide con **PER** (Phoneme Error Rate). El umbral que se cita para que el feedback sea
creíble en apps de pronunciación es **PER < 10 %**.

Nada de eso es razonable para una app personal en el navegador. Lo que **sí** es razonable:

1. El alumno lee/pronuncia una frase objetivo.
2. El reconocedor devuelve texto.
3. Se compara contra la frase esperada con **WER** (substituciones/inserciones/borrados).
4. Se marca la palabra que falló. `whisper.cpp` tiene `--dtw` con modelos `.en` para probabilidades de
   timestamp por palabra, así que se puede señalar la palabra mal dicha, no solo la frase.

**Trampa importante:** el WER se dispara con acentos. El corpus Edinburgh (40+ variedades de inglés) da
**19.7 % de WER promedio contra 2.7 % de habla leída estadounidense**. O sea: un hispanohablante va a
"arrastrar" errores que no son errores. **El puntaje hay que calibrarlo, no usarlo crudo**, y de todos
modos la app que ya existe mide 4 habilidades con IA — el número de pronunciación tiene que ser
orientativo, no una nota.

---

## 5. Voz sintética (listening)

| Opción | Peso | Velocidad | Calidad | Notas |
|---|---|---|---|---|
| `speechSynthesis` del navegador | **0 MB** | instantánea | robótica | gratis y ya existe, pero en Linux depende de `speech-dispatcher`/`espeak-ng`; en Android suena mejor |
| **Piper** (`@realtimex/piper-tts-web`, WASM) | chico | 🟢 rápido en móvil | natural | ~80 voces, ~30 idiomas, **confirmado que corre en Firefox** |
| **Kokoro-82M** (transformers.js) | ~330 MB (fp32) / menos en q4 | lento en móvil | 🟢 la mejor | `device: "webgpu"` o `"wasm"`; en un mid-range da ~60–90 s por minuto de audio vs ~10 s/min con Piper |

Reparto sensato: **Piper para todo lo rutinario** (frases de ejercicios, cientos de veces) y Kokoro solo
si algún día se quiere una "voz del profe" con más presencia. `speechSynthesis` sirve como respaldo
instantáneo mientras se descarga un modelo.

---

## 6. Datos y hosting

### 5.1 Datos en el navegador

- **`@sqlite.org/sqlite-wasm` + OPFS**: la base real, con el mismo SQL de las migraciones D1. Persiste en
  el sistema de archivos privado del origen.
- **Cabeceras COOP/COEP**: el multihilo (y varios VFS) las piden. Los propios docs de SQLite Wasm
  recomiendan usar el VFS **`opfs-sahpool`** cuando **no puedes mandar esas cabeceras**.
- Alternativa: **wa-sqlite**, con `AccessHandlePoolVFS` o `OPFSCoopSyncVFS` sobre OPFS, y
  `IDBBatchAtomicVFS` sobre IndexedDB como fallback.
- 🚩 **GitHub Pages NO permite cabeceras personalizadas.** Nunca. Confirmado en las discusiones oficiales
  (y por eso hay hackeos como `coi-serviceworker`).
- ✅ **Cloudflare Pages sí las permite** con un archivo `_headers` (también Netlify/Vercel).

### 5.2 Aviso sobre almacenamiento

- Los navegadores pueden **borrar** los datos de un origen por presión de disco (política LRU).
- Se mitiga con `navigator.storage.persist()`; conviene comprobar con `navigator.storage.estimate()`.
- Cuotas: Chrome/Android hasta ~60 % del disco libre; Safari 17+ hasta 80 % del disco para apps de
  navegador. **Un modelo de 30–150 MB entra sin drama**, pero no hay garantía absoluta de permanencia.
- La PWA ya usa `vite-plugin-pwa` (Workbox), así que el precache de modelos es directo.

---

## 6. Modelos de lenguaje locales (por qué NO, por ahora)

- **WebLLM** (WebGPU): Llama 3.2 1B en 4-bit = **695 MB de descarga** y ~880 MB de memoria de GPU.
- **wllama** (WASM/CPU, GGUF): corre sin GPU, pero para multihilo necesita COOP/COEP.
- Rendimiento real citado: laptop media con GPU integrada + WebGPU ~8–12 tokens/s; iPhone antiguo solo
  por WASM ~3–6 tokens/s.
- 🚫 **En esta laptop no hay WebGPU** (Firefox/Linux) → el camino es CPU por WASM → lento y con una
  descarga grande. **No vale la pena.** El texto sigue en Gemini free tier, que ya funciona y no cuesta.

Si algún día hay Chromium con WebGPU en la máquina, se revisa.

---

## 7. Fase 0 — plan de medición (lo primero que hay que hacer)

Nada de esto toca el proyecto: son **demos públicas** y una libreta para apuntar números. La regla es:
**si la medición no convence, no se integra.**

| # | Prueba | Enlace | Qué anotar |
|---|---|---|---|
| A | **Moonshine Web (primero)** | demo de Xenova en HuggingFace | si corre en el iPhone sin caerse, tiempo y precisión con tu acento |
| B | whisper.cpp WASM (`tiny`) | `ggml.ai/whisper.cpp` | segundos para transcribir 30 s — y **si la pestaña del iPhone aguanta** |
| C | Piper WASM | demo de `@realtimex/piper-tts-web` | segundos por frase, si la voz suena natural |
| D | ¿Hay WebGPU? | `webgpureport.org` | sí/no en laptop y en iPhone (debería dar sí en iOS 26) |
| E | Almacenamiento | devtools → consola | `navigator.storage.estimate()` y `persist()` |

**En los dos dispositivos: la laptop (CachyOS + Firefox) y el iPhone (Safari).**

⚠️ Para la prueba B en iPhone hay que bajar el modelo de 75 MB *en el navegador del teléfono* — y en iOS
Safari no se puede cargar un archivo local a mano como en escritorio. Si el demo no lo permite, esa
prueba se hace **sólo en la laptop** y la decisión de iPhone se toma con la tabla de memoria (sección 9.2):
Whisper tiny necesita ~273 MB y el techo es ~100 MB → **queda descartado de entrada**.

Criterios de aceptación que propongo (si no se cumplen, replanteamos):

- Transcribir una frase de 5–10 s en **menos de 3 s** en el celular.
- Que la voz sintética se genere en **menos de 1 s** por frase corta.
- Descarga inicial **por debajo de ~150 MB** (datos móviles son un costo real).
- Que funcione **sin WebGPU** al menos de forma degradada.
- 🔴 **Que la pestaña NO se caiga en el iPhone.** Este es el criterio más duro y el primero que hay que
  verificar: el techo medido es **~100 MB de memoria por página**. Si el modelo no cabe, se descarta sin
  discutir. Ver la sección 9.

---

## 8. Recomendación

**Orden sugerido, y por qué:**

1. **Fase 0**: medir con las demos. Es gratis, no ensucia el repo y decide todo lo demás.
2. **Fase 2A (audio)**: si las mediciones pasan, integrar **Moonshine `tiny` + Piper** en la PWA.
   Esto desbloquea listening, speaking y pronunciación **sin costo por uso** y sin depender de Gemini para
   audio. (Whisper queda **descartado para iPhone** por memoria: ver 9.2. Puede seguir vivo como
   experimento de escritorio, pero no como base del diseño.)
3. **Fase 2B (offline)**: recién después, pasar los datos a SQLite WASM + OPFS. Sólo tiene sentido si
   queremos la app usable **sin internet**; si no, D1 sigue siendo más simple.
4. **Hosting**: si se va a estático puro, **Cloudflare Pages (con `_headers`) le gana a GitHub Pages**,
   porque GitHub Pages no permite cabeceras. El repo puede seguir en GitHub igual.
5. **Texto/IA**: se queda en Gemini free tier. El LLM local no compite en esta máquina.
6. **Prerrequisito de prueba**: para probar el micrófono en el iPhone hay que **desplegar con HTTPS**
   (Cloudflare Pages), porque iOS no da acceso al micrófono en HTTP. Eso hay que hacerlo antes de la
   fase 0-C/D en el teléfono.

> **Dato invertido que conviene recordar:** en este par de dispositivos, **el iPhone es el rápido y la
> laptop el lento** — al revés de lo intuitivo. El iPhone tiene WebGPU (iOS 26) y la laptop no
> (Firefox en Linux). Por eso el diseño de la etapa 2 debe apuntar al iPhone como dispositivo objetivo,
> y la laptop como el caso "degradado".

**Lo que NO hacer:**
- ❌ Meter WASM a la app antes de medir. Rompería una etapa 1 que ya funciona.
- ❌ Portar nada con dueño (el aprendizaje del caso GTA V).
- ❌ Prometer pronunciación "tipo profesor nativo": con WASM y WER la precisión es orientativa, y sube
  artificialmente con acento hispano.
- ❌ Asumir que Firefox/Linux tendrá WebGPU pronto. Hoy no lo tiene.

---

## 9. iPhone: el dispositivo que cambia todo

El plan inicial asumía Android. Con **iPhone**, hay una buena noticia grande y un muro grande.

### 9.1 🟢 La buena: WebGPU SÍ existe en iPhone

Safari 26 (iOS 26) trae **WebGPU por defecto**. Los release notes de Apple lo dicen literal:

> *WebGPU — New Features: Added support for WebGPU. (145801580)*

Y de paso: *"Added support for an in-place interpreter for Wasm"*, o sea WASM también mejoró.

Consecuencia práctica, y es irónica: **el iPhone es más rápido que la laptop para esto.**
La laptop (Firefox/Linux) no tiene WebGPU; el iPhone sí. El celular deja de ser "el banco de
pruebas de segunda" y pasa a ser **el mejor dispositivo del par**.

- Si el iPhone ya está en iOS 26, no hay que hacer nada.
- Si no: actualizar, o activarlo a mano en
  `Ajustes → Apps → Safari → Avanzado → Feature Flags → WebGPU`.

### 9.2 🔴 El muro: la memoria de Safari en iOS

**Safari en iOS mata la pestaña cuando la página pasa cierto uso de memoria.** No es un rumor, está
medido:

| Dispositivo | Memoria que tumba la pestaña | Fuente |
|---|---|---|
| iPhone SE 3ª gen | **~100 MB** | Jeff Johnson, enero 2026 (iOS 26.2) |
| iPad 8ª gen | ~200 MB | Jeff Johnson, enero 2026 |
| Reportes de Unity WebGL | la memoria WASM **no puede crecer** de 256 MB a más sin crashear | foros Unity |
| Reportes de Babylon.js | hasta ~2 GB compartidos, inconsistente | foro Babylon |

Y esto tiene una víctima directa:

> **whisper `tiny` necesita ~273 MB de RAM en ejecución. El límite medido en un iPhone es ~100 MB.**

Traducción: **en el iPhone, Whisper se cae.** No es lentitud, es pestaña en blanco. Los 75 MB de
disco no son el problema — el problema es la memoria. Cuantizar a q5 arregla el disco, no la RAM.

**La solución ya estaba en la investigación: Moonshine.** `tiny` son **27 M de parámetros** (vs 39 M
de Whisper tiny, pero con arquitectura mucho más liviana y sin la ventana de 30 s), y es de la familia
que está diseñada para dispositivos con poca memoria. **Moonshine tiny sí cabe.**

Detalle extra de Transformers.js en iOS (issue #1242): hay que forzar **`numThreads = 1`** en el
backend WASM de ONNX Runtime, o la memoria se dispara y crashea. Se resuelve con:

```js
env.backends.onnx.wasm.numThreads = 1;
```

### 9.3 Almacenamiento en iPhone: mejor de lo que se dice

- **La regla de los 7 días NO aplica a las web apps instaladas en la pantalla de inicio.** El "límite
  de 50 MB" que repiten mil blogs **no es una política real** de Apple.
- Cuota (Safari 17+): hasta **60 % por origen**, 80 % del disco para apps de navegador.
- **Aun así hay que pedir `navigator.storage.persist()` y comprobar el resultado**, y diseñar asumiendo
  que podría negarse. O sea: si te borran el modelo, la app se lo vuelve a bajar y ya. Diseñar para eso,
  no confiar en que persiste.
- En **iOS 26, todo sitio añadido a la pantalla de inicio abre como web app por defecto**. Instalar es
  el camino esperado, no un extra.

### 9.4 Requisitos que aparecen por ser iPhone

1. **El micrófono exige HTTPS.** Safari en iOS bloquea `getUserMedia` en `http://` (salvo localhost, que
   el celular no puede alcanzar como "localhost" de tu laptop). ⇒ **para probar el micrófono en el
   celular hay que desplegar la app en un hosting con HTTPS** (Cloudflare Pages). No se puede probar el
   micrófono contra el servidor de desarrollo local.
2. **El audio necesita un toque del usuario.** En iOS, Web Audio no arranca solo: tiene que haber un tap.
   El diseño de la app debe abrir el micrófono/altavoz detrás de un botón, no al cargar la pantalla.
3. **Todo sitio en la pantalla de inicio abre como web app** en iOS 26 → el modo standalone sale gratis,
   pero hay que respetar el `safe-area` (ya está hecho en la app).

### 9.5 Estrategia recomendada para iPhone (híbrida)

No conviene apostar todo al navegador, justamente por el muro de memoria. Lo sensato:

| Parte | Dónde corre | Por qué |
|---|---|---|
| Transcripción de voz | **local (Moonshine tiny + `numThreads = 1`)** | no hay API gratis de audio decente y el iPhone sí tiene WebGPU |
| Voz sintética (listening) | **local (Piper, o `speechSynthesis` de iOS, que suena bien)** | gratis y sin descarga grande |
| Puntaje de pronunciación | **local (comparación contra la frase objetivo)** | es cálculo trivial, no necesita IA |
| Chat con el profesor | **servidor (Gemini, como hoy)** | si la pestaña se cae por memoria, el chat sigue funcionando |
| Perfil, nivel, errores | **servidor (D1, como hoy)** | es texto y son kilobytes; SQLite WASM no aporta |

O sea: **el híbrido no es una derrota, es la respuesta correcta al hardware.** Lo que hace la técnica
viral (meter todo en el navegador) brilla en juegos, donde el usuario acepta que la pestaña ocupe
memoria. En un iPhone, un pez gordo de 273 MB es una pestaña muerta.

---

## 10. Puente ya construido: el profe es un personaje (hecho el 2026-10-11)

Antes de la fase 0 se construyó la personalización, que no necesitaba nada de WASM:

- El profesor tiene **arquetipo** (6 inventados para la app: entrenador, profesora, amistad, mentor,
  rival, detective) o un **personaje descrito a mano**. El personaje entra al prompt como rol
  (`You are in character: ...`) con la regla de que las reglas de corrección mandan sobre el personaje.
- **Avatar**: 6 SVG propios en `web/public/avatars/` o una imagen del usuario, recortada a 256 px y
  convertida a WebP **en el navegador**; el data URL (≈20–35 KB) viaja dentro del JSON del profesor en
  D1. Cero servicios de archivos, cero migraciones (`teacher_profiles` ya guardaba un JSON).
- **Voz**: `speechSynthesis` con las voces del dispositivo, una por personaje, con sugerencia automática
  (idioma del personaje + nombre de voz + voces «Enhanced»). Es el **peldaño 0 de la sección 5**: cuando
  se integre Piper, solo hay que cambiar el motor de `web/src/lib/voice.ts` y la voz elegida en la
  configuración, sin tocar nada más.
- Avisos de iOS anotados en el código: la lista de voces llega vacía hasta el primer toque
  (`voiceschanged`), y la lectura en voz alta necesita un gesto del usuario (de ahí el botón «Escuchar»
  en cada respuesta; el autolectura es opcional porque iOS puede bloquearla).

**Regla de oro que se respetó:** el repositorio es público y no lleva ningún personaje, dibujo, letra ni
cómic con dueño. Un personaje de una franquicia (o cualquier obra ajena) vive **solo en la configuración
personal del usuario**, como texto libre y una imagen suya — el mismo criterio que con el port de GTA V.
Y describir un personaje por rasgos funciona mejor que pedirle al modelo que interprete una obra ajena.

---

## 11. Fuentes

- whisper.cpp WASM examples — `ggml.ai/whisper.cpp`, README del ejemplo `whisper.wasm` (ggml-org)
- Client-Side ASR With Faster-Whisper-WASM In Browser — Forasoft (2026): real-time factor CPU vs WebGPU
- Browser Speech Recognition: Whisper STT Guide — OfflineTTS (ago 2026): tamaños y RTF por WebGPU
- Moonshine / Moonshine v2 — moonshine-ai, arXiv 2602.12241: latencias comparadas con Whisper
- `timur00kh/whisper.wasm` — wrapper TypeScript; tamaños de modelos y límites de Firefox
- Piper WASM: `@realtimex/piper-tts-web` (DEV) y hilo de three.js sobre Piper vs Kokoro en móvil
- Sherpa-ONNX / VoxSherpa — tabla de rendimiento Kokoro vs Piper por gama de dispositivo
- SQLite Wasm: docs oficiales de persistencia (`opfs-sahpool` vs `opfs`), Chrome for Developers,
  y "The Current State Of SQLite Persistence On The Web" (PowerSync, mayo 2026)
- GitHub community #54257 y #13309 — GitHub Pages no admite cabeceras (COOP/COEP)
- Cloudflare Pages docs — archivo `_headers`
- web.dev y MDN — cuotas y evicción de almacenamiento; `navigator.storage.persist()`
- WebGPU Implementation Status (gpuweb/gpuweb) y web.dev — Firefox 141 Windows, 145 macOS, Linux en curso
- Pinggy / SearchQ (2026): WebLLM y wllama, tamaños y tokens/s por dispositivo
- Kotaku y Devtalk (oct 2026): los ports web "vibe-coded" y el takedown del de GTA V
- `Carter54git/Ultimate-Catalog-Of-Web-Game-Ports`
- **iPhone / iOS:** Safari 26.0 Release Notes de Apple (WebGPU y mejoras de Wasm); WebKit blog "Safari 26.0"
  (WebGPU por defecto y sitios en la pantalla de inicio como web app)
- **Memoria en iOS Safari:** lapcatsoftware.com (Jeff Johnson), "Mobile Safari web pages are severely
  limited by memory", 22 de enero de 2026 — ~100 MB iPhone SE 3ª gen, ~200 MB iPad 8ª gen, iOS 26.2
- **Memoria y WASM en iOS:** emscripten issue #19374 (Out-of-memory en Safari con `-pthread`),
  foros de Unity WebGL (la memoria no crece más allá de 256 MB), foro de Babylon.js
- **Transformers.js en iOS:** issue #1242 (crashes por memoria; arreglo `numThreads = 1`)
- **PWA en iOS / regla de 7 días:** Synthetixis, "Progressive web apps on iPhone in 2026: what is true
  and what is folklore" (la regla de 7 días no aplica a web apps instaladas; el "límite de 50 MB" es
  folclore); blog.tomayac.com sobre el cambio de iOS 17.4 en la UE; WebKit "Updates to Storage Policy"

> Los números de blogs se citan como orden de magnitud, no como benchmark propio. La medición real es la
> fase 0, en este equipo y en el celular.
