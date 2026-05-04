// Mapeia o nome do time (qualquer variação) para o arquivo do escudo em /escudos.

const norm = s => String(s || '')
  .trim()
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')

const MAP = {
  'vasco': 'vasco',
  'vasco da gama': 'vasco',
  'vitoria': 'vitoria',
  'vitória': 'vitoria',
  'athletico': 'athletico-pr',
  'athletico pr': 'athletico-pr',
  'athletico paranaense': 'athletico-pr',
  'atletico mg': 'atletico-mg',
  'atletico-mg': 'atletico-mg',
  'atlético mg': 'atletico-mg',
  'atletico mineiro': 'atletico-mg',
  'bahia': 'bahia',
  'botafogo': 'botafogo',
  'chapecoense': 'chapecoense',
  'corinthians': 'corinthians',
  'coritiba': 'coritiba',
  'cruzeiro': 'cruzeiro',
  'palmeiras': 'palmeiras',
  'bragantino': 'bragantino',
  'red bull bragantino': 'bragantino',
  'rb bragantino': 'bragantino',
  'remo': 'remo',
  'clube do remo': 'remo',
  'sao paulo': 'sao-paulo',
  'são paulo': 'sao-paulo',
  'mirassol': 'mirassol',
  'flamengo': 'flamengo',
  'fluminense': 'fluminense',
  'gremio': 'gremio',
  'grêmio': 'gremio',
  'internacional': 'internacional',
  'inter': 'internacional',
}

export function getEscudoUrl(team) {
  const key = norm(team)
  const slug = MAP[key]
  if (!slug) return null
  return `/escudos/${slug}.jpeg`
}
