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

import { BenchBrandingPanel, type BenchBrandingView } from "../bench-branding-panel";
import { BenchBrandColorIndicator } from "../bench-brand-color-indicator";
import {
  BenchCampaignForm,
  EMPTY_BENCH_CAMPAIGN_FORM,
} from "../bench-campaign-form";
import { BenchEvidencePanel } from "../bench-evidence-panel";
import {
  BENCH_ACTIVE_RUN_MESSAGE,
  BenchExecutionPanel,
} from "../bench-execution-panel";
import { BenchImageUpload } from "../bench-image-upload";
import { BenchPresetSelector } from "../bench-preset-selector";
import { BenchPreflightPanel } from "../bench-preflight-panel";
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

const BRANDING: BenchBrandingView = {
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
  brandColor: "#16A34A",
  visualStyle: "limpo",
  visualTone: "caloroso",
  brandPersonality: "confiável",
  campaignGuidelines: "sempre exibir preço",
  campaignBrief: "foco em ofertas do dia",
  profileSource: "without_logo",
  profileStatus: "synced",
  logoUrl: "https://storage.local/signed/logo.png",
  signatureUrl: "https://storage.local/signed/assinatura.png",
  identityState: "logo",
  identityReference: {
    kind: "logo",
    variantType: "primary",
    storagePath: "stores/aurora/logo.png",
    signedUrl: "https://storage.local/signed/logo.png",
  },
  identityReason: "logo:selected",
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
    // O brandColor resolvido é exibido de forma somente leitura.
    expect(screen.getByText("Cor da marca (resolvida)")).toBeInTheDocument();
    expect(screen.getByText("#16A34A")).toBeInTheDocument();
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
      screen.getByText(/preserva integralmente/),
    ).toBeInTheDocument();
  });
});

// ─── 2b. Formulário fiel, brandColor e preflight ─────────────────────────────

