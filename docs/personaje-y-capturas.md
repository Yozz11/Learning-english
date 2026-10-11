# Personaje del profe + captura de pantalla

Este archivo junta dos cosas: la ficha del personaje y la función de transcribir cualquier cosa de mi
pantalla. Léelo junto con `AGENTS.md`.

Ojo con el orden: lo del personaje se puede ajustar ya. La captura de pantalla es de la etapa 4, así que
no se construye hasta que yo lo autorice. Aquí solo queda claro qué quiero, para que la arquitectura no
la estorbe.

> **Nota de este equipo (2026-10-11):** la laptop usa **CachyOS + niri (Wayland)**, no KDE. Para la parte 2,
> el paso 1 en la PC no puede ser Spectacle ni `Win+Shift+S`: sería `grim` + `slurp` (herramientas de
> Wayland). Verificar en su momento, antes de prometer nada.

---

## Parte 1: ficha del personaje

Cada personaje es una ficha. El chat la lee y habla como él, sin dejar de corregir. Todo vive en la
configuración del usuario, nunca en el código del repo, y no se incluye nada con derechos de autor.

### Campos

- **nombre:** cómo se llama.
- **frase:** una línea que lo resume (se ve en la tarjeta).
- **avatar:** imagen que elige el usuario (se reduce a 256 px en el teléfono).
- **personalidad:** 3 a 5 rasgos (ej. directo, bromista, paciente).
- **cómo habla:** ritmo, muletillas, formalidad, jergas o exclamaciones. Máximo 3 líneas.
- **cómo corrige:** al instante o al final, qué tan suave o estricto, y cuántos errores por mensaje (1 o 2).
- **uso del español:** nunca, solo cuando haga falta, o seguido.
- **nivel de su inglés:** se ajusta al nivel del usuario.
- **mensaje inicial:** cómo saluda al abrir el chat.
- **diálogos de ejemplo:** 3 o 4 intercambios cortos que muestren su voz y cómo corrige. Es lo que más
  ayuda a que suene como el personaje.
- **cosas que nunca hace:** por ejemplo, no se burla de los errores, no traduce todo, no se sale del personaje.
- **voz:** voz del sistema asignada al personaje.
- **escenarios favoritos:** situaciones donde brilla (entrevista, pedir comida, una escena de su universo).

### Ejemplo (personaje original)

- **nombre:** Coach Rex
- **frase:** Entrenador que te exige, pero siempre está de tu lado.
- **personalidad:** directo, motivador, bromista, impaciente con las excusas.
- **cómo habla:** frases cortas, energía alta, usa "Let's go!" y "Again!". Compara el inglés con entrenar.
- **cómo corrige:** 1 error importante por mensaje, en una línea, y pide repetir.
- **uso del español:** solo cuando el usuario se trabe.
- **mensaje inicial:** "Hey! Warm-up time. Tell me one thing you did today."
- **diálogos de ejemplo:**
  - Usuario: "Yesterday I go to the gym."
    Rex: "Almost! Yesterday I **went** to the gym. Say it again, champ."
  - Usuario: "I don't know what to say."
    Rex: "No excuses. Start with: 'I feel...' and finish it."
  - Usuario: "No entiendo."
    Rex: "Easy. Te lo explico en español: ... Now try again in English."
- **cosas que nunca hace:** no regaña con dureza, no corrige más de 2 errores a la vez, no se sale del personaje.
- **escenarios favoritos:** entrevista de trabajo, hablar de deportes, retos de vocabulario.

### Estado hoy en la app

- **Ya existe:** nombre, avatar (galería o foto propia), personalidad, forma de corregir (con humor,
  formalidad y severidad), uso del español, nivel (automático o fijo), voz del sistema y el personaje
  descrito con mis palabras (campo `character`).
- **Falta:** frase, cómo habla, mensaje inicial, diálogos de ejemplo, cosas que nunca hace y escenarios
  favoritos.

---

## Parte 2: transcribir lo que veo en pantalla (etapa 4)

### Qué quiero

Poder seleccionar una zona de la pantalla, como con Win+Shift+S en Windows, en cualquier app o página, y
que mi app transcriba el texto, me lo explique a mi nivel y me deje practicarlo.

### Cómo funciona en cada lado

**PC con Linux (Arch + KDE):**

1. Un atajo de teclado que dispara la captura de una zona (Spectacle de KDE en modo región, o la
   herramienta equivalente si uso otro entorno).
2. Un script local pasa la imagen por OCR con Tesseract (inglés y español). Gratis y sin enviar la imagen
   a ningún servicio.
3. El script manda solo el texto a la API de mi app con mi token.
4. Se abre la app en la pantalla de la captura.

**iPhone (la web app no puede ver otras apps, así que se usa un atajo de iOS):**

1. Un atajo de Shortcuts que toma la última captura de pantalla, extrae el texto con la función de texto
   en imágenes de iOS (gratis, en el teléfono) y lo manda a mi API.
2. Se lanza con tocar la parte trasera, el botón de acción o desde el menú de compartir.
3. Para elegir solo una zona, recorto la captura en el editor de iOS antes de guardarla.
4. Verifica qué opciones de activación y de recorte hay realmente en mi versión de iOS antes de prometerlas.

### Qué hace la app con el texto

- Pantalla de "Capturas": texto original, explicación a mi nivel y traducción cuando la pida.
- Palabras nuevas guardadas para repaso.
- Botón "preguntarle al profe sobre esto".
- Opción de enviarla a la sección "Mis intereses" (etapa 3).

### Reglas

- Endpoint con autenticación por token, límite de tamaño del texto y límite de peticiones.
- No guardar imágenes. Guardar solo el texto necesario y borrarlo pasado un tiempo razonable.
- Las capturas son mías y personales. La app no debe acumular libros o artículos protegidos completos.
- Todo gratis: OCR local en la PC y en el iPhone, sin servicios de pago. Si piensas usar un OCR en la
  nube, dime antes los límites y costos.
- Antes de implementar, cuéntame las opciones en pocas líneas y espera mi aprobación.
