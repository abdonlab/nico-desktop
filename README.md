# NICO — App de escritorio con IA 🐺

Aplicación de escritorio para **NICO**, la IA nicolaita (UMSNH / Tianguis de la Ciencia 2026).
Es un **avatar (lobo neón) que flota en el escritorio** con el **chat integrado**: le escribes
abajo y responde ahí mismo, con voz. Todo vive dentro de la app (no usa el navegador ni Streamlit).

Desde la versión **1.3.0** puedes elegir **muchos cerebros** de IA y cambiar entre ellos desde
el engranaje ⚙️, sin tocar archivos.

## Cerebros disponibles
**☁️ En la nube (internet):** Gemini (Google) · OpenAI (ChatGPT) · Claude (Anthropic) ·
DeepSeek · OpenRouter (cientos de modelos) · Perplexity · *Otro (compatible con OpenAI)*
**💻 En tu computadora (local, sin costo):** Ollama · LM Studio · *Otro local (compatible con OpenAI)*

## Requisitos
- [Node.js](https://nodejs.org) **22 LTS o superior** (incluye `npm`).
  Con Node viejo puedes *probar* con `npm start`, pero para **crear el instalador** (`npm run dist`)
  hace falta Node 22.
- Una API key del servicio que quieras usar (p. ej. Gemini, gratis en https://aistudio.google.com/apikey),
  **o** un modelo local (Ollama / LM Studio) si no quieres depender de internet.

## Descargar el proyecto
**Opción A — ZIP (lo más simple):** entra a https://github.com/abdonlab/nico-desktop →
botón verde **Code** → **Download ZIP** → descomprime.

**Opción B — Git:**
```bash
git clone https://github.com/abdonlab/nico-desktop.git
```

## Primeros pasos
Desde la carpeta del proyecto (en Windows, mejor fuera de OneDrive y excluida del antivirus):

1. Crea tu archivo de configuración a partir del ejemplo:
   - Windows (CMD): `copy nico.config.example.js nico.config.js`
   - Mac/Linux: `cp nico.config.example.js nico.config.js`
2. Instala dependencias (solo la primera vez):
   ```bash
   npm install
   ```
3. Ábrelo:
   ```bash
   npm start
   ```

Aparece el lobo flotando en una esquina. No necesitas editar `nico.config.js` a mano: elige el
cerebro y pega tu key desde el engranaje ⚙️ (se guarda y **sobrevive a las actualizaciones**).

## Elegir el cerebro (engranaje ⚙️)
1. Pasa el cursor sobre el lobo y pulsa **⚙️**.
2. En **"¿Qué cerebro usa NICO?"** elige el proveedor. Los campos cambian solos:
   - Nube → pide **API key** y **modelo** (abajo hay un enlace para sacar la key de cada servicio).
   - Local (Ollama / LM Studio / otro) → pide la **dirección del servidor** y el **modelo**.
3. **Aceptar**. NICO empieza a usar ese cerebro enseguida. Cada proveedor recuerda su propia key
   y modelo, así que puedes alternar sin volver a escribir nada.

Notas por proveedor:
- **Ollama:** instálalo desde https://ollama.com y baja un modelo: `ollama pull qwen2.5:7b-instruct`.
  NICO intenta levantar Ollama solo si no está corriendo.
- **LM Studio:** carga un modelo y enciende el servidor (pestaña *Developer → Start Server*,
  por defecto `http://localhost:1234/v1`). Deja el modelo vacío para usar el que tengas cargado.
- **Otro (compatible con OpenAI):** sirve para Groq, Together, Mistral, xAI, llama.cpp, vLLM, Jan…
  solo pon su URL (`…/v1`), el modelo y la key si la pide.

## Controles del lobo (pasa el cursor encima)
| Botón | Acción |
|------|--------|
| 🔊 | Silenciar / activar la voz |
| ⚙️ | Configuración (cerebro, conocimiento, actualizaciones) |
| – | Minimizar (se esconde en la bandeja / Dock) |
| 🎲 | ¡Sorpréndeme! (animación aleatoria) |
| 📌 | Fijar / quitar "siempre encima" |
| 👻 | Modo fantasma: los clics atraviesan el lobo |
| ✕ | Cerrar |

Escribe abajo y presiona **Enter**. El lobo dice la respuesta en voz alta (en Mac usa la voz del
sistema en español; en Windows la voz del navegador).

## Darle conocimiento a NICO (RAG) 📚 — desde la app
Haz que NICO responda con **tus documentos** (historia de la UMSNH, carreras, info del Tianguis,
folletos, reglamentos…). Ya **no hace falta usar la terminal**:

1. Abre **⚙️** → sección **"Conocimiento de NICO"**.
2. **📄 Elegir documentos** → selecciona PDF, Word (.docx), Markdown (.md), texto (.txt) o HTML.
3. **Vectorizar y usar**. NICO lee, trocea y vectoriza los documentos y empieza a usarlos al instante.
   El conocimiento se guarda en tu carpeta de usuario, así que **sobrevive a las actualizaciones**.

Para vectorizar se necesitan *embeddings*. NICO elige el motor disponible automáticamente, sin
importar el cerebro de chat que uses: **Gemini** (si pusiste su key), **Ollama** o **LM Studio**
local, u **OpenAI** / *Otro compatible*. (Claude, DeepSeek, OpenRouter y Perplexity no ofrecen
embeddings: con esos, basta tener también una key de Gemini u OpenAI, o un modelo local.)

> Alternativa por terminal (opcional): pon archivos en una carpeta `conocimiento/` y corre
> `npm run indexar`. Si vas a hacer el instalador, córrelo **antes** de `npm run dist`.

## Actualizaciones
En **⚙️ → Actualizaciones → 🔄 Buscar en GitHub**, NICO compara tu versión con la del repo
`abdonlab/nico-desktop` y, si hay una más nueva, te ofrece abrirla en GitHub para descargarla.

## Crear el instalador (doble clic, sin terminal)
Con tu cerebro ya elegido:
```bash
npm install      # electron + electron-builder (primera vez)
npm run dist     # genera el instalador
```

### Windows
Queda en `dist/` como **`NICO-Setup.exe`**. Ábrelo para instalar (crea icono en el menú Inicio y
el escritorio). La primera vez Windows dirá *"Windows protegió tu PC"* → **Más información →
Ejecutar de todas formas** (normal en apps sin certificado de pago).
> El build necesita **Node 22**. Con Node viejo verás avisos `EBADENGINE` y puede fallar.

### Mac (Apple Silicon)
Queda en `dist/` (`NICO-…-arm64.dmg` y `NICO.app`). La config ya incluye **firma ad-hoc**
(`identity: null`) y un paso que limpia la cuarentena, necesario para abrir en M1/M2/M3.
Copia `NICO.app` a **Aplicaciones**. Si dijera *"NICO está dañada"*:
```bash
xattr -cr /ruta/a/NICO.app
```
(o clic derecho → Abrir → Abrir). Si tenías una versión vieja, bórrala y usa la nueva.

## Cambiar la imagen del avatar
1. Reemplaza **`src/nico.png`** por tu imagen (mismo nombre, fondo transparente).
2. Los **ojos que brillan** están alineados a la imagen actual; ajusta en `src/index.html` los
   porcentajes de `.eyeglow.left` / `.eyeglow.right` si tu imagen tiene los ojos en otro lugar.
3. Para el icono del instalador, reemplaza `build/icon.ico` (Windows) y `build/icon.png` (Mac).

## Estructura
```
nico-desktop/
├── package.json
├── nico.config.example.js  # plantilla de configuración (cópiala a nico.config.js)
├── nico.config.js          # << tu config (NO se sube a GitHub); la app igual se configura desde ⚙️
├── main.js                 # proceso principal: ventana + cerebros (todos los proveedores) + RAG
├── preload.js              # puente seguro
├── rag.js                  # conocimiento: lectura de documentos, embeddings y similitud
├── indexar.js              # genera conocimiento.json por terminal (opcional)
├── build/afterPack.js      # firma ad-hoc en Mac
└── src/
    ├── index.html          # avatar + chat + panel de configuración ⚙️
    ├── renderer.js         # lógica del avatar, chat y configuración
    ├── fonts/              # fuentes empaquetadas (funcionan sin internet)
    └── nico.png            # imagen del avatar
```

## Problemas comunes
- **"Falta tu API key …"**: ábre ⚙️ y pégala en el cerebro elegido.
- **"Tu API key parece inválida"**: revisa que la key y el nombre del **modelo** sean correctos.
- **"No pude conectar con … (servidor local)"**: enciende Ollama (`ollama serve`) o el servidor de
  LM Studio antes de preguntar.
- **El historial** de la conversación se envía al modelo para mantener el contexto dentro de la sesión.
