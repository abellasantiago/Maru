/* ═══════════════════════════════════════════════════════════════
   Momentos del timeline — ÚNICA fuente de datos de las cards.

   Cada entrada de DATOS tiene el contenido (fecha, título, texto,
   claves de búsqueda, foto y si es un hito destacado). La POSICIÓN
   en el espacio 3D se calcula sola en `disponer()` a partir del
   índice, así agregar/quitar/reordenar cards es trivial: se edita
   solo el array DATOS.

   ▸ Para reemplazar una foto: pisá el archivo assets/fotos/momento-NN.jpg
   ▸ Para cambiar el orden: reordená DATOS (la disposición 3D se recalcula).
   ═══════════════════════════════════════════════════════════════ */

/* ── Contenido de cada momento (en orden de recorrido) ── */
const DATOS = [
  {
    id: 'comienzo', titulo: 'La primera vez', fecha: '6 de abril de 2025',
    desc: 'Colonia, Uruguay. La primera vez que estuvimos juntos.',
    claves: ['primera vez', 'colonia', 'uruguay', 'abril', '2025', 'comienzo', 'inicio'],
  },
  {
    id: 'charla', titulo: 'Una charla profunda', fecha: '16 de junio de 2025',
    desc: 'Por Instagram, con vos de viaje en Chile.',
    claves: ['charla', 'instagram', 'chile', 'junio', '2025', 'profunda', 'viaje'],
  },
  {
    id: 'kolombo', titulo: 'Kolombo', fecha: '19 de julio de 2025',
    desc: 'Te confesé lo que sentía. Ahí arrancó todo.',
    claves: ['kolombo', 'fiesta', 'confesion', 'julio', '2025'],
  },
  {
    id: 'key-conference', titulo: 'Key Conference', fecha: '25 de agosto de 2025',
    desc: 'Esa noche nos fuimos juntos y dimos un paso importante.',
    claves: ['key conference', 'fiesta', 'agosto', '2025'],
  },
  {
    id: 'pde-primera', titulo: 'Punta del Este', fecha: '5 al 7 de septiembre de 2025',
    desc: 'Nuestra primera escapada. La base de muchas cosas.',
    claves: ['punta del este', 'escapada', 'apartamento', 'septiembre', '2025'],
  },
  {
    id: 'choque', titulo: 'El choque', fecha: '13 de septiembre de 2025',
    desc: 'Chocamos la camioneta… juntos hasta en eso.',
    claves: ['choque', 'camioneta', 'accidente', 'septiembre', '2025'],
  },
  {
    id: 'novios', titulo: 'Nos pusimos de novios', fecha: '20 de septiembre de 2025',
    desc: 'Un finde en Montevideo. El día más importante de todos.',
    claves: ['novios', 'montevideo', 'septiembre', '2025', 'importante', 'noviazgo'],
    destacado: true,
  },
  {
    id: 'kilombito', titulo: 'Kilombito', fecha: '10 de octubre de 2025',
    desc: 'Fiesta en Punta del Este, juntos.',
    claves: ['kilombito', 'fiesta', 'punta del este', 'octubre', '2025'],
  },
  {
    id: 'campo-primera', titulo: 'Tu campo', fecha: '31 oct — 2 nov de 2025',
    desc: 'Tres días en el campo de tu familia, Río Negro.',
    claves: ['campo', 'rio negro', 'escapada', 'octubre', 'noviembre', '2025'],
  },
  {
    id: 'exit', titulo: 'Exit', fecha: '9 de noviembre de 2025',
    desc: 'Con vos y todos mis amigos.',
    claves: ['exit', 'fiesta', 'amigos', 'noviembre', '2025'],
  },
  {
    id: 'key-mood-malvin', titulo: 'Key Mood', fecha: '15 de noviembre de 2025',
    desc: 'Mano a mano. Ese finde alquilamos en Malvín.',
    claves: ['key mood', 'fiesta', 'malvin', 'noviembre', '2025'],
  },
  {
    id: 'liceo', titulo: 'La fiesta de tu liceo', fecha: '20 de diciembre de 2025',
    desc: 'Me invitaste y fui con vos y tus amigas.',
    claves: ['liceo', 'fiesta interna', 'diciembre', '2025', 'amigas'],
  },
  {
    id: 'key-mood-pde', titulo: 'Key Mood · PDE', fecha: '28 de diciembre de 2025',
    desc: 'Punta del Este, mano a mano.',
    claves: ['key mood', 'punta del este', 'diciembre', '2025'],
  },
  {
    id: 'collage', titulo: 'Año nuevo juntos', fecha: '31 de diciembre de 2025',
    desc: 'Fiesta Collage. Arrancamos el año juntos.',
    claves: ['collage', 'año nuevo', 'fin de año', 'diciembre', '2025'],
  },
  {
    id: 'adriatique', titulo: 'Adriatique', fecha: '4 de enero de 2026',
    desc: 'Juntos y con mis amigos.',
    claves: ['adriatique', 'fiesta', 'enero', '2026', 'amigos'],
  },
  {
    id: 'verano', titulo: 'Verano juntos', fecha: '27 dic — 10 ene',
    desc: 'Muchos días de fiestas, playa y familia.',
    claves: ['verano', 'playa', 'familia', 'fiestas', 'enero', '2026'],
  },
  {
    id: 'kilombito-2', titulo: 'Kilombito, otra vez', fecha: '31 de enero de 2026',
    desc: 'Juntos y con mis amigos.',
    claves: ['kilombito', 'fiesta', 'enero', '2026', 'amigos'],
  },
  {
    id: 'pedrera', titulo: 'La Pedrera', fecha: '13 al 18 de febrero de 2026',
    desc: 'Rocha, con tu familia. Vimos las estrellas juntos.',
    claves: ['la pedrera', 'rocha', 'estrellas', 'familia', 'febrero', '2026'],
  },
  {
    id: 'clari', titulo: 'Casamiento de Clari', fecha: '29 de febrero de 2026',
    desc: '',
    claves: ['casamiento', 'clari', 'boda', 'febrero', '2026'],
  },
  {
    id: 'animas', titulo: 'Sierra de las Ánimas', fecha: '12 al 15 de marzo de 2026',
    desc: 'Un finde en un domo, solos los dos.',
    claves: ['sierra de las animas', 'domo', 'marzo', '2026', 'escapada'],
  },
  {
    id: 'semana-santa', titulo: 'Semana Santa', fecha: '30 mar — 4 abr de 2026',
    desc: 'En familia, en tu campo de Río Negro.',
    claves: ['semana santa', 'campo', 'rio negro', 'familia', 'abril', '2026'],
  },
  {
    id: 'pde-serie', titulo: 'Punta del Este', fecha: '15 al 17 de mayo de 2026',
    desc: 'Una serie, un asado, nosotros.',
    claves: ['punta del este', 'asado', 'serie', 'mayo', '2026'],
  },
  {
    id: 'viaje', titulo: 'El viaje', fecha: '29 de mayo de 2026',
    desc: 'Te fuiste a ver el mundo. Te despedí en el aeropuerto. Y acá te espero.',
    claves: ['viaje', 'aeropuerto', 'mundo', 'despedida', 'mayo', '2026'],
  },
];

