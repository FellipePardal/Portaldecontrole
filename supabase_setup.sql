-- ============================================================
-- Portal de Controle - FFU Transmissões
-- Supabase Setup SQL
-- ============================================================

-- ============================================================
-- Table 1: brasileirao_jogos
-- ============================================================
CREATE TABLE IF NOT EXISTS brasileirao_jogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eu TEXT,
  dia TEXT,
  data TEXT,
  hora_brt TEXT,
  mandante TEXT,
  visitante TEXT,
  estadio TEXT,
  cidade TEXT,
  padrao TEXT,
  detentor TEXT,
  ppv TEXT,
  um TEXT,
  nome_numero TEXT,
  sng_premiere TEXT,
  sng_host TEXT,
  gerador TEXT,
  supervisores_1 TEXT,
  liveu_1 TEXT,
  supervisores_2 TEXT,
  liveu_2 TEXT,
  dtv TEXT,
  op_vmix TEXT,
  op_audio TEXT,
  teleporto TEXT,
  satelite TEXT,
  service_start_gmt TEXT,
  abertura_brt TEXT,
  service_end_gmt TEXT,
  fechamento_brt TEXT,
  total_horas TEXT,
  banda TEXT,
  status TEXT DEFAULT 'Pendente',
  reserva TEXT,
  transponder TEXT,
  uplink TEXT,
  downlink TEXT,
  satelite_globo TEXT,
  status_g TEXT DEFAULT 'Pendente',
  reserva_g TEXT,
  transponder_g TEXT,
  uplink_g TEXT,
  downlink_g TEXT,
  aspecto TEXT,
  compressao TEXT,
  transmissao TEXT,
  modulacao TEXT,
  sr TEXT,
  fec TEXT,
  biss_code TEXT,
  ficha_jogo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brasileirao_jogos DISABLE ROW LEVEL SECURITY;
ALTER TABLE brasileirao_jogos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE brasileirao_jogos;

-- ============================================================
-- Table 2: perifericos_brasileirao
-- ============================================================
CREATE TABLE IF NOT EXISTS perifericos_brasileirao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rod TEXT,
  dia TEXT,
  data TEXT,
  hora_brt TEXT,
  mandante TEXT,
  visitante TEXT,
  estadio TEXT,
  cidade TEXT,
  padrao TEXT,
  detentor TEXT,
  credenciamento TEXT,
  drone TEXT,
  fornecedor_drone TEXT,
  minidrone TEXT,
  fornecedor_minidrone TEXT,
  dslr TEXT,
  qtde TEXT,
  fornecedor_dslr TEXT,
  grua TEXT,
  fornecedor_grua TEXT,
  goalcam TEXT,
  fornecedor_goalcam TEXT,
  trilho TEXT,
  fornecedor_trilho TEXT,
  carrinho TEXT,
  fornecedor_carrinho TEXT,
  clipcam TEXT,
  fornecedor_clipcam TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE perifericos_brasileirao DISABLE ROW LEVEL SECURITY;
ALTER TABLE perifericos_brasileirao REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE perifericos_brasileirao;

-- ============================================================
-- Table 3: paulistao_feminino_jogos
-- ============================================================
CREATE TABLE IF NOT EXISTS paulistao_feminino_jogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rod TEXT,
  dia TEXT,
  data TEXT,
  hora_brt TEXT,
  mandante TEXT,
  visitante TEXT,
  cidade TEXT,
  estadio TEXT,
  padrao TEXT,
  detentor TEXT,
  um TEXT,
  gerador TEXT,
  dslr TEXT,
  refcam TEXT,
  drone TEXT,
  minidrone TEXT,
  supervisor_um_host TEXT,
  grua TEXT,
  coordenador TEXT,
  dtv TEXT,
  op_vmix TEXT,
  teleporto TEXT,
  satelite TEXT,
  status TEXT DEFAULT 'Pendente',
  reserva TEXT,
  transponder TEXT,
  uplink TEXT,
  downlink TEXT,
  banda TEXT,
  aspecto TEXT,
  compressao TEXT,
  transmissao TEXT,
  modulacao TEXT,
  sr TEXT,
  fec TEXT,
  service_start_gmt TEXT,
  abertura_brt TEXT,
  service_end_gmt TEXT,
  fechamento_brt TEXT,
  total_horas TEXT,
  audio_1_2 TEXT,
  audio_3_4 TEXT,
  biss_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE paulistao_feminino_jogos DISABLE ROW LEVEL SECURITY;
ALTER TABLE paulistao_feminino_jogos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE paulistao_feminino_jogos;

-- ============================================================
-- Table 4: perifericos_paulistao
-- ============================================================
CREATE TABLE IF NOT EXISTS perifericos_paulistao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rod TEXT,
  dia TEXT,
  data TEXT,
  hora_brt TEXT,
  mandante TEXT,
  visitante TEXT,
  estadio TEXT,
  cidade TEXT,
  padrao TEXT,
  detentor TEXT,
  credenciamento TEXT,
  drone TEXT,
  fornecedor_drone TEXT,
  minidrone TEXT,
  fornecedor_minidrone TEXT,
  dslr TEXT,
  qtde TEXT,
  fornecedor_dslr TEXT,
  grua TEXT,
  fornecedor_grua TEXT,
  goalcam TEXT,
  fornecedor_goalcam TEXT,
  trilho TEXT,
  fornecedor_trilho TEXT,
  carrinho TEXT,
  fornecedor_carrinho TEXT,
  clipcam TEXT,
  fornecedor_clipcam TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE perifericos_paulistao DISABLE ROW LEVEL SECURITY;
ALTER TABLE perifericos_paulistao REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE perifericos_paulistao;
