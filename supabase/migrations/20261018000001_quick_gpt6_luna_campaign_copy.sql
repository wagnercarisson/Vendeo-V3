-- Quick GSD — adicionar `gpt-6-luna` como modelo de `campaign_copy` (forward-only).
-- LOCAL-ONLY: apenas AUTORADA aqui. NÃO aplicar sem autorização (`migration up --local`).
-- NÃO altera defaults, a seleção vigente nem outros modelos. NÃO registra geração real como validada.
-- Reexecução CONFERE o cadastro existente e FALHA em divergência (não esconde com ON CONFLICT DO NOTHING).
--
-- Pricing NÃO é semeado aqui (dado via `admin_set_ai_model_price` na sessão, com revisão humana):
--   openai/gpt-6-luna — input US$0,10/M · cached 0,01/M · output US$0,50/M (doc oficial).

DO $$
DECLARE
  v_segment TEXT;
  v_status  TEXT;
BEGIN
  SELECT segment, status INTO v_segment, v_status
  FROM public.ai_model_catalog
  WHERE capability = 'campaign_copy'
    AND provider = 'openai'
    AND model = 'gpt-6-luna'
    AND protocol = 'chat-completions';

  IF FOUND THEN
    IF v_segment <> 'text' OR v_status <> 'active' THEN
      RAISE EXCEPTION 'catalog_divergence: gpt-6-luna existe com segment=% status=%', v_segment, v_status;
    END IF;
    RAISE NOTICE 'catalog_exists_ok: gpt-6-luna (campaign_copy)';
    RETURN;
  END IF;

  INSERT INTO public.ai_model_catalog
    (capability, segment, provider, model, protocol, label, status, source_note, validated_at)
  VALUES
    ('campaign_copy', 'text', 'openai', 'gpt-6-luna', 'chat-completions',
     'GPT-6 Luna (copy)', 'active',
     'doc oficial platform.openai.com/docs/pricing (input 0.10/M, output 0.50/M); visibilidade na conta a confirmar na sessao',
     NULL);
  RAISE NOTICE 'catalog_inserted: gpt-6-luna (campaign_copy)';
END $$;

-- =============================================================================
-- REVERT (manual; apenas instância local, se autorizado)
-- =============================================================================
-- DELETE FROM public.ai_model_catalog
--  WHERE capability='campaign_copy' AND provider='openai'
--    AND model='gpt-6-luna' AND protocol='chat-completions';
