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

   ▸ Para reemplazar/rotar una foto: pisá el archivo assets/fotos/Momento-NN.webp

   ▸ ENCUADRE: la card recorta la foto con object-fit:cover (5:4). Si el
     sujeto queda descentrado, ajustá `encuadre` de esa línea — son las
     mismas dos coordenadas de CSS object-position: 'horizontal vertical'
     en % (0% 0% = esquina superior izquierda, 100% 100% = inferior
     derecha). Por defecto '50% 50%' (centrado). Para subir el encuadre
     (mostrar más de la parte de ARRIBA de la foto) bajá el segundo
     número, ej. '50% 20%'; para bajarlo, subilo, ej. '50% 80%'.
   ═══════════════════════════════════════════════════════════════ */

/* ── Contenido de cada momento (en orden de recorrido) ──
   Una línea por foto. Completá titulo y fecha; el resto se arma solo. */
const DATOS = [
  { titulo: 'Colonia', fecha: '6 de abril 2025', encuadre: '50% 60%', desc: 'Primera vez que estuvimos, noche mágica para toda la vida' },   // 01 → Momento-01.jpg
  //{ titulo: 'Posada del Mar', fecha: '25 de agosto 2025', encuadre: '50% 50%', desc: 'After de Key Conference' },   // 02 → Momento-02.jpg
  { titulo: 'Lo de Tata', fecha: '25 de agosto de 2025', encuadre: '50% 31%', desc: 'Fuimos a lo de Tata después del after de Key Conference' },   // 03 → Momento-03.jpg
  { titulo: 'Chivipizza', fecha: '29 de agosto 2025', encuadre: '50% 40%', desc: 'Nuestra primera salida a cenar' },   // 04 → Momento-04.jpg
  { titulo: 'Finde en Punta del Este', fecha: '5 de setiembre de 2025', encuadre: '50% 30%', desc: 'Hicimos una escapada de fin de semana a Punta, fue increíble' },   // 05 → Momento-05.jpg
  { titulo: 'Nos chocaron', fecha: '13 de setiembre de 2025', encuadre: '50% 55%', desc: 'Una moto nos chocó, primer momento tenso juntos' },   // 06 → Momento-06.jpg
  { titulo: 'Mejor día de mi vida', fecha: '20 de setiembre de 2025', encuadre: '50% 35%', destacado: true, desc: 'Alquilamos un apto por el finde, ese sábado nos pusimos de novios' },   // 07 → Momento-07.jpg
  { titulo: 'Dilema', fecha: '23 de setiembre de 2025', encuadre: '50% 15%', desc: '' },   // 08 → Momento-08.jpg
  { titulo: 'Kilombito, Punta del Este', fecha: '10 de octubre de 2025', encuadre: '50% 55%', desc: 'Finde en lo del Boli, ese viernes fuimos a Kilombito con los monos' },   // 09 → Momento-09.jpg
  { titulo: 'Hockey de las pibas', fecha: '19 de octubre de 2025', encuadre: '50% 50%', desc: 'Fuimos a la semifinal de Old Girls, ahi conocí a algunas monas' },   // 10 → Momento-10.jpg  (foto horizontal)
  { titulo: 'Bautismo de Apon', fecha: '25 de octubre de 2025', encuadre: '50% 45%', desc: 'Bautismo de Apon, no conocia a casi nadie de la familia y le prendí la vela a Sturla' },   // 11 → Momento-11.jpg
  { titulo: 'Escapada al campo', fecha: '31 de octubre de 2025', encuadre: '50% 65%', desc: 'Nos fuimos un finde para el campo solos, recorrimos, caminamos, bailamos y cantamos, Maru se mamó y vomitó' },   // 12 → Momento-12.jpg
  { titulo: 'Exit', fecha: '8 de Noviembre de 2025', encuadre: '50% 70%', desc: 'Fuimos a la Exit con los monos' },   // 13 → Momento-13.jpg
  { titulo: 'Airbnb para el finde y Keymood', fecha: '14 de noviembre de 2025', encuadre: '50% 70%', desc: 'Alquilamos un apto por el finde, ese sábado fuimos a Key Mood' },   // 14 → Momento-14.jpg
  { titulo: 'Vela', fecha: '20 de noviembre de 2025', encuadre: '50% 30%', desc: '2 meses de novios' },   // 15 → Momento-15.jpg
  { titulo: 'Manzanar', fecha: '19 de Diciembre de 2025', encuadre: '50% 35%', desc: '4 meses de novios' },   // 16 → Momento-16.jpg
  { titulo: 'Interno', fecha: '19 de Diciembre de 2025', encuadre: '50% 45%', desc: 'Noche final del interno del British' },   // 17 → Momento-17.jpg 
  { titulo: 'Las Toscas', fecha: '25 de diciembre de 2025', encuadre: '50% 30%', desc: 'Pasamos el día con mi familia en Las Toscas' },   // 18 → Momento-18.jpg
  { titulo: 'Cumple de Mili Batlle', fecha: '28 de diciembre de 2025', encuadre: '50% 40%', desc: 'Cumple de Mili y previa en Manantiales' },   // 19 → Momento-19.jpg
  { titulo: 'Key Mood, Punta del Este', fecha: '28 de diciembre de 2025', encuadre: '50% 64%', desc: 'Fuimos a Key Mood en Punta mano a mano' },   // 20 → Momento-20.jpg
  { titulo: 'Playa con Tata e Isa Mautone', fecha: '30 de diciembre de 2025', encuadre: '50% 65%', desc: '' },   // 21 → Momento-21.jpg
  { titulo: 'Collage', fecha: '31 de diciembre de 2025', encuadre: '50% 80%', desc: 'Empezamos el año juntos' },   // 22 → Momento-22.jpg
  { titulo: 'Adriatique', fecha: '4 de enero de 2026', encuadre: '50% 55%', desc: 'Fiesta en el MACA' },   // 23 → Momento-23.jpg
  { titulo: 'Café misterio', fecha: '20 de enero de 2026', encuadre: '50% 20%', desc: '4 meses de novios' },   // 24 → Momento-24.jpg
  { titulo: 'Familia Massei, mi cumple', fecha: '25 de enero de 2026', encuadre: '50% 30%', desc: 'Fuimos a cenar por mi cumple' },   // 25 → Momento-25.jpg
  { titulo: 'Kilombito con los monos', fecha: '30 de enero de 2026', encuadre: '50% 40%', desc: '' },   // 26 → Momento-26.jpg
  { titulo: 'La Pedrera con tu familia', fecha: '13 de febrero de 2026', encuadre: '50% 75%', desc: 'Los padres de Maru alquilaron carnaval en la Pedrera y me invitaron' },   // 27 → Momento-27.jpg
  { titulo: 'Casamiento de Clari', fecha: '28 de febrero de 2026', encuadre: '50% 45%', desc: '' },   // 28 → Momento-28.jpg  (foto horizontal)
  { titulo: 'Domos en la Sierra de las Ánimas', fecha: '13 de marzo de 2026', encuadre: '50% 62%', desc: 'Alquilamos unos domos para pasar el finde, hicimos trekking y entrañitas con choclo' },   // 29 → Momento-29.jpg
  { titulo: 'Semana Santa en el campo', fecha: '30 de marzo de 2026', encuadre: '50% 45%', desc: 'Tradición de los Symonds pasar Semana Santa en el campo, planazo' },   // 30 → Momento-30.jpg
  { titulo: 'Apto de Viole en Punta', fecha: '15 de mayo de 2026', encuadre: '50% 60%', desc: 'Viole nos prestó su apto en Punta por el finde' },   // 31 → Momento-31.jpg
  { titulo: 'Maru se fue 2 meses de viaje', fecha: '29 de mayo de 2026', encuadre: '50% 55%', desc: 'Bandoni Chanti' },   // 32 → Momento-32.jpg

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
  foto: `assets/fotos/Momento-${String(i + 1).padStart(2, '0')}.webp`,
  encuadre: d.encuadre || '50% 50%',
  ...disponer(i),
}));

/* Profundidad del último momento (la usan las partículas y las
   enredaderas para cubrir todo el largo del recorrido). */
export const PROFUNDIDAD = Z_INICIO - (MOMENTOS.length - 1) * Z_PASO;
