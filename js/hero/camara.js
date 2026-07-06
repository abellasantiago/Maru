/* ═══════════════════════════════════════════════════════════════
   Recorrido de cámara ligado al scroll.

   El scroll NO mueve contenido en 2D: mueve la cámara por el
   espacio (dolly + leve paneo) siguiendo dos curvas Catmull-Rom:
   una para la POSICIÓN y otra para el punto al que MIRA. El
   progreso del scroll (0..1, ya suavizado por Lenis) se mapea 1:1
   sobre las curvas — sin inercia extra.

   El último tramo termina con el panel "portal" ocupando toda la
   pantalla: la puerta de entrada al timeline.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { MOMENTOS } from './momentos.js';

export class RecorridoCamara {
  constructor(camara) {
    this.camara = camara;

    /* Parallax por mouse (se suma suave al final, nunca al scroll) */
    this.parallax = new THREE.Vector2();
    this.progreso = 0;

    const P = MOMENTOS.map((m) => new THREE.Vector3().fromArray(m.posicion));
    const portal = P[P.length - 1];

    /*
      IMPORTANTE: ambas curvas se muestrean con getPoint (parámetro
      uniforme POR SEGMENTO, no por longitud de arco). Así el keyframe
      i de posición y el keyframe i de mirada caen exactamente en el
      mismo progreso u = i/8 y la cámara siempre mira lo que debe:
      cuando está frente a un panel, lo encuadra centrado.
    */

    /* ── Curva de posición: pasa frente a cada panel, alternando lados ── */
    this.curvaPosicion = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.2, 11.5),                               // 0 inicio: corazón al frente
      new THREE.Vector3(0.4, 0.1, 5),                                // 1 acercándose al corazón
      new THREE.Vector3(1.6, 0.35, -3),                              // 2 lo pasa por el costado
      new THREE.Vector3(P[0].x + 2.4, P[0].y + 0.2, P[0].z + 5.2),   // 3 frente al momento 1
      new THREE.Vector3(P[1].x - 2.4, P[1].y + 0.3, P[1].z + 5.2),   // 4 momento 2
      new THREE.Vector3(P[2].x + 2.4, P[2].y + 0.2, P[2].z + 5.2),   // 5 momento 3
      new THREE.Vector3(P[3].x - 2.4, P[3].y - 0.2, P[3].z + 5.2),   // 6 momento 4
      new THREE.Vector3(portal.x, portal.y + 0.05, portal.z + 7),    // 7 alineado al portal
      new THREE.Vector3(portal.x, portal.y, portal.z + 2.45),        // 8 portal desborda la pantalla
    ], false, 'centripetal');

    /* ── Curva de mirada: del corazón a cada panel, terminando en el portal ── */
    this.curvaMirada = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-1.6, 0.3, -8),
      P[0].clone(),
      P[1].clone(),
      P[2].clone(),
      P[3].clone(),
      portal.clone(),
      portal.clone(),
    ], false, 'centripetal');

    /* ── Anclas de progreso: keyframe 3+i encuadra al momento i.
       El portal ancla un poco antes del final (después arranca el velo) ── */
    const segmentos = this.curvaPosicion.points.length - 1;   // 8
    this.anclas = MOMENTOS.map((m, i) =>
      i === MOMENTOS.length - 1 ? 0.94 : (3 + i) / segmentos
    );

    this._pos = new THREE.Vector3();
    this._mirada = new THREE.Vector3();
  }

  /** Progreso del scroll 0..1 → posición y orientación de cámara */
  aplicarProgreso(progreso) {
    this.progreso = progreso;
  }

  /** El mouse en NDC produce un paneo mínimo (desactivado en reduced-motion) */
  aplicarParallax(mouseNDC, dt) {
    const k = Math.min(1, dt * 3);
    this.parallax.x += (mouseNDC.x * 0.32 * CONFIG.parallaxMouse - this.parallax.x) * k;
    this.parallax.y += (mouseNDC.y * 0.18 * CONFIG.parallaxMouse - this.parallax.y) * k;
  }

  actualizar() {
    const u = THREE.MathUtils.clamp(this.progreso, 0, 1);

    /* Muestreo por segmento: mantiene alineadas posición y mirada */
    this.curvaPosicion.getPoint(u, this._pos);
    this.curvaMirada.getPoint(u, this._mirada);

    /* El parallax se atenúa al final para que el portal encaje perfecto */
    const atenuacion = 1 - THREE.MathUtils.smoothstep(u, 0.9, 0.985);
    this.camara.position.set(
      this._pos.x + this.parallax.x * atenuacion,
      this._pos.y + this.parallax.y * atenuacion,
      this._pos.z
    );
    this.camara.lookAt(
      this._mirada.x + this.parallax.x * 0.4 * atenuacion,
      this._mirada.y + this.parallax.y * 0.25 * atenuacion,
      this._mirada.z
    );
  }

  /** Índice del momento activo según el progreso actual (para la UI) */
  momentoActivo() {
    let indice = 0;
    for (let i = 0; i < this.anclas.length; i++) {
      const anterior = i === 0 ? 0 : (this.anclas[i - 1] + this.anclas[i]) / 2;
      if (this.progreso >= anterior) indice = i;
    }
    return indice;
  }
}
