# OmniSynth AI

Orquestador multi-IA: consulta especialistas en paralelo, muestra resultados progresivos y usa un Árbitro para sintetizar una respuesta consolidada. Incluye perfil persistente, historial, adjuntos multimodales, estudio de imágenes, storyboards de video y un **Cerebro persistente opcional en la nube**.

## Cerebro persistente

El Árbitro ahora trabaja en un ciclo de memoria:

`RECORDAR → ANALIZAR → CONTRASTAR → SINTETIZAR → APRENDER`

La memoria se separa del modelo. OmniSynth guarda recuerdos durables —decisiones, preferencias, hechos de proyectos, restricciones y aprendizajes— y los recupera semánticamente cuando una consulta futura los vuelve relevantes.

La implementación usa **Supabase/Postgres + pgvector**. El diseño usa búsqueda semántica con `pgvector`, índice HNSW y separación por usuario.

Para embeddings se usa `gemini-embedding-2` con 768 dimensiones a través del SDK oficial de Google.

### Activación

1. Creá un proyecto en Supabase.
2. En Authentication activá **Anonymous Sign-Ins**. Supabase crea un usuario anónimo persistente mientras conserve la sesión del navegador; esa identidad puede convertirse luego en una cuenta permanente. citeturn388927search2
3. Ejecutá `supabase/migrations/202610020001_brain.sql` en el SQL Editor.
4. Copiá `.env.example` a `.env.local` y completá:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
5. Reiniciá `npm run dev`.

**Importante:** la service role key solo debe existir del lado del servidor. El navegador recibe únicamente la clave pública. Para aplicaciones multiusuario, mantené RLS activo y no expongas tablas internas directamente al cliente. El esquema mantiene RLS activo y el acceso de tablas se mantiene del lado del servidor.

La sesión anónima está pensada para comenzar sin fricción, pero se pierde al cerrar sesión, borrar datos del navegador o cambiar de dispositivo. Para una versión multi-dispositivo, el siguiente paso es vincular la identidad anónima a email/OAuth. citeturn388927search2

## Requisitos
- Node.js 18+ (22 recomendado).
- Al menos una clave: `GEMINI_API_KEY` y/o `ANTHROPIC_API_KEY`.
- Para Cerebro en nube: proyecto Supabase + variables `SUPABASE_*` y `VITE_SUPABASE_*`.

## Uso local
1. `npm install`
2. Copiá `.env.example` a `.env.local` y completá las claves.
3. `npm run dev` y abrí `http://localhost:3000`.

## Producción
`npm run build && npm start`

## Proveedores
- Gemini usa el SDK oficial `@google/genai` y modelos configurables con `GEMINI_MODELS`.
- Claude usa la Messages API de Anthropic con salida estructurada nativa para el arbitraje JSON.
- El árbitro usa Claude por defecto cuando `ANTHROPIC_API_KEY` está configurada; si no, usa Gemini.

## Qué aprende el Cerebro

El Árbitro puede registrar hasta cinco recuerdos por sesión. Se descartan secretos, claves y contenido efímero. Cuando un recuerdo contradice uno anterior recuperado durante la consulta, puede marcar el anterior como obsoleto y guardar la corrección.

El sistema también guarda un resumen estructurado de la sesión en `brain_sessions` para poder auditar cómo evolucionó el razonamiento, sin convertir todo el historial en memoria permanente.

## Adjuntos
Se aceptan imágenes, PDF y formatos de texto/código (TXT, MD, CSV, JSON, XML, TS/TSX, JS/JSX, Python, SQL, HTML, CSS, YAML). Los formatos Office binarios deben convertirse a PDF o texto antes de adjuntarse para evitar enviar binarios como texto corrupto.

## Artefactos
Los bloques `html`, `svg`, `jsx` y `mermaid` se muestran con vista previa aislada, código, copiar, descargar y pantalla completa.

## Configuración del Árbitro profundo

`ARBITER_CHALLENGE=true` activa una pasada adversarial previa a la síntesis final. Esta pasada busca contradicciones, supuestos sin respaldo, huecos de evidencia y riesgos de implementación. Se puede desactivar para reducir latencia y coste.

## Instalación como app web (PWA)

OmniSynth está preparado para publicarse en `https://ili.com.ar` como **Progressive Web App**. El navegador puede ofrecer instalación y, una vez instalada, OmniSynth se abre en modo `standalone`, sin la barra de URL habitual. La instalación PWA requiere HTTPS (excepto `localhost`/`127.0.0.1` en desarrollo) y un manifest válido; los navegadores Chromium además verifican los iconos de 192px y 512px. citeturn898955search3

La app incluye:
- `public/manifest.webmanifest` con nombre, iconos, `start_url`, `scope`, `display` y accesos directos.
- `public/sw.js` para el app-shell offline y actualización segura de activos. Las rutas `/api/*` nunca se cachean porque pueden transportar conversaciones o datos privados.
- Iconos PNG de 192px, 512px, maskable y `apple-touch-icon`.
- Botón **Instalar app** en la interfaz usando `beforeinstallprompt` cuando el navegador lo soporta. Este evento permite disparar el diálogo nativo desde un botón propio. citeturn898955search3
- Ayuda específica para iPhone/iPad, donde la instalación se realiza desde el menú Compartir de Safari. citeturn898955search3

### Dominio `ili.com.ar`

Publicá la aplicación bajo HTTPS y asegurate de que:

`https://ili.com.ar/manifest.webmanifest` → devuelva el manifest con MIME `application/manifest+json`.

`https://ili.com.ar/sw.js` → devuelva el service worker desde la **raíz del dominio**, para que tenga scope `/`.

`https://ili.com.ar/icons/icon-192.png` y `https://ili.com.ar/icons/icon-512.png` → sean accesibles públicamente.

El servidor de producción de OmniSynth ya configura estos recursos y evita que `manifest.webmanifest`, `sw.js` e `index.html` queden bloqueados por cachés HTTP antiguas.

Después de publicar, en Chrome/Edge el usuario verá la opción **Instalar OmniSynth** cuando el navegador haya determinado que el sitio es instalable. No es posible forzar el diálogo nativo en todos los navegadores; `beforeinstallprompt` tampoco está disponible en iOS. citeturn898955search3
