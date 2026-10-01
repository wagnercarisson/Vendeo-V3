// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

import { BENCH_DEFAULT_PROMPT_BASE } from "@/lib/lab/bench/domain/prompt-base";
import { COMPOSER_VERSION } from "@/lib/lab/bench/domain/prompt-composer";
import {
  BenchPreflightEvidenceSchema,
} from "@/lib/lab/bench/domain/schemas";
import {
  collectBenchTextIntegrityFields,
  createBenchTextIntegrityRevision,
  detectBenchTextIntegrity,
  TEXT_INTEGRITY_POLICY_VERSION,
} from "@/lib/lab/bench/domain/text-integrity-detector";

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
import { BenchImageUpload, benchUploadFingerprint } from "../bench-image-upload";
import { BenchPresetSelector } from "../bench-preset-selector";
import {
  BenchPreflightPanel,
  type BenchPreflightEvidenceView,
} from "../bench-preflight-panel";
import { BenchPromptEditor } from "../bench-prompt-editor";
import {
  BenchPoliciesPanel,
  type BenchPromptPolicyView,
} from "../bench-policies-panel";
import {
  BenchAttemptsPanel,
  type BenchAttemptView,
} from "../bench-attempts-panel";

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

const PRESET_ENABLED_MEDIUM = {
  ...PRESET_ENABLED,
  id: "gpt-image-2-medium",
  label: "GPT Image 2 · medium",
  quality: "medium",
};

