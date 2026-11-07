"use client";

import { AlertCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { computeExpandGeometry, type ExpandGeometrySupported } from "@/lib/lab/bench/domain/expand-geometry";
import { DEFAULT_EXPAND_9_16_PROMPT, EXPAND_9_16_PROMPT_VERSION } from "@/lib/lab/bench/domain/expand-prompt";
import type { BenchConfigOptions, BenchPresetOption } from "../../_components/bench-workbench";
import { BenchStoreSelector, type BenchStoreOption } from "../../_components/bench-store-selector";
import { BenchPresetSelector } from "../../_components/bench-preset-selector";
import { BenchSingleImageUpload } from "./bench-single-image-upload";
import { BenchExpandGeometryPanel } from "./bench-expand-geometry-panel";
import { BenchExpandPromptPanel, type BenchExpandPromptStatus } from "./bench-expand-prompt-panel";
import { BenchExpandExecutionPanel } from "./bench-expand-execution-panel";
import { BenchExpandResultPanel } from "./bench-expand-result-panel";
import { BenchExpandHistoryPanel } from "./bench-expand-history-panel";
import type { BenchInputMetadata, BenchUploadResult } from "../../_components/bench-image-upload";

/**
 * Contêiner cliente da operação **Expansão de campanha pronta** (quick
 * 261107-qvo). Mantém apenas estado de UI; nenhuma chamada paga parte daqui.
 */

interface BenchExpandWorkbenchProps {
  stores: BenchStoreOption[];
  presets: BenchPresetOption[];
  config: BenchConfigOptions;
}

export function BenchExpandWorkbench({
  stores,
  presets,
  config,
}: BenchExpandWorkbenchProps) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [presetId, setPresetId] = useState(
    presets.find((preset) => preset.enabled)?.id ?? presets[0]?.id ?? "",
  );
  const [upload, setUpload] = useState<BenchUploadResult | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_EXPAND_9_16_PROMPT);
  const [promptStatus, setPromptStatus] = useState<BenchExpandPromptStatus>("idle");
  const [executionConfigRevision, setExecutionConfigRevision] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [attempting, setAttempting] = useState(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const operationRef = useRef<{ id: string; fingerprint: string } | null>(null);

  const getOperationId = useCallback((fingerprint: string): string => {
    const current = operationRef.current;
    if (current && current.fingerprint === fingerprint) return current.id;
    const id = crypto.randomUUID();
    operationRef.current = { id, fingerprint };
    return id;
  }, []);

  const input = upload?.inputs[0] ?? null;
  const geometry =
    input && input.width !== null && input.height !== null
      ? computeExpandGeometry({ width: input.width, height: input.height })
      : null;
  const supportedGeometry: ExpandGeometrySupported | null =
    geometry?.supported ? geometry : null;
  const approvedPrompt = promptStatus === "approved" ? prompt : null;

  function handleStoreChange(nextStoreId: string) {
    setStoreId(nextStoreId);
    setUpload(null);
    setSelectedRunId(null);
    setPrompt(DEFAULT_EXPAND_9_16_PROMPT);
    setPromptStatus("idle");
    setApprovalError(null);
    setAttemptError(null);
    operationRef.current = null;
    setExecutionConfigRevision((revision) => revision + 1);
  }

  function handleUploaded(result: BenchUploadResult) {
    setUpload(result);
    setSelectedRunId(null);
    setPromptStatus("idle");
    setApprovalError(null);
    setAttemptError(null);
    setExecutionConfigRevision((revision) => revision + 1);
  }

  function handleSelectionInvalidated() {
    setUpload(null);
    setSelectedRunId(null);
    setPromptStatus("idle");
    setApprovalError(null);
    setAttemptError(null);
    setExecutionConfigRevision((revision) => revision + 1);
  }

  function handlePresetChange(nextPresetId: string) {
    setPresetId(nextPresetId);
    // Modelo/qualidade não alteram o texto: a aprovação do prompt permanece.
    setExecutionConfigRevision((revision) => revision + 1);
  }

  function handlePromptChange(next: string) {
    setPrompt(next);
    setPromptStatus("edited");
    setApprovalError(null);
    setExecutionConfigRevision((revision) => revision + 1);
  }

  function handleResetPrompt() {
    setPrompt(DEFAULT_EXPAND_9_16_PROMPT);
    setPromptStatus("idle");
    setApprovalError(null);
    setExecutionConfigRevision((revision) => revision + 1);
  }

  function handleApprove() {
    if (prompt.trim().length === 0) {
      setApprovalError("O prompt de expansão não pode estar vazio.");
      return;
    }
    if (!supportedGeometry) {
      setApprovalError("Resolva a geometria da entrada antes de aprovar.");
      return;
    }
    setApprovalError(null);
    setPromptStatus("approved");
  }

  async function handleNewAttempt(sourceRunId: string) {
    setAttempting(true);
    setAttemptError(null);
    try {
      const operationId = crypto.randomUUID();
      const response = await fetch(
        `/api/admin/laboratorio/bancada/runs/${encodeURIComponent(sourceRunId)}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationId }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        runId?: string;
        references?: string[];
        error?: string;
      };
      if (!response.ok || !data.runId || !Array.isArray(data.references)) {
        setAttemptError("Não foi possível iniciar uma nova tentativa.");
        setAttempting(false);
        return;
      }

      const detail = await fetch(
        `/api/admin/laboratorio/bancada/runs/${encodeURIComponent(data.runId)}`,
        { method: "GET" },
      );
      const detailData = (await detail.json().catch(() => ({}))) as {
        artifacts?: Array<{
          kind: string;
          storagePath?: string;
          mimeType: string | null;
          width: number | null;
          height: number | null;
          bytes: number | null;
          checksum: string | null;
        }>;
      };
      const inputs: BenchInputMetadata[] = (detailData.artifacts ?? [])
        .filter((artifact) => artifact.kind === "input")
        .map((artifact) => ({
          path: artifact.storagePath ?? "",
          mimeType: artifact.mimeType ?? "image/png",
          width: artifact.width,
          height: artifact.height,
          bytes: artifact.bytes ?? 0,
          checksum: artifact.checksum ?? "",
        }))
        .filter((artifact) => artifact.path.length > 0);

      setUpload({
        runId: data.runId,
        references: data.references,
        operationId,
        inputs,
      });
      setSelectedRunId(null);
      setPromptStatus("idle");
      setApprovalError(null);
      setExecutionConfigRevision((revision) => revision + 1);
      setHistoryRefresh((revision) => revision + 1);
      setAttempting(false);
    } catch {
      setAttemptError("Não foi possível iniciar uma nova tentativa.");
      setAttempting(false);
    }
  }

  function handleCompleted(runId: string) {
    setSelectedRunId(runId);
    setHistoryRefresh((revision) => revision + 1);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <BenchStoreSelector
          stores={stores}
          value={storeId}
          onChange={handleStoreChange}
        />
        <BenchSingleImageUpload
          storeId={storeId}
          getOperationId={getOperationId}
          onUploaded={handleUploaded}
          onSelectionInvalidated={handleSelectionInvalidated}
        />
        <BenchPresetSelector
          presets={presets}
          config={config}
          presetId={presetId}
          formato="9:16"
          showFormat={false}
          onChange={handlePresetChange}
        />
        <BenchExpandGeometryPanel geometry={geometry} />
        <BenchExpandPromptPanel
          value={prompt}
          promptVersion={EXPAND_9_16_PROMPT_VERSION}
          status={promptStatus}
          onChange={handlePromptChange}
          onApprove={handleApprove}
          onReset={handleResetPrompt}
          disabled={!upload}
        />
        {approvalError && (
          <p role="alert" className="flex items-center gap-1 text-sm text-accent-red font-body">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {approvalError}
          </p>
        )}
        {attemptError && (
          <p role="alert" className="flex items-center gap-1 text-sm text-accent-red font-body">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {attemptError}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <BenchExpandExecutionPanel
          storeId={storeId}
          presetId={presetId}
          promptApproved={approvedPrompt}
          promptVersion={EXPAND_9_16_PROMPT_VERSION}
          runId={upload?.runId ?? null}
          references={upload?.references ?? []}
          operationId={upload?.operationId ?? null}
          geometry={supportedGeometry}
          configRevision={executionConfigRevision}
          disabled={!upload}
          onCompleted={handleCompleted}
        />
        <BenchExpandResultPanel
          runId={selectedRunId}
          onNewAttempt={handleNewAttempt}
          attempting={attempting}
        />
        <BenchExpandHistoryPanel
          storeId={storeId}
          refreshKey={historyRefresh}
          selectedRunId={selectedRunId}
          onOpen={setSelectedRunId}
        />
      </div>
    </div>
  );
}
