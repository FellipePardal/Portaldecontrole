-- ============================================================
-- Escala publicada vs. rascunho
-- Interno segue livre para estudo; o link do prestador SÓ mostra
-- jogos com escala_publicada = TRUE. Backfill: jogos até hoje
-- nascem publicados (já aconteceram); futuros nascem rascunho.
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'escala_geral','brasileirao_jogos','paulistao_feminino_jogos',
    'perifericos_brasileirao','perifericos_paulistao'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS escala_publicada BOOLEAN NOT NULL DEFAULT FALSE', t);
  END LOOP;
END $$;

-- Data dd/mm → DATE em 2026 (usa a norm_ddmm criada no matcher)
CREATE OR REPLACE FUNCTION public.ddmm_para_date(d TEXT) RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN public.norm_ddmm(d) IS NULL THEN NULL
    ELSE to_date('2026-' || split_part(public.norm_ddmm(d),'/',2) || '-' || split_part(public.norm_ddmm(d),'/',1), 'YYYY-MM-DD')
  END
$$;

-- Backfill: tudo que já aconteceu (data <= hoje) nasce publicado
UPDATE escala_geral              SET escala_publicada = TRUE WHERE public.ddmm_para_date(data) <= CURRENT_DATE;
UPDATE brasileirao_jogos         SET escala_publicada = TRUE WHERE public.ddmm_para_date(data) <= CURRENT_DATE;
UPDATE paulistao_feminino_jogos  SET escala_publicada = TRUE WHERE public.ddmm_para_date(data) <= CURRENT_DATE;
UPDATE perifericos_brasileirao   SET escala_publicada = TRUE WHERE public.ddmm_para_date(data) <= CURRENT_DATE;
UPDATE perifericos_paulistao     SET escala_publicada = TRUE WHERE public.ddmm_para_date(data) <= CURRENT_DATE;

