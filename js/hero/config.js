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
export const ES_MOBILE = window.matchMedia('(max-width: 760px)').matches || ES_TACTIL;

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
/* Con --alto-recorrido: 3000vh y 31 cards, estos valores dejan el landing en
   ~390vh (mismo que antes) y el timeline en ~2520vh → ~76vh de scroll por card
   (se preserva el ritmo aunque haya más momentos que antes). Si cambia la
   CANTIDAD de cards, reajustar --alto-recorrido para mantener el vh por card. */
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
  cantidadBokeh: MOVIMIENTO_REDUCIDO ? 60 : (ES_MOBILE ? 90 : 150),
  cantidadLuciernagas: MOVIMIENTO_REDUCIDO ? 150 : (ES_MOBILE ? 240 : 480),

  /* Velos de seda (las "auroras" que reemplazan a las enredaderas) */
  cantidadVelos: ES_MOBILE ? 6 : 10,

  /* Cielo: estrellas lejanas sobre la nebulosa */
  cantidadEstrellas: ES_MOBILE ? 380 : 620,

  /* Corazón central: point cloud rojo (almohadón 3D de la curva ♥ clásica) */
  particulasCorazon: ES_MOBILE ? 3600 : 6500,
  amplitudRespiracion: MOVIMIENTO_REDUCIDO ? 0.008 : 0.022,
  /* Vueltas que da el corazón sobre su eje durante el landing. Tiene que
     ser un ENTERO: el giro se completa justo antes de que empiece el
     desarme y tiene que terminar MIRANDO DE FRENTE. Si quedara de perfil,
     el corazón se desarmaría de canto —una columna— y se perdería la
     silueta ♥ justo en el momento en que más importa verla. */
  vueltasCorazon: 1,

  /* Entrada del corazón (segundos): las partículas caen desde arriba y
     lo van ARMANDO de abajo hacia arriba, hasta cerrar la silueta ♥.
     No arranca sola: la suelta el click de la obertura (ver obertura.js). */
  duracionEntrada: MOVIMIENTO_REDUCIDO ? 1.0 : 3.2,

  /* ── Desarme: el río de brasas ──
     Al scrollear, el corazón no se dispersa al azar: cada partícula se
     SUELTA como una brasa, cae y la corriente se la lleva hacia el
     corredor (-Z, donde espera el amanecer). Perillas del efecto:
     ▸ ecosBrasas: copias de la nube dibujadas un pelín "atrás en el
       tiempo". Son la ESTELA de movimiento de cada brasa — lo que hace
       que se lean como fuego y no como puntos que se trasladan.
     ▸ retrasoEco: separación entre eco y eco, en unidades de desarme.
       Más alto = estelas más largas (y más separadas entre sí).
     ▸ remolinoBrasas: radianes de vórtice que gira el río mientras cae.
     ▸ brasasCerca: fracción de partículas que pasan al ras del lente. */
  ecosBrasas: MOVIMIENTO_REDUCIDO ? 0 : (ES_MOBILE ? 1 : 2),
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

  /* Post-procesamiento */
  bloom: { fuerza: 0.55, radio: 0.85, umbral: 0.55 },
  grano: MOVIMIENTO_REDUCIDO ? 0.02 : 0.035,
  vineta: 0.32,
  aberracion: 0.007,            // aberración cromática radial, apenas perceptible
  /* Enfoque cinematográfico (profundidad de campo suave): el centro queda
     nítido y los bordes se ablandan, como una lente de foco corto. */
  enfoque: ES_MOBILE ? 0.0032 : 0.0058,   // radio de desenfoque en UV (0 = apagado)
  radioNitido: 0.34,            // hasta qué distancia del centro se mantiene nítido

  /* Render */
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
};
