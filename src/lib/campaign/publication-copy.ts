"use server";

export interface ValidationIssue {
  field: string;
  message: string;
  code: string;
}

export type PublicationCopyUpdate =
  | { caption: string; hashtags: string[]; cta_post: string }
  | { restore: true };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePublicationCopy(
  body: unknown,
):
  | { valid: true; data: { caption: string; hashtags: string[]; cta_post: string } }
  | { valid: true; data: { restore: true } }
  | { valid: false; issues: ValidationIssue[] }
{
  const issues: ValidationIssue[] = [];

  if (body === null || body === undefined || !isRecord(body)) {
    return {
      valid: false,
      issues: [{ field: "body", message: "Body inválido.", code: "invalid_body" }],
    };
  }

  // If restore === true, return valid immediately (skip all other validation)
  if (body.restore === true) {
    return { valid: true, data: { restore: true } };
  }

  // Check if body has caption, hashtags, or cta_post
  const hasCaption = "caption" in body;
  const hasHashtags = "hashtags" in body;
  const hasCtaPost = "cta_post" in body;

  if (!hasCaption && !hasHashtags && !hasCtaPost) {
    return {
      valid: false,
      issues: [
        {
          field: "body",
          message:
            "Body deve conter caption, hashtags e cta_post para edição, ou restore: true para restaurar original.",
          code: "invalid_body",
        },
      ],
    };
  }

  // Validate caption
  if (!hasCaption) {
    issues.push({
      field: "caption",
      message: "Caption deve ter entre 1 e 2200 caracteres.",
      code: "too_short",
    });
  } else if (typeof body.caption !== "string") {
    issues.push({
      field: "caption",
      message: "Caption deve ter entre 1 e 2200 caracteres.",
      code: "invalid_type",
    });
  } else {
    if (body.caption.length < 1) {
      issues.push({
        field: "caption",
        message: "Caption deve ter entre 1 e 2200 caracteres.",
        code: "too_short",
      });
    }
    if (body.caption.length > 2200) {
      issues.push({
        field: "caption",
        message: "Caption deve ter entre 1 e 2200 caracteres.",
        code: "too_long",
      });
    }
  }

  // Validate hashtags
  if (!hasHashtags) {
    issues.push({
      field: "hashtags",
      message: "Hashtags deve ser um array de strings.",
      code: "invalid_type",
    });
  } else if (!Array.isArray(body.hashtags)) {
    issues.push({
      field: "hashtags",
      message: "Hashtags deve ser um array de strings.",
      code: "invalid_type",
    });
  } else {
    if (body.hashtags.length > 30) {
      issues.push({
        field: "hashtags",
        message: "Máximo de 30 hashtags.",
        code: "too_many",
      });
    }

    body.hashtags.forEach((tag: unknown, index: number) => {
      if (typeof tag !== "string") {
        issues.push({
          field: `hashtags[${index}]`,
          message:
            "Hashtag deve começar com # e conter apenas letras, números e underscore.",
          code: "invalid_format",
        });
      } else {
        if (!/^#\w+$/.test(tag)) {
          issues.push({
            field: `hashtags[${index}]`,
            message:
              "Hashtag deve começar com # e conter apenas letras, números e underscore.",
            code: "invalid_format",
          });
        }
        if (tag.length < 2 || tag.length > 100) {
          issues.push({
            field: `hashtags[${index}]`,
            message:
              "Hashtag deve começar com # e conter apenas letras, números e underscore.",
            code: tag.length < 2 ? "too_short" : "too_long",
          });
        }
      }
    });
  }

  // Validate cta_post
  if (!hasCtaPost) {
    issues.push({
      field: "cta_post",
      message: "CTA deve ter no máximo 200 caracteres.",
      code: "invalid_type",
    });
  } else if (typeof body.cta_post !== "string") {
    issues.push({
      field: "cta_post",
      message: "CTA deve ter no máximo 200 caracteres.",
      code: "invalid_type",
    });
  } else {
    if (body.cta_post.length > 200) {
      issues.push({
        field: "cta_post",
        message: "CTA deve ter no máximo 200 caracteres.",
        code: "too_long",
      });
    }
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    data: {
      caption: body.caption as string,
      hashtags: body.hashtags as string[],
      cta_post: body.cta_post as string,
    },
  };
}
