"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Loader2, AlertCircle } from "lucide-react";

interface LegalDocumentViewerProps {
  url: string;
  title: string;
  version: string;
}

export function LegalDocumentViewer({ url, title, version }: LegalDocumentViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

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
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
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
    <div className="space-y-2">
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
      <pre className="whitespace-pre-wrap text-sm text-text-secondary font-body leading-relaxed bg-bg-elevated rounded-lg p-4 max-h-[50vh] overflow-y-auto">
        {content}
      </pre>
    </div>
  );
}
