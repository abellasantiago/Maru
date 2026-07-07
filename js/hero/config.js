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

  El LANDING transcurre en dos tiempos (ver camara.js), SIEMPRE con la cámara
  descendiendo (el mundo pasa de largo desde el primer scroll — inmersión) y
  el corazón clavado al centro de la pantalla girando sobre su eje:
  ▸ 0..landingGiro (fracción DEL landing): descenso lineal 1:1 con el scroll.
  ▸ landingGiro..1: acelera con empalme suave hacia la velocidad del timeline,
    y el corazón se esfuma para dar paso a las cards.
*/
/* Con --alto-recorrido: 2150vh, estos valores dejan el landing en ~450vh
   (igual que antes) y estiran el timeline a ~1500vh → ~65vh de scroll por
   card: navegación más pausada entre momentos. */
export const FASES = {
  landingGiro: 0.73,   // fracción del landing de descenso lineal (los "3-4 scrolls")
  landingFin: 0.22,    // duración total del landing: más scroll = más lento
  timelineFin: 0.95,   // fin del vuelo por las cards (después: velo + cierre)
};

/* Posición INICIAL del corazón: bien arriba del mundo. La cámara arranca a su
   altura y desciende ~16 unidades (≈ 2 pantallas de mundo) hasta el timeline;
   durante el viaje el corazón se re-ancla al centro de la vista (camara.js),
   así gira clavado en pantalla mientras todo lo demás pasa de largo. */
export const POS_CORAZON = [0, 16, 0];

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
  vueltasCorazon: MOVIMIENTO_REDUCIDO ? 0.6 : 1.25,   // giros completos durante el landing

  /* Post-procesamiento */
  bloom: { fuerza: 0.55, radio: 0.85, umbral: 0.55 },
  grano: MOVIMIENTO_REDUCIDO ? 0.02 : 0.035,
  vineta: 0.32,

  /* Render */
  dprMaximo: ES_MOBILE ? 1.5 : 2,

  /* CSS3D: 1 unidad de mundo = 100px de panel (escala 0.01) */
  escalaCSS3D: 0.01,
};
