/* ═══════════════════════════════════════════════════════════════
   Servidor de DESARROLLO (no forma parte del sitio).

   Sirve los archivos estáticos igual que `python -m http.server`
   y agrega un endpoint POST /__captura que guarda imágenes
   (data URL) en la carpeta indicada — lo usamos para verificar
   visualmente el hero durante el desarrollo.

   El sitio en producción NO necesita esto: cualquier servidor
   estático alcanza.
   ═══════════════════════════════════════════════════════════════ */

import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PUERTO = process.env.PORT || 8123;
const RAIZ = process.cwd();
const CARPETA_CAPTURAS = process.env.CAPTURAS || join(RAIZ, '.capturas');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

http.createServer(async (req, res) => {
  /* Endpoint de capturas del hero (solo dev) */
  if (req.method === 'POST' && req.url.startsWith('/__captura')) {
    const nombre = new URL(req.url, 'http://x').searchParams.get('nombre') || 'captura';
    let cuerpo = '';
    req.on('data', (t) => (cuerpo += t));
    req.on('end', async () => {
      try {
        const base64 = cuerpo.replace(/^data:image\/\w+;base64,/, '');
        await mkdir(CARPETA_CAPTURAS, { recursive: true });
        const ruta = join(CARPETA_CAPTURAS, nombre + '.jpg');
        await writeFile(ruta, Buffer.from(base64, 'base64'));
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(ruta);
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
    });
    return;
  }

  /* Archivos estáticos */
  try {
    const rutaLimpia = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([.][.][\\/])+/, '');
    let ruta = join(RAIZ, rutaLimpia);
    if (rutaLimpia === '/' || rutaLimpia === '\\') ruta = join(RAIZ, 'index.html');
    const datos = await readFile(ruta);
    res.writeHead(200, {
      'Content-Type': MIME[extname(ruta).toLowerCase()] || 'application/octet-stream',
      /* DESARROLLO: nunca cachear. Los módulos ES se cachean muy agresivo y,
         sin esto, el navegador sigue sirviendo la versión vieja del sitio
         (JS/CSS) aunque los archivos en disco hayan cambiado. */
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.end(datos);
  } catch {
    res.writeHead(404);
    res.end('no existe');
  }
}).listen(PUERTO, '127.0.0.1', () => {
  console.log(`dev-servidor en http://localhost:${PUERTO} (capturas → ${CARPETA_CAPTURAS})`);
});
