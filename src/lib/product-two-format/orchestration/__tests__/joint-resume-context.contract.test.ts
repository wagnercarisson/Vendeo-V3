import { describe, expect, it } from "vitest";

import {
  buildJointResumeContext,
  omitJointResumeContext,
  readJointResumeContext,
} from "../joint-resume-context";

const OPERATION = "22222222-2222-4222-8222-222222222222";
const SQUARE = "11111111-1111-4111-8111-111111111111";
const BASE = "33333333-3333-4333-8333-333333333333";

function sequence(...values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1]!;
}

describe("F60.7 C1 — identidade durável", () => {
  it("gera squareDeliveryId e somente o requestId inicial da base", () => {
    const context = buildJointResumeContext({
      operationId: OPERATION,
      uuid: sequence(SQUARE, BASE),
    });
    expect(context).toEqual({
      squareDeliveryId: SQUARE,
      initialRequestIds: { base: BASE },
    });
  });

  it("lê estritamente o contexto persistido", () => {
    const snapshot = {
      jointResumeContext: {
        squareDeliveryId: SQUARE,
        initialRequestIds: { base: BASE },
      },
    };
    expect(readJointResumeContext(snapshot)).toEqual({
      kind: "found",
      context: {
        squareDeliveryId: SQUARE,
        initialRequestIds: { base: BASE },
      },
    });
  });

  it("recusa ID inicial de expansão e campos extras", () => {
    expect(
      readJointResumeContext({
        jointResumeContext: {
          squareDeliveryId: SQUARE,
          initialRequestIds: { base: BASE, expansion: OPERATION },
        },
      }),
    ).toEqual({
      kind: "invalid",
      reason: "initial_request_ids_must_only_contain_base",
    });
    expect(
      readJointResumeContext({
        jointResumeContext: {
          squareDeliveryId: SQUARE,
          initialRequestIds: { base: BASE },
          extra: true,
        },
      }),
    ).toEqual({
      kind: "invalid",
      reason: "joint_context_unexpected_field:extra",
    });
  });

  it("omite a chave volátil do hash de conteúdo", () => {
    expect(
      omitJointResumeContext({
        campaignFormat: "1:1+9:16",
        jointResumeContext: { squareDeliveryId: SQUARE },
      }),
    ).toEqual({ campaignFormat: "1:1+9:16" });
  });
});