-- RPC do prestador: filtra escala_publicada em TODAS as origens
CREATE OR REPLACE FUNCTION public.escala_do_prestador(tok UUID)
RETURNS TABLE (
  origem TEXT, jogo_ref TEXT, campeonato TEXT, fase_rodada TEXT,
  data TEXT, dia TEXT, horario TEXT, cidade TEXT, estadio TEXT,
  mandante TEXT, visitante TEXT, funcao TEXT, obs TEXT,
  conf_status TEXT, conf_obs TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE l prestador_links%ROWTYPE;
BEGIN
  SELECT * INTO l FROM prestador_links p WHERE p.token = tok AND p.ativo;
  IF NOT FOUND THEN RETURN; END IF;

  IF l.tipo = 'pessoa' THEN
    RETURN QUERY
    SELECT 'escala_geral'::TEXT, eg.id::TEXT, eg.campeonato, eg.fase_rodada,
           eg.data, eg.dia, eg.horario, eg.cidade, eg.estadio,
           eg.mandante, eg.visitante, f.rotulo, eg.obs,
           c.status, c.obs
    FROM escala_geral eg
    CROSS JOIN LATERAL (VALUES
      ('Coordenador UM', eg.coordenador_um),
      ('Produtor UM',    eg.produtor_um),
      ('Produtor Campo', eg.produtor_campo),
      ('Monitoração',    eg.monitoracao)
    ) f(rotulo, valor)
    LEFT JOIN escala_confirmacoes c
      ON c.link_id = l.id AND c.origem = 'escala_geral'
     AND c.jogo_ref = eg.id::TEXT AND c.funcao = f.rotulo
    WHERE eg.escala_publicada
      AND f.valor IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(string_to_array(f.valor, '/')) p
                  WHERE lower(btrim(p)) = lower(btrim(l.nome)));
  ELSE
    RETURN QUERY
    SELECT 'brasileirao_jogos'::TEXT, b.id::TEXT, 'Brasileirão 26'::TEXT, b.eu,
           b.data, b.dia, b.hora_brt, b.cidade, b.estadio, b.mandante, b.visitante,
           f.rotulo, NULL::TEXT, c.status, c.obs
    FROM brasileirao_jogos b
    CROSS JOIN LATERAL (VALUES
      ('UM', b.um), ('SNG Premiere', b.sng_premiere), ('SNG Host', b.sng_host),
      ('Gerador', b.gerador), ('Teleporto', b.teleporto)
    ) f(rotulo, valor)
    LEFT JOIN escala_confirmacoes c
      ON c.link_id = l.id AND c.origem = 'brasileirao_jogos'
     AND c.jogo_ref = b.id::TEXT AND c.funcao = f.rotulo
    WHERE b.escala_publicada
      AND f.valor IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(string_to_array(f.valor, '/')) p
                  WHERE lower(btrim(p)) = lower(btrim(l.nome)));

    RETURN QUERY
    SELECT 'paulistao_feminino_jogos'::TEXT, pf.id::TEXT, 'Paulistão F 26'::TEXT, pf.rod,
           pf.data, pf.dia, pf.hora_brt, pf.cidade, pf.estadio, pf.mandante, pf.visitante,
           f.rotulo, NULL::TEXT, c.status, c.obs
    FROM paulistao_feminino_jogos pf
    CROSS JOIN LATERAL (VALUES
      ('UM', pf.um), ('Gerador', pf.gerador), ('Teleporto', pf.teleporto)
    ) f(rotulo, valor)
    LEFT JOIN escala_confirmacoes c
      ON c.link_id = l.id AND c.origem = 'paulistao_feminino_jogos'
     AND c.jogo_ref = pf.id::TEXT AND c.funcao = f.rotulo
    WHERE pf.escala_publicada
      AND f.valor IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(string_to_array(f.valor, '/')) p
                  WHERE lower(btrim(p)) = lower(btrim(l.nome)));

    RETURN QUERY
    SELECT 'perifericos_brasileirao'::TEXT, pb.id::TEXT, 'Brasileirão 26 · Periféricos'::TEXT, pb.rod,
           pb.data, pb.dia, pb.hora_brt, pb.cidade, pb.estadio, pb.mandante, pb.visitante,
           f.rotulo, NULL::TEXT, c.status, c.obs
    FROM perifericos_brasileirao pb
    CROSS JOIN LATERAL (VALUES
      ('Drone', pb.fornecedor_drone), ('MiniDrone', pb.fornecedor_minidrone),
      ('DSLR', pb.fornecedor_dslr), ('Grua', pb.fornecedor_grua),
      ('GoalCam', pb.fornecedor_goalcam), ('Trilho', pb.fornecedor_trilho),
      ('Carrinho', pb.fornecedor_carrinho), ('ClipCam', pb.fornecedor_clipcam)
    ) f(rotulo, valor)
    LEFT JOIN escala_confirmacoes c
      ON c.link_id = l.id AND c.origem = 'perifericos_brasileirao'
     AND c.jogo_ref = pb.id::TEXT AND c.funcao = f.rotulo
    WHERE pb.escala_publicada
      AND f.valor IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(string_to_array(f.valor, '/')) p
                  WHERE lower(btrim(p)) = lower(btrim(l.nome)));

    RETURN QUERY
    SELECT 'perifericos_paulistao'::TEXT, pp.id::TEXT, 'Paulistão F 26 · Periféricos'::TEXT, pp.rod,
           pp.data, pp.dia, pp.hora_brt, pp.cidade, pp.estadio, pp.mandante, pp.visitante,
           f.rotulo, NULL::TEXT, c.status, c.obs
    FROM perifericos_paulistao pp
    CROSS JOIN LATERAL (VALUES
      ('Drone', pp.fornecedor_drone), ('MiniDrone', pp.fornecedor_minidrone),
      ('DSLR', pp.fornecedor_dslr), ('Grua', pp.fornecedor_grua),
      ('GoalCam', pp.fornecedor_goalcam), ('Trilho', pp.fornecedor_trilho),
      ('Carrinho', pp.fornecedor_carrinho), ('ClipCam', pp.fornecedor_clipcam)
    ) f(rotulo, valor)
    LEFT JOIN escala_confirmacoes c
      ON c.link_id = l.id AND c.origem = 'perifericos_paulistao'
     AND c.jogo_ref = pp.id::TEXT AND c.funcao = f.rotulo
    WHERE pp.escala_publicada
      AND f.valor IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(string_to_array(f.valor, '/')) p
                  WHERE lower(btrim(p)) = lower(btrim(l.nome)));
  END IF;
END $$;

-- Placar do backfill (aparece no Results)
SELECT 'escala_geral' AS tabela, count(*) FILTER (WHERE escala_publicada) AS publicados, count(*) AS total FROM escala_geral
UNION ALL
SELECT 'brasileirao_jogos', count(*) FILTER (WHERE escala_publicada), count(*) FROM brasileirao_jogos
UNION ALL
SELECT 'paulistao_feminino_jogos', count(*) FILTER (WHERE escala_publicada), count(*) FROM paulistao_feminino_jogos;
