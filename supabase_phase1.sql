-- ============================================================
-- Portal de Controle - FASE 1
-- Schema dinâmico: competições, colunas e eventos via JSONB
-- ============================================================
-- IMPORTANTE: este script NÃO altera as tabelas físicas existentes
-- (brasileirao_jogos, perifericos_brasileirao, paulistao_feminino_jogos,
-- perifericos_paulistao, nba_prime_video). Elas continuam funcionando
-- como "legacy" e ficam acessíveis pelo código antigo.
-- ============================================================

-- ============================================================
-- 1) competitions
--    Registry central de campeonatos (legacy + novos)
-- ============================================================
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  accent_color TEXT NOT NULL DEFAULT '#22c55e',
  accent_bg TEXT,
  -- 'legacy_*' aponta para uma tabela física existente.
  -- 'dynamic' significa que os dados ficam em competition_events (JSONB).
  template_key TEXT NOT NULL DEFAULT 'dynamic',
  -- Para legacy: nome da tabela física. Para dynamic: NULL.
  legacy_table TEXT,
  -- Define se essa competição tem aba "Periférico" como sub-seção.
  parent_competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
  section_kind TEXT NOT NULL DEFAULT 'controle', -- 'controle' | 'periferico'
  sort_order INT NOT NULL DEFAULT 100,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE competitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE competitions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE competitions;

CREATE INDEX IF NOT EXISTS idx_competitions_parent ON competitions(parent_competition_id);
CREATE INDEX IF NOT EXISTS idx_competitions_sort ON competitions(sort_order);

-- ============================================================
-- 2) competition_columns
--    Schema dinâmico por competição (substitui src/config/tables.js)
-- ============================================================
CREATE TABLE IF NOT EXISTS competition_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'select' | 'url'
  options JSONB DEFAULT '[]'::jsonb,  -- array de strings (ou ref a dropdown_options.category)
  options_category TEXT,              -- se preenchido, lê opções dinamicamente de dropdown_options
  width INT NOT NULL DEFAULT 120,
  col_group TEXT,
  sticky BOOLEAN NOT NULL DEFAULT FALSE,
  status_color BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (competition_id, key)
);

ALTER TABLE competition_columns DISABLE ROW LEVEL SECURITY;
ALTER TABLE competition_columns REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE competition_columns;

CREATE INDEX IF NOT EXISTS idx_competition_columns_comp ON competition_columns(competition_id, sort_order);

-- ============================================================
-- 3) competition_events
--    Linhas (jogos) das competições dinâmicas — JSONB flexível
-- ============================================================
CREATE TABLE IF NOT EXISTS competition_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE competition_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE competition_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE competition_events;

CREATE INDEX IF NOT EXISTS idx_competition_events_comp ON competition_events(competition_id, created_at);
CREATE INDEX IF NOT EXISTS idx_competition_events_status ON competition_events(status);

-- ============================================================
-- 4) dropdown_options
--    Listas globais (estádios, supervisores, UMs etc.)
--    Substitui os arrays hardcoded em tables.js
-- ============================================================
CREATE TABLE IF NOT EXISTS dropdown_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,        -- 'estadios' | 'supervisores' | 'ums' | 'detentores' | etc.
  value TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, value)
);

ALTER TABLE dropdown_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE dropdown_options REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE dropdown_options;

CREATE INDEX IF NOT EXISTS idx_dropdown_options_cat ON dropdown_options(category, sort_order);

-- ============================================================
-- 5) SEED — competições legacy (Brasileirão, Paulistão Fem.)
-- ============================================================
INSERT INTO competitions (slug, label, accent_color, accent_bg, template_key, legacy_table, section_kind, sort_order)
VALUES
  ('brasileirao',   'Brasileirão 26',    '#65B32E', '#0d1a06', 'legacy_brasileirao',  'brasileirao_jogos',         'controle', 10),
  ('paulistao-fem', 'Paulistão Fem. 26', '#ec4899', '#1a0a14', 'legacy_paulistao_fem', 'paulistao_feminino_jogos', 'controle', 20)
ON CONFLICT (slug) DO NOTHING;

-- Para remover NBA do banco já existente, execute no Supabase:
-- UPDATE competitions SET archived = true WHERE slug = 'nba-prime';

-- Subseções "Periférico" para Brasileirão e Paulistão Fem.
INSERT INTO competitions (slug, label, accent_color, accent_bg, template_key, legacy_table, section_kind, sort_order, parent_competition_id)
SELECT 'periferico-br', 'Periférico BR26', '#4d8922', '#0a1505', 'legacy_periferico_br', 'perifericos_brasileirao', 'periferico', 11,
       (SELECT id FROM competitions WHERE slug = 'brasileirao')
WHERE NOT EXISTS (SELECT 1 FROM competitions WHERE slug = 'periferico-br');

