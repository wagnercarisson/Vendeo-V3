"use client";

import { AlertCircle, ImagePlus, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { LabTable } from "../../_components/lab-table";

/**
 * Upload das imagens de produto da bancada (F48.2.2, D5/D14).
 *
 * Envia um `POST` **multipart** para `/api/admin/laboratorio/bancada/inputs` com o
 * campo `operationId` e os arquivos em `files`. O servidor cria o run em
 * **`draft`** (sem ocupar o slot global de geração ativa) e persiste cada imagem
 * **apenas** no bucket `lab-artifacts`, sob `bench/{runId}/inputs/...`. Os
 * metadados devolvidos (path, tipo, dimensões, tamanho, checksum) são exibidos e
 * elevados ao contêiner, junto do `runId`/`references`, para a confirmação.
 *
 * O `operationId` é obtido do contêiner por fingerprint do conjunto de arquivos +
 * loja — reenviar o mesmo conjunto reutiliza a operação (idempotência).
 */

export interface BenchInputMetadata {
  path: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  bytes: number;
  checksum: string;
}

export interface BenchUploadResult {
  runId: string;
  references: string[];
  operationId: string;
  inputs: BenchInputMetadata[];
}

interface BenchImageUploadProps {
  storeId: string;
  getOperationId: (fingerprint: string) => string;
  onUploaded: (result: BenchUploadResult) => void;
  disabled?: boolean;
}

const ACCEPTED_MIME_TYPES = "image/png,image/jpeg,image/webp";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function fileFingerprint(storeId: string, files: File[]): string {
  const signature = files
    .map((file) => `${file.name}:${file.size}:${file.lastModified}`)
    .sort();
  return JSON.stringify([storeId, signature]);
}

export function BenchImageUpload({
  storeId,
  getOperationId,
  onUploaded,
  disabled = false,
}: BenchImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<BenchInputMetadata[]>([]);

  async function handleUpload() {
    setError(null);

    if (!storeId) {
      setError("Selecione uma loja de teste antes de enviar as imagens.");
      return;
    }
    if (files.length === 0) {
      setError("Selecione ao menos uma imagem do produto.");
      return;
    }

    const operationId = getOperationId(fileFingerprint(storeId, files));
    const form = new FormData();
    form.append("operationId", operationId);
    for (const file of files) form.append("files", file);

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
          "Não foi possível enviar as imagens. Verifique o tipo/tamanho e tente novamente.",
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
      setError("Não foi possível enviar as imagens. Tente novamente.");
      setUploading(false);
    }
  }

  return (
    <section
      data-testid="bench-image-upload"
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-image-upload-title"
    >
      <h2
        id="bench-image-upload-title"
        className="font-heading text-lg font-semibold text-text-primary"
      >
        Imagens do produto
      </h2>

      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border-light bg-bg-deep/40 p-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary font-body">
          <ImagePlus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Envie uma ou mais imagens (PNG, JPEG ou WebP). Elas são gravadas no
            bucket local do laboratório sob <code>bench/&lt;runId&gt;/inputs/</code>.
          </span>
        </div>
        <input
          ref={inputRef}
          data-testid="bench-image-input"
          type="file"
          multiple
          accept={ACCEPTED_MIME_TYPES}
          disabled={disabled || uploading}
          aria-label="Selecionar imagens do produto"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          className="text-sm text-text-secondary file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-bg-elevated file:px-3 file:py-2 file:text-sm file:text-text-primary"
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            data-testid="bench-upload-button"
            onClick={handleUpload}
            disabled={disabled}
            loading={uploading}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Enviar imagens
          </Button>
          <span className="font-mono text-xs text-text-muted">
            {files.length} arquivo(s)
          </span>
        </div>
      </div>

      {uploading && (
        <p className="flex items-center gap-2 text-sm text-accent-amber font-body">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Enviando imagens…
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

      {inputs.length > 0 && (
        <LabTable
          caption="Imagens enviadas (metadados registrados)"
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
          {inputs.map((entry) => (
            <tr key={entry.path} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {entry.path}
              </td>
              <td className="px-3 py-2 text-xs text-text-secondary">{entry.mimeType}</td>
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {entry.width && entry.height
                  ? `${entry.width}×${entry.height}`
                  : "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                {formatBytes(entry.bytes)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-text-muted">
                {entry.checksum.slice(0, 12)}…
              </td>
            </tr>
          ))}
        </LabTable>
      )}
    </section>
  );
}
