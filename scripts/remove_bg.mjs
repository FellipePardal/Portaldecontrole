// Remove fundo branco/quase-branco de uma imagem e salva como PNG transparente.
// Uso: node scripts/remove_bg.mjs <input> <output.png> [threshold]

import { Jimp } from 'jimp'
import { readFileSync } from 'node:fs'

const [, , input, output, thrArg] = process.argv
if (!input || !output) {
  console.error('Uso: node remove_bg.mjs <input> <output.png> [threshold=240]')
  process.exit(1)
}
const threshold = parseInt(thrArg) || 240

const buf = readFileSync(input)
const img = await Jimp.read(buf)
const { width, height } = img.bitmap

img.scan(0, 0, width, height, (x, y, idx) => {
  const r = img.bitmap.data[idx]
  const g = img.bitmap.data[idx + 1]
  const b = img.bitmap.data[idx + 2]
  if (r >= threshold && g >= threshold && b >= threshold) {
    img.bitmap.data[idx + 3] = 0
  }
})

await img.write(output)
console.log(`✓ ${output}`)
