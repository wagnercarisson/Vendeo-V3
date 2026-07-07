"use server";

import {
  resolveStoreIdentity as _resolveStoreIdentity,
  validateIdentityReference as _validateIdentityReference,
  buildCampaignBrief as _buildCampaignBrief,
} from "@/lib/store-identity-service";

export async function resolveStoreIdentity(...args: Parameters<typeof _resolveStoreIdentity>) {
  return _resolveStoreIdentity(...args);
}

export async function validateIdentityReference(...args: Parameters<typeof _validateIdentityReference>) {
  return _validateIdentityReference(...args);
}

export async function buildCampaignBrief(...args: Parameters<typeof _buildCampaignBrief>) {
  return _buildCampaignBrief(...args);
}
