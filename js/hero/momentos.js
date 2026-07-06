/* ═══════════════════════════════════════════════════════════════
   Momentos del recorrido — ÚNICA fuente de datos de los paneles.

   Para cambiar el contenido del hero alcanza con editar este
   archivo: título, fecha, palabras clave del buscador, foto y
   posición/rotación del panel en el espacio 3D.

   ▸ posicion: [x, y, z] en unidades de mundo (la cámara arranca en
     z ≈ +13 y viaja hacia z negativo).
   ▸ rotacion: [x, y, z] en radianes — leves, para que floten como
     objetos en el espacio y no como tarjetas alineadas.
   ▸ El último momento es el "portal": el panel que crece hasta
     ocupar toda la pantalla y da paso al timeline.
   ═══════════════════════════════════════════════════════════════ */

export const MOMENTOS = [
  {
    id: 'comienzo',
    titulo: 'El comienzo',
    fecha: '14 · 02 · 2022',
    claves: ['comienzo', 'inicio', 'primera cita', 'cita', 'febrero', '2022'],
    foto: 'assets/fotos/momento-1.jpg',
    posicion: [-3.4, 0.7, -12],
    rotacion: [0.04, 0.32, -0.02],
  },
  {
    id: 'viaje',
    titulo: 'Primer viaje',
    fecha: '07 · 2022',
    claves: ['viaje', 'primer viaje', 'ruta', 'julio', 'vacaciones'],
    foto: 'assets/fotos/momento-2.jpg',
    posicion: [3.8, -0.8, -24],
    rotacion: [-0.03, -0.35, 0.03],
  },
  {
    id: 'cumple',
    titulo: 'Tu cumpleaños',
    fecha: '· · ·',
    claves: ['cumpleaños', 'cumple', 'velas', 'torta', 'festejo'],
    foto: 'assets/fotos/momento-3.jpg',
    posicion: [-3.6, -0.5, -36],
    rotacion: [0.05, 0.3, 0.0],
  },
  {
    id: 'pacha',
    titulo: 'Pachá',
    fecha: 'nuestra esquina',
    claves: ['pacha', 'pachá', 'cerezas', 'esquina', 'bar'],
    foto: 'assets/fotos/momento-4.jpg',
    posicion: [3.5, 1.0, -48],
    rotacion: [0.0, -0.28, -0.03],
  },
  {
    id: 'hoy',
    titulo: 'Hoy',
    fecha: 'y esto recién empieza',
    claves: ['hoy', 'ahora', 'siempre', 'nosotros'],
    foto: 'assets/fotos/momento-5.jpg',
    posicion: [0, 0.15, -62],
    rotacion: [0, 0, 0],
  },
];
