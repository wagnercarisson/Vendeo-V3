"use client";

import { AlertCircle, ImagePlus, Loader2, Star, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { LabTable } from "../../_components/lab-table";

/**
 * Upload das imagens de produto da bancada (F48.2.2, D5/D14; F48.2.4, D19).
 *
 * **Seleção explícita (correção de UAT):** um campo **obrigatório** para a imagem
 * **principal** e um campo **separado** para **até três imagens adicionais**
 * opcionais. Adicionar adicionais **não** substitui a seleção anterior e o
 * operador pode **remover ou substituir** qualquer imagem antes do envio. A UI
 * exibe claramente a principal, as adicionais e a **ordem**.
 *
 * No envio, constrói **um único multipart ordenado** — (1) principal; (2)
 * adicionais na ordem exibida — preservando o contrato da rota (`operationId` +
 * `files`). O servidor persiste a principal no índice 0 e as adicionais nos
 * índices seguintes; a **identidade canônica** é anexada **posteriormente** pelo
 * runtime como a **última** referência.
 *
 * O `operationId` é obtido do contêiner por **fingerprint do conjunto com papéis e
 * ordem** (`storeId + principal + adicionais em ordem`, sem ordenação alfabética):
 * trocar principal por adicional, remover uma imagem ou mudar a ordem produz
 * fingerprint/operação diferente; reenviar o mesmo conjunto, com os mesmos papéis
 * e ordem, permanece idempotente.
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

export const MAX_ADDITIONAL_IMAGES = 3;
const ACCEPTED_MIME_TYPES = "image/png,image/jpeg,image/webp";
const ADDITIONAL_IMAGES_HELP =
  "Imagens adicionais de referência — opcionais. Podem ajudar a preservar detalhes e orientar a composição, mas nem todas necessariamente aparecerão na arte final.";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function fileSignature(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Fingerprint do conjunto **com papéis e ordem**: `storeId + principal +
 * adicionais em ordem` (sem `.sort()`). Trocar papéis, remover ou reordenar muda
 * o fingerprint; reenviar o mesmo conjunto/papéis/ordem é idempotente.
 */
export function benchUploadFingerprint(
  storeId: string,
  main: File | null,
  additional: readonly File[],
): string {
  return JSON.stringify([
    storeId,
    main ? fileSignature(main) : null,
    additional.map(fileSignature),
  ]);
}

export function BenchImageUpload({
  storeId,
  getOperationId,
  onUploaded,
  disabled = false,
}: BenchImageUploadProps) {
  const mainInputRef = useRef<HTMLInputElement>(null);
  const additionalInputRef = useRef<HTMLInputElement>(null);
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<BenchInputMetadata[]>([]);

  function handleMainChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setMainFile(event.target.files?.[0] ?? null);
  }

  function handleAdditionalChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setError(null);
    setAdditionalFiles((current) => {
      const combined = [...current, ...selected];
      if (combined.length > MAX_ADDITIONAL_IMAGES) {
        setError(`Selecione no máximo ${MAX_ADDITIONAL_IMAGES} imagens adicionais.`);
        return current;
      }
      return combined;
    });
    if (additionalInputRef.current) additionalInputRef.current.value = "";
  }

  function removeMain() {
    setError(null);
    setMainFile(null);
    if (mainInputRef.current) mainInputRef.current.value = "";
  }

  function removeAdditional(index: number) {
    setError(null);
    setAdditionalFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    setError(null);

    if (!storeId) {
      setError("Selecione uma loja de teste antes de enviar as imagens.");
      return;
    }
    if (!mainFile) {
      setError("Selecione a imagem principal do produto.");
      return;
    }

    const ordered = [mainFile, ...additionalFiles];
    const operationId = getOperationId(
      benchUploadFingerprint(storeId, mainFile, additionalFiles),
    );
    const form = new FormData();
    form.append("operationId", operationId);
    // Ordem obrigatória: principal (índice 0) → adicionais (índices seguintes).
    for (const file of ordered) form.append("files", file);

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

      <div className="flex items-center gap-2 text-sm text-text-secondary font-body">
        <ImagePlus className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Envie a <strong>imagem principal</strong> e, se quiser, até{" "}
          {MAX_ADDITIONAL_IMAGES} imagens adicionais (PNG, JPEG ou WebP). As imagens são
          gravadas no bucket local <code>lab-artifacts</code> sob{" "}
          <code>bench/&lt;runId&gt;/inputs/</code>.
        </span>
      </div>

      {/* Imagem principal (obrigatória) */}
      <div
        data-testid="bench-main-image-field"
        className="flex flex-col gap-3 rounded-lg border border-dashed border-border-light bg-bg-deep/40 p-4"
      >
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
          <Star className="h-3.5 w-3.5" aria-hidden="true" />
          Imagem principal (obrigatória)
        </p>
        <input
          ref={mainInputRef}
          data-testid="bench-image-input-main"
          type="file"
          accept={ACCEPTED_MIME_TYPES}
          disabled={disabled || uploading}
          aria-label="Selecionar imagem principal do produto"
          onChange={handleMainChange}
          className="text-sm text-text-secondary file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-bg-elevated file:px-3 file:py-2 file:text-sm file:text-text-primary"
        />
        {mainFile && (
          <div
            data-testid="bench-main-image"
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-elevated px-3 py-2"
          >
            <span className="font-mono text-xs text-text-primary">
              Principal: {mainFile.name}
            </span>
            <button
              type="button"
              data-testid="bench-remove-main"
              onClick={removeMain}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-1 text-xs text-accent-red font-body"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remover
            </button>
          </div>
        )}
      </div>

      {/* Imagens adicionais (opcionais, até 3) */}
      <div
        data-testid="bench-additional-image-field"
        className="flex flex-col gap-3 rounded-lg border border-dashed border-border-light bg-bg-deep/40 p-4"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted font-heading">
          Imagens adicionais (opcionais — até {MAX_ADDITIONAL_IMAGES})
        </p>
        <p className="text-sm text-text-secondary font-body">{ADDITIONAL_IMAGES_HELP}</p>
        <input
          ref={additionalInputRef}
          data-testid="bench-image-input-additional"
          type="file"
          multiple
          accept={ACCEPTED_MIME_TYPES}
          disabled={disabled || uploading || additionalFiles.length >= MAX_ADDITIONAL_IMAGES}
          aria-label="Selecionar imagens adicionais do produto"
          onChange={handleAdditionalChange}
          className="text-sm text-text-secondary file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-bg-elevated file:px-3 file:py-2 file:text-sm file:text-text-primary"
        />
        {additionalFiles.length > 0 && (
          <ol className="space-y-2">
            {additionalFiles.map((file, index) => (
              <li
                key={`${file.name}:${file.lastModified}:${index}`}
                data-testid={`bench-additional-image-${index}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg-elevated px-3 py-2"
              >
                <span className="font-mono text-xs text-text-primary">
                  Adicional {index + 1}: {file.name}
                </span>
                <button
                  type="button"
                  data-testid={`bench-remove-additional-${index}`}
                  onClick={() => removeAdditional(index)}
                  disabled={disabled || uploading}
                  className="inline-flex items-center gap-1 text-xs text-accent-red font-body"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Remover
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

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
          {mainFile ? 1 : 0} principal + {additionalFiles.length} adicional(is)
        </span>
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
                Ordem
              </th>
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
          {inputs.map((entry, index) => (
            <tr key={entry.path} className="border-t border-border">
              <td className="px-3 py-2 text-xs text-text-secondary">
                {index === 0 ? "Principal" : `Adicional ${index}`}
              </td>
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
