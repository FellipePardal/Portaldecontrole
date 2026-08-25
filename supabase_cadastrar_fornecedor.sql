-- ============================================================
-- Cadastro rápido de fornecedor (base única Hub+Portal)
-- Única escrita do Portal no app_state do Hub. Substitui o
-- read-modify-write do array inteiro (que perdia edições
-- concorrentes do Hub) por um append ATÔMICO com dedupe por
-- apelido normalizado: se já existir, devolve o existente.
-- Só usuários com papel de edição executam.
-- ============================================================

CREATE OR REPLACE FUNCTION public.portal_cadastrar_fornecedor(novo JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  apelido_norm TEXT := lower(btrim(coalesce(novo->>'apelido', '')));
  existente JSONB;
BEGIN
  IF NOT public.portal_pode_editar() THEN
    RAISE EXCEPTION 'sem permissão para cadastrar fornecedor';
  END IF;
  IF apelido_norm = '' THEN
    RAISE EXCEPTION 'apelido vazio';
  END IF;

  -- Lock da linha: serializa appends concorrentes sem tocar no resto do app_state
  PERFORM 1 FROM app_state WHERE key = 'fornecedores' FOR UPDATE;

  SELECT e INTO existente
  FROM app_state, jsonb_array_elements(coalesce(value, '[]'::jsonb)) e
  WHERE key = 'fornecedores'
    AND lower(btrim(coalesce(e->>'apelido', ''))) = apelido_norm
  LIMIT 1;

  IF existente IS NOT NULL THEN
    RETURN existente;
  END IF;

  UPDATE app_state
     SET value = coalesce(value, '[]'::jsonb) || jsonb_build_array(novo),
         updated_at = NOW()
   WHERE key = 'fornecedores';

  RETURN novo;
END $$;

REVOKE EXECUTE ON FUNCTION public.portal_cadastrar_fornecedor(JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.portal_cadastrar_fornecedor(JSONB) TO authenticated;
