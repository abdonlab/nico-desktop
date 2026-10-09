# NICO — App de escritorio con IA 🐺

Aplicación de escritorio para **NICO**, la IA nicolaita (UMSNH / Tianguis de la Ciencia 2026).
Tiene la **inteligencia artificial integrada**: escribes en el chat y NICO te responde ahí mismo,
usando la API de **Gemini**. Incluye un avatar (lobo neón) que flota en el escritorio, reacciona
y dice las respuestas en voz alta.

No usa Streamlit ni ventanas del navegador: todo vive dentro de la app.

## Requisitos
- [Node.js](https://nodejs.org) 18 o superior (incluye `npm`).
- Una **API key de Gemini** (gratis en https://aistudio.google.com/apikey).

## Configuración (¡importante!)
Abre el archivo **`nico.config.js`** y pega tu API key:

```js
GEMINI_API_KEY: 'PEGA_AQUI_TU_API_KEY',
MODEL: 'gemini-2.0-flash',   // o el modelo que uses en nico-chat
```

Ahí mismo puedes ajustar la personalidad de NICO (`SYSTEM_PROMPT`).
> No compartas ese archivo con tu key en internet ni en GitHub.

## Cómo ejecutarlo
Desde la carpeta del proyecto (fuera de OneDrive y excluida del antivirus):

```bash
npm install      # instala Electron (solo la primera vez)
npm start        # abre NICO
```

Se abren dos cosas: la **ventana de chat** (donde platicas con NICO) y el
**lobo neón flotando** en la esquina del escritorio.

## Uso
- Escribe en el chat y presiona **Enter** (Shift+Enter = salto de línea). NICO responde con Gemini.
- El lobo **dice en voz alta** cada respuesta (voz del sistema en español).
- Controles del lobo (pasa el cursor encima):

| Botón | Acción |
|------|--------|
| 💬 | Mostrar / ocultar el chat |
| ▶ | Prueba de voz |
| 📌 | Fijar / quitar "siempre encima" |
| 👻 | Modo fantasma: los clics atraviesan el lobo |
| ✕ | Cerrar |

## Usar IA local con Ollama (sin internet, gratis)
Ideal para el stand: NICO responde sin conexión ni costo.

1. Instala Ollama: https://ollama.com/download
2. Descarga un modelo (en una terminal):

   ```bash
   ollama pull llama3.2
   ```

3. En `nico.config.js` cambia el proveedor:

   ```js
   PROVIDER: 'ollama',
   OLLAMA_MODEL: 'llama3.2',   // o el modelo que hayas descargado
   ```

4. Deja Ollama corriendo (`ollama serve`, o simplemente abre la app de Ollama)
   y arranca NICO. Listo — ahora piensa localmente.

Para volver a la nube, pon `PROVIDER: 'gemini'`.

## Darle conocimiento a NICO (RAG) 📚
Haz que NICO responda con **tus documentos** (historia de la UMSNH, carreras,
info del Tianguis, folletos, reglamentos…) en vez de solo lo que el modelo sepa.

1. Crea una carpeta **`conocimiento/`** dentro del proyecto y mete ahí tus archivos:
   **PDF, Word (.docx), Markdown (.md), texto (.txt) o HTML (.html)**.
   Para info de una página web, copia el texto y pégalo en un `.txt`.
2. Genera el índice (una sola vez, y cada vez que cambies los documentos):

   ```bash
   npm run indexar
   ```

   Esto crea `conocimiento.json`. Usa el **mismo cerebro** de tu `nico.config.js`:
   - Con `PROVIDER: 'gemini'` → necesita internet y tu API key.
   - Con `PROVIDER: 'ollama'` → primero descarga el modelo de embeddings:

     ```bash
     ollama pull nomic-embed-text
     ```

3. Abre NICO (`npm start`) y pregúntale sobre tus documentos. Él busca los
   fragmentos más relevantes y responde con esa información.

Ajustes en `nico.config.js` (sección RAG): `RAG_ENABLED` (apagar/encender),
`RAG_TOP_K` (cuántos fragmentos usa), `RAG_MIN_SCORE` (qué tan estricto).

> Si vas a hacer el `.exe`, corre `npm run indexar` **antes** de `npm run dist`
> para que el conocimiento quede incluido en la app.

## Cambiar la imagen del avatar
1. Reemplaza **`src/nico.png`** por tu imagen (mismo nombre, fondo transparente
   para el efecto flotante). Si usas otro nombre, cámbialo también en
   `src/index.html` (`<img src="nico.png">`).
2. Los **ojos que brillan** están alineados a la imagen actual. Si tu nueva
   imagen tiene los ojos en otro lugar, ajusta en `src/index.html` los
   porcentajes de `.eyeglow.left` y `.eyeglow.right`, o borra esas dos líneas
   `<span class="eyeglow ...">` si no las quieres.
3. Para el ícono del `.exe`, reemplaza también `build/icon.ico` (imagen cuadrada).

## Estructura
```
nico-desktop/
├── package.json
├── nico.config.js   # << tu API key, modelo, personalidad y opciones RAG
├── main.js          # proceso principal: ventanas + llamada a Gemini/Ollama + RAG
├── preload.js       # puente seguro
├── rag.js           # búsqueda de conocimiento (embeddings + similitud)
├── indexar.js       # genera conocimiento.json (npm run indexar)
├── conocimiento/    # << aquí pones tus PDF, Word, .md, .txt, .html
├── conocimiento.json# índice generado (no editar a mano)
└── src/
    ├── index.html   # el avatar (lobo) y sus animaciones
    ├── renderer.js  # lógica del avatar (voz, brillo)
    ├── chat.html    # interfaz del chat
    ├── chat.js      # lógica del chat
    └── nico.png     # imagen del avatar
```

## Notas
- El historial de la conversación se envía a Gemini para que NICO recuerde el
  contexto dentro de la misma sesión.
- Si ves "Falta tu API key": no la pegaste en `nico.config.js`.
- Si ves "Error de la API (400/403)": revisa que la key y el `MODEL` sean correctos.

## Crear el ejecutable (.exe) para el escritorio
Para tener un `NICO.exe` que abras con doble clic, sin terminal:

1. Pega tu API key en `nico.config.js` (paso de arriba).
2. En la carpeta del proyecto:

   ```bash
   npm install       # trae electron y electron-builder
   npm run dist      # genera el ejecutable
   ```

3. El resultado queda en la carpeta **`dist/`**, como **`NICO.exe`** (portátil).
   Cópialo a tu Escritorio o crea un acceso directo (clic derecho → Enviar a → Escritorio).

Junto al ejecutable, en `dist/win-unpacked/resources/nico.config.js`, puedes
cambiar la API key después sin recompilar (si usas la versión portátil, la
config viaja dentro; para editarla suelta, usa el build de carpeta:
`npx electron-builder --dir`).

> El `.exe` no está firmado digitalmente, así que la primera vez Windows
> mostrará "Windows protegió tu PC" → haz clic en **Más información → Ejecutar
> de todas formas**. Es normal en apps sin certificado de pago.

### En Mac (Apple Silicon)
La config ya incluye **firma ad-hoc** (`identity: null`), necesaria para que la
app abra en chips M1/M2/M3. Genera y abre así:

```bash
npm run dist
```

El resultado queda en `dist/` (`NICO-…-arm64.dmg` y `NICO.app`).
Si al abrir dice **"NICO está dañada"** o **"no se puede verificar"**, quítale la
marca de cuarentena una vez:

```bash
xattr -cr /ruta/a/NICO.app
```

(o abre con **clic derecho → Abrir → Abrir**). Si ya tenías una versión vieja
sin firmar, bórrala y usa la nueva.