const PRESETS = [PRESET_ENABLED, PRESET_DISABLED];
const MOCK_TEXT_INTEGRITY_EVIDENCE = {
  policyVersion: "48.2.5-text-integrity-v1",
  reviewRevision: "a".repeat(64),
  decision: "no_alerts" as const,
};

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
    fireEvent.change(screen.getByTestId("bench-image-input-main"), {
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

  describe("uploader — principal + adicionais ordenados (correção de UAT)", () => {
    function makeFile(name: string, lastModified = 1): File {
      return new File([new Uint8Array([1, 2, 3])], name, {
        type: "image/png",
        lastModified,
      });
    }

    function renderUploader(options?: {
      getOperationId?: (fingerprint: string) => string;
      onUploaded?: (result: unknown) => void;
    }) {
      const onUploaded = options?.onUploaded ?? vi.fn();
      const getOperationId = options?.getOperationId ?? (() => "op-fixed");
      render(
        <BenchImageUpload
          storeId={STORE_A.id}
          getOperationId={getOperationId}
          onUploaded={onUploaded}
        />,
      );
      return { onUploaded, getOperationId };
    }

    function selectMain(file: File) {
      fireEvent.change(screen.getByTestId("bench-image-input-main"), {
        target: { files: [file] },
      });
    }

    function selectAdditional(files: File[]) {
      fireEvent.change(screen.getByTestId("bench-image-input-additional"), {
        target: { files },
      });
    }

    function inputsResponse(runId: string, count: number) {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          runId,
          inputs: Array.from({ length: count }, (_, index) => ({
            path: `bench/${runId}/inputs/${index}.png`,
            mimeType: "image/png",
            width: 1024,
            height: 1024,
            bytes: 3,
            checksum: "deadbeefcafebabe",
          })),
        }),
      };
    }

    it("1. selecionar a principal e depois uma segunda imagem mantém as duas", () => {
      renderUploader();
      selectMain(makeFile("principal.png"));
      selectAdditional([makeFile("adicional.png")]);

      expect(screen.getByTestId("bench-main-image")).toHaveTextContent("principal.png");
      expect(screen.getByTestId("bench-additional-image-0")).toHaveTextContent(
        "adicional.png",
      );
    });

    it("2. adicionais em ação posterior não apagam a principal", () => {
      renderUploader();
      selectMain(makeFile("principal.png"));
      selectAdditional([makeFile("a1.png")]);
      selectAdditional([makeFile("a2.png")]);

      expect(screen.getByTestId("bench-main-image")).toHaveTextContent("principal.png");
      expect(screen.getByTestId("bench-additional-image-0")).toHaveTextContent("a1.png");
      expect(screen.getByTestId("bench-additional-image-1")).toHaveTextContent("a2.png");
    });

    it("3. remover e substituir imagens funciona antes do envio", () => {
      renderUploader();
      selectMain(makeFile("principal.png"));
      selectAdditional([makeFile("a1.png")]);

      fireEvent.click(screen.getByTestId("bench-remove-additional-0"));
      expect(screen.queryByTestId("bench-additional-image-0")).toBeNull();
      selectAdditional([makeFile("a1-nova.png")]);
      expect(screen.getByTestId("bench-additional-image-0")).toHaveTextContent(
        "a1-nova.png",
      );

      fireEvent.click(screen.getByTestId("bench-remove-main"));
      expect(screen.queryByTestId("bench-main-image")).toBeNull();
      selectMain(makeFile("principal-nova.png"));
      expect(screen.getByTestId("bench-main-image")).toHaveTextContent(
        "principal-nova.png",
      );
    });

    it("4. mais de três adicionais é recusado", () => {
      renderUploader();
      selectMain(makeFile("principal.png"));
      selectAdditional([makeFile("a1.png"), makeFile("a2.png"), makeFile("a3.png")]);
      expect(screen.getAllByTestId(/^bench-additional-image-\d+$/)).toHaveLength(3);

      selectAdditional([makeFile("a4.png")]);
      expect(screen.getAllByTestId(/^bench-additional-image-\d+$/)).toHaveLength(3);
      expect(screen.getByRole("alert")).toHaveTextContent("no máximo 3");
    });

    it("5. multipart preserva a ordem principal → adicionais", async () => {
      mockFetch.mockResolvedValueOnce(inputsResponse("run-ordem", 3));
      renderUploader();
      selectMain(makeFile("principal.png"));
      selectAdditional([makeFile("a1.png"), makeFile("a2.png")]);
      fireEvent.click(screen.getByTestId("bench-upload-button"));

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
      const body = mockFetch.mock.calls[0][1].body as FormData;
      const files = body.getAll("files") as File[];
      expect(files.map((file) => file.name)).toEqual([
        "principal.png",
        "a1.png",
        "a2.png",
      ]);
    });

    it("6. a resposta produz references na mesma ordem", async () => {
      const runId = "run-ref";
      mockFetch.mockResolvedValueOnce(inputsResponse(runId, 2));
      const onUploaded = vi.fn();
      renderUploader({ onUploaded });
      selectMain(makeFile("principal.png"));
      selectAdditional([makeFile("a1.png")]);
      fireEvent.click(screen.getByTestId("bench-upload-button"));

      await waitFor(() => expect(onUploaded).toHaveBeenCalled());
      expect(
        (onUploaded.mock.calls[0][0] as { references: string[] }).references,
      ).toEqual([`bench/${runId}/inputs/0.png`, `bench/${runId}/inputs/1.png`]);
    });

    it("7. trocar principal/adicional, remover ou reordenar altera o fingerprint; mesmo conjunto mantém", () => {
      const main = makeFile("principal.png");
      const a1 = makeFile("a1.png");
      const a2 = makeFile("a2.png");

      const base = benchUploadFingerprint(STORE_A.id, main, [a1]);
      const sameSet = benchUploadFingerprint(STORE_A.id, main, [a1]);
      const swapped = benchUploadFingerprint(STORE_A.id, a1, [main]);
      const added = benchUploadFingerprint(STORE_A.id, main, [a1, a2]);
      const reordered = benchUploadFingerprint(STORE_A.id, main, [a2, a1]);

      expect(sameSet).toBe(base);
      expect(swapped).not.toBe(base);
      expect(added).not.toBe(base);
      expect(reordered).not.toBe(added);
    });

    it("8. reenviar o mesmo conjunto e ordem mantém a idempotência", async () => {
      let cache: { fingerprint: string; id: string } | null = null;
      const getOperationId = (fingerprint: string) => {
        if (cache && cache.fingerprint === fingerprint) return cache.id;
        const id = cache ? "op-2" : "op-1";
        cache = { fingerprint, id };
        return id;
      };
      mockFetch.mockResolvedValue(inputsResponse("run-idem", 1));
      renderUploader({ getOperationId });

      selectMain(makeFile("principal.png"));
      fireEvent.click(screen.getByTestId("bench-upload-button"));
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      selectMain(makeFile("principal.png"));
      fireEvent.click(screen.getByTestId("bench-upload-button"));
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

      const op1 = (mockFetch.mock.calls[0][1].body as FormData).get("operationId");
      const op2 = (mockFetch.mock.calls[1][1].body as FormData).get("operationId");
      expect(op2).toBe(op1);
    });

    it("10. a identidade é anexada por último pelo adapter da bancada (fonte)", () => {
      const source = readComponentSource("bench-image-upload.tsx");
      // A UI envia apenas imagens de produto (principal → adicionais); a identidade
      // é anexada pelo runtime/adapter da bancada como última referência.
      expect(source).not.toContain("identityImageUrl");
      expect(source).not.toContain("campaign-images");
      const adapterSource = readFileSync(
        path.resolve(
          process.cwd(),
          "src/lib/ai/adapters/bench-images.ts",
        ),
        "utf8",
      );
      // A identidade é anexada APÓS as imagens do produto (loop de referências).
      const productIdx = adapterSource.indexOf("reference-");
      const identityIdx = adapterSource.indexOf('"identity"');
      expect(productIdx).toBeGreaterThan(-1);
      expect(identityIdx).toBeGreaterThan(productIdx);
    });

    it("11. nenhuma chamada real de IA ocorre no upload", async () => {
      mockFetch.mockResolvedValueOnce(inputsResponse("run-noai", 1));
      renderUploader();
      selectMain(makeFile("principal.png"));
      fireEvent.click(screen.getByTestId("bench-upload-button"));
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

      const url = String(mockFetch.mock.calls[0][0]);
      expect(url).toBe("/api/admin/laboratorio/bancada/inputs");
      expect(url).not.toMatch(/openai|anthropic|generativelanguage|provider/i);
    });
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

  it("apresenta alertas e reenvia keep_exactly para os mesmos textos", async () => {
    const reviewRevision = "b".repeat(64);
    const mouseAlert = detectBenchTextIntegrity([
      { field: "product.name", value: "Mouseeee sem fio" },
    ])[0];
    const composeBodies: Array<Record<string, unknown>> = [];
    let composeCount = 0;
    mockFetch.mockImplementation(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("/compose")) {
        composeCount += 1;
        composeBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        if (composeCount === 1) {
          return jsonResponse(
            {
              error: "text_integrity_review_required",
              textIntegrityReview: {
                policyVersion: "48.2.5-text-integrity-v1",
                reviewRevision,
                alerts: [mouseAlert],
              },
            },
            422,
          );
        }
        return jsonResponse({
          compiledPrompt: "PROMPT APÓS KEEP",
          blocks: {},
          composerVersion: COMPOSER_VERSION,
          policyVersions: {
            intencao: "48.2.4-oferta-v1",
            tipoConteudo: "48.2.5-produto-v3",
            geral: "48.2.5-general-integrity-v1",
          },
          promptBaseVersion: BENCH_DEFAULT_PROMPT_BASE.version,
          textIntegrityEvidence: {
            policyVersion: "48.2.5-text-integrity-v1",
            reviewRevision,
            decision: "keep_exactly",
          },
        });
      }
      return jsonResponse({ branding: BRANDING });
    });

    render(await BancadaPage());
    fireEvent.change(screen.getByLabelText("Nome do produto"), {
      target: { value: "Mouseeee sem fio" },
    });
    expect(screen.getByTestId("bench-compose-button")).toBeEnabled();
    fireEvent.click(screen.getByTestId("bench-compose-button"));
    await waitFor(() =>
      expect(mockFetch.mock.calls.some(([url]) => String(url).includes("/compose"))).toBe(true),
    );

    const review = await screen.findByTestId("bench-text-integrity-review");
    expect(within(review).getByText(
      "Nome do produto — possível caractere repetido; verifique.",
    )).toBeInTheDocument();
    expect(review).not.toHaveTextContent("Mouseeee sem fio");
    expect(review).not.toHaveTextContent("character_repeated_suspicious");
    expect(review).not.toHaveTextContent(mouseAlert.excerpt);
    expect(screen.queryByRole("textbox", { name: "Prompt compilado" })).toBeNull();

    const productField = screen.getByLabelText("Nome do produto");
    const scrollIntoView = vi.fn();
    Object.defineProperty(productField, "scrollIntoView", { value: scrollIntoView, configurable: true });
    const verifyButton = screen.getByRole("button", { name: "Verificar Nome do produto" });
    expect(verifyButton.tagName).toBe("BUTTON");
    expect(verifyButton.tabIndex).toBe(0);
    expect(verifyButton.className).toContain("focus-visible:ring-2");
    fireEvent.click(verifyButton);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(document.activeElement).toBe(productField);
    expect(productField.className).toContain("focus:ring-2");

    fireEvent.click(screen.getByTestId("bench-keep-text-exactly-button"));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Prompt compilado" })).toHaveValue(
        "PROMPT APÓS KEEP",
      ),
    );
    expect(composeBodies).toHaveLength(2);
    expect(composeBodies[1].textIntegrityEvidence).toEqual({
      policyVersion: "48.2.5-text-integrity-v1",
      reviewRevision,
      decision: "keep_exactly",
    });
    expect(composeBodies[1].promptBase).toBe(composeBodies[0].promptBase);
    expect((composeBodies[1].product as { name: string }).name).toBe("Mouseeee sem fio");
  });

  it("usa rótulos humanos e ação Verificar para os quatro campos sem exibir texto técnico", () => {
    const onVerifyField = vi.fn();
    const alerts = [
      { field: "product.name", excerpt: "Mouseeee sem fio", reason: "raw-name-reason", ruleId: "character_repeated_suspicious" },
      { field: "product.description", excerpt: "raw-description", reason: "raw-description-reason", ruleId: "ptbr_voce_without_accent" },
      { field: "product.mandatoryArtworkText", excerpt: "raw-mandatory", reason: "raw-mandatory-reason", ruleId: "spacing_anomaly" },
      { field: "promptBase", excerpt: "raw-prompt-base", reason: "raw-prompt-reason", ruleId: "punctuation_repeated" },
    ] as const;
    render(
      <BenchPreflightPanel
        status="idle"
        compiledPrompt=""
        finalPrompt=""
        composerVersion=""
        composing={false}
        error={null}
        textIntegrityReview={{
          policyVersion: "48.2.5-text-integrity-v1",
          reviewRevision: "d".repeat(64),
          alerts: [...alerts],
          stale: false,
        }}
        onCompose={() => {}}
        onEditFinal={() => {}}
        onApprove={() => {}}
        onKeepExactly={() => {}}
        onVerifyField={onVerifyField}
      />,
    );

    const cards = screen.getAllByTestId("bench-text-integrity-alert");
    expect(cards).toHaveLength(4);
    const expectedMessages = [
      "Nome do produto — possível caractere repetido; verifique.",
      "Descrição — possível erro de ortografia; verifique.",
      "Informações obrigatórias — possível espaçamento anormal; verifique.",
      "Prompt-base — possível pontuação duplicada; verifique.",
    ];
    cards.forEach((card, index) => {
      expect(card).toHaveTextContent(expectedMessages[index]);
      expect(card.textContent).not.toContain(alerts[index].excerpt);
      expect(card.textContent).not.toContain(alerts[index].ruleId);
      expect(card.textContent).not.toContain(alerts[index].reason);
    });

    for (const label of ["Nome do produto", "Descrição", "Informações obrigatórias", "Prompt-base"]) {
      fireEvent.click(screen.getByRole("button", { name: `Verificar ${label}` }));
    }
    expect(onVerifyField.mock.calls).toEqual([
      ["product.name"],
      ["product.description"],
      ["product.mandatoryArtworkText"],
      ["promptBase"],
    ]);
  });

  it("Verificar rola e move o foco aos quatro campos cobertos", async () => {
    const reviewRevision = "e".repeat(64);
    const alerts = [
      {
        field: "product.name",
        excerpt: "Mouseeee sem fio",
        reason: "A repeated character may be a typo.",
        ruleId: "character_repeated_suspicious",
      },
      {
        field: "product.description",
        excerpt: "Produto para voce",
        reason: "A spelling pattern may be a typo.",
        ruleId: "ptbr_voce_without_accent",
      },
      {
        field: "product.mandatoryArtworkText",
        excerpt: "Lote  3",
        reason: "A spacing pattern may be unusual.",
        ruleId: "spacing_anomaly",
      },
      {
        field: "promptBase",
        excerpt: "Final!!",
        reason: "A punctuation pattern may be unusual.",
        ruleId: "punctuation_repeated",
      },
    ];
    mockFetch.mockImplementation(async (url: unknown) => {
      if (String(url).includes("/compose")) {
        return jsonResponse(
          {
            error: "text_integrity_review_required",
            textIntegrityReview: {
              policyVersion: "48.2.5-text-integrity-v1",
              reviewRevision,
              alerts,
            },
          },
          422,
        );
      }
      return jsonResponse({ branding: BRANDING });
    });

    render(await BancadaPage());
    fireEvent.change(screen.getByLabelText("Nome do produto"), {
      target: { value: "Mouseeee sem fio" },
    });
    fireEvent.click(screen.getByTestId("bench-compose-button"));
    const review = await screen.findByTestId("bench-text-integrity-review");
    expect(review).not.toHaveTextContent("Mouseeee sem fio");

    const targets = [
      {
        field: "product.name",
        label: "Nome do produto",
        element: screen.getByLabelText("Nome do produto"),
      },
      {
        field: "product.description",
        label: "Descrição",
        element: screen.getByLabelText("Descrição (opcional)"),
      },
      {
        field: "product.mandatoryArtworkText",
        label: "Informações obrigatórias",
        element: screen.getByLabelText("Informações obrigatórias na arte"),
      },
      {
        field: "promptBase",
        label: "Prompt-base",
        element: screen.getByRole("textbox", { name: "Prompt" }),
      },
    ];

    for (const { field, label, element } of targets) {
      const scrollIntoView = vi.fn();
      Object.defineProperty(element, "scrollIntoView", {
        value: scrollIntoView,
        configurable: true,
      });
      const verifyButton = screen.getByRole("button", { name: `Verificar ${label}` });
      expect(verifyButton.tagName).toBe("BUTTON");
      expect(verifyButton.tabIndex).toBe(0);
      expect(verifyButton.className).toContain("focus-visible:ring-2");
      verifyButton.focus();
      expect(document.activeElement).toBe(verifyButton);
      fireEvent.click(verifyButton);
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
      expect(document.activeElement).toBe(element);
      expect(element.className).toContain("focus:ring-2");
      expect(field).toBeTruthy();
    }
  });

  it.each([
    { label: "Nome do produto", value: "Café" },
    { label: "Descrição (opcional)", value: "Descrição" },
    { label: "Informações obrigatórias na arte", value: "Lote 2" },
    { label: "Prompt", value: "Prompt-base editado" },
  ])("invalidates the preflight after editing covered field $label", async ({ label, value }) => {
    mockFetch.mockImplementation(async (url: unknown) => {
      if (String(url).includes("/compose")) {
        return jsonResponse({
          compiledPrompt: "PROMPT COMPILADO",
          blocks: {},
          composerVersion: COMPOSER_VERSION,
          policyVersions: {
            intencao: "48.2.4-oferta-v1",
            tipoConteudo: "48.2.5-produto-v3",
            geral: "48.2.5-general-integrity-v1",
          },
          promptBaseVersion: BENCH_DEFAULT_PROMPT_BASE.version,
          textIntegrityEvidence: MOCK_TEXT_INTEGRITY_EVIDENCE,
        });
      }
      return jsonResponse({ branding: BRANDING });
    });

    render(await BancadaPage());
    fireEvent.click(screen.getByTestId("bench-compose-button"));
    await screen.findByRole("textbox", { name: "Prompt compilado" });
    fireEvent.click(screen.getByTestId("bench-approve-button"));
    await waitFor(() =>
      expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent("Prompt aprovado"),
    );

    const field =
      label === "Prompt"
        ? screen.getByRole("textbox", { name: "Prompt" })
        : screen.getByLabelText(label);
    fireEvent.change(field, { target: { value } });

    await waitFor(() =>
      expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent("Prompt invalidado"),
    );
    expect(screen.getByTestId("bench-generate-button")).toBeDisabled();
  });

  it.each([
    { label: "Nome do produto", value: "Produto atualizado" },
    { label: "Prompt", value: "Prompt-base atualizado" },
  ])("descarta resposta atrasada de compose após editar $label", async ({ label, value }) => {
    let composeCount = 0;
    let originalEvidence: typeof MOCK_TEXT_INTEGRITY_EVIDENCE | null = null;
    let finishDelayedResponse: ((response: ReturnType<typeof jsonResponse>) => void) | null = null;
    mockFetch.mockImplementation((url: unknown, init?: RequestInit) => {
      const target = String(url);
      if (target.includes("/branding")) return Promise.resolve(jsonResponse({ branding: BRANDING }));
      if (target.includes("/compose")) {
        composeCount += 1;
        const request = JSON.parse(String(init?.body)) as {
          product: { name: string; description?: string; mandatoryArtworkText?: string };
          promptBase: string;
        };
        if (composeCount === 2) {
          return new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
            finishDelayedResponse = resolve;
          });
        }
        const reviewRevision = createBenchTextIntegrityRevision(
          collectBenchTextIntegrityFields({
            product: request.product,
            promptBase: request.promptBase,
          }),
        );
        originalEvidence = {
          policyVersion: TEXT_INTEGRITY_POLICY_VERSION,
          reviewRevision,
          decision: "no_alerts",
        };
        return Promise.resolve(
          jsonResponse({
            compiledPrompt: "PROMPT ATUAL",
            blocks: {},
            composerVersion: COMPOSER_VERSION,
            policyVersions: {},
            promptBaseVersion: BENCH_DEFAULT_PROMPT_BASE.version,
            textIntegrityEvidence: originalEvidence,
          }),
        );
      }
      return Promise.resolve(jsonResponse({ error: "unexpected_test_request" }, 400));
    });

    render(await BancadaPage());
    fireEvent.change(screen.getByLabelText("Nome do produto"), {
      target: { value: "Produto inicial" },
    });
    fireEvent.click(screen.getByTestId("bench-compose-button"));
    await waitFor(() => expect(composeCount).toBe(1));
    await screen.findByDisplayValue("PROMPT ATUAL");
    fireEvent.click(screen.getByTestId("bench-approve-button"));
    await waitFor(() =>
      expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent("Prompt aprovado"),
    );

    fireEvent.click(screen.getByTestId("bench-compose-button"));
    await waitFor(() => expect(composeCount).toBe(2));
    const editedField =
      label === "Prompt"
        ? screen.getByRole("textbox", { name: "Prompt" })
        : screen.getByLabelText(label);
    fireEvent.change(editedField, { target: { value } });
    await waitFor(() =>
      expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent("Prompt invalidado"),
    );
    expect(screen.getByTestId("bench-generate-button")).toBeDisabled();

    await act(async () => {
      if (!finishDelayedResponse) throw new Error("compose response was not held");
      finishDelayedResponse(
        jsonResponse({
          compiledPrompt: "PROMPT OBSOLETO",
          blocks: {},
          composerVersion: COMPOSER_VERSION,
          policyVersions: {},
          promptBaseVersion: BENCH_DEFAULT_PROMPT_BASE.version,
          textIntegrityEvidence: originalEvidence,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent("Prompt invalidado");
    expect(screen.queryByDisplayValue("PROMPT OBSOLETO")).toBeNull();
    expect(screen.getByTestId("bench-generate-button")).toBeDisabled();
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

  it("encaminha a evidência no_alerts recebida de compose até /runs", async () => {
    let composedPromptBase = "";
    mockFetch.mockImplementation(async (url: unknown, init?: RequestInit) => {
      const target = String(url);
      if (target.includes("/branding")) return jsonResponse({ branding: BRANDING });
      if (target.includes("/inputs")) {
        return jsonResponse(
          {
            runId: RUN_ID,
            inputs: [
              {
                path: `bench/${RUN_ID}/inputs/0.png`,
                mimeType: "image/png",
                width: 8,
                height: 8,
                bytes: 3,
                checksum: "input-checksum",
              },
            ],
          },
          201,
        );
      }
      if (target.includes("/compose")) {
        const request = JSON.parse(String(init?.body)) as {
          product: { name: string; description?: string; mandatoryArtworkText?: string };
          promptBase: string;
        };
        composedPromptBase = request.promptBase;
        const reviewRevision = createBenchTextIntegrityRevision(
          collectBenchTextIntegrityFields({
            product: request.product,
            promptBase: request.promptBase,
          }),
        );
        return jsonResponse({
          compiledPrompt: "PROMPT SEM ALERTAS",
          blocks: {},
          composerVersion: COMPOSER_VERSION,
          policyVersions: { tipoConteudo: "48.2.5-produto-v3", geral: "48.2.5-general-integrity-v1" },
          promptBaseVersion: BENCH_DEFAULT_PROMPT_BASE.version,
          textIntegrityEvidence: {
            policyVersion: TEXT_INTEGRITY_POLICY_VERSION,
            reviewRevision,
            decision: "no_alerts",
          },
        });
      }
      if (target.includes("/estimate")) return jsonResponse(ESTIMATE);
      if (target.endsWith("/runs")) {
        return ndjsonResponse([{ type: "done", runId: RUN_ID }]);
      }
      return jsonResponse({ error: "unexpected_test_request" }, 400);
    });

    render(await BancadaPage());
    fireEvent.change(screen.getByLabelText("Nome do produto"), {
      target: { value: "Café especial" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), {
      target: { value: "Crie uma arte comercial clara." },
    });
    fireEvent.change(screen.getByTestId("bench-image-input-main"), {
      target: {
        files: [new File([new Uint8Array([1, 2, 3])], "principal.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByTestId("bench-upload-button"));
    await waitFor(() => expect(mockFetch.mock.calls.some(([url]) => String(url).includes("/inputs"))).toBe(true));

    fireEvent.click(screen.getByTestId("bench-compose-button"));
    await screen.findByRole("textbox", { name: "Prompt compilado" });
    fireEvent.click(screen.getByTestId("bench-approve-button"));
    await waitFor(() =>
      expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent("Prompt aprovado"),
    );

    await openConfirmation();
    fireEvent.click(screen.getByTestId("lab-confirm-button"));
    await waitFor(() => expect(runCalls()).toHaveLength(1));

    const runBody = JSON.parse(String(runCalls()[0][1].body)) as {
      preflight: { textIntegrityEvidence: { decision: string }; promptBase: string };
    };
    expect(runBody.preflight.textIntegrityEvidence.decision).toBe("no_alerts");
    expect(runBody.preflight.promptBase).toBe(composedPromptBase);
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

  it("distingue estado stale e mostra a revisão/alertas atuais", () => {
    render(
      <BenchPreflightPanel
        status="invalidated"
        compiledPrompt=""
        finalPrompt=""
        composerVersion=""
        composing={false}
        error="Recomponha com a revisão atual."
        textIntegrityReview={{
          policyVersion: "48.2.5-text-integrity-v1",
          reviewRevision: "c".repeat(64),
          alerts: [
            {
              field: "promptBase",
              excerpt: "voce",
              reason: "A grafia pode precisar de revisão.",
              ruleId: "ptbr_voce_without_accent",
            },
          ],
          stale: true,
        }}
        onCompose={() => {}}
        onEditFinal={() => {}}
        onApprove={() => {}}
        onKeepExactly={() => {}}
      />,
    );

    const review = screen.getByTestId("bench-text-integrity-review");
    expect(review).toHaveTextContent("Revisão textual desatualizada");
    expect(review).toHaveTextContent("Prompt-base — possível erro de ortografia; verifique.");
    expect(review).not.toHaveTextContent("voce");
    expect(review).not.toHaveTextContent("ptbr_voce_without_accent");
    expect(screen.getByTestId("bench-keep-text-exactly-button")).toBeInTheDocument();
  });

  it("o workbench invalida o preflight de forma centralizada (ponto único + revisão)", () => {
    const source = readComponentSource("bench-workbench.tsx");
    expect(source).toContain("invalidatePreflight");
    expect(source).toContain("preflightRevision");
    // A invalidação cobre as entradas que compõem texto/referências.
    expect(source).toContain("handleStoreChange");
    expect(source).toContain("handleCampaignChange");
    expect(source).toContain("handlePromptBaseChange");
    expect(source).toContain("handleUploaded");
    // Configuração de execução (preset/modelo/qualidade) invalida só a estimativa
    // e a confirmação financeira — não o prompt aprovado (correção de UAT).
    expect(source).toContain("handlePresetChange");
    expect(source).toContain("executionConfigRevision");
    // Sem hashes persistidos e sem comparação lado a lado/votação.
    expect(source).not.toMatch(/createHash|sha256/i);
    expect(source).not.toMatch(/lado a lado|vota(ção|r)|enquete/i);
    expect(source).not.toContain("campaign-images");
  });

  it("trocar preset/modelo/qualidade NÃO invalida o prompt aprovado (correção de UAT)", async () => {
    mockListBenchPresets.mockReturnValue([
      PRESET_ENABLED,
      PRESET_ENABLED_MEDIUM,
      PRESET_DISABLED,
    ]);
    mockFetch.mockImplementation(async (url: unknown) => {
      const target = String(url);
      if (target.includes("/compose")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            compiledPrompt: "PROMPT COMPILADO",
            blocks: { "IDENTIDADE E DIREÇÃO VISUAL": "Loja: Aurora" },
            composerVersion: COMPOSER_VERSION,
            policyVersions: {
              intencao: "48.2.4-oferta-v1",
              tipoConteudo: "48.2.5-produto-v3",
              geral: "48.2.5-general-integrity-v1",
            },
            promptBaseVersion: BENCH_DEFAULT_PROMPT_BASE.version,
            textIntegrityEvidence: MOCK_TEXT_INTEGRITY_EVIDENCE,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ branding: BRANDING }) };
    });

    render(await BancadaPage());

    fireEvent.click(screen.getByTestId("bench-compose-button"));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Prompt compilado" })).toHaveValue(
        "PROMPT COMPILADO",
      ),
    );
    fireEvent.click(screen.getByTestId("bench-approve-button"));
    await waitFor(() =>
      expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent(
        "Prompt aprovado",
      ),
    );

    // Troca a configuração de execução (qualidade → medium): o prompt permanece aprovado.
    fireEvent.change(screen.getByLabelText("Qualidade"), { target: { value: "medium" } });

    expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent("Prompt aprovado");
    expect(screen.getByRole("textbox", { name: "Prompt compilado" })).toHaveValue(
      "PROMPT COMPILADO",
    );
  });

  it("alterar as imagens invalida o prompt aprovado (correção de UAT)", async () => {
    mockFetch.mockImplementation(async (url: unknown) => {
      const target = String(url);
      if (target.includes("/compose")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            compiledPrompt: "PROMPT COMPILADO",
            blocks: { "IDENTIDADE E DIREÇÃO VISUAL": "Loja: Aurora" },
            composerVersion: COMPOSER_VERSION,
            policyVersions: {
              intencao: "48.2.4-oferta-v1",
              tipoConteudo: "48.2.5-produto-v3",
              geral: "48.2.5-general-integrity-v1",
            },
            promptBaseVersion: BENCH_DEFAULT_PROMPT_BASE.version,
            textIntegrityEvidence: MOCK_TEXT_INTEGRITY_EVIDENCE,
          }),
        };
      }
      if (target.includes("/inputs")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            runId: "run-img",
            inputs: [
              {
                path: "bench/run-img/inputs/0.png",
                mimeType: "image/png",
                width: 1024,
                height: 1024,
                bytes: 3,
                checksum: "deadbeefcafebabe",
              },
            ],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ branding: BRANDING }) };
    });

    render(await BancadaPage());

    fireEvent.click(screen.getByTestId("bench-compose-button"));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Prompt compilado" })).toHaveValue(
        "PROMPT COMPILADO",
      ),
    );
    fireEvent.click(screen.getByTestId("bench-approve-button"));
    await waitFor(() =>
      expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent(
        "Prompt aprovado",
      ),
    );

    const file = new File([new Uint8Array([1, 2, 3])], "principal.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByTestId("bench-image-input-main"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByTestId("bench-upload-button"));

    await waitFor(() =>
      expect(screen.getByTestId("bench-preflight-status")).toHaveTextContent(
        "Prompt invalidado",
      ),
    );
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
  estimatedUsd: 0.00588,
  coverage: "partial",
  mode: "token_based",
  isEstimate: true,
  costSource: "bench_local_pricing",
  costRuleVersion: "2026-09-bench-2",
};

const PREFLIGHT_EVIDENCE: BenchPreflightEvidenceView = {
  promptBase: "prompt base",
  promptCompiled: "prompt compilado",
  promptApproved: "Foto do produto em fundo claro",
  promptBlocks: { "INSTRUÇÕES DO PROMPT-BASE": "prompt base" },
  composerVersion: COMPOSER_VERSION,
  // Campos da F48.2.4 exigidos pelo schema estrito (D11/D14): sem eles o
  // `POST /runs` responde 400 por preflight-evidence ausente. A evidência é
  // **textual**: NÃO carrega `presetId`/`config` de execução (correção de UAT).
  policyVersions: {
    intencao: "48.2.4-oferta-v1",
    formato: "48.2.4-formato-1-1-v1",
    tipoConteudo: "48.2.5-produto-v3",
    estrutura: "48.2.4-peca-unica-v1",
    tema: "48.2.4-tema-nenhum-v1",
  },
  promptBaseVersion: BENCH_DEFAULT_PROMPT_BASE.version,
  textIntegrityEvidence: {
    policyVersion: TEXT_INTEGRITY_POLICY_VERSION,
    reviewRevision: createBenchTextIntegrityRevision(
      collectBenchTextIntegrityFields({
        product: { name: "Café especial" },
        promptBase: "prompt base",
      }),
    ),
    decision: "no_alerts",
  },
  identityReference: {
    kind: "logo",
    variantType: "primary",
    storagePath: "stores/aurora/logo.png",
  },
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
  usage: { outputImageTokens: 196 },
  estimatedCostUsd: 0.03,
  costDetail: { mode: "token_based" },
  costSource: "bench_local_pricing",
  costRuleVersion: "2026-09-bench-2",
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
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ...ESTIMATE, coverage: "complete", estimatedUsd: 0.04 }),
    );
    renderExecutionPanel();

    await openConfirmation();

    const panel = screen.getByTestId("bench-estimate-panel");
    expect(within(panel).getByText("US$ 0.04")).toBeInTheDocument();
    expect(within(panel).getByText("complete")).toBeInTheDocument();
    expect(runCalls()).toHaveLength(0);
  });

  it("identifica pricing parcial como somente saída e informa custos adicionais", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ...ESTIMATE, coverage: "partial", estimatedUsd: 0.04 }),
    );
    renderExecutionPanel();
    await openConfirmation();

    const panel = screen.getByTestId("bench-estimate-panel");
    expect(within(panel).getByText("saída: US$ 0.04")).toBeInTheDocument();
    expect(within(panel).getByText("Estimativa parcial — somente saída")).toBeInTheDocument();
    expect(
      within(panel).getByText(/tokens de texto e imagem de entrada.*adicionais/i),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(/confirme financeiramente cada geração manual separadamente/i),
    ).toBeInTheDocument();
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

