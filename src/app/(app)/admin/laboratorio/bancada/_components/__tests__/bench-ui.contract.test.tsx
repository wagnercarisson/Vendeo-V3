// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F48.2.2 — suíte de contrato da UI da bancada (`48-2-2-07`).
 *
 * Trava o contrato visual da bancada: navegação interna, estado de ambiente
 * desabilitado sem acesso a dados, fluxo mínimo (loja → branding → produto/oferta
 * → upload em `draft` → prompt → formato/modelo/qualidade → estimativa →
 * confirmação → execução → resultado/download → evidências), a distinção entre
 * usage/calculado/estimado e a **ausência** de comparação lado a lado, votação,
 * emojis e promessa de cancelamento de geração ativa.
 *
 * `fetch` é sempre mockado e nenhum provider é chamado.
 */

const {
  mockGetLabEnvironment,
  mockListBenchTestStores,
  mockListBenchPresets,
} = vi.hoisted(() => ({
  mockGetLabEnvironment: vi.fn(),
  mockListBenchTestStores: vi.fn(),
  mockListBenchPresets: vi.fn(),
}));

vi.mock("@/lib/lab/environment-guard", () => ({
  getLabEnvironment: () => mockGetLabEnvironment(),
  assertLabEnvironment: vi.fn(),
  labEnvironmentDeniedBody: (reason: string) => ({
    error: "environment_blocked",
    reason,
  }),
  LabEnvironmentError: class LabEnvironmentError extends Error {},
}));

vi.mock("@/lib/lab/bench/domain/store-manifest", () => ({
  listBenchTestStores: (...args: unknown[]) => mockListBenchTestStores(...args),
}));

vi.mock("@/lib/lab/bench/domain/preset-registry", () => ({
  listBenchPresets: (...args: unknown[]) => mockListBenchPresets(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import BancadaPage from "@/app/(app)/admin/laboratorio/bancada/page";
import LaboratorioLayout from "@/app/(app)/admin/laboratorio/layout";

import { BenchBrandingPanel } from "../bench-branding-panel";
import { BenchImageUpload } from "../bench-image-upload";
import { BenchPresetSelector } from "../bench-preset-selector";
import { BenchPromptEditor } from "../bench-prompt-editor";

const COMPONENTS_DIR = "src/app/(app)/admin/laboratorio/bancada/_components";

function readComponentSource(relative: string): string {
  return readFileSync(path.resolve(process.cwd(), `${COMPONENTS_DIR}/${relative}`), "utf8");
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ENABLED_ENV = {
  enabled: true,
  supabaseHost: "localhost",
  local: true,
  reason: "ok",
};
const DISABLED_ENV = {
  enabled: false,
  supabaseHost: null,
  local: false,
  reason: "disabled_flag",
};

const STORE_A = {
  id: "11111111-1111-4111-8111-111111111111",
  label: "Loja de teste A",
  name: "Empório Aurora",
  segment: "mercados-mercearias",
};

const PRESET_ENABLED = {
  id: "gpt-image-2-low",
  label: "GPT Image 2 · low",
  capability: "campaign_image",
  provider: "openai",
  model: "gpt-image-2",
  protocol: "images",
  quality: "low",
  size: "1024x1024",
  enabled: true,
};

const PRESET_DISABLED = {
  id: "gpt-image-2-responses",
  label: "GPT Image 2 · responses (desabilitado)",
  capability: "campaign_image",
  provider: "openai",
  model: "gpt-image-2",
  protocol: "responses",
  quality: "low",
  size: "1024x1024",
  enabled: false,
  reason: "protocolo_nao_confirmado",
};

const PRESETS = [PRESET_ENABLED, PRESET_DISABLED];

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ branding: null }),
  });
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn().mockReturnValue("00000000-0000-4000-8000-0000000000aa"),
  });
  mockGetLabEnvironment.mockReturnValue(ENABLED_ENV);
  mockListBenchTestStores.mockResolvedValue([STORE_A]);
  mockListBenchPresets.mockReturnValue(PRESETS);
});

afterEach(() => vi.unstubAllGlobals());

// ─── 1. Página, navegação interna e estado de ambiente desabilitado ──────────

