-- RLS: store_brand_assets
ALTER TABLE store_brand_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select_brand_assets" ON store_brand_assets
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())));

-- RLS: store_brand_profiles
ALTER TABLE store_brand_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select_brand_profiles" ON store_brand_profiles
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())));

-- RLS: store_visual_signatures
ALTER TABLE store_visual_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select_visual_signatures" ON store_visual_signatures
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())));

-- RLS: generation_events (default-deny — no policy)
ALTER TABLE generation_events ENABLE ROW LEVEL SECURITY;
-- NOTA: Nenhuma policy FOR SELECT TO authenticated em generation_events.
-- Apenas supabaseAdmin (service_role) acessa esta tabela.

-- GRANT SELECT necessario para RLS funcionar com authenticated role
GRANT SELECT ON TABLE store_brand_assets TO authenticated;
GRANT SELECT ON TABLE store_brand_profiles TO authenticated;
GRANT SELECT ON TABLE store_visual_signatures TO authenticated;
-- generation_events NAO recebe GRANT SELECT (default-deny)

-- Storage: store-brand-assets — de public_read para tenant_isolation
DROP POLICY IF EXISTS "brand_assets_public_read" ON storage.objects;
CREATE POLICY "tenant_isolation_brand_assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'store-brand-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid())
    )
  );

-- Storage: visual-signatures — de public_read para tenant_isolation
DROP POLICY IF EXISTS "visual_signatures_public_read" ON storage.objects;
CREATE POLICY "tenant_isolation_visual_signatures" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'visual-signatures'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid())
    )
  );

-- Storage: store-logos (excecao temporaria — Fase 11)
-- NOTA: store-logos mantem politica publica atual.
-- Nenhum fluxo novo le/escreve em store-logos.
-- Inventario e migracao programados para Fase 11.
-- Policy atual: FOR SELECT TO authenticated USING (bucket_id = 'store-logos')

-- REVERT:
-- DROP POLICY IF EXISTS "tenant_isolation_visual_signatures" ON storage.objects;
-- DROP POLICY IF EXISTS "tenant_isolation_brand_assets" ON storage.objects;
-- ALTER TABLE generation_events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE store_visual_signatures DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE store_brand_profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE store_brand_assets DISABLE ROW LEVEL SECURITY;
-- REVOKE SELECT ON TABLE store_visual_signatures FROM authenticated;
-- REVOKE SELECT ON TABLE store_brand_profiles FROM authenticated;
-- REVOKE SELECT ON TABLE store_brand_assets FROM authenticated;
-- CREATE POLICY "brand_assets_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'store-brand-assets');
-- CREATE POLICY "visual_signatures_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'visual-signatures');
