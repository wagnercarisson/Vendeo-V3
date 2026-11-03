"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Save,
  RotateCcw,
  X,
  CheckCheck,
  Download,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import type { CampaignPageProps, NewFlowCopyView } from "@/lib/campaign/display";
import type {
  CampaignDetailCopyMessages,
  CampaignDetailMessages,
} from "@/lib/i18n/campaign-detail/messages";
import type { SupportedUiLocale } from "@/lib/i18n/locales";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import CampaignApprovalView from "@/components/campaign/campaign-approval-view";
import { UnknownResultPanel } from "@/components/flow/unknown-result-panel";
import { RefundedPanel } from "@/components/flow/refunded-panel";
import { CopyRecoveryPanel } from "@/components/flow/copy-recovery-panel";
import { isDrivingCopyRecovery } from "@/lib/campaign/copy-recovery-driving";

interface CampaignPageClientProps extends CampaignPageProps {
  messages: CampaignDetailMessages;
  locale: SupportedUiLocale;
}

/**
 * Extração mínima das condições de renderização da página. O MESMO resultado
 * decide qual tela aparece e se a interface da entrega pronta é localizada —
 * assim as duas regras não podem divergir. Não altera precedência nem estado.
 */
type DeliverySurface = "ready" | "approval" | "regenerating" | "other";

function resolveDeliverySurface(props: CampaignPageProps): DeliverySurface {
  if (props.newFlow) {
    return props.newFlow.state === "delivered" ? "ready" : "other";
  }

  if (props.displayStatus !== "ready") return "other";
  if (props.approval?.state.status === "regenerating") return "regenerating";

  if (
    props.approval?.state.status === "pending" &&
    props.approval.candidateImageUrl &&
    props.approval.candidateVersionId
  ) {
    return "approval";
  }

  return "ready";
}

/**
 * F56.2b2a (B2.1 / Plano 04) — `requestToken` POR ACIONAMENTO (critério 27):
 * cada NOVA tentativa (automática 2ª/3ª ou clique manual) gera um token PRÓPRIO;
 * o reenvio do MESMO acionamento é o único que reutiliza (não implementado aqui —
 * um clique = um acionamento).
 *
 * WR-01 — o token DEVE satisfazer `z.string().uuid()` no servidor. Preferimos
 * `crypto.randomUUID()`; na sua ausência geramos um UUID v4 VÁLIDO a partir de
 * `crypto.getRandomValues` (bits de versão/variante fixados). SEM fonte
 * criptográfica devolvemos `null` (sentinela) e o CHAMADOR NÃO envia o POST.
 */
function newRequestToken(): string | null {
  if (typeof crypto === "undefined") return null;
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    // RFC 4122 v4: nibble de versão = 4; bits de variante = 10xx.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return null;
}

