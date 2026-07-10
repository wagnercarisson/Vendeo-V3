"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CampaignPageProps } from "@/lib/campaign/display";

export default function CampaignPageClient(props: CampaignPageProps) {
  const router = useRouter();

  useEffect(() => {
    if (props.displayStatus !== "generating") return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [props.displayStatus, router]);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link
        href="/minhas-campanhas"
        className="mb-4 inline-block text-sm text-blue-600 hover:text-blue-800"
      >
        ← Minhas Campanhas
      </Link>
      {props.displayStatus === "generating" && <GeneratingView />}
      {props.displayStatus === "stale" && <StaleView onNewCampaign={() => router.push("/")} />}
      {props.displayStatus === "error" && <ErrorView onNewCampaign={() => router.push("/")} />}
      {props.displayStatus === "ready" && <ReadyView {...props} />}
    </div>
  );
}

function ReadyView(props: CampaignPageProps) {
  const [currentCopy, setCurrentCopy] = useState({
    caption: props.caption,
    hashtags: props.hashtags,
    cta_post: props.ctaPost,
  });
  const [isEdited, setIsEdited] = useState(props.isPublicationCopyEdited);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ caption: "", hashtags: [] as string[], cta_post: "" });
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
      const res = await fetch(`/api/campaign/${props.campaignId}/publication-copy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
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
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  }, [editData, props.campaignId]);

  const handleRestore = useCallback(async () => {
    if (!confirm("Restaurar texto original da IA?")) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/campaign/${props.campaignId}/publication-copy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
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

  const handleHashtagsChange = useCallback((value: string) => {
    const tags = value.split("\n").map(s => s.trim()).filter(Boolean);
    setEditData(prev => ({ ...prev, hashtags: tags }));
  }, []);

  return (
    <div className="space-y-6">
      {props.imageUrl && (
        <img
          src={props.imageUrl}
          alt={props.productName || "Campanha"}
          className="w-full rounded-lg shadow-md"
        />
      )}
      <h1 className="text-2xl font-bold">{props.productName}</h1>
      <p className="text-sm text-gray-500">
        Criada em {new Date(props.createdAt).toLocaleDateString("pt-BR")}
      </p>

      <div className="border-t pt-4 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold">Kit de Publicação</h2>
          {isEdited && !isEditing && (
            <span className="text-xs rounded bg-yellow-100 text-yellow-800 px-2 py-0.5 font-medium">
              Editado
            </span>
          )}
        </div>

        {!isEditing ? (
          <div className="space-y-3">
            {currentCopy.caption && <p className="text-lg">{currentCopy.caption}</p>}
            {currentCopy.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentCopy.hashtags.map((tag) => (
                  <span key={tag} className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {currentCopy.cta_post && (
              <p className="font-semibold text-green-700">{currentCopy.cta_post}</p>
            )}
            <button
              onClick={handleEdit}
              className="rounded border px-4 py-1 text-sm hover:bg-gray-100"
            >
              ✏️ Editar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Caption</label>
              <textarea
                value={editData.caption}
                onChange={(e) => setEditData(prev => ({ ...prev, caption: e.target.value }))}
                className="w-full rounded border border-gray-600 bg-gray-800 p-2 text-gray-100"
                rows={4}
                maxLength={2200}
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Hashtags (uma por linha)</label>
              <textarea
                value={editData.hashtags.join("\n")}
                onChange={(e) => handleHashtagsChange(e.target.value)}
                className="w-full rounded border border-gray-600 bg-gray-800 p-2 text-gray-100"
                rows={4}
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">CTA</label>
              <input
                type="text"
                value={editData.cta_post}
                onChange={(e) => setEditData(prev => ({ ...prev, cta_post: e.target.value }))}
                className="w-full rounded border border-gray-600 bg-gray-800 p-2 text-gray-100"
                maxLength={200}
                disabled={isSaving}
              />
            </div>

            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "Salvando..." : "💾 Salvar"}
              </button>
              <button
                onClick={handleRestore}
                disabled={isSaving}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                ↩️ Restaurar original
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <a
        href={props.downloadUrl}
        className="inline-block rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
      >
        Baixar Original
      </a>
    </div>
  );
}

function GeneratingView() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-12">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      <p className="text-lg text-gray-600">Sua campanha está sendo gerada...</p>
    </div>
  );
}

function StaleView({ onNewCampaign }: { onNewCampaign: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-12">
      <p className="text-lg text-yellow-700">Geração interrompida. Tente novamente.</p>
      <button
        onClick={onNewCampaign}
        className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
      >
        Criar Nova Campanha
      </button>
    </div>
  );
}

function ErrorView({ onNewCampaign }: { onNewCampaign: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-12">
      <p className="text-lg text-red-700">Não foi possível gerar sua campanha.</p>
      <button
        onClick={onNewCampaign}
        className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
      >
        Criar Nova Campanha
      </button>
    </div>
  );
}
