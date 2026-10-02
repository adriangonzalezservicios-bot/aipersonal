import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { ArtifactBlock, ARTIFACT_LANGS } from './ArtifactBlock';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!content) {
    return <p className="text-slate-400 italic">Sin contenido disponible.</p>;
  }

  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`prose prose-invert max-w-none text-slate-200 leading-relaxed text-sm md:text-base space-y-3 ${className}`}>
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = !firstLine.includes(' ') && firstLine.length < 15;
          const language = hasLang ? firstLine : 'code';
          const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          if (hasLang && ARTIFACT_LANGS.has(language.toLowerCase())) {
            return <ArtifactBlock key={index} language={language} code={codeBody} />;
          }

          return (
            <div key={index} className="my-4 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900/90 shadow-md">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/60 text-xs font-mono text-slate-400">
                <span className="uppercase tracking-wider font-semibold text-indigo-400">{language}</span>
                <button
                  onClick={() => copyCode(codeBody, index)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Copiar código"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-xs md:text-sm font-mono text-emerald-300/90 bg-slate-950/70 leading-relaxed">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        // Render regular lines
        const paragraphs = part.split(/\n\n+/);
        return (
          <React.Fragment key={index}>
            {paragraphs.map((para, pIdx) => {
              const trimmed = para.trim();
              if (!trimmed) return null;

              // Headers
              if (trimmed.startsWith('#### ')) {
                return (
                  <h5 key={pIdx} className="text-base font-semibold text-slate-200 mt-4 mb-2 flex items-center gap-2">
                    {formatInline(trimmed.replace('#### ', ''))}
                  </h5>
                );
              }
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={pIdx} className="text-lg font-bold text-indigo-300 mt-5 mb-2.5 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-indigo-500 rounded-full inline-block" />
                    {formatInline(trimmed.replace('### ', ''))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={pIdx} className="text-xl font-bold text-slate-100 mt-6 mb-3 pb-1 border-b border-slate-800">
                    {formatInline(trimmed.replace('## ', ''))}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={pIdx} className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-sky-200 to-white mt-6 mb-3">
                    {formatInline(trimmed.replace('# ', ''))}
                  </h2>
                );
              }

              // Blockquotes
              if (trimmed.startsWith('> ')) {
                return (
                  <blockquote key={pIdx} className="border-l-4 border-indigo-500/80 bg-indigo-950/20 px-4 py-2.5 rounded-r-lg my-3 text-slate-300 italic">
                    {formatInline(trimmed.replace(/^>\s*/gm, ''))}
                  </blockquote>
                );
              }

              // List items
              const lines = trimmed.split('\n');
              // Tablas
              if (lines.length >= 2 && lines[0].includes('|') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[1])) {
                const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
                const head = cells(lines[0]);
                const rows = lines.slice(2).map(cells);
                return (
                  <div key={pIdx} className="overflow-x-auto my-3 rounded-lg border border-slate-800">
                    <table className="w-full text-xs md:text-sm text-left">
                      <thead className="bg-slate-800/70 text-slate-200">
                        <tr>{head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{formatInline(h)}</th>)}</tr>
                      </thead>
                      <tbody className="text-slate-300">
                        {rows.map((r, ri) => (
                          <tr key={ri} className="border-t border-slate-800">
                            {r.map((c, ci) => <td key={ci} className="px-3 py-2 align-top">{formatInline(c)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              const isList = lines.every((l) => /^\s*([*-]|\d+\.)\s+/.test(l));

              if (isList) {
                const isOrdered = /^\s*\d+\.\s+/.test(lines[0]);
                if (isOrdered) {
                  return (
                    <ol key={pIdx} className="list-decimal list-inside space-y-1.5 my-2.5 pl-2 text-slate-300">
                      {lines.map((l, lIdx) => (
                        <li key={lIdx} className="pl-1">
                          {formatInline(l.replace(/^\s*\d+\.\s+/, ''))}
                        </li>
                      ))}
                    </ol>
                  );
                } else {
                  return (
                    <ul key={pIdx} className="space-y-1.5 my-2.5 pl-1 text-slate-300">
                      {lines.map((l, lIdx) => (
                        <li key={lIdx} className="flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                          <span>{formatInline(l.replace(/^\s*([*-])\s+/, ''))}</span>
                        </li>
                      ))}
                    </ul>
                  );
                }
              }

              // Regular paragraph with linebreaks
              return (
                <p key={pIdx} className="text-slate-300 leading-relaxed my-2">
                  {lines.map((line, lIdx) => (
                    <React.Fragment key={lIdx}>
                      {formatInline(line)}
                      {lIdx < lines.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/**
 * Helper to format bold, italic, and inline code
 */
function formatInline(text: string): React.ReactNode {
  // Regex to match `code`, **bold**, *italic*
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return tokens.map((token, i) => {
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-xs border border-slate-700/60">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-100">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return (
        <em key={i} className="italic text-slate-300">
          {token.slice(1, -1)}
        </em>
      );
    }
    return token;
  });
}
