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

/* Paleta 3D — espejo exacto de las variables CSS */
export const PALETA = {
  fondo: colorDeCSS('--color-fondo-3d'),
  crema: colorDeCSS('--color-crema'),
  beige: colorDeCSS('--color-beige'),
  bordoOscuro: colorDeCSS('--color-bordo-oscuro'),
  bordo: colorDeCSS('--color-bordo'),
  rojo: colorDeCSS('--color-rojo'),
  rojoVivo: colorDeCSS('--color-rojo-vivo'),
  rojoClaro: colorDeCSS('--color-rojo-claro'),
  dorado: colorDeCSS('--color-dorado'),
};

/*
  Fases del recorrido (fracción del scroll total 0..1):
  ▸ 0            → landingFin : LANDING — el corazón, centrado, gira con
                                el scroll y luego se esfuma.
  ▸ landingFin   → timelineFin: TIMELINE — vuelo de cámara por las 23 cards.
  ▸ timelineFin  → 1          : FINAL — velo crema y pantalla de cierre.
*/
export const FASES = {
  landingFin: 0.09,
  timelineFin: 0.92,
};

/* Posición del corazón en el mundo: arriba y al frente. La cámara arranca a su
   altura (mirándolo solo) y DESCIENDE por el eje Y con el scroll hasta el
   timeline. Compartida por corazon.js y camara.js para que coincidan siempre. */
export const POS_CORAZON = [0, 8, 0];

export const CONFIG = {
  /* Cámara */
  fov: ES_MOBILE ? 60 : 52,
  parallaxMouse: MOVIMIENTO_REDUCIDO ? 0 : (ES_MOBILE ? 0 : 1),

  /* Partículas ambientales ("polvo de luz") — cubren todo el corredor */
  cantidadParticulas: MOVIMIENTO_REDUCIDO ? 1400 : (ES_MOBILE ? 2200 : 4600),
  amplitudDeriva: MOVIMIENTO_REDUCIDO ? 0.15 : 0.55,

  /* Corazón central */
  particulasCorazon: ES_MOBILE ? 700 : 1100,
  amplitudRespiracion: MOVIMIENTO_REDUCIDO ? 0.008 : 0.022,
  vueltasCorazon: MOVIMIENTO_REDUCIDO ? 0.6 : 2,   // giros completos durante el landing

  /* Post-procesamiento */
  bloom: { fuerza: 0.55, radio: 0.85, umbral: 0.55 },
  grano: MOVIMIENTO_REDUCIDO ? 0.02 : 0.035,
  vineta: 0.32,

  /* Render */
  dprMaximo: ES_MOBILE ? 1.5 : 2,

  /* CSS3D: 1 unidad de mundo = 100px de panel (escala 0.01) */
  escalaCSS3D: 0.01,
};