/* ── Disposición 3D: parámetros del "corredor" de cards ── */
const X_CARD = 3.2;        // separación lateral respecto del eje central
const Y_AMPLITUD = 1.0;    // vaivén vertical
const Z_INICIO = -12;      // z de la primera card (la cámara arranca en +11.5)
const Z_PASO = 7.4;        // separación en profundidad entre cards

/* Calcula posición/rotación de la card i, alternando lados como en la
   referencia: se navegan una tras otra, flotando a ambos lados del eje. */
function disponer(i) {
  const lado = i % 2 === 0 ? -1 : 1;
  const x = lado * (X_CARD + Math.sin(i * 1.3) * 0.35);
  const y = Math.sin(i * 0.7) * Y_AMPLITUD + Math.cos(i * 1.9) * 0.22;
  const z = Z_INICIO - i * Z_PASO;
  /* Rotación leve: la card se angula hacia el centro (hacia la cámara) */
  const rot = [Math.sin(i * 0.5) * 0.05, -lado * 0.3, Math.sin(i * 1.1) * 0.04];
  return { posicion: [x, y, z], rotacion: rot };
}

/* Momentos finales = contenido + disposición 3D + ruta de foto */
export const MOMENTOS = DATOS.map((d, i) => ({
  ...d,
  foto: `assets/fotos/momento-${String(i + 1).padStart(2, '0')}.jpg`,
  ...disponer(i),
}));

/* Profundidad del último momento (la usan las partículas y las
   enredaderas para cubrir todo el largo del recorrido). */
export const PROFUNDIDAD = Z_INICIO - (DATOS.length - 1) * Z_PASO;
