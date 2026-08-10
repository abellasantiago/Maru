/* ═══════════════════════════════════════════════════════════════
   Configuración central del hero.

   Los colores NO están hardcodeados acá: se leen de las variables
   CSS de :root para que la paleta viva en un solo lugar
   (css/estilos.css). Los parámetros de cantidad/intensidad se
   ajustan según capacidad del dispositivo y prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

/* Lee una variable CSS de :root y la devuelve como THREE.Color */
function colorDeCSS(nombre) {
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(nombre)
    .trim();
  return new THREE.Color(valor);
}

/* Detección de contexto (se evalúa una sola vez al cargar) */
export const MOVIMIENTO_REDUCIDO =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ES_TACTIL = window.matchMedia('(pointer: coarse)').matches;

/* ¿Es un teléfono/tablet? Se decide por la PANTALLA, no por el ancho de la
   ventana. Con `(max-width: 760px)` alcanzaba con abrir el sitio en una
   ventana angosta de una laptop para que quedara clavado en calidad de
   teléfono PARA SIEMPRE: estas constantes se evalúan una sola vez al cargar
   el módulo y ya nadie las vuelve a mirar (partículas y buffers se
   construyen con ellas). La pantalla, en cambio, no cambia al redimensionar.
   El CSS sigue usando su propio `max-width: 760px` — ahí sí queremos que el
   LAYOUT se acomode a la ventana; lo que no puede depender de la ventana es
   la calidad del mundo 3D. */
const LADO_CORTO_PANTALLA = Math.min(screen.width || 9999, screen.height || 9999);
export const ES_MOBILE = ES_TACTIL || LADO_CORTO_PANTALLA <= 820;

/* Pantalla HiDPI (retina). En una laptop de 13" cada píxel CSS son 2 píxeles
   reales: es lo que permite que el mundo se vea nítido… y también la razón de
   que sea tan fácil quedarse sin cuadro (4× de píxeles a dibujar). */
export const ES_RETINA = window.devicePixelRatio >= 1.5;

/* Paleta 3D — espejo de las variables CSS que usan los shaders. (Los tonos
   que sólo se usan en el CSS de la UI —beige, bordó oscuro— no se replican
   acá porque ningún shader los pide.) */
export const PALETA = {
  fondo: colorDeCSS('--color-fondo-3d'),
  crema: colorDeCSS('--color-crema'),
  bordo: colorDeCSS('--color-bordo'),
  rojo: colorDeCSS('--color-rojo'),
  rojoVivo: colorDeCSS('--color-rojo-vivo'),
  rojoClaro: colorDeCSS('--color-rojo-claro'),
  rosa: colorDeCSS('--color-rosa'),
  dorado: colorDeCSS('--color-dorado'),
};

/*
  Fases del recorrido (fracción del scroll total 0..1):
  ▸ 0            → landingFin : LANDING — el corazón, centrado, gira con
                                el scroll y luego se esfuma.
  ▸ landingFin   → timelineFin: TIMELINE — vuelo de cámara por las cards.
  ▸ timelineFin  → 1          : FINAL — velo crema y pantalla de cierre.

  El LANDING transcurre en dos tiempos (ver camara.js), SIEMPRE con la cámara
  descendiendo (el mundo pasa de largo desde el primer scroll — inmersión) y
  el corazón clavado al centro de la pantalla girando sobre su eje:
  ▸ 0..landingGiro (fracción DEL landing): descenso lineal 1:1 con el scroll.
  ▸ landingGiro..1: acelera con empalme suave hacia la velocidad del timeline,
    y el corazón se esfuma para dar paso a las cards.
*/
/* Con --alto-recorrido: 3000vh y 32 cards, estos valores dejan el landing en
   ~390vh y el timeline en ~2520vh → ~74vh de scroll por card. Si cambia la
   CANTIDAD de cards, reajustar --alto-recorrido para mantener el vh por card
   (agregar o sacar una sola no mueve la aguja: el reparto es por segmento de
   curva, y una card más entre 30 y pico cambia el ritmo en ~3%). */
export const FASES = {
  landingGiro: 0.73,   // fracción del landing de descenso lineal (los "3-4 scrolls")
  landingFin: 0.13,    // duración total del landing: más scroll = más lento
  timelineFin: 0.97,   // fin del vuelo por las cards (después: velo + cierre)
};

/* Cuándo se desarma el corazón, en fracción DEL LANDING. Es el reloj del
   acto entero: el giro se completa en `desde` (el corazón se planta de
   frente), ahí empieza a soltar brasas, y en `hasta` ya se apagó la
   última — bastante antes de que el landing termine, así el río nunca se
   superpone con las cards, que recién cobran cuerpo al final del descenso. */
