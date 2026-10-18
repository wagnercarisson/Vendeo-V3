-- Quick GSD — adicionar `gpt-6-luna` como modelo de `brand_profile_vision` (forward-only).
-- LOCAL-ONLY: apenas AUTORADA aqui. NÃO aplicar sem autorização (`migration up --local`).
-- NÃO altera defaults, a seleção vigente nem outros modelos. NÃO registra geração real como validada.
-- Preserva `brand_profile_text` e `campaign_copy`. Reexecução CONFERE o cadastro existente
-- e FALHA em divergência (não esconde com ON CONFLICT DO NOTHING).
--
-- Compatibilidade oficial (developers.openai.com/docs/models): GPT-6 Luna é vision-capable
--   ("All latest OpenAI models support text and image input ... vision"); Chat Completions
--   é o caminho documentado para análise de imagens; Luna suporta `reasoning_effort=none`.
--
-- Pricing NÃO é semeado aqui: reutilizado por (provider, model) do `openai/gpt-6-luna`.

DO $$
DECLARE
  v_segment TEXT;
  v_status  TEXT;
BEGIN
  SELECT segment, status INTO v_segment, v_status
  FROM public.ai_model_catalog
  WHERE capability = 'brand_profile_vision'
    AND provider = 'openai'
    AND model = 'gpt-6-luna'
    AND protocol = 'chat-completions';

  IF FOUND THEN
    IF v_segment <> 'vision' OR v_status <> 'active' THEN
      RAISE EXCEPTION 'catalog_divergence: gpt-6-luna existe com segment=% status=%', v_segment, v_status;
    END IF;
    RAISE NOTICE 'catalog_exists_ok: gpt-6-luna (brand_profile_vision)';
    RETURN;
  END IF;

  INSERT INTO public.ai_model_catalog
    (capability, segment, provider, model, protocol, label, status, source_note, validated_at)
  VALUES
    ('brand_profile_vision', 'vision', 'openai', 'gpt-6-luna', 'chat-completions',
     'GPT-6 Luna (brand profile vision)', 'active',
     'doc oficial developers.openai.com/models (vision; input 0.10/M, output 0.50/M); pricing reutilizado por (provider, model); visibilidade na conta a confirmar na sessao',
     NULL);
  RAISE NOTICE 'catalog_inserted: gpt-6-luna (brand_profile_vision)';
END $$;

-- =============================================================================
-- REVERT (manual; apenas instância local, se autorizado)
-- =============================================================================
-- DELETE FROM public.ai_model_catalog
--  WHERE capability='brand_profile_vision' AND provider='openai'
--    AND model='gpt-6-luna' AND protocol='chat-completions';