export default function CampaignPageClient(props: CampaignPageClientProps) {
  const router = useRouter();

  const surface = resolveDeliverySurface(props);
  const isReadySurface = surface === "ready";
  const interfaceLang =
    isReadySurface && props.locale === "es-419" ? "es-419" : undefined;
  const fallbackTitle = isReadySurface
    ? props.messages.fallbackTitle
    : "Campanha";
  const displayTitle = props.productName || fallbackTitle;
  const contentTitleLang =
    isReadySurface && props.productName ? "" : undefined;
  const breadcrumbs = [
    {
      label: isReadySurface ? props.messages.breadcrumbCampaigns : "Campanhas",
      href: "/campanhas",
    },
    { label: displayTitle, lang: contentTitleLang },
  ];

  const isNewFlowRunning = props.newFlow?.state === "running";
  const isLegacyGenerating = !props.newFlow && props.displayStatus === "generating";
  const recovery = props.newFlow?.recovery;
  const drivesAutomaticRecovery =
    isDrivingCopyRecovery(props.campaignId, props.newFlow?.operationId) &&
    recovery?.manualAttempts === 0;

  // F56.2b2a (correção pós-revisão) — a recuperação ATIVA/EM ESPERA também exige
  // ACOMPANHAMENTO: outra aba (ou reload) precisa refletir o avanço do servidor
  // mesmo com a imagem já `delivered` (sem `generating`/`running`). O poll apenas
  // REFLETE o estado persistido (`router.refresh()`); NUNCA inicia chamadas — uma
  // aba que não dirige jamais emite requisição. `indeterminada` NÃO entra (evita
  // loop ilimitado); `concluida` encerra o acompanhamento. Espera que o servidor
  // confirmou vencida, SEM aba dirigente, encerra o poll: só resta ação manual.
  const recoveryNeedsAccompaniment =
    recovery != null &&
    (recovery.state === "ativa" ||
      (recovery.state === "aguardando" &&
        (recovery.waitRemainingMs > 0 || drivesAutomaticRecovery)));

  useEffect(() => {
    if (
      !isLegacyGenerating &&
      !isNewFlowRunning &&
      !recoveryNeedsAccompaniment
    )
      return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [isLegacyGenerating, isNewFlowRunning, recoveryNeedsAccompaniment, router]);

  // F56.2b1b (Plano 06, B1B-D7 / REQ-56.2.2-09): campanha do NOVO fluxo — o
  // estado exibido deriva da OPERAÇÃO PERSISTIDA (props.newFlow) e NUNCA cai nas
  // telas legadas (`StaleView`/`ErrorView`) nem expõe ação de regeneração. O poll
  // apenas reflete o estado persistido (não retoma/controla execução).
  if (props.newFlow) {
    return (
      <div lang={interfaceLang} className="mx-auto max-w-2xl">
        <PageHeader
          title={displayTitle}
          titleLang={contentTitleLang}
          breadcrumbs={breadcrumbs}
        />

        {props.newFlow.state === "running" && <GeneratingView />}
        {props.newFlow.state === "delivered" && <NewFlowDeliveredView {...props} />}
        {props.newFlow.state === "refunded" && (
          <RefundedPanel
            campaignId={props.campaignId}
            supportEmail={props.newFlow.supportEmail}
            confirmed
            restoredForm={props.newFlow.restoredForm ?? null}
          />
        )}
        {props.newFlow.state === "unknown" && (
          <UnknownResultPanel
            supportReference={props.newFlow.supportReference ?? null}
            supportEmail={props.newFlow.supportEmail}
            campaignId={props.campaignId}
            operationId={props.newFlow.operationId ?? null}
          />
        )}
      </div>
    );
  }

  return (
    <div lang={interfaceLang} className="mx-auto max-w-2xl">
      <PageHeader
        title={displayTitle}
        titleLang={contentTitleLang}
        breadcrumbs={breadcrumbs}
      />

      {props.displayStatus === "generating" && <GeneratingView />}
      {props.displayStatus === "stale" && (
        <StaleView onNewCampaign={() => router.push("/campanhas/nova")} />
      )}
      {props.displayStatus === "error" && (
        <ErrorView onNewCampaign={() => router.push("/campanhas/nova")} />
      )}
      {surface === "regenerating" ? (
        <RegeneratingView />
      ) : surface === "approval" &&
        props.approval?.candidateImageUrl &&
        props.approval.candidateVersionId ? (
        <CampaignApprovalView
          campaignId={props.campaignId}
          versionId={props.approval.candidateVersionId}
          imageUrl={props.approval.candidateImageUrl}
          productName={props.productName}
          showProblemReport={Boolean(
            props.approval.isV1 && props.approval.hasOpportunity
          )}
        />
      ) : surface === "ready" ? (
        <ReadyView {...props} />
      ) : null}
    </div>
  );
}

function CopyButton({
  text,
  label,
  copyMessages,
}: {
  text: string;
  label: string;
  copyMessages: CampaignDetailCopyMessages;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      aria-label={`${copyMessages.ariaPrefix} ${label}`}
      className="shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? copyMessages.copied : copyMessages.copy}
    </Button>
  );
}

function ReadyView(props: CampaignPageClientProps) {
  const router = useRouter();
  const [currentCopy, setCurrentCopy] = useState({
    caption: props.caption,
    hashtags: props.hashtags,
    cta_post: props.ctaPost,
  });
  const [isEdited, setIsEdited] = useState(props.isPublicationCopyEdited);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    caption: "",
    hashtags: [] as string[],
    cta_post: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleEdit = useCallback(() => {
    setEditData({
      caption: currentCopy.caption,
      hashtags: currentCopy.hashtags,
      cta_post: currentCopy.cta_post,
    });
    setIsEditing(true);
    setSaveError(null);
  }, [currentCopy]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/campaign/${props.campaignId}/publication-copy`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editData),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      const data = await res.json();
      const saved = data.publication_copy_current;
      setCurrentCopy({
        caption: saved.caption,
        hashtags: saved.hashtags,
        cta_post: saved.cta_post,
      });
      setIsEdited(true);
      setIsEditing(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Erro ao salvar",
      );
    } finally {
      setIsSaving(false);
    }
  }, [editData, props.campaignId]);

  const handleRestore = useCallback(async () => {
    if (!confirm("Restaurar texto original da IA?")) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/campaign/${props.campaignId}/publication-copy`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restore: true }),
        },
      );
      if (!res.ok) throw new Error("Failed to restore");
      const data = await res.json();
      const snapshot = data.publication_copy_snapshot;
      setCurrentCopy({
        caption: snapshot.caption,
        hashtags: snapshot.hashtags,
        cta_post: snapshot.cta_post,
      });
      setIsEdited(false);
      setIsEditing(false);
    } catch {
      setSaveError("Não foi possível restaurar. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }, [props.campaignId]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleHashtagsChange = useCallback(
    (value: string) => {
      const tags = value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      setEditData((prev) => ({ ...prev, hashtags: tags }));
    },
    [],
  );

  return (
    <div className="space-y-6">
      {props.imageUrl && (
        <img
          src={props.imageUrl}
          alt={props.productName || props.messages.fallbackTitle}
          lang=""
          className="w-full rounded-xl shadow-md"
        />
      )}

      <p className="text-sm text-text-muted font-body">
        {props.messages.createdAtLabel}{" "}
        {new Date(props.createdAt).toLocaleDateString("pt-BR")}
      </p>

      <Card>
        <div className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-xl font-semibold text-text-primary font-heading">
              {props.messages.publicationKit}
            </h2>
            {isEdited && !isEditing && (
              <Badge variant="ready">
                <CheckCheck className="mr-1 h-3 w-3" />
                {props.messages.editedBadge}
              </Badge>
            )}
          </div>

          {!isEditing ? (
            <div className="space-y-3">
              {currentCopy.caption && (
                <div className="flex items-start gap-2">
                  <p lang="" className="flex-1 text-lg text-text-primary font-body">
                    {currentCopy.caption}
                  </p>
                  <CopyButton
                    text={currentCopy.caption}
                    label={props.messages.copy.targets.caption}
                    copyMessages={props.messages.copy}
                  />
                </div>
              )}
              {currentCopy.hashtags.length > 0 && (
                <div className="flex items-start gap-2">
                  <div lang="" className="flex flex-1 flex-wrap gap-2">
                    {currentCopy.hashtags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="rounded-full bg-accent-green/10 px-3 py-1 text-sm text-accent-green font-body"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <CopyButton
                    text={currentCopy.hashtags.join(" ")}
                    label={props.messages.copy.targets.hashtags}
                    copyMessages={props.messages.copy}
                  />
                </div>
              )}
              {currentCopy.cta_post && (
                <div className="flex items-start gap-2">
                  <p lang="" className="flex-1 font-semibold text-accent-green font-heading">
                    {currentCopy.cta_post}
                  </p>
                  <CopyButton
                    text={currentCopy.cta_post}
                    label={props.messages.copy.targets.cta}
                    copyMessages={props.messages.copy}
                  />
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            </div>
          ) : (
            <div lang="pt-BR" className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary font-heading">
                  Legenda
                </label>
                <textarea
                  lang=""
                  value={editData.caption}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      caption: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-bg-surface p-3 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-green focus:outline-none font-body"
                  rows={4}
                  maxLength={2200}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary font-heading">
                  Hashtags (uma por linha)
                </label>
                <textarea
                  lang=""
                  value={editData.hashtags.join("\n")}
                  onChange={(e) => handleHashtagsChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-surface p-3 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-green focus:outline-none font-body"
                  rows={4}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary font-heading">
                  CTA
                </label>
                <input
                  lang=""
                  type="text"
                  value={editData.cta_post}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      cta_post: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-bg-surface p-3 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-green focus:outline-none font-body"
                  maxLength={200}
                  disabled={isSaving}
                />
              </div>

              {saveError && (
                <p className="text-sm text-accent-red font-body">
                  {saveError}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  loading={isSaving}
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestore}
                  disabled={isSaving}
                >
                  <RotateCcw className="h-4 w-4" />
                  Restaurar original
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Button
        variant="primary"
        size="md"
        onClick={() => { window.location.href = `/api/campaign/${props.campaignId}/download`; }}
      >
        <Download className="h-4 w-4" />
        {props.messages.downloadOriginal}
      </Button>
      <p className="text-xs text-text-muted">
        {props.messages.disclaimer}
      </p>
    </div>
  );
}

function GeneratingView() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-12">
      <Loader2 className="h-12 w-12 animate-spin text-accent-green" />
      <p className="text-lg text-text-secondary font-body">
        Sua campanha está sendo gerada...
      </p>
    </div>
  );
}

// F37.2 (R7): progresso da v2 durante a correção (`regenerating`). Sem download,
// sem Kit de Publicação e sem [Aprovar arte]/[Informar problema] — não cai no
// ReadyView.
function RegeneratingView() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-12">
      <Loader2 className="h-12 w-12 animate-spin text-accent-green" />
      <p className="text-lg text-text-secondary font-body">
        Corrigindo a arte...
      </p>
      <p className="text-sm text-text-muted font-body">
        Aguarde: a nova versão aparecerá para aprovação.
      </p>
    </div>
  );
}

// F56.2b1b (P3) — campanha do NOVO fluxo entregue (`delivered`): a ARTE é exibida
// e, quando a copy do NOVO FLUXO está disponível (lida POR OPERAÇÃO), os textos
// completos (título/legenda/hashtags/CTA) são exibidos. Falha/cancelamento da copy
// ⇒ feedback SEGURO (âmbar) — nunca sucesso falso, nunca bloqueia a arte e SEM
// ação de retry ("Gerar novamente"). NÃO inicia geração/cobrança.
//
// F56.2b2a (B2.1 / Plano 04) — a superfície de RECUPERAÇÃO de copy é composta
// sobre a MESMA entrega: o `CopyRecoveryPanel` é renderizado SOMENTE quando a view
// mapeada é não-nula E a copy está pendente/falha (a `concluída` remove a
// recuperação e o texto entregue continua no `NewFlowCopyPanel`). O poll de 5s
// segue preservado (apenas REFLETE o estado do servidor — não retoma/controla).
function NewFlowDeliveredView(props: CampaignPageClientProps) {
  const router = useRouter();
  const operationId = props.newFlow?.operationId ?? null;
  const recovery = props.newFlow?.recovery ?? null;

  // `isDriving` derivado do HANDLE DE CONDUÇÃO lido no mount: `true` SOMENTE na
  // aba INICIADORA, DENTRO do ciclo da geração daquela aba; `reload`/outra aba
  // (SEM handle) ⇒ `false` ⇒ apenas ACOMPANHA (retomada MANUAL).
  const isDriving = useMemo(
    () => isDrivingCopyRecovery(props.campaignId, operationId),
    [props.campaignId, operationId],
  );

  // A espera persistida pode estar vencida mesmo após reload/outra aba. Sem
  // condução automática, apresentar retomada MANUAL, sem prometer geração/0s.
  // Usa a confirmação do SERVIDOR, não apenas o relógio local da contagem.
  const manualRecoveryReady = recovery?.state === "aguardando" &&
    recovery.waitRemainingMs <= 0 && (!isDriving || recovery.manualAttempts > 0);

  const waitKey = `${recovery?.state ?? ""}|${recovery?.autoAttempts ?? -1}|${recovery?.waitRemainingMs ?? 0}`;
  const [remainingMs, setRemainingMs] = useState(recovery?.waitRemainingMs ?? 0);
  const [trackedWaitKey, setTrackedWaitKey] = useState(waitKey);
  const [actionError, setActionError] = useState<string | null>(null);
  // Guarda de NÃO-duplicação do acionamento automático ANCORADA no AVANÇO
  // PERSISTIDO: memoriza o `autoAttempts` para o qual a última automática foi
  // emitida. Re-arma AUTOMATICAMENTE quando o servidor avança o contador — cobre
  // a falha RÁPIDA (o novo `aguardando` nem chega a renderizar `ativa`) e a
  // chegada com a espera já vencida — e evita duplicar dentro do MESMO episódio.
  const lastEmittedAutoRef = useRef<number | null>(null);

  // A espera REPORTADA pelo servidor é a AUTORIDADE. Ajuste DURANTE O RENDER
  // (padrão React): quando o servidor reporta um NOVO episódio de espera
  // (estado/autoAttempts/waitRemainingMs mudam), a contagem é re-sincronizada
  // ANTES do commit — assim o efeito de emissão NUNCA vê um `remainingMs === 0`
  // herdado do episódio anterior (evita a próxima automática disparar cedo).
  if (waitKey !== trackedWaitKey) {
    setTrackedWaitKey(waitKey);
    setRemainingMs(recovery?.waitRemainingMs ?? 0);
  }

  // Contador local apenas REFLETE o que o servidor reportou (não infere espera).
  useEffect(() => {
    if (recovery?.state !== "aguardando") return;
    const id = setInterval(() => {
      setRemainingMs((prev) => (prev > 0 ? Math.max(0, prev - 1000) : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [recovery?.state]);

  const emitAttempt = useCallback(
    async (mode: "manual" | "auto_retry") => {
      if (!operationId) return;
      // WR-01 — SEM fonte criptográfica para um UUID válido: NÃO emitir o POST.
      // MANUAL ⇒ feedback SEGURO; AUTOMÁTICA ⇒ simplesmente não emite.
      const requestToken = newRequestToken();
      if (requestToken === null) {
        if (mode === "manual") {
          setActionError(
            "Não foi possível tentar novamente agora. Tente de novo em instantes.",
          );
        }
        return;
      }
      try {
        const res = await fetch(
          `/api/campaign/${props.campaignId}/copy-recovery`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode,
              operationId,
              requestToken,
            }),
          },
        );
        if (!res.ok) {
          // HTTP NÃO-OK ⇒ feedback SEGURO (sem terminal falso nem motivo interno).
          if (mode === "manual") {
            setActionError(
              "Não foi possível tentar novamente agora. Tente de novo em instantes.",
            );
          }
          return;
        }
        setActionError(null);
        router.refresh();
      } catch {
        if (mode === "manual") {
          setActionError(
            "Não foi possível tentar novamente agora. Tente de novo em instantes.",
          );
        }
      }
    },
    [operationId, props.campaignId, router],
  );

  // AGENDA da próxima AUTOMÁTICA: SOMENTE a aba INICIADORA (`isDriving === true`)
  // emite `mode: "auto_retry"` ao fim da contagem REPORTADA, com `requestToken`
  // NOVO por acionamento. A guarda é ancorada no `autoAttempts` PERSISTIDO: cada
  // avanço do servidor re-arma a emissão (inclusive a falha rápida e a chegada com
  // espera vencida); o MESMO `autoAttempts` não emite duas vezes. Após QUALQUER
  // início MANUAL (`manualAttempts > 0`) o ciclo automático está FECHADO e NENHUMA
  // automática é agendada (belt-and-braces). `reload`/outra aba (sem handle) apenas
  // ACOMPANHA.
  useEffect(() => {
    if (recovery?.state !== "aguardando") return;
    if (!isDriving) return;
    if (remainingMs > 0) return;
    if (recovery.manualAttempts !== 0) return;
    if (lastEmittedAutoRef.current === recovery.autoAttempts) return;
    lastEmittedAutoRef.current = recovery.autoAttempts;
    void emitAttempt("auto_retry");
  }, [recovery?.state, recovery?.autoAttempts, recovery?.manualAttempts, remainingMs, isDriving, emitAttempt]);

  const showRecovery = recovery !== null && recovery.state !== "concluida";

  return (
    <div className="space-y-6">
      {props.imageUrl && (
        <img
          src={props.imageUrl}
          alt={props.productName || props.messages.fallbackTitle}
          lang=""
          className="w-full rounded-xl shadow-md"
        />
      )}

      <p className="text-sm text-text-muted font-body">
        {props.messages.createdAtLabel}{" "}
        {new Date(props.createdAt).toLocaleDateString("pt-BR")}
      </p>

      {showRecovery && recovery ? (
        <>
          <div lang="pt-BR">
            <CopyRecoveryPanel
              state={manualRecoveryReady ? "interrompida" : recovery.state}
              autoAttempts={recovery.autoAttempts}
              manualAttempts={recovery.manualAttempts}
              waitRemainingMs={
                recovery.state === "aguardando" ? remainingMs : recovery.waitRemainingMs
              }
              canRetry={recovery.canRetry}
              onRecover={() => {
                void emitAttempt("manual");
              }}
              onVerify={() => router.refresh()}
              supportEmail={props.newFlow?.supportEmail}
            />
          </div>
          {actionError && (
            <p lang="pt-BR" role="alert" className="text-sm text-accent-red font-body">
              {actionError}
            </p>
          )}
        </>
      ) : (
        <NewFlowCopyPanel
          copy={props.newFlow?.copy ?? null}
          messages={props.messages}
        />
      )}

      <Button
        variant="primary"
        size="md"
        onClick={() => {
          window.location.href = props.downloadUrl;
        }}
      >
        <Download className="h-4 w-4" />
        {props.messages.downloadOriginal}
      </Button>
      <p className="text-xs text-text-muted">
        {props.messages.disclaimer}
      </p>
    </div>
  );
}

// F56.2b1b (P3) — painel da copy do NOVO FLUXO. `delivered` ⇒ textos completos;
// `failed`/`canceled` ⇒ feedback seguro (âmbar); `pending`/ausente ⇒ nada (a arte
// continua exibida). Somente LEITURA — nunca gera/regenera/retenta.
function NewFlowCopyPanel({
  copy,
  messages,
}: {
  copy: NewFlowCopyView | null;
  messages: CampaignDetailMessages;
}) {
  if (!copy) return null;

  if (copy.state === "failed" || copy.state === "canceled") {
    return (
      <Card>
        <div lang="pt-BR" className="p-4">
          <p className="text-sm text-accent-amber font-body">
            {copy.state === "canceled"
              ? "A geração do texto demorou mais que o esperado e foi interrompida. A arte está pronta para uso."
              : "Não foi possível gerar o texto desta campanha. A arte está pronta para uso."}
          </p>
        </div>
      </Card>
    );
  }

  if (copy.state === "pending") return null;

  const hasText = Boolean(
    copy.title || copy.caption || copy.hashtags.length > 0 || copy.ctaPost,
  );
  if (!hasText) return null;

  return (
    <Card>
      <div className="p-4">
        <h2 className="mb-4 text-xl font-semibold text-text-primary font-heading">
          {messages.publicationKit}
        </h2>
        <div className="space-y-3">
          {copy.title && (
            <div className="flex items-start gap-2">
              <p lang="" className="flex-1 text-lg font-semibold text-text-primary font-heading">
                {copy.title}
              </p>
              <CopyButton
                text={copy.title}
                label={messages.copy.targets.title}
                copyMessages={messages.copy}
              />
            </div>
          )}
          {copy.caption && (
            <div className="flex items-start gap-2">
              <p lang="" className="flex-1 text-lg text-text-primary font-body">
                {copy.caption}
              </p>
              <CopyButton
                text={copy.caption}
                label={messages.copy.targets.caption}
                copyMessages={messages.copy}
              />
            </div>
          )}
          {copy.hashtags.length > 0 && (
            <div className="flex items-start gap-2">
              <div lang="" className="flex flex-1 flex-wrap gap-2">
                {copy.hashtags.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="rounded-full bg-accent-green/10 px-3 py-1 text-sm text-accent-green font-body"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <CopyButton
                text={copy.hashtags.join(" ")}
                label={messages.copy.targets.hashtags}
                copyMessages={messages.copy}
              />
            </div>
          )}
          {copy.ctaPost && (
            <div className="flex items-start gap-2">
              <p lang="" className="flex-1 font-semibold text-accent-green font-heading">
                {copy.ctaPost}
              </p>
              <CopyButton
                text={copy.ctaPost}
                label={messages.copy.targets.cta}
                copyMessages={messages.copy}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// F56.2b1b (Plano 06, REQ-56.2.2-07) → F56.2b2b (B2.2 / B2B-D5): a falha
// CONFIRMADA do novo fluxo (operação persistida como `refunded`) é exibida pelo
// `RefundedPanel` (mensagem EXATA + nota de escopo + CTA de nova geração com os
// dados restaurados). `NewFlowFailureView` foi substituído — a copy antiga
// ("A geração falhou e o crédito foi devolvido.") NÃO é mais usada.
function StaleView({
  onNewCampaign,
}: {
  onNewCampaign: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-12">
      <p className="text-lg text-accent-amber font-body">
        Geração interrompida. Tente novamente.
      </p>
      <Button variant="primary" onClick={onNewCampaign}>
        Criar Nova Campanha
      </Button>
    </div>
  );
}

function ErrorView({
  onNewCampaign,
}: {
  onNewCampaign: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-12">
      <p className="text-lg text-accent-red font-body">
        Não foi possível gerar sua campanha.
      </p>
      <Button variant="primary" onClick={onNewCampaign}>
        Criar Nova Campanha
      </Button>
    </div>
  );
}