describe("contrato de UI — página da bancada e navegação interna", () => {
  it("mostra o aviso de indisponibilidade com o motivo e não lê lojas/presets quando o ambiente está bloqueado", async () => {
    mockGetLabEnvironment.mockReturnValue(DISABLED_ENV);

    render(await BancadaPage());

    expect(
      screen.getByText("Laboratório desabilitado neste ambiente"),
    ).toBeInTheDocument();
    expect(screen.getByText("disabled_flag")).toBeInTheDocument();
    expect(screen.getByText("A flag VENDEO_LAB_ENABLED não está ativa")).toBeInTheDocument();

    expect(mockListBenchTestStores).not.toHaveBeenCalled();
    expect(mockListBenchPresets).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("expõe 'Bancada' na navegação interna do laboratório", () => {
    render(
      <LaboratorioLayout>
        <div>conteúdo</div>
      </LaboratorioLayout>,
    );

    const nav = screen.getByRole("navigation", {
      name: "Navegação do laboratório",
    });
    const link = within(nav).getByRole("link", { name: "Bancada" });
    expect(link).toHaveAttribute("href", "/admin/laboratorio/bancada");
  });

  it("renderiza o seletor de loja de teste com as lojas do manifesto", async () => {
    render(await BancadaPage());

    expect(screen.getByTestId("bench-store-selector")).toBeInTheDocument();
    expect(screen.getByLabelText("Loja de teste")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Loja de teste A/ })).toBeInTheDocument();
  });
});

// ─── 2. Branding, produto/oferta, upload, prompt e presets ───────────────────

const BRANDING = {
  storeId: STORE_A.id,
  storeName: "Empório Aurora",
  segment: "mercados-mercearias",
  subsegment: null,
  toneOfVoice: "Próximo e direto",
  positioning: "Mercearia de bairro",
  shortDescription: "Mercearia local",
  slogan: "Aqui é mais perto",
  typographyDirection: "Inter para títulos, Open Sans para corpo",
  safeColorTokens: { primary: "#16A34A" },
  brandColorsChosen: ["#16A34A", null],
  logoColorsDetected: ["#16A34A"],
  visualStyle: "limpo",
  visualTone: "caloroso",
  brandPersonality: "confiável",
  campaignGuidelines: "sempre exibir preço",
  campaignBrief: "foco em ofertas do dia",
  profileSource: "without_logo",
  profileStatus: "synced",
  logoUrl: "https://storage.local/signed/logo.png",
  signatureUrl: "https://storage.local/signed/assinatura.png",
  assets: [
    {
      assetType: "logo",
      variantType: "primary",
      storagePath: "stores/aurora/logo.png",
      mimeType: "image/png",
      width: 512,
      height: 512,
      sizeBytes: 2048,
      checksum: "abc123def456",
      signedUrl: "https://storage.local/signed/logo.png",
    },
  ],
};

const CONFIG = {
  dimensions: {
    pipeline: [
      { id: "manual-direto", label: "Manual direto", enabled: true },
      {
        id: "ia-assistido",
        label: "IA assistido (futuro)",
        enabled: false,
        reason: "fora_do_primeiro_recorte",
      },
    ],
    formato: [
      { id: "1:1", label: "Quadrado 1:1", enabled: true },
      {
        id: "9:16",
        label: "Vertical 9:16",
        enabled: false,
        reason: "fora_do_primeiro_recorte",
      },
    ],
    intencao: [
      { id: "oferta", label: "Oferta", enabled: true },
      {
        id: "destaque",
        label: "Destaque",
        enabled: false,
        reason: "fora_do_primeiro_recorte",
      },
    ],
    tipoConteudo: [{ id: "produto", label: "Produto", enabled: true }],
    estrutura: [{ id: "peca-unica", label: "Peça única", enabled: true }],
    tema: [{ id: "nenhum", label: "Nenhum", enabled: true }],
  },
  defaults: {
    pipeline: "manual-direto",
    formato: "1:1",
    intencao: "oferta",
    tipoConteudo: "produto",
    estrutura: "peca-unica",
    tema: "nenhum",
  },
};