// ─── 4. F48.2.4 — políticas/versões, prompt-base padrão e identidade ─────────

const POLICIES: BenchPromptPolicyView[] = [
  {
    dimension: "intencao",
    id: "policy.intencao.oferta",
    value: "oferta",
    version: "48.2.4-oferta-v1",
  },
  {
    dimension: "formato",
    id: "policy.formato.1-1",
    value: "1:1",
    version: "48.2.4-formato-1-1-v1",
  },
  {
    dimension: "tipoConteudo",
    id: "policy.tipoConteudo.produto",
    value: "produto",
    version: "48.2.5-produto-v3",
  },
  {
    dimension: "estrutura",
    id: "policy.estrutura.peca-unica",
    value: "peca-unica",
    version: "48.2.4-peca-unica-v1",
  },
  {
    dimension: "tema",
    id: "policy.tema.nenhum",
    value: "nenhum",
    version: "48.2.4-tema-nenhum-v1",
  },
];

const ATTEMPTS: BenchAttemptView[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    status: "succeeded",
    attemptOfRunId: null,
    createdAt: "2026-09-30T10:00:00.000Z",
    finishedAt: "2026-09-30T10:01:00.000Z",
    promptBaseVersion: "48.2.4-oferta-1-1-v1",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    status: "failed",
    attemptOfRunId: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-09-30T11:00:00.000Z",
    finishedAt: null,
    promptBaseVersion: null,
  },
];

