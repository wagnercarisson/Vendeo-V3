-- Quick GSD — adicionar `gpt-6-luna` como modelo de `brand_profile_text` (forward-only).
-- LOCAL-ONLY: apenas AUTORADA aqui. NÃO aplicar sem autorização (`migration up --local`).
-- NÃO altera defaults, a seleção vigente nem outros modelos. NÃO registra geração real como validada.
-- NÃO remove nem altera a linha de `campaign_copy`. Reexecução CONFERE o cadastro existente
-- e FALHA em divergência (não esconde com ON CONFLICT DO NOTHING).
--
-- Pricing NÃO é semeado aqui: a resolução de custo é por (provider, model), então o pricing
--   vigente de openai/gpt-6-luna (mesma tupla já usada por `campaign_copy`) é reutilizado —
--   não se duplica nem se inventa preço.

DO $$
DECLARE
  v_segment TEXT;
  v_status  TEXT;
BEGIN
  SELECT segment, status INTO v_segment, v_status
  FROM public.ai_model_catalog
  WHERE capability = 'brand_profile_text'
    AND provider = 'openai'
    AND model = 'gpt-6-luna'
    AND protocol = 'chat-completions';

  IF FOUND THEN
    IF v_segment <> 'text' OR v_status <> 'active' THEN
      RAISE EXCEPTION 'catalog_divergence: gpt-6-luna existe com segment=% status=%', v_segment, v_status;
    END IF;
    RAISE NOTICE 'catalog_exists_ok: gpt-6-luna (brand_profile_text)';
    RETURN;
  END IF;

  INSERT INTO public.ai_model_catalog
    (capability, segment, provider, model, protocol, label, status, source_note, validated_at)
  VALUES
    ('brand_profile_text', 'text', 'openai', 'gpt-6-luna', 'chat-completions',
     'GPT-6 Luna (brand profile)', 'active',
     'doc oficial platform.openai.com/docs/pricing (input 0.10/M, output 0.50/M); pricing reutilizado por (provider, model); visibilidade na conta a confirmar na sessao',
     NULL);
  RAISE NOTICE 'catalog_inserted: gpt-6-luna (brand_profile_text)';
END $$;

-- =============================================================================
-- REVERT (manual; apenas instância local, se autorizado)
-- =============================================================================
-- DELETE FROM public.ai_model_catalog
--  WHERE capability='brand_profile_text' AND provider='openai'
--    AND model='gpt-6-luna' AND protocol='chat-completions';