INSERT INTO competitions (slug, label, accent_color, accent_bg, template_key, legacy_table, section_kind, sort_order, parent_competition_id)
SELECT 'periferico-pf', 'Periférico PF26', '#be185d', '#500724', 'legacy_periferico_pf', 'perifericos_paulistao', 'periferico', 21,
       (SELECT id FROM competitions WHERE slug = 'paulistao-fem')
WHERE NOT EXISTS (SELECT 1 FROM competitions WHERE slug = 'periferico-pf');

-- ============================================================
-- 6) SEED — dropdown_options a partir das listas atuais
-- ============================================================
INSERT INTO dropdown_options (category, value, sort_order) VALUES
  ('estadios', 'Maracanã', 10),
  ('estadios', 'Nilton Santos', 20),
  ('estadios', 'São Januário', 30),
  ('estadios', 'Beira Rio', 40),
  ('estadios', 'Neo Química Arena', 50),
  ('estadios', 'Arena da Baixada', 60),
  ('estadios', 'Couto Pereira', 70),
  ('estadios', 'Mineirão', 80),
  ('estadios', 'Arena Condá', 90),
  ('estadios', 'Campos Maia', 100),
  ('estadios', 'Allianz Parque', 110),
  ('estadios', 'Arena MRV', 120),
  ('estadios', 'Castelão', 130),
  ('estadios', 'Ligga Arena', 140),
  ('estadios', 'Mané Garrincha', 150),
  ('padroes', 'B1', 10),
  ('padroes', 'B2', 20),
  ('detentores', 'CazeTV/Record', 10),
  ('detentores', 'AmazonPrime', 20),
  ('detentores', 'Globo', 30),
  ('detentores', 'SporTV', 40),
  ('detentores', 'Band', 50),
  ('detentores', 'DAZN', 60),
  ('ums', 'Multvideo', 10),
  ('ums', 'PW Video', 20),
  ('ums', 'CromaMix', 30),
  ('ums', 'TVClube', 40),
  ('ums', 'Kapta Filmes', 50),
  ('ums', 'Conecta', 60),
  ('sng', 'Conecta', 10),
  ('sng', 'Cromamix', 20),
  ('sng', 'Mineiro', 30),
  ('sng', 'PW', 40),
  ('sng', 'LocLine', 50),
  ('sng', 'No Break', 60),
  ('sng', 'Kiyoshi', 70),
  ('sng', 'Estrutura Globo', 80),
  ('supervisores', 'Rafael Gusmão / 21 98038-6887', 10),
  ('supervisores', 'Anderson Fernandes / 71 8805-2446', 20),
  ('supervisores', 'Julio Fornazari / 11 98433-9323', 30),
  ('supervisores', 'Alexandre Dumas / 11 94166-8766', 40),
  ('supervisores', 'Paulo Brito Jr / 11 94041-2580', 50),
  ('supervisores', 'Lucas Rodrigues', 60),
  ('supervisores', 'Flavio Brandão', 70),
  ('supervisores', 'Ricardo Milsoni', 80),
  ('supervisores', 'Paulo Brito', 90),
  ('dtv', 'Marquinhos', 10),
  ('dtv', 'Carlão', 20),
  ('dtv', 'Verdes Mares', 30),
  ('op_vmix', 'Guilherme Sanches', 10),
  ('op_vmix', 'Adalberto Godoy', 20),
  ('op_vmix', 'Pedro Souza', 30),
  ('op_vmix', 'Helamã Hyrum', 40),
  ('op_audio', 'Op. da Produtora', 10),
  ('op_audio', 'Fabricio', 20),
  ('op_audio', 'Cavalheiro', 30),
  ('teleporto', 'LM Assunção', 10),
  ('satelite', 'Amz3', 10),
  ('satelite', 'SES-6', 20),
  ('satelite', 'Star One C2', 30),
  ('satelite', 'Intelsat', 40),
  ('status', 'Confirmado', 10),
  ('status', 'Reservado', 20),
  ('status', 'Pendente', 30),
  ('status', 'Cancelado', 40),
  ('status', 'Em andamento', 50),
  ('status', 'Aguardando', 60),
  ('status', 'Alteração', 70),
  ('dias', 'Segunda', 10),
  ('dias', 'Terça', 20),
  ('dias', 'Quarta', 30),
  ('dias', 'Quinta', 40),
  ('dias', 'Sexta', 50),
  ('dias', 'Sábado', 60),
  ('dias', 'Domingo', 70)
ON CONFLICT (category, value) DO NOTHING;

-- ============================================================
-- 7) Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS competitions_set_updated_at ON competitions;
CREATE TRIGGER competitions_set_updated_at
  BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS competition_events_set_updated_at ON competition_events;
CREATE TRIGGER competition_events_set_updated_at
  BEFORE UPDATE ON competition_events
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
