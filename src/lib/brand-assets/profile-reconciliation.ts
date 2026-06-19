import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import type { BrandProfileSource } from '@/lib/brand-assets/types';

export interface ReconciliationOptions {
  activateProfileIds?: string[];
  outdatedSources?: BrandProfileSource[];
  markIncompatibleAsOutdated?: boolean;
  preserveCurrentAsFallback?: boolean;
}

export interface ReconciliationResult {
  activatedProfiles: string[];
  outdatedProfiles: string[];
  preservedFallback: boolean;
}

export async function reconcileProfiles(
  storeId: string,
  options: ReconciliationOptions
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    activatedProfiles: [],
    outdatedProfiles: [],
    preservedFallback: false,
  };

  if (options.preserveCurrentAsFallback) {
    const { data: currentSynced } = await supabase
      .from('store_brand_profiles')
      .select('id')
      .eq('store_id', storeId)
      .eq('status', 'synced')
      .maybeSingle();

    if (currentSynced) {
      const isTarget = options.activateProfileIds?.includes(currentSynced.id);
      if (!isTarget) {
        result.preservedFallback = true;
      }
    }

    if (options.activateProfileIds && options.activateProfileIds.length > 0) {
      const { data: targets } = await supabase
        .from('store_brand_profiles')
        .select('id, status')
        .eq('store_id', storeId)
        .in('id', options.activateProfileIds);

      for (const target of targets ?? []) {
        const { data: incompatibleProfiles } = await supabase
          .from('store_brand_profiles')
          .select('id')
          .eq('store_id', storeId)
          .neq('id', target.id)
          .eq('status', 'synced');

        if (incompatibleProfiles && incompatibleProfiles.length > 0) {
          const incompatibleIds = incompatibleProfiles.map(p => p.id);
          await supabase
            .from('store_brand_profiles')
            .update({ status: 'outdated', updated_at: new Date().toISOString() })
            .eq('store_id', storeId)
            .in('id', incompatibleIds);
          result.outdatedProfiles.push(...incompatibleIds);
        }

        if (target.status !== 'synced') {
          await supabase
            .from('store_brand_profiles')
            .update({ status: 'synced', updated_at: new Date().toISOString() })
            .eq('id', target.id);
        }
        result.activatedProfiles.push(target.id);
      }
    }

    return result;
  }

  if (options.markIncompatibleAsOutdated && options.activateProfileIds && options.activateProfileIds.length > 0) {
    const { data: targets } = await supabase
      .from('store_brand_profiles')
      .select('id')
      .eq('store_id', storeId)
      .in('id', options.activateProfileIds);

    for (const target of targets ?? []) {
      const { data: incompatibleProfiles } = await supabase
        .from('store_brand_profiles')
        .select('id')
        .eq('store_id', storeId)
        .neq('id', target.id)
        .eq('status', 'synced');

      if (options.outdatedSources && options.outdatedSources.length > 0) {
        const { data: sourceFiltered } = await supabase
          .from('store_brand_profiles')
          .select('id')
          .eq('store_id', storeId)
          .neq('id', target.id)
          .eq('status', 'synced')
          .in('source', options.outdatedSources);

        const filteredIds = (sourceFiltered ?? []).map(p => p.id);
        if (filteredIds.length > 0) {
          await supabase
            .from('store_brand_profiles')
            .update({ status: 'outdated', updated_at: new Date().toISOString() })
            .eq('store_id', storeId)
            .in('id', filteredIds);
          result.outdatedProfiles.push(...filteredIds);
        }
      } else if (incompatibleProfiles && incompatibleProfiles.length > 0) {
        const incompatibleIds = incompatibleProfiles.map(p => p.id);
        await supabase
          .from('store_brand_profiles')
          .update({ status: 'outdated', updated_at: new Date().toISOString() })
          .eq('store_id', storeId)
          .in('id', incompatibleIds);
        result.outdatedProfiles.push(...incompatibleIds);
      }

      const { data: targetProfile } = await supabase
        .from('store_brand_profiles')
        .select('status')
        .eq('id', target.id)
        .single();

      if (targetProfile && targetProfile.status !== 'synced') {
        await supabase
          .from('store_brand_profiles')
          .update({ status: 'synced', updated_at: new Date().toISOString() })
          .eq('id', target.id);
      }
      result.activatedProfiles.push(target.id);
    }
  }

  return result;
}