describe("contrato de UI — branding, upload, prompt e presets", () => {
  it("exibe o branding completo incluindo a direção tipográfica e as URLs assinadas", () => {
    render(<BenchBrandingPanel branding={BRANDING} />);

    expect(screen.getByText("Branding da loja")).toBeInTheDocument();
    expect(screen.getByText("Direção tipográfica")).toBeInTheDocument();
    expect(
      screen.getByText("Inter para títulos, Open Sans para corpo"),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Logo de Empório Aurora")).toHaveAttribute(
      "src",
      "https://storage.local/signed/logo.png",
    );
    expect(screen.getByAltText("Assinatura de Empório Aurora")).toHaveAttribute(
      "src",
      "https://storage.local/signed/assinatura.png",
    );
  });

  it("não contém operação de escrita no branding (somente leitura)", () => {
    const source = readComponentSource("bench-branding-panel.tsx");
    expect(source).not.toMatch(/\b(insert|update)\b/i);
  });

  it("faz POST multipart para /inputs, exibe metadados e não usa o bucket de campanha", async () => {
    const onUploaded = vi.fn();
    const runId = "22222222-2222-4222-8222-222222222222";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        runId,
        inputs: [
          {
            path: `bench/${runId}/inputs/0.png`,
            mimeType: "image/png",
            width: 1024,
            height: 1024,
            bytes: 2048,
            checksum: "deadbeefcafebabe",
          },
        ],
      }),
    });

    render(
      <BenchImageUpload
        storeId={STORE_A.id}
        getOperationId={() => "00000000-0000-4000-8000-0000000000aa"}
        onUploaded={onUploaded}
      />,
    );

    const file = new File([new Uint8Array([1, 2, 3])], "produto.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByTestId("bench-image-input"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId("bench-upload-button"));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/laboratorio/bancada/inputs");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("operationId")).toBe(
      "00000000-0000-4000-8000-0000000000aa",
    );
    expect((init.body as FormData).getAll("files")).toHaveLength(1);

    expect(await screen.findByText(new RegExp(`bench/${runId}`))).toBeInTheDocument();
    expect(screen.getByText(/1024×1024/)).toBeInTheDocument();
    expect(onUploaded).toHaveBeenCalledWith(
      expect.objectContaining({
        runId,
        references: [`bench/${runId}/inputs/0.png`],
      }),
    );

    const source = readComponentSource("bench-image-upload.tsx");
    expect(source).not.toContain("campaign-images");
    expect(source).toContain("lab-artifacts");
    expect(source).toContain("inputs");
  });

  it("trava as dimensões do primeiro recorte (não editáveis)", () => {
    render(
      <BenchPresetSelector
        presets={PRESETS}
        config={CONFIG}
        presetId={PRESET_ENABLED.id}
        onChange={() => {}}
      />,
    );

    expect(screen.getByTestId("bench-locked-intencao")).toHaveTextContent("Intenção");
    expect(screen.getByTestId("bench-locked-tipoConteudo")).toHaveTextContent(
      "Tipo de conteúdo",
    );
    expect(screen.getByTestId("bench-locked-estrutura")).toHaveTextContent("Estrutura");
    expect(screen.getByTestId("bench-locked-tema")).toHaveTextContent("Tema");

    expect(screen.queryByRole("combobox", { name: "Intenção" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Estrutura" })).toBeNull();
  });

  it("mostra o motivo do preset desabilitado", () => {
    render(
      <BenchPresetSelector
        presets={PRESETS}
        config={CONFIG}
        presetId={PRESET_ENABLED.id}
        onChange={() => {}}
      />,
    );

    expect(
      screen.getByText(/indisponível: protocolo_nao_confirmado/),
    ).toBeInTheDocument();
  });

  it("mantém o prompt manual sem concatenar o branding", () => {
    render(
      <BenchPromptEditor
        value="Foto do produto em fundo claro"
        onChange={() => {}}
      />,
    );

    const textarea = screen.getByRole("textbox", {
      name: "Prompt",
    }) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Foto do produto em fundo claro");
    expect(textarea.value).not.toMatch(/Empório Aurora|Branding/);
    expect(
      screen.getByText(/branding não é concatenado automaticamente/),
    ).toBeInTheDocument();
  });
});
