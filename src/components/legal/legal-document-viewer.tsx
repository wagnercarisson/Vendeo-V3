"use client";

import { useState, useEffect, useRef } from "react";
import { ExternalLink, Loader2, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface LegalDocumentViewerProps {
  url: string;
  title: string;
  version: string;
  onLoad?: (success: boolean) => void;
}

export function LegalDocumentViewer({ url, title, version, onLoad }: LegalDocumentViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setContent(null);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
          onLoadRef.current?.(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
          onLoadRef.current?.(false);
        }
      });

    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando {title.toLowerCase()}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-6 gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-accent-red" />
        <p className="text-sm text-text-secondary">
          Não foi possível carregar o documento oficial.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-accent-blue underline hover:text-accent-blue/80"
        >
          Abrir {title} ({version}) em nova aba <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
  <div className="space-y-4 text-sm text-text-secondary font-body leading-relaxed">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">{version}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent-blue underline hover:text-accent-blue/80"
          >
            Abrir em nova aba <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="bg-bg-elevated rounded-lg p-4 max-h-[50vh] overflow-y-auto">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-xl font-bold text-text-primary font-heading mb-3">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-lg font-semibold text-text-primary font-heading mt-5 mb-2">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-semibold text-text-primary font-heading mt-4 mb-1">{children}</h3>
              ),
              p: ({ children }) => <p className="mb-3">{children}</p>,
              ul: ({ children }) => (
                <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
              ),
              li: ({ children }) => <li>{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-text-primary">{children}</strong>
              ),
              em: ({ children }) => <em>{children}</em>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-blue underline hover:text-accent-blue/80">
                  {children}
                </a>
              ),
              hr: () => <hr className="border-border-light my-4" />,
              code: ({ children }) => (
                <code className="bg-bg-surface px-1.5 py-0.5 rounded text-xs text-text-primary">{children}</code>
              ),
              pre: ({ children }) => (
                <pre className="bg-bg-surface rounded-lg p-3 mb-3 overflow-x-auto text-xs">{children}</pre>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-xs border-collapse">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-border-light px-2 py-1 text-left font-semibold text-text-primary">{children}</th>
              ),
              td: ({ children }) => (
                <td className="border border-border-light px-2 py-1">{children}</td>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
  );
}