export const DESARME = { desde: 0.45, hasta: 0.85 };

/* Posición INICIAL del corazón: bien arriba del mundo. La cámara arranca a su
   altura y desciende ~16 unidades (≈ 2 pantallas de mundo) hasta el timeline;
   durante el viaje el corazón se re-ancla al centro de la vista (camara.js),
   así gira clavado en pantalla mientras todo lo demás pasa de largo. */
export const POS_CORAZON = [0, 16, 0];

export const CONFIG = {
  /* Cámara */
  fov: ES_MOBILE ? 60 : 52,
  camaraLejos: 460,             // el amanecer del final vive a ~z -280
  parallaxMouse: MOVIMIENTO_REDUCIDO ? 0 : (ES_MOBILE ? 0 : 1),

  /* ── Ambiente de ensueño (reemplaza al viejo "polvo de luz") ──
     La profundidad se construye con POCAS luces grandes y suaves (bokeh
     de fotografía romántica) + chispas doradas mínimas, nunca con miles
     de puntos: el centro de la pantalla queda siempre despejado. */
  cantidadBokeh: MOVIMIENTO_REDUCIDO ? 60 : (ES_MOBILE ? 90 : 200),
  cantidadLuciernagas: MOVIMIENTO_REDUCIDO ? 150 : (ES_MOBILE ? 240 : 760),

  /* Velos de seda (las "auroras" que reemplazan a las enredaderas) */
  cantidadVelos: ES_MOBILE ? 6 : 13,

  /* Cielo: estrellas lejanas sobre la nebulosa */
  cantidadEstrellas: ES_MOBILE ? 380 : 1100,

  /* Corazón central: point cloud rojo (almohadón 3D de la curva ♥ clásica).
     El alfa en reposo se normaliza por cantidad (ver uDensidad en corazon.js):
     subir esto DENSIFICA la nube sin encenderla de más — con blending aditivo,
     el doble de puntos con el mismo alfa es el doble de luz sumada. */
  particulasCorazon: ES_MOBILE ? 3600 : 11000,
  amplitudRespiracion: MOVIMIENTO_REDUCIDO ? 0.008 : 0.022,
  /* Vueltas que da el corazón sobre su eje durante el landing. Tiene que
     ser un ENTERO: el giro se completa justo antes de que empiece el
     desarme y tiene que terminar MIRANDO DE FRENTE. Si quedara de perfil,
     el corazón se desarmaría de canto —una columna— y se perdería la
     silueta ♥ justo en el momento en que más importa verla. */
  vueltasCorazon: 1,

  /* Entrada del corazón (segundos): las partículas caen desde arriba y
     lo van ARMANDO de abajo hacia arriba, hasta cerrar la silueta ♥.
     La dispara comenzarEntrada(), que main.js llama apenas arranca el
     mundo — no hay preludio que la demore. */
  duracionEntrada: MOVIMIENTO_REDUCIDO ? 1.0 : 3.2,

  /* ── Desarme: el río de brasas ──
     Al scrollear, el corazón no se dispersa al azar: cada partícula se
     SUELTA como una brasa, cae y la corriente se la lleva hacia el
     corredor (-Z, donde espera el amanecer). Perillas del efecto:
     ▸ ecosBrasas: copias de la nube dibujadas un pelín "atrás en el
       tiempo". Son la ESTELA de movimiento de cada brasa — lo que hace
       que se lean como fuego y no como puntos que se trasladan.

       ES LA PERILLA MÁS CARA DEL SITIO, y conviene entender por qué antes
       de subirla: cada eco vuelve a dibujar la nube ENTERA (11 000 puntos
       gordos, aditivos y superpuestos), así que con 3 el corazón se dibuja
       CUATRO VECES en el mismo cuadro. Medido en la laptop de 13": cada
       eco cuesta ~1.2 ms, y el desarme —que ya es el momento más pesado
       del recorrido— quedaba en 15.5 ms, a un milímetro de los 16.7 ms
       que dan los 60 fps. O sea: el efecto más lindo del sitio era también
       el que trababa la máquina justo cuando había que mirarlo.
       En 0 el desarme baja a 11.9 ms y el pico desaparece del todo. Las
       brasas siguen goteando, cayendo y yéndose al corredor; lo que se
       pierde es el rastro detrás de cada una. Si algún día sobra máquina,
       1 (13.1 ms) es el punto medio que devuelve la lectura de fuego.
       (Y sí: mobile se queda con MÁS ecos que escritorio, que parece al
       revés. No lo es — en el teléfono la nube tiene 3600 puntos y no
       11 000, así que ahí un eco cuesta un tercio y sí entra en el cuadro.)
     ▸ retrasoEco: separación entre eco y eco, en unidades de desarme.
       Más alto = estelas más largas (y más separadas entre sí).
     ▸ remolinoBrasas: radianes de vórtice que gira el río mientras cae.
     ▸ brasasCerca: fracción de partículas que pasan al ras del lente. */
  ecosBrasas: MOVIMIENTO_REDUCIDO ? 0 : (ES_MOBILE ? 1 : 0),
  retrasoEco: 0.011,
  remolinoBrasas: MOVIMIENTO_REDUCIDO ? 0 : 0.62,
  brasasCerca: MOVIMIENTO_REDUCIDO ? 0 : 0.07,

  /* Estrellas fugaces: cuántas pueden cruzar el cielo a la vez. Con 2 y
     esperas largas casi siempre se ve una sola — un detalle, no un show. */
  cantidadFugaces: MOVIMIENTO_REDUCIDO ? 0 : 2,
  esperaFugaz: [9, 23],          // segundos de calma entre cruce y cruce

  /* Resplandor detrás del corazón: alfa máximo del abanico. Bajísimo a
     propósito — tiene que leerse como aire con luz, nunca como gráfico.
     Subir de ~0.06 empieza a notarse como "rayos" dibujados. */
  intensidadRayos: MOVIMIENTO_REDUCIDO ? 0.012 : 0.026,

  /* Cámara viva: deriva orgánica mínima e independiente del scroll, para
     que el mundo nunca quede del todo quieto (sensación de cámara en mano). */
  derivaCamara: MOVIMIENTO_REDUCIDO ? 0 : 0.07,

  /* ── Post-procesamiento ──
     `bloomEscala` es la resolución del bloom como fracción de la del cuadro.
     UnrealBloomPass ya trabaja internamente a la mitad de lo que se le pasa,
     así que 0.45 acá deja el glow a algo menos de un cuarto de resolución:
     para un resplandor de radio 0.85 —que es puro desenfoque ancho— eso es
     indistinguible a ojo y ahorra varios milisegundos en una GPU integrada.
     `tinteHalacion` tiñe los niveles más desenfocados del bloom hacia el rojo
     cálido: es la HALACIÓN del cine en película, el sangrado rojizo alrededor
     de las luces fuertes. Los niveles finos quedan neutros (el brillo cerca
     de la fuente es blanco) y los anchos se van al bordó de la paleta. */
  bloom: { fuerza: 0.55, radio: 0.85, umbral: 0.55 },
  bloomEscala: ES_MOBILE ? 0.4 : 0.45,
  tinteHalacion: 0.55,          // 0 = bloom neutro · 1 = halación a pleno
  grano: MOVIMIENTO_REDUCIDO ? 0.02 : 0.035,
  vineta: 0.32,
  aberracion: 0.007,            // aberración cromática radial, apenas perceptible
  /* Enfoque cinematográfico (profundidad de campo suave): el centro queda
     nítido y los bordes se ablandan, como una lente de foco corto. */
  enfoque: ES_MOBILE ? 0.0032 : 0.0068,   // radio de desenfoque en UV (0 = apagado)
  /* Hasta dónde se mantiene nítido, medido en RADIO DE LENTE: 0 es el centro
     óptico y 1 es la esquina del cuadro, en cualquier proporción de pantalla
     (ver el shader). Bajarlo agranda la zona blanda y encierra más el centro. */
  radioNitido: 0.30,
  /* Muestras del disco de bokeh. Cada una es una lectura de textura sobre casi
     toda la pantalla, así que es la perilla más cara del post: medido en la
     laptop, cada muestra son ~0.11 ms a 1.5×. Con la espiral de ángulo áureo y
     el giro por píxel, 14 dan un desenfoque continuo — los 12 de antes, en dos
     anillos fijos, dejaban ver la estructura en los bordes. */
  muestrasBokeh: ES_MOBILE ? 8 : 14,

  /* Arrastre de velocidad: al scrollear rápido, el cuadro se estira RADIALMENTE
     hacia afuera —lo que en cine hace una toma acelerando por un túnel—. Es el
     mismo disco de muestras del bokeh, corrido hacia el centro: no cuesta un
     pase aparte. Contenido a propósito: se tiene que SENTIR sin verse. */
  arrastreVelocidad: MOVIMIENTO_REDUCIDO ? 0 : (ES_MOBILE ? 0.006 : 0.013),

  /* Grano de película: se pega a los MEDIOS TONOS (como el haluro real) en vez
     de repartirse parejo. Sin esto el negro de la nebulosa hierve. */
  granoEnNegros: 0.25,          // cuánto grano queda en las sombras (0..1)

  /* Tramado (dither) contra el banding. La nebulosa es un degradé bordó muy
     oscuro y muy amplio: en 8 bits de salida se ve a bandas, y en una pantalla
     buena de laptop se notan muchísimo. Un nivel de ruido triangular justo
     antes de escribir el píxel las disuelve por completo, y es gratis. */
  tramado: 1,                   // amplitud en niveles de 8 bits (0 = apagado)

  /* Techo duro de la escala de render (píxeles reales por píxel CSS). No es
     la escala con la que se dibuja —esa la busca el gobernador, ver CALIDAD
     abajo—, es hasta dónde se le permite llegar. En teléfonos se corta en 1.5
     aunque la pantalla sea 3×: más allá de ahí no se ve nada nuevo a esa
     densidad y se gasta batería. */
  dprMaximo: ES_MOBILE ? 1.5 : 2,

  /* CSS3D: 1 unidad de mundo = 100px de panel (escala 0.01) */
  escalaCSS3D: 0.01,

  /* Supersample de las cards: el CSS3DRenderer las agranda en pantalla (2–4×
     en monitores grandes/HiDPI) y las rasteriza a su tamaño de layout → se
     ven blandas. Maquetamos cada card a ×supersampleCards px (ver var(--ss)
     en .panel-vidrio) y dividimos su escala 3D por el mismo factor, así el
     tamaño en el mundo no cambia pero la textura tiene más resolución.
     En mobile bajamos a 1.5 para no gastar memoria de GPU de más. */
  supersampleCards: ES_MOBILE ? 1.5 : 2,

  /* Resolución de la nebulosa como fracción del cuadro. El domo es un FBM de
     tres octavas de ruido simplex evaluado en CADA píxel de la pantalla: en la
     GPU integrada de una laptop se comía la MITAD del cuadro él solo. Como lo
     que dibuja son nubes enormes y suavísimas, calcularlo a un tercio de
     resolución y estirarlo es indistinguible a ojo (ver atmosfera.js). */
  escalaNebulosa: ES_MOBILE ? 0.3 : 0.32,
};

