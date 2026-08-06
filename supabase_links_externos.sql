-- ============================================================
-- Portal de Controle — Fases 2 e 4
--   • Links externos por prestador/fornecedor + confirmação de presença
--   • Integração Escala Geral ↔ Controle (hub_jogo_id + matcher)
-- Rodar DEPOIS do supabase_seguranca.sql.
-- ============================================================

-- ── Fase 2: links externos ───────────────────────────────────
CREATE TABLE IF NOT EXISTS prestador_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'pessoa', -- pessoa (Escala Geral) | empresa (Controle/Periféricos)
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escala_confirmacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES prestador_links(id) ON DELETE CASCADE,
  origem TEXT NOT NULL,     -- escala_geral | brasileirao_jogos | paulistao_feminino_jogos | perifericos_*
  jogo_ref TEXT NOT NULL,   -- id da linha na tabela de origem
  funcao TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmado','recusado')),
  obs TEXT,
  jogo_label TEXT,          -- snapshot p/ exibição ("Mandante x Visitante")
  jogo_data TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(link_id, origem, jogo_ref, funcao)
);

-- RLS: equipe logada lê/gerencia; anon NADA (externos só via RPC abaixo)
ALTER TABLE prestador_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_confirmacoes ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['prestador_links','escala_confirmacoes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.portal_pode_editar())', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON public.%I FOR UPDATE TO authenticated USING (public.portal_pode_editar()) WITH CHECK (public.portal_pode_editar())', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON public.%I FOR DELETE TO authenticated USING (public.portal_pode_editar())', t, t);
  END LOOP;
END $$;

-- ── RPC: escala do prestador (única porta pública, token-gated) ──────────────
-- Retorna os jogos onde o NOME do link aparece. Nunca expõe valores $.
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
    WHERE f.valor IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(string_to_array(f.valor, '/')) p
                  WHERE lower(btrim(p)) = lower(btrim(l.nome)));
  ELSE
    -- empresa: Controle BR
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
    WHERE f.valor IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(string_to_array(f.valor, '/')) p
                  WHERE lower(btrim(p)) = lower(btrim(l.nome)));

    -- empresa: Controle Paulistão F
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
    WHERE f.valor IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(string_to_array(f.valor, '/')) p
                  WHERE lower(btrim(p)) = lower(btrim(l.nome)));

    -- empresa: Periféricos BR
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
    WHERE f.valor IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(string_to_array(f.valor, '/')) p
                  WHERE lower(btrim(p)) = lower(btrim(l.nome)));

    -- empresa: Periféricos PF
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
    WHERE f.valor IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(string_to_array(f.valor, '/')) p
                  WHERE lower(btrim(p)) = lower(btrim(l.nome)));
  END IF;
END $$;

-- ── RPC: confirmar presença (valida token + posse do jogo antes de gravar) ───
CREATE OR REPLACE FUNCTION public.confirmar_presenca(
  tok UUID, p_origem TEXT, p_jogo_ref TEXT, p_funcao TEXT, p_status TEXT, p_obs TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l prestador_links%ROWTYPE; jogo RECORD;
BEGIN
  IF p_status NOT IN ('confirmado','recusado') THEN
    RAISE EXCEPTION 'status inválido';
  END IF;
  SELECT * INTO l FROM prestador_links p WHERE p.token = tok AND p.ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'link inválido ou revogado'; END IF;

  SELECT * INTO jogo FROM public.escala_do_prestador(tok) e
   WHERE e.origem = p_origem AND e.jogo_ref = p_jogo_ref AND e.funcao = p_funcao;
  IF NOT FOUND THEN RAISE EXCEPTION 'jogo/função não pertence a este link'; END IF;

  INSERT INTO escala_confirmacoes (link_id, origem, jogo_ref, funcao, status, obs, jogo_label, jogo_data, updated_at)
  VALUES (l.id, p_origem, p_jogo_ref, p_funcao, p_status, NULLIF(btrim(coalesce(p_obs,'')), ''),
          jogo.mandante || ' x ' || jogo.visitante, jogo.data, NOW())
  ON CONFLICT (link_id, origem, jogo_ref, funcao)
  DO UPDATE SET status = EXCLUDED.status, obs = EXCLUDED.obs,
                jogo_label = EXCLUDED.jogo_label, jogo_data = EXCLUDED.jogo_data, updated_at = NOW();
END $$;

REVOKE EXECUTE ON FUNCTION public.escala_do_prestador(UUID) FROM public;
REVOKE EXECUTE ON FUNCTION public.confirmar_presenca(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.escala_do_prestador(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_presenca(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Realtime das confirmações (indicadores ao vivo na Escala Geral)
ALTER TABLE escala_confirmacoes REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND tablename='escala_confirmacoes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE escala_confirmacoes;
  END IF;
END $$;

-- ── Fase 4: integração Escala Geral ↔ Controle ───────────────
ALTER TABLE escala_geral ADD COLUMN IF NOT EXISTS hub_jogo_id TEXT;
CREATE INDEX IF NOT EXISTS idx_escala_geral_hub ON escala_geral(hub_jogo_id);

-- Matcher: liga linhas da Escala Geral aos jogos do Controle pelo par
-- mandante+visitante+data (formatos dd/mm iguais nas duas pontas).
UPDATE escala_geral eg
SET hub_jogo_id = b.hub_jogo_id
FROM brasileirao_jogos b
WHERE eg.hub_jogo_id IS NULL AND b.hub_jogo_id IS NOT NULL
  AND lower(btrim(eg.mandante))  = lower(btrim(b.mandante))
  AND lower(btrim(eg.visitante)) = lower(btrim(b.visitante))
  AND btrim(eg.data) = btrim(b.data);

UPDATE escala_geral eg
SET hub_jogo_id = pf.hub_jogo_id
FROM paulistao_feminino_jogos pf
WHERE eg.hub_jogo_id IS NULL AND pf.hub_jogo_id IS NOT NULL
  AND lower(btrim(eg.mandante))  = lower(btrim(pf.mandante))
  AND lower(btrim(eg.visitante)) = lower(btrim(pf.visitante))
  AND btrim(eg.data) = btrim(pf.data);

-- Quantos ligaram (aparece no Results):
SELECT campeonato, count(*) FILTER (WHERE hub_jogo_id IS NOT NULL) AS ligados, count(*) AS total
FROM escala_geral GROUP BY campeonato ORDER BY total DESC;
