"use client";

import { AlertCircle, ImagePlus, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { LabTable } from "../../../_components/lab-table";
import type {
  BenchInputMetadata,
  BenchUploadResult,
} from "../../_components/bench-image-upload";

/**
 * Upload da **campanha pronta** (quick 261107-qvo) — exatamente uma imagem.
 * A imagem é a peça a preservar, não referência de produto; nenhuma identidade
 * ou referência adicional é anexada.
 */

interface BenchSingleImageUploadProps {
  storeId: string;
  getOperationId: (fingerprint: string) => string;
  onUploaded: (result: BenchUploadResult) => void;
  disabled?: boolean;
}

const ACCEPTED_MIME_TYPES = "image/png,image/jpeg,image/webp";

function fileSignature(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/** Fingerprint estável da operação de expansão (loja + imagem). */
export function benchExpandUploadFingerprint(
  storeId: string,
  file: File | null,
): string {
  return JSON.stringify(["expand", storeId, file ? fileSignature(file) : null]);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function BenchSingleImageUpload({
  storeId,
  getOperationId,
  onUploaded,
  disabled = false,
}: BenchSingleImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<BenchInputMetadata[]>([]);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== "function") {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setInputs([]);
    setFile(event.target.files?.[0] ?? null);
  }

  async function handleUpload() {
    setError(null);
    if (!storeId) {
      setError("Selecione uma loja de teste antes de enviar a campanha.");
      return;
    }
    if (!file) {
      setError("Selecione uma única imagem de campanha pronta.");
      return;
    }

    const operationId = getOperationId(
      benchExpandUploadFingerprint(storeId, file),
    );
    const form = new FormData();
    form.append("operationId", operationId);
    form.append("operation", "expand");
    form.append("files", file);

    setUploading(true);
    try {
      const response = await fetch(
        "/api/admin/laboratorio/bancada/inputs",
        { method: "POST", body: form },
      );
      const data = (await response.json().catch(() => ({}))) as {
        runId?: string;
        inputs?: BenchInputMetadata[];
        error?: string;
      };
      if (!response.ok || !data.runId || !Array.isArray(data.inputs)) {
        setError(
          data.error === "bench_expand_requires_single_image"
            ? "Envie exatamente uma imagem de campanha pronta."
            : "Não foi possível enviar a campanha. Verifique o tipo/tamanho e tente novamente.",
        );
        setUploading(false);
        return;
      }

      setInputs(data.inputs);
      setUploading(false);
      onUploaded({
        runId: data.runId,
        references: data.inputs.map((entry) => entry.path),
        operationId,
        inputs: data.inputs,
      });
    } catch {
      setError("Não foi possível enviar a campanha. Tente novamente.");
      setUploading(false);
    }
  }

  const input = inputs[0] ?? null;

  return (
    <section
      data-testid="bench-single-image-upload"
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-single-image-title"
    >
      <h2
        id="bench-single-image-title"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Campanha pronta
      </h2>

      <div className="flex items-start gap-2 text-sm text-text-secondary font-body">
        <ImagePlus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Envie <strong>uma única imagem</strong> da campanha que será preservada
          (PNG, JPEG ou WebP). Nenhuma identidade visual ou referência adicional
          será anexada automaticamente.
        </span>
      </div>

      <input
        ref={inputRef}
        data-testid="bench-expand-image-input"
        type="file"
        accept={ACCEPTED_MIME_TYPES}
        disabled={disabled || uploading}
        aria-label="Selecionar imagem da campanha pronta"
        onChange={handleChange}
        className="text-sm text-text-secondary file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-bg-elevated file:px-3 file:py-2 file:text-sm file:text-text-primary"
      />

      {file && (
        <div className="space-y-3 rounded-lg border border-border bg-bg-deep/40 p-3">
          <p className="font-mono text-xs text-text-primary">
            Arquivo: {file.name}
          </p>
          {previewUrl ? (
            <img
              data-testid="bench-expand-image-preview"
              src={previewUrl}
              alt="Prévia da campanha pronta"
              className="max-h-72 rounded-lg border border-border object-contain"
            />
          ) : null}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          data-testid="bench-expand-upload-button"
          onClick={handleUpload}
          disabled={disabled}
          loading={uploading}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Enviar campanha
        </Button>
        <span className="font-mono text-xs text-text-muted">
          {file ? "1 imagem" : "0 imagens"}
        </span>
      </div>

      {uploading && (
        <p className="flex items-center gap-2 text-sm text-accent-amber font-body">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Enviando campanha…
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-center gap-1 text-sm text-accent-red font-body"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {input && (
        <LabTable
          caption="Imagem de origem (metadados reais)"
          head={
            <>
              <th scope="col" className="px-3 py-2 text-xs text-text-muted font-heading">
                Caminho
              </th>
              <th scope="col" className="px-3 py-2 text-xs text-text-muted font-heading">
                Tipo
              </th>
              <th scope="col" className="px-3 py-2 text-xs text-text-muted font-heading">
                Dimensões
              </th>
              <th scope="col" className="px-3 py-2 text-xs text-text-muted font-heading">
                Tamanho
              </th>
              <th scope="col" className="px-3 py-2 text-xs text-text-muted font-heading">
                Checksum
              </th>
            </>
          }
        >
          <tr className="border-t border-border">
            <td className="px-3 py-2 font-mono text-xs text-text-secondary">
              {input.path}
            </td>
            <td className="px-3 py-2 text-xs text-text-secondary">{input.mimeType}</td>
            <td className="px-3 py-2 font-mono text-xs text-text-secondary">
              {input.width && input.height ? `${input.width}×${input.height}` : "—"}
            </td>
            <td className="px-3 py-2 font-mono text-xs text-text-secondary">
              {formatBytes(input.bytes)}
            </td>
            <td className="px-3 py-2 font-mono text-xs text-text-muted">
              {input.checksum.slice(0, 12)}…
            </td>
          </tr>
        </LabTable>
      )}
    </section>
  );
}