describe("contrato de UI — formulário fiel e brandColor", () => {
  it("exibe os campos fiéis e 'Preservar imagem original' apenas fora de Oferta", () => {
    const { rerender } = render(
      <BenchCampaignForm
        value={{ ...EMPTY_BENCH_CAMPAIGN_FORM, campaignIntent: "offer" }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("Nome do produto")).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição (opcional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço original")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço de venda")).toBeInTheDocument();
    expect(screen.getByText("Intenção da campanha")).toBeInTheDocument();
    expect(screen.getByLabelText("Selo promocional")).toBeInTheDocument();
    expect(screen.getByLabelText("Validade da oferta")).toBeInTheDocument();
    expect(screen.getByText("Imagem meramente ilustrativa")).toBeInTheDocument();
    expect(screen.getByLabelText("Informações obrigatórias na arte")).toBeInTheDocument();

    // Em Oferta, "Preservar imagem original" não é oferecido.
    expect(screen.queryByText("Preservar imagem original")).toBeNull();

    rerender(
      <BenchCampaignForm
        value={{ ...EMPTY_BENCH_CAMPAIGN_FORM, campaignIntent: "spotlight" }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Preservar imagem original")).toBeInTheDocument();
  });

  it("exibe o indicador do brandColor resolvido (somente leitura)", () => {
    render(<BenchBrandColorIndicator color="#22C55E" />);

    expect(screen.getByText("Cor da marca (resolvida)")).toBeInTheDocument();
    expect(screen.getByText("#22C55E")).toBeInTheDocument();
  });

  it("o formulário não faz escrita produtiva e é desktop-only (sem votação/lado a lado)", () => {
    const source = readComponentSource("bench-campaign-form.tsx");
    expect(source).not.toMatch(/lado a lado|vota(ção|r)|enquete/i);
    expect(source).not.toContain("campaign-images");
    expect(source).not.toContain("fetch(");
  });
});

describe("contrato de UI — preflight (compor/editar/aprovar)", () => {
  it("oferece 'Compor prompt' e 'Aprovar prompt' e mostra o estado", () => {
    render(
      <BenchPreflightPanel
        status="idle"
        compiledPrompt=""
        finalPrompt=""
        composerVersion=""
        composing={false}
        error={null}
        onCompose={() => {}}
        onEditFinal={() => {}}
        onApprove={() => {}}
      />,
    );

    expect(screen.getByTestId("bench-compose-button")).toHaveTextContent("Compor prompt");
    expect(screen.getByTestId("bench-approve-button")).toHaveTextContent("Aprovar prompt");
    expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent(
      "Prompt não composto",
    );
    // Sem composição, o prompt compilado não é exibido e aprovar fica desabilitado.
    expect(screen.queryByRole("textbox", { name: "Prompt compilado" })).toBeNull();
    expect(screen.getByTestId("bench-approve-button")).toBeDisabled();
  });

  it("exibe o prompt compilado, habilita aprovação e mostra o estado aprovado", () => {
    const { rerender } = render(
      <BenchPreflightPanel
        status="composed"
        compiledPrompt="[IDENTIDADE E DIREÇÃO VISUAL]\nLoja: Aurora"
        finalPrompt="[IDENTIDADE E DIREÇÃO VISUAL]\nLoja: Aurora"
        composerVersion="48.2.3-prompt-composer-v1"
        composing={false}
        error={null}
        onCompose={() => {}}
        onEditFinal={() => {}}
        onApprove={() => {}}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Prompt compilado" })).toBeInTheDocument();
    expect(screen.getByTestId("bench-approve-button")).toBeEnabled();

    rerender(
      <BenchPreflightPanel
        status="approved"
        compiledPrompt="[IDENTIDADE E DIREÇÃO VISUAL]\nLoja: Aurora"
        finalPrompt="[IDENTIDADE E DIREÇÃO VISUAL]\nLoja: Aurora"
        composerVersion="48.2.3-prompt-composer-v1"
        composing={false}
        error={null}
        onCompose={() => {}}
        onEditFinal={() => {}}
        onApprove={() => {}}
      />,
    );
    expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent(
      "Prompt aprovado",
    );
  });

  it("mostra o estado de invalidação em accent.amber", () => {
    render(
      <BenchPreflightPanel
        status="invalidated"
        compiledPrompt=""
        finalPrompt=""
        composerVersion=""
        composing={false}
        error={null}
        onCompose={() => {}}
        onEditFinal={() => {}}
        onApprove={() => {}}
      />,
    );

    expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent(
      "Prompt invalidado — recomponha e aprove",
    );
  });

  it("o workbench invalida o preflight de forma centralizada (ponto único + revisão)", () => {
    const source = readComponentSource("bench-workbench.tsx");
    expect(source).toContain("invalidatePreflight");
    expect(source).toContain("preflightRevision");
    // A invalidação é chamada por TODAS as entradas usadas na composição.
    expect(source).toContain("handleStoreChange");
    expect(source).toContain("handleCampaignChange");
    expect(source).toContain("handlePromptBaseChange");
    expect(source).toContain("handlePresetChange");
    expect(source).toContain("handleUploaded");
    // Sem hashes persistidos e sem comparação lado a lado/votação.
    expect(source).not.toMatch(/createHash|sha256/i);
    expect(source).not.toMatch(/lado a lado|vota(ção|r)|enquete/i);
    expect(source).not.toContain("campaign-images");
  });
});

// ─── 3. Estimativa, confirmação, execução, resultado e evidências ────────────

const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

const RUN_ID = "33333333-3333-4333-8333-333333333333";
const OPERATION_ID = "00000000-0000-4000-8000-0000000000aa";
const REFERENCES = [`bench/${RUN_ID}/inputs/0.png`];

const ESTIMATE = {
  presetId: PRESET_ENABLED.id,
  estimatedUsd: 0.04,
  coverage: "complete",
  mode: "token_based",
  isEstimate: true,
  costSource: "bench_local_pricing",
  costRuleVersion: "2026-09-bench-1",
};

const PREFLIGHT_EVIDENCE = {
  promptBase: "prompt base",
  promptCompiled: "prompt compilado",
  promptApproved: "Foto do produto em fundo claro",
  promptBlocks: { "INSTRUÇÕES DO PROMPT-BASE": "prompt base" },
  composerVersion: "48.2.3-prompt-composer-v1",
};

const EVIDENCE_RUN = {
  id: RUN_ID,
  status: "succeeded",
  promptSent: "Foto do produto em fundo claro",
  provider: "openai",
  protocol: "images",
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "low",
  latencyMs: 8400,
  usage: { outputImageTokens: 400 },
  estimatedCostUsd: 0.006,
  costDetail: { mode: "token_based" },
  costSource: "bench_local_pricing",
  costRuleVersion: "2026-09-bench-1",
  errorType: null,
  errorMessage: null,
  config: { formato: "1:1" },
};

const OUTPUT_ARTIFACT = {
  id: "artifact-1",
  kind: "output",
  mimeType: "image/png",
  width: 1024,
  height: 1024,
  bytes: 204800,
  signedUrl: "https://storage.local/signed/output.png",
};

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => payload,
  };
}

function ndjsonResponse(events: unknown[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

function runCalls() {
  return mockFetch.mock.calls.filter(([url]) => String(url).endsWith("/runs"));
}

function renderExecutionPanel(onCompleted = vi.fn()) {
  render(
    <BenchExecutionPanel
      storeId={STORE_A.id}
      presetId={PRESET_ENABLED.id}
      approvedPrompt="Foto do produto em fundo claro"
      preflightEvidence={PREFLIGHT_EVIDENCE}
      product={{ name: "Café especial" }}
          offer={{}}
      runId={RUN_ID}
      references={REFERENCES}
      operationId={OPERATION_ID}
      onCompleted={onCompleted}
    />,
  );
  return onCompleted;
}

async function openConfirmation() {
  fireEvent.click(screen.getByTestId("bench-generate-button"));
  await screen.findByTestId("lab-confirm-button");
}

describe("contrato de UI — estimativa, confirmação, execução e evidências", () => {
  it("'Gerar imagem' exibe a estimativa e exige confirmação sem POST", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(ESTIMATE));
    renderExecutionPanel();

    await openConfirmation();

    const panel = screen.getByTestId("bench-estimate-panel");
    expect(within(panel).getByText("US$ 0.04")).toBeInTheDocument();
    expect(within(panel).getByText("complete")).toBeInTheDocument();
    expect(runCalls()).toHaveLength(0);
  });

  it("apresenta pricing parcial como faixa e ausente como indisponível", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ...ESTIMATE, coverage: "partial" }),
    );
    renderExecutionPanel();
    await openConfirmation();

    const panel = screen.getByTestId("bench-estimate-panel");
    expect(within(panel).getByText("a partir de US$ 0.04")).toBeInTheDocument();
    expect(within(panel).queryByText("US$ 0.04")).toBeNull();
    expect(runCalls()).toHaveLength(0);
  });

  it("apresenta pricing ausente como indisponível", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ...ESTIMATE, coverage: "missing", estimatedUsd: null }),
    );
    renderExecutionPanel();
    await openConfirmation();

    const panel = screen.getByTestId("bench-estimate-panel");
    expect(within(panel).getAllByText("indisponível").length).toBeGreaterThanOrEqual(1);
  });

  it("confirma com confirmed true + operationId/runId/references do upload e consome o NDJSON", async () => {
    const onCompleted = vi.fn();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(ESTIMATE))
      .mockResolvedValueOnce(
        ndjsonResponse([
          { type: "phase", phase: "running" },
          { type: "done", runId: RUN_ID },
        ]),
      );
    renderExecutionPanel(onCompleted);

    await openConfirmation();
    fireEvent.click(screen.getByTestId("lab-confirm-button"));

    await waitFor(() => expect(runCalls()).toHaveLength(1));
    const [url, init] = runCalls()[0];
    expect(String(url)).toBe("/api/admin/laboratorio/bancada/runs");
    const body = JSON.parse(String(init.body));
    expect(body.confirmed).toBe(true);
    expect(body.operationId).toBe(OPERATION_ID);
    expect(body.runId).toBe(RUN_ID);
    expect(body.references).toEqual(REFERENCES);
    expect(body.storeId).toBe(STORE_A.id);
    expect(body.presetId).toBe(PRESET_ENABLED.id);
    // O prompt enviado é exatamente o prompt final aprovado + evidência do preflight.
    expect(body.prompt).toBe("Foto do produto em fundo claro");
    expect(body.preflight).toEqual(PREFLIGHT_EVIDENCE);

    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(RUN_ID));
  });

  it("bloqueia a geração sem prompt aprovado", () => {
    render(
      <BenchExecutionPanel
        storeId={STORE_A.id}
        presetId={PRESET_ENABLED.id}
        approvedPrompt={null}
        preflightEvidence={null}
        product={{ name: "Café especial" }}
            offer={{}}
        runId={RUN_ID}
        references={REFERENCES}
        operationId={OPERATION_ID}
      />,
    );

    expect(
      screen.getByText("Aprove o prompt compilado antes de estimar ou gerar."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("bench-generate-button")).toBeDisabled();
  });

  it("consome exatamente um terminal (done/error) mesmo com eventos repetidos", async () => {
    const onCompleted = vi.fn();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(ESTIMATE))
      .mockResolvedValueOnce(
        ndjsonResponse([
          { type: "done", runId: RUN_ID },
          { type: "done", runId: RUN_ID },
          { type: "error", code: "run_failed", message: "Execução falhou" },
        ]),
      );
    renderExecutionPanel(onCompleted);

    await openConfirmation();
    fireEvent.click(screen.getByTestId("lab-confirm-button"));

    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
    expect(onCompleted).toHaveBeenCalledWith(RUN_ID);
  });

  it("orienta aguardar na concorrência e não promete cancelar a geração ativa", async () => {
    const onCompleted = vi.fn();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(ESTIMATE))
      .mockResolvedValueOnce(
        jsonResponse({ error: "bench_run_already_active" }, 409),
      );
    renderExecutionPanel(onCompleted);

    await openConfirmation();
    fireEvent.click(screen.getByTestId("lab-confirm-button"));

    expect(await screen.findByText(BENCH_ACTIVE_RUN_MESSAGE)).toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /cancelar.*(gera|ativa|concluir)/i }),
    ).toBeNull();
  });

  it("exibe o resultado com download e o painel de evidências distinguindo usage/calculado/estimado", () => {
    render(<BenchEvidencePanel run={EVIDENCE_RUN} artifacts={[OUTPUT_ARTIFACT]} />);

    expect(screen.getByText("Usage do provider")).toBeInTheDocument();
    expect(screen.getByText("Custo calculado")).toBeInTheDocument();
    expect(
      screen.getByText("Custo estimado — não é valor faturado"),
    ).toBeInTheDocument();
    expect(screen.getByText("Latência")).toBeInTheDocument();
    expect(screen.getByText("8.4 s")).toBeInTheDocument();

    expect(screen.getByTestId("bench-result-download")).toHaveAttribute(
      "href",
      "https://storage.local/signed/output.png",
    );
  });

  it("não oferece comparação lado a lado, votação nem emojis", () => {
    renderExecutionPanel();

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/lado a lado|vota(ção|r)|enquete/i);
    expect(EMOJI_PATTERN.test(text)).toBe(false);

    const sources = [
      "bench-execution-panel.tsx",
      "bench-evidence-panel.tsx",
      "bench-estimate-panel.tsx",
      "bench-workbench.tsx",
    ]
      .map(readComponentSource)
      .join("\n");
    expect(sources).not.toMatch(/lado a lado|vota(ção|r)|enquete/i);
    expect(EMOJI_PATTERN.test(sources)).toBe(false);
  });
});
