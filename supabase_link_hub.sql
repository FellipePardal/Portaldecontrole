-- ============================================================
-- Linkagem Portal de Controle ↔ Hub Financeiro
-- Adiciona coluna hub_jogo_id em brasileirao_jogos e paulistao_feminino_jogos
-- ============================================================

ALTER TABLE brasileirao_jogos
  ADD COLUMN IF NOT EXISTS hub_jogo_id TEXT UNIQUE;

ALTER TABLE paulistao_feminino_jogos
  ADD COLUMN IF NOT EXISTS hub_jogo_id TEXT UNIQUE;

ALTER TABLE perifericos_brasileirao
  ADD COLUMN IF NOT EXISTS hub_jogo_id TEXT UNIQUE;

ALTER TABLE perifericos_paulistao
  ADD COLUMN IF NOT EXISTS hub_jogo_id TEXT UNIQUE;

-- Índices para upsert por hub_jogo_id
CREATE INDEX IF NOT EXISTS idx_brasileirao_hub ON brasileirao_jogos(hub_jogo_id);
CREATE INDEX IF NOT EXISTS idx_paulistao_fem_hub ON paulistao_feminino_jogos(hub_jogo_id);
CREATE INDEX IF NOT EXISTS idx_perifericos_br_hub ON perifericos_brasileirao(hub_jogo_id);
CREATE INDEX IF NOT EXISTS idx_perifericos_pf_hub ON perifericos_paulistao(hub_jogo_id);
