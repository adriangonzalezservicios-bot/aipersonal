import React, { useMemo, useState } from 'react';
import { Copy, Check, Download, Maximize2, Minimize2, Eye, Code2 } from 'lucide-react';

export const ARTIFACT_LANGS = new Set(['html', 'svg', 'jsx', 'react', 'tsx', 'mermaid']);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const safeScript = (s: string) => s.replace(/<\/script/gi, '<\\/script');

function reactDoc(code: string): string {
  let name: string | null = null;
  let src = code
    .replace(/^\s*import\s[^;]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '');
  src = src.replace(/export\s+default\s+(function|class)\s+(\w+)/, (_m, kind, n) => {
    name = n;
    return `${kind} ${n}`;
  });
  src = src.replace(/export\s+default\s+(\w+)\s*;?\s*$/m, (_m, n) => {
    name = n;
    return '';
  });
  if (!name && /export\s+default/.test(src)) {
    src = src.replace(/export\s+default\s+/, 'const __App = ');
    name = '__App';
  }
  src = src.replace(/^\s*export\s+/gm, '');
  if (!name) {
    const m = [...src.matchAll(/(?:function|const|class)\s+([A-Z]\w*)/g)].pop();
    name = m ? m[1] : 'App';
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>body{margin:0;font-family:system-ui,sans-serif}#err{color:#b91c1c;white-space:pre-wrap;padding:12px;font:12px monospace}</style></head>
<body><div id="root"></div><pre id="err"></pre>
<script>window.onerror=function(m){document.getElementById('err').textContent+=m+'\\n'}</script>
<script type="text/babel" data-presets="react">
const {useState,useEffect,useRef,useMemo,useCallback,useReducer,useContext,createContext,useLayoutEffect,Fragment}=React;
${safeScript(src)}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${name}));
</script></body></html>`;
}

export function buildSrcDoc(language: string, code: string): string {
  const lang = language.toLowerCase();
  if (lang === 'svg') {
    return `<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">${code}</body></html>`;
  }
  if (lang === 'mermaid') {
    return `<!doctype html><html><body style="margin:16px;background:#0f172a;color:#e2e8f0"><pre class="mermaid">${esc(code)}</pre>
<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';mermaid.initialize({startOnLoad:true,theme:'dark'});</script></body></html>`;
  }
  if (lang === 'jsx' || lang === 'react' || lang === 'tsx') return reactDoc(code);
  if (/<html|<!doctype/i.test(code)) return code;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${code}</body></html>`;
}

interface Props {
  language: string;
  code: string;
}

export const ArtifactBlock: React.FC<Props> = ({ language, code }) => {
  const lang = language.toLowerCase();
  const startsInPreview =
    lang !== 'html' || /<html|<!doctype|<script|<body/i.test(code);
  const [tab, setTab] = useState<'preview' | 'code'>(startsInPreview ? 'preview' : 'code');
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const srcDoc = useMemo(() => buildSrcDoc(lang, code), [lang, code]);

  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const isSvg = lang === 'svg';
    const blob = new Blob([isSvg ? code : srcDoc], { type: isSvg ? 'image/svg+xml' : 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artefacto-${Date.now()}.${isSvg ? 'svg' : 'html'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const btn =
    'flex items-center gap-1.5 px-2 py-1 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors';

  return (
    <div
      className={
        full
          ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col'
          : 'my-4 rounded-xl overflow-hidden border border-indigo-500/30 bg-slate-900/90 shadow-md'
      }
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-700/60 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-wider font-semibold text-indigo-400 font-mono mr-2">
            Artefacto · {lang}
          </span>
          <button onClick={() => setTab('preview')} className={`${btn} ${tab === 'preview' ? '!bg-indigo-600 !text-white' : ''}`}>
            <Eye className="w-3.5 h-3.5" /> Vista previa
          </button>
          <button onClick={() => setTab('code')} className={`${btn} ${tab === 'code' ? '!bg-indigo-600 !text-white' : ''}`}>
            <Code2 className="w-3.5 h-3.5" /> Código
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={copy} className={btn} title="Copiar código">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={download} className={btn} title="Descargar">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setFull(!full)} className={btn} title="Pantalla completa">
            {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {tab === 'preview' ? (
        <iframe
          title="Vista previa del artefacto"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          className={`w-full bg-white ${full ? 'flex-1' : 'h-[460px]'}`}
        />
      ) : (
        <pre className={`p-4 overflow-auto text-xs md:text-sm font-mono text-emerald-300/90 bg-slate-950/70 leading-relaxed ${full ? 'flex-1' : 'max-h-[460px]'}`}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};
