/* ═══════════════════════════════════════════════════════════════
   Optimizador de fotos de las cards (no forma parte del sitio).

   Convierte cada assets/fotos/Momento-NN.jpg a WebP:
   ▸ redimensiona al lado más largo = 1600px (sin agrandar las chicas),
     que es 2× el tamaño físico de una card en pantalla grande/HiDPI
     → nítida sin desperdiciar peso.
   ▸ calidad 82: prácticamente indistinguible del original a ~⅓ del peso.
   ▸ .rotate() hornea la orientación EXIF (las fotos del celu vienen
     rotadas por metadato; al pasar a WebP sin esto saldrían de costado).
   ▸ NO recorta: mantiene la proporción original. El encuadre 5:4 de la
     card lo sigue haciendo object-fit:cover en vivo. Si querés controlar
     qué se recorta, recortá la foto a mano a ~5:4 ANTES de correr esto.

   Uso (desde la raíz del proyecto):
     npm install sharp          (una sola vez)
     node herramientas/optimizar-fotos.mjs

   Deja los .webp junto a los .jpg. Después hay que apuntar las cards a
   .webp: en js/hero/momentos.js cambiar la extensión '.jpg' → '.webp'
   (o pedímelo y lo hago yo).
   ═══════════════════════════════════════════════════════════════ */

import { readdir, stat } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = join(RAIZ, 'assets', 'fotos');
const LADO_MAX = 1600;
const CALIDAD = 82;

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('\n  Falta la librería "sharp". Instalala con:\n    npm install sharp\n');
  process.exit(1);
}

const kb = (n) => Math.round(n / 1024);

const archivos = (await readdir(CARPETA))
  .filter((f) => extname(f).toLowerCase() === '.jpg')
  .sort();

if (archivos.length === 0) {
  console.log('No encontré .jpg en', CARPETA);
  process.exit(0);
}

console.log(`Optimizando ${archivos.length} fotos → WebP (máx ${LADO_MAX}px, calidad ${CALIDAD})\n`);

let totalAntes = 0, totalDespues = 0;

for (const nombre of archivos) {
  const origen = join(CARPETA, nombre);
  const destino = join(CARPETA, basename(nombre, extname(nombre)) + '.webp');
  try {
    const antes = (await stat(origen)).size;
    const info = await sharp(origen)
      .rotate()                                   // hornea orientación EXIF
      .resize(LADO_MAX, LADO_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: CALIDAD })
      .toFile(destino);
    const despues = info.size;
    totalAntes += antes;
    totalDespues += despues;
    const pct = Math.round((1 - despues / antes) * 100);
    console.log(
      `  ${nombre.padEnd(16)} ${String(kb(antes)).padStart(4)}KB → ` +
      `${String(kb(despues)).padStart(4)}KB  (${info.width}×${info.height}, −${pct}%)`
    );
  } catch (e) {
    console.error(`  ${nombre.padEnd(16)} ERROR: ${e.message}`);
  }
}

console.log(
  `\nTotal: ${kb(totalAntes)}KB → ${kb(totalDespues)}KB ` +
  `(−${Math.round((1 - totalDespues / totalAntes) * 100)}%)`
);
console.log('\nListo. Ahora apuntá las cards a .webp en js/hero/momentos.js (extensión .jpg → .webp).');
