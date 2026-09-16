// @vitest-environment node
import { describe, it, expect } from "vitest";
import sharp from "sharp";

import {
  LAB_TECHNICAL_ALERTS,
  LAB_UNIFORM_STDDEV_THRESHOLD,
  validateArtifactTechnically,
} from "../technical-validation";

/**
 * Validação técnica objetiva do laboratório (F48.1, D9).
 *
 * Todos os buffers são gerados localmente com `sharp` — nenhuma rede, nenhum
 * download e nenhuma chamada paga. Cobre válida/uniforme, ruidosa, corrompida,
 * vazia, proporção divergente e MIME divergente, além da ausência de qualquer
 * campo de nota de qualidade.
 */

const FORBIDDEN_KEY_PATTERN = /score|rating|quality|publishable|beauty/i;

/** PNG 64×64 de cor sólida (imagem uniforme). */
async function solidPng(width = 64, height = 64): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    .png()
    .toBuffer();
}

/** JPEG com padrão determinístico de alto contraste (não uniforme). */
async function noisyJpeg(width = 64, height = 64): Promise<Buffer> {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let index = 0; index < width * height; index += 1) {
    const value = index % 2 === 0 ? 0 : 255;
    raw[index * channels] = value;
    raw[index * channels + 1] = value;
    raw[index * channels + 2] = value;
  }
  return sharp(raw, { raw: { width, height, channels } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

describe("validateArtifactTechnically — fatos objetivos com sharp", () => {
  it("PNG sólido é decodificável, uniforme e reporta MIME/dimensões/proporção reais", async () => {
    const result = await validateArtifactTechnically({ buffer: await solidPng() });

    expect(result.decodable).toBe(true);
    expect(result.mimeType).toBe("image/png");
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.aspectRatio).toBe(1);
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.uniform).toBe(true);
    expect(result.alerts).toContain("uniform_image");
    expect(result.emptyOrCorrupt).toBe(false);
  });

  it("JPEG ruidoso é decodificável e NÃO uniforme", async () => {
    const result = await validateArtifactTechnically({ buffer: await noisyJpeg() });

    expect(result.decodable).toBe(true);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.uniform).toBe(false);
    expect(result.alerts).not.toContain("uniform_image");
  });

  it("buffer com bytes arbitrários é corrompido, sem lançar", async () => {
    const result = await validateArtifactTechnically({
      buffer: Buffer.from("isto-nao-e-uma-imagem-valida", "utf8"),
    });

    expect(result.decodable).toBe(false);
    expect(result.emptyOrCorrupt).toBe(true);
    expect(result.alerts).toContain("decode_failed");
    expect(result.mimeType).toBeNull();
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
  });

  it("buffer vazio reporta bytes 0 e alerta empty_buffer, sem lançar", async () => {
    const result = await validateArtifactTechnically({ buffer: Buffer.alloc(0) });

    expect(result.bytes).toBe(0);
    expect(result.decodable).toBe(false);
    expect(result.emptyOrCorrupt).toBe(true);
    expect(result.alerts).toEqual(["empty_buffer"]);
  });

  it("proporção divergente da esperada emite aspect_ratio_mismatch", async () => {
    const result = await validateArtifactTechnically({
      buffer: await solidPng(64, 32),
      expectedAspectRatio: 1,
    });

    expect(result.aspectRatio).toBe(2);
    expect(result.alerts).toContain("aspect_ratio_mismatch");
  });

  it("MIME declarado divergente emite mime_mismatch e o MIME real prevalece", async () => {
    const result = await validateArtifactTechnically({
      buffer: await solidPng(),
      declaredMimeType: "image/jpeg",
    });

    expect(result.mimeType).toBe("image/png");
    expect(result.alerts).toContain("mime_mismatch");
  });

  it("MIME declarado igual ao real não emite mime_mismatch", async () => {
    const result = await validateArtifactTechnically({
      buffer: await solidPng(),
      declaredMimeType: "image/png",
    });

    expect(result.alerts).not.toContain("mime_mismatch");
  });

  it("campos reservados são sempre null (nenhuma capacidade textual/OCR nesta fase)", async () => {
    const results = [
      await validateArtifactTechnically({ buffer: await solidPng() }),
      await validateArtifactTechnically({ buffer: Buffer.from("x", "utf8") }),
      await validateArtifactTechnically({ buffer: Buffer.alloc(0) }),
    ];

    for (const result of results) {
      expect(result.structuredOutputValid).toBeNull();
      expect(result.ocrAlert).toBeNull();
    }
  });

  it("o resultado não expõe nenhuma chave de nota de qualidade", async () => {
    const result = await validateArtifactTechnically({ buffer: await solidPng() });

    const offending = Object.keys(result).filter((key) => FORBIDDEN_KEY_PATTERN.test(key));
    expect(offending).toEqual([]);
  });

  it("expõe apenas códigos de alerta conhecidos", async () => {
    const result = await validateArtifactTechnically({ buffer: await solidPng(64, 32) });

    for (const alert of result.alerts) {
      expect(LAB_TECHNICAL_ALERTS).toContain(alert);
    }
  });

  it("threshold de uniformidade documentado é 1", () => {
    expect(LAB_UNIFORM_STDDEV_THRESHOLD).toBe(1);
  });
});
