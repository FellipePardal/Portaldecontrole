-- ============================================================
-- Escala Geral — todos os campeonatos numa aba só
-- Funções controladas: Coordenador UM, Produtor UM, Produtor de
-- Campo e Monitoração (com o valor $ do coordenador e do produtor).
-- Fonte inicial: "Planejamento HB LiveMode - Escala 2026" (CSV),
-- importada por scripts/importar_escala_geral.mjs.
-- ============================================================
-- ⚠ Rode o supabase_seguranca.sql DEPOIS deste arquivo — é ele que
-- cria as policies de escala_geral. Ver ORDEM_DE_EXECUCAO.md.
--
-- Até 09/2026 a linha abaixo era "DISABLE ROW LEVEL SECURITY", e
-- re-rodar este arquivo em produção destrancava a escala inteira
-- (nomes e valores $) para qualquer um com a chave anon.
-- ============================================================

CREATE TABLE IF NOT EXISTS escala_geral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campeonato TEXT,
  fase_rodada TEXT,
  dia TEXT,
  data TEXT,
  horario TEXT,
  cidade TEXT,
  estadio TEXT,
  mandante TEXT,
  visitante TEXT,
  transmissao TEXT,
  coordenador_um TEXT,
  coordenador_um_valor TEXT,
  produtor_um TEXT,
  produtor_um_valor TEXT,
  produtor_campo TEXT,
  monitoracao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escala_geral_camp ON escala_geral(campeonato);
CREATE INDEX IF NOT EXISTS idx_escala_geral_data ON escala_geral(data);

ALTER TABLE escala_geral ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_geral REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE escala_geral;
