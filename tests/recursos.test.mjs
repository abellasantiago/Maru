import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { MOMENTOS } from '../js/hero/momentos.js';

const raiz = new URL('../', import.meta.url);

test('cada recuerdo tiene contenido y una foto WebP válida', async () => {
  const ids = new Set();
  const fotos = new Set();
  for (const momento of MOMENTOS) {
    assert.ok(momento.titulo.trim(), momento.id);
    assert.equal(typeof momento.desc, 'string', momento.id);
    assert.ok(!ids.has(momento.id), `ID repetido: ${momento.id}`);
    assert.ok(!fotos.has(momento.foto), `Foto repetida: ${momento.foto}`);
    ids.add(momento.id);
    fotos.add(momento.foto);
    const foto = await readFile(new URL(momento.foto, raiz));
    assert.equal(foto.toString('ascii', 0, 4), 'RIFF', momento.foto);
    assert.equal(foto.toString('ascii', 8, 12), 'WEBP', momento.foto);
    assert.ok(momento.posicion.every(Number.isFinite), momento.id);
    assert.ok(momento.rotacion.every(Number.isFinite), momento.id);
  }
});

test('los recursos del HTML y las fuentes existen bajo la ruta de GitHub Pages', async () => {
  for (const ruta of ['index.html', 'css/estilos.css']) {
    const documento = new URL(ruta, raiz);
    const texto = await readFile(documento, 'utf8');
    const rutas = ruta.endsWith('.html')
      ? [...texto.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
      : [...texto.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/g)]
        .map((m) => m[1] ?? m[2] ?? m[3]);
    for (const recurso of rutas.filter((r) => !/^(?:https?:|data:|#)/.test(r))) {
      assert.ok(!recurso.startsWith('/'), `Ruta absoluta incompatible con /Maru/: ${recurso}`);
      assert.ok((await stat(new URL(recurso, documento))).isFile(), recurso);
    }
  }
  assert.ok((await stat(new URL('assets/musica/beautiful-crazy.mp3', raiz))).size > 0);
});

test('todos los imports del sitio y de Three.js resuelven a archivos existentes', async () => {
  const html = await readFile(new URL('index.html', raiz), 'utf8');
  const mapa = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  async function revisar(carpeta) {
    for (const archivo of await readdir(carpeta, { withFileTypes: true })) {
      const url = new URL(archivo.name + (archivo.isDirectory() ? '/' : ''), carpeta);
      if (archivo.isDirectory()) { await revisar(url); continue; }
      if (!archivo.name.endsWith('.js')) continue;
      const texto = await readFile(url, 'utf8');
      const imports = [...texto.matchAll(/\b(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)];
      for (const [, nombre] of imports) {
        let destino;
        if (nombre.startsWith('.')) destino = new URL(nombre, url);
        else if (mapa[nombre]) destino = new URL(mapa[nombre], raiz);
        else {
          const prefijo = Object.keys(mapa).find((p) => p.endsWith('/') && nombre.startsWith(p));
          assert.ok(prefijo, `Import sin resolver: ${nombre} en ${url.pathname}`);
          destino = new URL(mapa[prefijo] + nombre.slice(prefijo.length), raiz);
        }
        assert.ok((await stat(destino)).isFile(), destino.pathname);
      }
    }
  }
  await revisar(new URL('js/', raiz));
});
