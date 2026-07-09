/* ═══════════════════════════════════════════════════════════════
   Momentos del timeline — ÚNICA fuente de datos de las cards.

   Hay una entrada por foto (Momento-01.jpg … Momento-31.jpg). La
   POSICIÓN 3D de cada card se calcula sola en `disponer()` a partir
   del índice, así agregar/quitar/reordenar es trivial: se edita solo
   el array DATOS.

   ▸▸▸ PARA COMPLETAR: en cada línea de DATOS, escribí el `titulo` y la
       `fecha` de esa foto entre las comillas. Ejemplo:
         { titulo: 'Nuestra primera cita', fecha: '6 de abril de 2025' },
       (Opcional) para marcar un hito especial con marco/glow dorado,
       agregá  destacado: true  a esa línea.
       (Opcional) `claves: ['playa','verano']` agrega palabras extra al
       buscador; el buscador ya usa el título y la fecha igual.

   ▸ Para reemplazar/rotar una foto: pisá el archivo assets/fotos/Momento-NN.jpg
   ═══════════════════════════════════════════════════════════════ */

/* ── Contenido de cada momento (en orden de recorrido) ──
   Una línea por foto. Completá titulo y fecha; el resto se arma solo. */
const DATOS = [
  { titulo: '', fecha: '' },   // 01 → Momento-01.jpg
  { titulo: '', fecha: '' },   // 02 → Momento-02.jpg
  { titulo: '', fecha: '' },   // 03 → Momento-03.jpg
  { titulo: '', fecha: '' },   // 04 → Momento-04.jpg
  { titulo: '', fecha: '' },   // 05 → Momento-05.jpg
  { titulo: '', fecha: '' },   // 06 → Momento-06.jpg
  { titulo: '', fecha: '' },   // 07 → Momento-07.jpg
  { titulo: '', fecha: '' },   // 08 → Momento-08.jpg
  { titulo: '', fecha: '' },   // 09 → Momento-09.jpg
  { titulo: '', fecha: '' },   // 10 → Momento-10.jpg  (foto horizontal)
  { titulo: '', fecha: '' },   // 11 → Momento-11.jpg
  { titulo: '', fecha: '' },   // 12 → Momento-12.jpg
  { titulo: '', fecha: '' },   // 13 → Momento-13.jpg
  { titulo: '', fecha: '' },   // 14 → Momento-14.jpg
  { titulo: '', fecha: '' },   // 15 → Momento-15.jpg
  { titulo: '', fecha: '' },   // 16 → Momento-16.jpg
  { titulo: '', fecha: '' },   // 17 → Momento-17.jpg  ⚠ FALTA esta foto: agregala o borrá esta línea
  { titulo: '', fecha: '' },   // 18 → Momento-18.jpg
  { titulo: '', fecha: '' },   // 19 → Momento-19.jpg
  { titulo: '', fecha: '' },   // 20 → Momento-20.jpg
  { titulo: '', fecha: '' },   // 21 → Momento-21.jpg
  { titulo: '', fecha: '' },   // 22 → Momento-22.jpg
  { titulo: '', fecha: '' },   // 23 → Momento-23.jpg
  { titulo: '', fecha: '' },   // 24 → Momento-24.jpg
  { titulo: '', fecha: '' },   // 25 → Momento-25.jpg
  { titulo: '', fecha: '' },   // 26 → Momento-26.jpg
  { titulo: '', fecha: '' },   // 27 → Momento-27.jpg
  { titulo: '', fecha: '' },   // 28 → Momento-28.jpg  (foto horizontal)
  { titulo: '', fecha: '' },   // 29 → Momento-29.jpg
  { titulo: '', fecha: '' },   // 30 → Momento-30.jpg
  { titulo: '', fecha: '' },   // 31 → Momento-31.jpg
];

/* ── Disposición 3D: parámetros del "corredor" de cards ── */
const X_CARD = 3.2;        // separación lateral respecto del eje central
const Y_AMPLITUD = 1.0;    // vaivén vertical
const Z_INICIO = -12;      // z de la primera card
const Z_PASO = 7.4;        // separación en profundidad entre cards

/* Calcula posición/rotación de la card i, alternando lados: se navegan
   una tras otra, flotando a ambos lados del eje. */
function disponer(i) {
  const lado = i % 2 === 0 ? -1 : 1;
  const x = lado * (X_CARD + Math.sin(i * 1.3) * 0.35);
  const y = Math.sin(i * 0.7) * Y_AMPLITUD + Math.cos(i * 1.9) * 0.22;
  const z = Z_INICIO - i * Z_PASO;
  /* Rotación leve: la card se angula hacia el centro (hacia la cámara) */
  const rot = [Math.sin(i * 0.5) * 0.05, -lado * 0.3, Math.sin(i * 1.1) * 0.04];
  return { posicion: [x, y, z], rotacion: rot };
}

/* Contenido genérico de PREVISUALIZACIÓN: mientras `titulo`/`fecha` estén
   vacíos en DATOS, la card muestra estos textos de ejemplo para ver cómo
   queda. Apenas cargues los tuyos, se muestran los tuyos. Para que una card
   NO tenga descripción, ponéle  desc: ''  en su línea de DATOS. */
const GENERICO = {
  titulo: 'Un momento juntos',
  fecha: '12 de enero de 2026',
  desc: 'Una tarde cualquiera que se volvió inolvidable — texto de ejemplo para ver cómo queda la card.',
};

/* Momentos finales = contenido + id + ruta de foto + disposición 3D.
   La foto se busca por índice: Momento-01.jpg, Momento-02.jpg, … */
export const MOMENTOS = DATOS.map((d, i) => ({
  id: `m${String(i + 1).padStart(2, '0')}`,
  claves: d.claves || [],
  destacado: d.destacado || false,
  titulo: (d.titulo && d.titulo.trim()) ? d.titulo : GENERICO.titulo,
  fecha: (d.fecha && d.fecha.trim()) ? d.fecha : GENERICO.fecha,
  desc: (d.desc !== undefined) ? d.desc : GENERICO.desc,
  foto: `assets/fotos/Momento-${String(i + 1).padStart(2, '0')}.jpg`,
  ...disponer(i),
}));

/* Profundidad del último momento (la usan las partículas y las
   enredaderas para cubrir todo el largo del recorrido). */
export const PROFUNDIDAD = Z_INICIO - (MOMENTOS.length - 1) * Z_PASO;
