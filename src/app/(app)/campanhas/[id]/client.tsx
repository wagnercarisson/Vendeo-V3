"use client";

import { useEffect, useState, useCallback } from "react";
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
import type { CampaignPageProps } from "@/lib/campaign/display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default function CampaignPageClient(props: CampaignPageProps) {
  const router = useRouter();

  useEffect(() => {
    if (props.displayStatus !== "generating") return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [props.displayStatus, router]);

  const breadcrumbs = [
    { label: "Campanhas", href: "/campanhas" },
    { label: props.productName || "Campanha" },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={props.productName || "Campanha"}
        breadcrumbs={breadcrumbs}
      />

      {props.displayStatus === "generating" && <GeneratingView />}
      {props.displayStatus === "stale" && (
        <StaleView onNewCampaign={() => router.push("/campanhas/nova")} />
      )}
      {props.displayStatus === "error" && (
        <ErrorView onNewCampaign={() => router.push("/campanhas/nova")} />
      )}
      {props.displayStatus === "ready" && <ReadyView {...props} />}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
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
      aria-label={`Copiar ${label}`}
      className="shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-accent-green" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado!" : "Copiar"}
    </Button>
  );
}

function ReadyView(props: CampaignPageProps) {
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
          alt={props.productName || "Campanha"}
          className="w-full rounded-xl shadow-md"
        />
      )}

      <p className="text-sm text-text-muted font-body">
        Criada em{" "}
        {new Date(props.createdAt).toLocaleDateString("pt-BR")}
      </p>

      <Card>
        <div className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-xl font-semibold text-text-primary font-heading">
              Kit de Publicação
            </h2>
            {isEdited && !isEditing && (
              <Badge variant="ready">
                <CheckCheck className="mr-1 h-3 w-3" />
                Editado
              </Badge>
            )}
          </div>

          {!isEditing ? (
            <div className="space-y-3">
              {currentCopy.caption && (
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-lg text-text-primary font-body">
                    {currentCopy.caption}
                  </p>
                  <CopyButton text={currentCopy.caption} label="caption" />
                </div>
              )}
              {currentCopy.hashtags.length > 0 && (
                <div className="flex items-start gap-2">
                  <div className="flex flex-1 flex-wrap gap-2">
                    {currentCopy.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-accent-green/10 px-3 py-1 text-sm text-accent-green font-body"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <CopyButton text={currentCopy.hashtags.join(" ")} label="hashtags" />
                </div>
              )}
              {currentCopy.cta_post && (
                <div className="flex items-start gap-2">
                  <p className="flex-1 font-semibold text-accent-green font-heading">
                    {currentCopy.cta_post}
                  </p>
                  <CopyButton text={currentCopy.cta_post} label="CTA" />
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
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary font-heading">
                  Caption
                </label>
                <textarea
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
        Baixar Original
      </Button>
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
