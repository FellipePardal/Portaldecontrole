-- ============================================================
-- Renome de fornecedor com propagação (Fase C da base única)
-- Renomear o apelido no Hub NÃO pode quebrar o vínculo por nome
-- nas escalas do Portal: esta RPC troca o nome em todas as
-- colunas de fornecedor das 5 tabelas + prestador_links,
-- segmento a segmento (convenção "A / B"), preservando anotações
-- ("Nome (H)", "Nome - Record", "Nome cobre").
-- Só usuários com papel de edição executam.
-- ============================================================

CREATE OR REPLACE FUNCTION public.renomear_fornecedor(antigo TEXT, novo TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  par TEXT[];
  total INTEGER := 0;
  afetadas INTEGER;
BEGIN
  IF NOT public.portal_pode_editar() THEN
    RAISE EXCEPTION 'sem permissão para renomear';
  END IF;
  IF btrim(coalesce(antigo, '')) = '' OR btrim(coalesce(novo, '')) = '' OR btrim(antigo) = btrim(novo) THEN
    RETURN 0;
  END IF;

  FOREACH par SLICE 1 IN ARRAY ARRAY[
    ['brasileirao_jogos','um'], ['brasileirao_jogos','sng_premiere'], ['brasileirao_jogos','sng_host'],
    ['brasileirao_jogos','gerador'], ['brasileirao_jogos','supervisores_1'], ['brasileirao_jogos','supervisores_2'],
    ['brasileirao_jogos','liveu_1'], ['brasileirao_jogos','liveu_2'], ['brasileirao_jogos','dtv'],
    ['brasileirao_jogos','op_vmix'], ['brasileirao_jogos','op_audio'], ['brasileirao_jogos','teleporto'],
    ['paulistao_feminino_jogos','um'], ['paulistao_feminino_jogos','sng'], ['paulistao_feminino_jogos','gerador'],
    ['paulistao_feminino_jogos','supervisor_um_host'], ['paulistao_feminino_jogos','coordenador'],
    ['paulistao_feminino_jogos','dtv'], ['paulistao_feminino_jogos','op_vmix'], ['paulistao_feminino_jogos','teleporto'],
    ['paulistao_feminino_jogos','dslr'], ['paulistao_feminino_jogos','refcam'], ['paulistao_feminino_jogos','drone'],
    ['paulistao_feminino_jogos','minidrone'], ['paulistao_feminino_jogos','grua'],
    ['perifericos_brasileirao','fornecedor_drone'], ['perifericos_brasileirao','fornecedor_minidrone'],
    ['perifericos_brasileirao','fornecedor_dslr'], ['perifericos_brasileirao','fornecedor_grua'],
    ['perifericos_brasileirao','fornecedor_goalcam'], ['perifericos_brasileirao','fornecedor_trilho'],
    ['perifericos_brasileirao','fornecedor_carrinho'], ['perifericos_brasileirao','fornecedor_clipcam'],
    ['perifericos_paulistao','fornecedor_drone'], ['perifericos_paulistao','fornecedor_minidrone'],
    ['perifericos_paulistao','fornecedor_dslr'], ['perifericos_paulistao','fornecedor_grua'],
    ['perifericos_paulistao','fornecedor_goalcam'], ['perifericos_paulistao','fornecedor_trilho'],
    ['perifericos_paulistao','fornecedor_carrinho'], ['perifericos_paulistao','fornecedor_clipcam'],
    ['escala_geral','coordenador_um'], ['escala_geral','produtor_um'],
    ['escala_geral','produtor_campo'], ['escala_geral','monitoracao']
  ] LOOP
    EXECUTE format($sql$
      UPDATE %I SET %I = (
        SELECT string_agg(
          CASE
            WHEN btrim(seg) = $1 THEN $2
            WHEN btrim(seg) LIKE $1 || ' %%' THEN $2 || substr(btrim(seg), length($1) + 1)
            ELSE btrim(seg)
          END, ' / ')
        FROM unnest(string_to_array(%I, '/')) seg
      ), updated_at = NOW()
      WHERE EXISTS (
        SELECT 1 FROM unnest(string_to_array(%I, '/')) s
        WHERE btrim(s) = $1 OR btrim(s) LIKE $1 || ' %%'
      )
    $sql$, par[1], par[2], par[2], par[2]) USING btrim(antigo), btrim(novo);
    GET DIAGNOSTICS afetadas = ROW_COUNT;
    total := total + afetadas;
  END LOOP;

  UPDATE prestador_links SET nome = btrim(novo) WHERE btrim(nome) = btrim(antigo);
  GET DIAGNOSTICS afetadas = ROW_COUNT;
  total := total + afetadas;

  RETURN total;
END $$;

REVOKE EXECUTE ON FUNCTION public.renomear_fornecedor(TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.renomear_fornecedor(TEXT, TEXT) TO authenticated;