describe("contrato de UI — políticas/versões e prompt-base padrão (F48.2.4)", () => {
  it("exibe as políticas habilitadas com id+versão, a versão do compositor e a do prompt-base padrão", () => {
    render(
      <BenchPoliciesPanel
        policies={POLICIES}
        composerVersion={COMPOSER_VERSION}
        promptBaseVersion={BENCH_DEFAULT_PROMPT_BASE.version}
      />,
    );

    expect(screen.getByTestId("bench-policies-panel")).toBeInTheDocument();
    expect(screen.getByText("Políticas habilitadas")).toBeInTheDocument();
    expect(screen.getByTestId("bench-policy-intencao")).toHaveTextContent("oferta");
    expect(screen.getByTestId("bench-policy-formato")).toHaveTextContent("1:1");
    expect(screen.getByText(/policy\.intencao\.oferta/)).toBeInTheDocument();
    expect(screen.getByText(/48\.2\.4-oferta-v1/)).toBeInTheDocument();
    expect(screen.getByText("Versão do compositor")).toBeInTheDocument();
    expect(screen.getByText(COMPOSER_VERSION)).toBeInTheDocument();
    expect(screen.getByText("Prompt-base padrão")).toBeInTheDocument();
    expect(screen.getByText(BENCH_DEFAULT_PROMPT_BASE.version)).toBeInTheDocument();
  });

  it("o painel de políticas é somente leitura e não expõe secrets", () => {
    const source = readComponentSource("bench-policies-panel.tsx");
    expect(source).not.toContain("fetch(");
    expect(source).not.toMatch(/process\.env|service_role|sk-/);
    expect(source).not.toMatch(/lado a lado|vota(ção|r)|enquete|ranking/i);
    expect(EMOJI_PATTERN.test(source)).toBe(false);
  });

  it("semeia o editor com o prompt-base padrão e oferece reposição explícita", () => {
    const onReset = vi.fn();
    const onChange = vi.fn();
    render(
      <BenchPromptEditor
        value={BENCH_DEFAULT_PROMPT_BASE.content}
        onChange={onChange}
        promptBaseVersion={BENCH_DEFAULT_PROMPT_BASE.version}
        onResetToDefault={onReset}
      />,
    );

    const textarea = screen.getByRole("textbox", {
      name: "Prompt",
    }) as HTMLTextAreaElement;
    expect(textarea.value).toBe(BENCH_DEFAULT_PROMPT_BASE.content);

    fireEvent.click(screen.getByTestId("bench-reset-prompt-base"));
    expect(onReset).toHaveBeenCalledTimes(1);
    // A reposição é delegada ao contêiner; o editor não altera sozinho o valor.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a página server semeia o prompt-base padrão a partir das props iniciais, sem POST /compose", async () => {
    render(await BancadaPage());

    const textarea = screen.getByRole("textbox", {
      name: "Prompt",
    }) as HTMLTextAreaElement;
    expect(textarea.value).toBe(BENCH_DEFAULT_PROMPT_BASE.content);
    expect(screen.getByTestId("bench-policies-panel")).toBeInTheDocument();
    expect(screen.getByTestId("bench-attempts-panel")).toBeInTheDocument();

    const composeCalls = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes("/compose"),
    );
    expect(composeCalls).toHaveLength(0);
  });

  it("exibe as versões no painel de preflight", () => {
    render(
      <BenchPreflightPanel
        status="composed"
        compiledPrompt="[IDENTIDADE E DIREÇÃO VISUAL]\nLoja: Aurora"
        finalPrompt="[IDENTIDADE E DIREÇÃO VISUAL]\nLoja: Aurora"
        composerVersion={COMPOSER_VERSION}
        policyVersions={PREFLIGHT_EVIDENCE.policyVersions ?? {}}
        promptBaseVersion={BENCH_DEFAULT_PROMPT_BASE.version}
        composing={false}
        error={null}
        onCompose={() => {}}
        onEditFinal={() => {}}
        onApprove={() => {}}
      />,
    );

    const versions = screen.getByTestId("bench-preflight-versions");
    expect(versions).toHaveTextContent(COMPOSER_VERSION);
    expect(versions).toHaveTextContent(BENCH_DEFAULT_PROMPT_BASE.version);
    expect(versions).toHaveTextContent("intencao:48.2.4-oferta-v1");
  });

  it("exibe a referência canônica de identidade sem URL assinada", () => {
    render(<BenchBrandingPanel branding={BRANDING} />);

    const label = screen.getByText("Identidade enviada ao modelo");
    expect(label).toBeInTheDocument();
    const row = label.closest("div");
    expect(row?.textContent).toContain("stores/aurora/logo.png");
    expect(row?.textContent).not.toContain("signed");
  });
});

