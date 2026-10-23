/* Búsqueda de recuerdos: combina título, fecha, descripción y claves sin
   depender de tildes, signos ni espacios en nombres como Key Mood. */
export function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buscarMomentos(momentos, consulta) {
  const buscado = normalizar(consulta);
  if (!buscado) return [];
  const palabras = buscado.split(' ');
  const compacto = buscado.replace(/ /g, '');

  return momentos.flatMap((momento, indice) => {
    const titulo = normalizar(momento.titulo);
    const fecha = normalizar(momento.fecha);
    const descripcion = normalizar(momento.desc || '');
    const claves = normalizar((momento.claves || []).join(' '));
    const campos = [titulo, fecha, descripcion, claves];
    if (!palabras.every((palabra) => campos.some((campo) =>
      campo.includes(palabra) || campo.replace(/ /g, '').includes(palabra)))) return [];

    let puntuacion = 0;
    if (titulo === buscado || titulo.replace(/ /g, '') === compacto) puntuacion += 100;
    else if (titulo.startsWith(buscado)) puntuacion += 70;
    else if (titulo.includes(buscado)) puntuacion += 45;
    for (const palabra of palabras) {
      if (titulo.split(' ').some((parte) => parte.startsWith(palabra))) puntuacion += 12;
      else if (titulo.includes(palabra)) puntuacion += 8;
      else if (claves.includes(palabra)) puntuacion += 6;
      else if (fecha.includes(palabra)) puntuacion += 4;
      else puntuacion += 1;
    }
    return [{ indice, momento, puntuacion }];
  }).sort((a, b) => b.puntuacion - a.puntuacion || a.indice - b.indice);
}
