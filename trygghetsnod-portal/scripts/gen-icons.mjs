import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

// Trygghetsnod-logo: hus med tak, myndig-blå på paper-färgat fundament.
const logoSvg = (size, bg) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}" rx="${Math.round(size * 0.18)}"/>
  <g transform="translate(80 90)">
    <rect x="20" y="180" width="312" height="220" fill="#EDF1F6" stroke="#1E3A5F" stroke-width="18" stroke-linejoin="round"/>
    <path d="M10 190 L176 40 L342 190 Z" fill="#EDF1F6" stroke="#1E3A5F" stroke-width="18" stroke-linejoin="round"/>
    <rect x="140" y="250" width="72" height="150" fill="#FDFDFC" stroke="#1E3A5F" stroke-width="14"/>
  </g>
</svg>`

// Icon 192 & 512 (paper bakgrund — matchar portalens färg)
for (const size of [192, 512]) {
  await sharp(Buffer.from(logoSvg(size, '#FAF9F6')))
    .resize(size, size)
    .png()
    .toFile(join(OUT, `icon-${size}.png`))
}

// Maskable icon: myndig-blå full-bleed så iOS/Android kan crop:a
await sharp(Buffer.from(logoSvg(512, '#1E3A5F')))
  .resize(512, 512)
  .png()
  .toFile(join(OUT, 'icon-maskable-512.png'))

// Apple touch icon (180x180 utan transparens)
await sharp(Buffer.from(logoSvg(512, '#FAF9F6')))
  .resize(180, 180)
  .png()
  .toFile(join(OUT, 'apple-touch-icon.png'))

// Favicon (32x32)
await sharp(Buffer.from(logoSvg(512, '#FAF9F6')))
  .resize(32, 32)
  .png()
  .toFile(join(OUT, 'favicon-32.png'))

console.log('Ikoner klara i', OUT)