/* ═══════════════════════════════════════════════════════════════
   Escala de render adaptativa.

   Es LA perilla de calidad del sitio: cuántos píxeles reales se dibujan por
   cada píxel CSS. En una pantalla retina, 2 significa nitidez nativa —el
   mundo se ve tallado— y 1 significa la mitad de resolución estirada, que en
   este sitio (todo puntitos y degradés finos) se nota enseguida como blando.

   No se elige acá: se MIDE en marcha (ver calidad.js). Ninguna constante
   puede saber si la máquina es un Air del 2019 o un Studio, y la diferencia
   entre 30 y 60 cuadros por segundo pesa más en la sensación de "cine" que
   cualquier efecto que se pueda agregar. Así que se arranca en un valor
   prudente y el gobernador sube hasta donde la máquina aguante.
   ═══════════════════════════════════════════════════════════════ */
export const CALIDAD = {
  escalaMinima: ES_MOBILE ? 1 : 1,
  escalaMaxima: Math.min(window.devicePixelRatio || 1, CONFIG.dprMaximo),
  /* Arranque: en retina, 1.5 ya se ve claramente nítido y deja aire para
     medir. Subir desde acá es invisible; bajar desde 2 se ve. */
  escalaInicial: Math.min(
    window.devicePixelRatio || 1,
    ES_MOBILE ? 1.5 : (ES_RETINA ? 1.5 : 1)
  ),
  escalon: 0.25,
  /* ── Los dos umbrales, en milisegundos POR CUADRO ──
     Ojo con lo que se mide: el tiempo entre cuadros está CUANTIZADO por el
     vsync. Si la pantalla va a 60 Hz, un cuadro que tarda 14 ms y uno que
     tarda 16.6 ms se miden los DOS como 16.7 ms; y uno que tarda 16.8 pierde
     el pase y se mide como 33. No existe el "17.5": o llegás o vas a la
     mitad. Por eso no se puede leer "cuánto margen sobra" — hay que probar.
     ▸ holgadoMs: estamos manteniendo el refresco (60 Hz o mejor). Puede que
       sobre máquina o puede que estemos justo: la única forma de saberlo es
       subir un escalón y ver qué pasa.
     ▸ techoMs: se están perdiendo cuadros de verdad. */
  holgadoMs: 17.6,
  techoMs: 19.5,
};