// ─── 5. F48.2.4 — tentativas, invalidação reforçada e evidência estrita ──────

describe("contrato de UI — tentativas e 'Nova tentativa' (F48.2.4)", () => {
  it("lista as tentativas por linhagem e oferece 'Nova tentativa'", () => {
    const onNewAttempt = vi.fn();
    render(
      <BenchAttemptsPanel
        attempts={ATTEMPTS}
        canStartAttempt
        onNewAttempt={onNewAttempt}
      />,
    );

    expect(screen.getByText("Tentativas anteriores")).toBeInTheDocument();
    expect(
      screen.getByTestId(`bench-attempt-${ATTEMPTS[0].id}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`bench-attempt-${ATTEMPTS[1].id}`),
    ).toBeInTheDocument();

    const button = screen.getByTestId("bench-new-attempt-button");
    expect(button).toHaveTextContent("Nova tentativa");
    fireEvent.click(button);
    expect(onNewAttempt).toHaveBeenCalledTimes(1);
  });

  it("mostra o empty state quando não há tentativas e desabilita a ação", () => {
    render(<BenchAttemptsPanel attempts={[]} />);

    expect(screen.getByText("Nenhuma tentativa anterior")).toBeInTheDocument();
    expect(screen.getByTestId("bench-new-attempt-button")).toBeDisabled();
  });

  it("é desktop-only e não oferece lado a lado/votação/ranking", () => {
    const source = readComponentSource("bench-attempts-panel.tsx");
    expect(source).not.toMatch(/lado a lado|vota(ção|r)|enquete|ranking/i);
    expect(EMOJI_PATTERN.test(source)).toBe(false);
  });

  it("o workbench separa aprovação de configuração de execução e monta a evidência textual", () => {
    const source = readComponentSource("bench-workbench.tsx");
    // Invalidação do prompt cobre prompt-base e as entradas de texto.
    expect(source).toContain("invalidatePreflight");
    expect(source).toContain("handlePromptBaseChange");
    expect(source).toContain("setPolicyVersions({})");
    // Configuração de execução separada (não invalida o prompt — correção de UAT).
    expect(source).toContain("handlePresetChange");
    expect(source).toContain("executionConfigRevision");
    // Evidência do preflight é textual (campos exigidos pelo schema estrito).
    expect(source).toContain("policyVersions");
    expect(source).toContain("promptBaseVersion");
    expect(source).toContain("identityReference");
    // Sem hashes persistidos e sem comparação lado a lado/votação.
    expect(source).not.toMatch(/createHash|sha256/i);
    expect(source).not.toMatch(/lado a lado|vota(ção|r)|enquete|ranking/i);
    expect(source).not.toContain("campaign-images");
  });

  it("a fixture PREFLIGHT_EVIDENCE satisfaz o BenchPreflightEvidenceSchema estrito", () => {
    const result = BenchPreflightEvidenceSchema.safeParse(PREFLIGHT_EVIDENCE);
    expect(result.success).toBe(true);
  });

  it("o POST /runs envia a evidência de preflight completa (sem 400 por campo ausente)", async () => {
    const onCompleted = vi.fn();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(ESTIMATE))
      .mockResolvedValueOnce(
        ndjsonResponse([{ type: "done", runId: RUN_ID }]),
      );
    renderExecutionPanel(onCompleted);

    await openConfirmation();
    fireEvent.click(screen.getByTestId("lab-confirm-button"));

    await waitFor(() => expect(runCalls()).toHaveLength(1));
    const body = JSON.parse(String(runCalls()[0][1].body));
    expect(body.preflight).toEqual(PREFLIGHT_EVIDENCE);
    expect(BenchPreflightEvidenceSchema.safeParse(body.preflight).success).toBe(true);
  });

  it("o painel de evidências distingue prompt-base, versões e custo reportado", () => {
    render(
      <BenchEvidencePanel
        run={{
          ...EVIDENCE_RUN,
          promptBase: "prompt base",
          promptBaseVersion: BENCH_DEFAULT_PROMPT_BASE.version,
          policyVersions: {
            intencao: "48.2.4-oferta-v1",
            tipoConteudo: "48.2.5-produto-v3",
            geral: "48.2.5-general-integrity-v1",
          },
          composerVersion: COMPOSER_VERSION,
          reportedCostUsd: 1.23,
        }}
        artifacts={[]}
      />,
    );

    expect(screen.getByText("Prompt-base usado")).toBeInTheDocument();
    expect(screen.getByText("Prompt-base padrão (versão)")).toBeInTheDocument();
    expect(screen.getByText("Versões (compositor/políticas)")).toBeInTheDocument();
    expect(screen.getByText("Custo reportado pelo provider")).toBeInTheDocument();
    expect(screen.getByText("US$ 1.23")).toBeInTheDocument();
  });

  it("nenhum painel novo expõe secrets nem URL assinada de identidade", () => {
    const sources = [
      "bench-policies-panel.tsx",
      "bench-attempts-panel.tsx",
      "bench-prompt-editor.tsx",
      "bench-workbench.tsx",
    ]
      .map(readComponentSource)
      .join("\n");
    expect(sources).not.toMatch(/process\.env|service_role|SUPABASE_SERVICE|sk-/);
    expect(sources).not.toContain("signedUrl");
    expect(EMOJI_PATTERN.test(sources)).toBe(false);
  });
});
