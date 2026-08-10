-- ============================================================
-- Feed de atividades — "quem alterou o quê", estilo Sheets/Docs
-- Gatilhos nas tabelas principais gravam cada INSERT/UPDATE/
-- DELETE com autor (auth.uid → portal_profiles/auth.users),
-- rótulo do jogo e campos alterados. Presence (quem está online)
-- não precisa de SQL — é canal de realtime puro.
-- ============================================================

CREATE TABLE IF NOT EXISTS portal_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario TEXT,
  acao TEXT NOT NULL,            -- criou | editou | excluiu
  tabela TEXT NOT NULL,
  rotulo TEXT,                   -- "Mandante x Visitante" (ou nome do link)
  campos TEXT[],                 -- colunas alteradas (updates)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_atividades_data ON portal_atividades(created_at DESC);

ALTER TABLE portal_atividades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "atv_select" ON portal_atividades;
CREATE POLICY "atv_select" ON portal_atividades FOR SELECT TO authenticated USING (true);
-- (sem policy de INSERT — só o gatilho SECURITY DEFINER escreve)

CREATE OR REPLACE FUNCTION public.log_atividade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  quem TEXT;
  j JSONB := to_jsonb(COALESCE(NEW, OLD));
  rot TEXT;
  mudados TEXT[];
BEGIN
  IF uid IS NULL THEN
    quem := CASE WHEN TG_TABLE_NAME = 'escala_confirmacoes' THEN 'Prestador (link externo)' ELSE 'Sistema' END;
  ELSE
    SELECT COALESCE(NULLIF(nome, ''), email) INTO quem FROM portal_profiles WHERE id = uid;
    IF quem IS NULL THEN SELECT email INTO quem FROM auth.users WHERE id = uid; END IF;
  END IF;

  rot := COALESCE(
    j->>'jogo_label',
    NULLIF(CONCAT(j->>'mandante', ' x ', j->>'visitante'), ' x '),
    j->>'nome'
  );

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(n.key), '{}') INTO mudados
    FROM jsonb_each_text(to_jsonb(NEW)) n
    LEFT JOIN jsonb_each_text(to_jsonb(OLD)) o ON o.key = n.key
    WHERE o.value IS DISTINCT FROM n.value
      AND n.key NOT IN ('updated_at', 'created_at');
    IF mudados = '{}' THEN RETURN NULL; END IF; -- update sem mudança real não polui o feed
  END IF;

  INSERT INTO portal_atividades (usuario, acao, tabela, rotulo, campos)
  VALUES (
    quem,
    CASE TG_OP WHEN 'INSERT' THEN 'criou' WHEN 'UPDATE' THEN 'editou' ELSE 'excluiu' END,
    TG_TABLE_NAME, rot, mudados
  );
  -- Retenção: ~2% das gravações limpam o que passou de 60 dias (barato com o índice)
  IF random() < 0.02 THEN
    DELETE FROM portal_atividades WHERE created_at < NOW() - INTERVAL '60 days';
  END IF;
  RETURN NULL;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brasileirao_jogos','perifericos_brasileirao',
    'paulistao_feminino_jogos','perifericos_paulistao',
    'escala_geral','escala_confirmacoes','prestador_links'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_log_atividade ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_log_atividade AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_atividade()', t);
  END LOOP;
END $$;

ALTER TABLE portal_atividades REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname='supabase_realtime' AND tablename='portal_atividades') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE portal_atividades;
  END IF;
END $$;
