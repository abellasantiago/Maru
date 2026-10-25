/* Sin dependencias: también funciona en CI antes de instalar sharp. */
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));

async function verificar(carpeta) {
  let cantidad = 0;
  for (const archivo of await readdir(carpeta, { withFileTypes: true })) {
    const ruta = join(carpeta, archivo.name);
    if (archivo.isDirectory()) cantidad += await verificar(ruta);
    else if (/\.(m?js)$/.test(archivo.name)) {
      const resultado = spawnSync(process.execPath, ['--check', ruta], { encoding: 'utf8' });
      if (resultado.error || resultado.status !== 0) {
        console.error(resultado.stderr || resultado.error?.message);
        process.exitCode = 1;
      }
      cantidad++;
    }
  }
  return cantidad;
}

let total = 0;
for (const carpeta of ['js', 'herramientas', 'tests']) total += await verificar(join(raiz, carpeta));
if (!process.exitCode) console.log(`Sintaxis válida en ${total} archivos JavaScript.`);
