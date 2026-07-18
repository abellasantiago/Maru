/* ═══════════════════════════════════════════════════════════════
   Recorrido de cámara ligado al scroll — en TRES fases.

   El scroll no mueve contenido en 2D: mueve la cámara por el espacio.
   Según la fracción de scroll (0..1) la cámara vive una de tres fases
   (ver FASES en config.js):

   ▸ LANDING  : la cámara queda casi quieta frente al corazón (que gira
                y se esfuma). Un leve dolly de acercamiento da anticipación.
   ▸ TIMELINE : vuelo por las 23 cards siguiendo dos curvas Catmull-Rom
                (una para la POSICIÓN, otra para la MIRADA). Cada card, a
                su turno, queda encuadrada en el centro.
   ▸ FINAL    : la cámara sigue derivando hacia adelante mientras sube el
                velo crema hacia la pantalla de cierre.

   Continuidad: el final del landing usa exactamente el primer punto de
   las curvas del timeline, así no hay saltos al cambiar de fase.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CONFIG, FASES, POS_CORAZON, MOVIMIENTO_REDUCIDO } from './config.js';
import { MOMENTOS } from './momentos.js';

const LEAD_POS = 5.3;   // cuánto por delante de la card se ubica la cámara al encuadrarla
                        // (calibrado para las cards 5:4: prominentes pero con aire alrededor)

export class RecorridoCamara {
  constructor(camara) {
    this.camara = camara;

    /* Parallax por mouse (se suma suave, nunca al scroll) */
    this.parallax = new THREE.Vector2();
    this.progreso = 0;
    this.progresoLanding = 0;   // 0..1 dentro del landing (lo lee el corazón)

    const P = MOMENTOS.map((m) => new THREE.Vector3().fromArray(m.posicion));

    /* ── Curvas del timeline ──
       Dos puntos de entrada (dive tras el corazón) + un keyframe por card
       (encuadrándola) + un punto de salida (settle tras la última). */
    const posKeys = [
      new THREE.Vector3(0, 0.2, 5.0),      // 0 recién pasado el corazón
      new THREE.Vector3(0, 0.25, -1.5),    // 1 entrando al corredor
    ];
    const lookKeys = [
      new THREE.Vector3(0, 0.05, -4),
      new THREE.Vector3(0, 0.05, -10),
    ];
    P.forEach((p) => {
      /* Cámara cerca del eje central (leve peso al lado de la card); la
         mirada apunta a la card, que así queda centrada en pantalla. */
      posKeys.push(new THREE.Vector3(p.x * 0.6, p.y * 0.5, p.z + LEAD_POS));
      lookKeys.push(new THREE.Vector3(p.x, p.y, p.z));
    });
    const ultimo = P[P.length - 1];
    posKeys.push(new THREE.Vector3(0, 0.05, ultimo.z - 6.5));   // settle
    lookKeys.push(new THREE.Vector3(0, 0, ultimo.z - 12));

    this.curvaPos = new THREE.CatmullRomCurve3(posKeys, false, 'centripetal');
    this.curvaLook = new THREE.CatmullRomCurve3(lookKeys, false, 'centripetal');

    /* ── Anclas de progreso GLOBAL por card ──
       La card i cae en el keyframe (2 + i). getPoint usa parámetro uniforme
       por segmento, así u = (2+i)/segmentos encuadra exactamente la card i. */
    const segmentos = posKeys.length - 1;
    this.anclas = MOMENTOS.map((m, i) => {
      const u = (2 + i) / segmentos;
      return FASES.landingFin + u * (FASES.timelineFin - FASES.landingFin);
    });

    /* ── Landing (efecto Active Theory): el corazón queda CLAVADO en el
       centro de la pantalla girando sobre sí mismo, mientras la cámara
       DESCIENDE por el mundo desde el primer scroll — partículas y
       enredaderas pasan de largo, dando la sensación de recorrer el sitio
       hacia abajo hasta llegar al timeline, que espera más al fondo.
       El truco: el corazón se re-ancla cada frame al punto de MIRADA de la
       cámara (corazonAncla), así nunca se desplaza en pantalla. ── */
    this.landingInicioPos = new THREE.Vector3(0, POS_CORAZON[1], 10);
    this.landingInicioLook = new THREE.Vector3(0, POS_CORAZON[1], 0);
    this.landingFinPos = this.curvaPos.getPoint(0);     // continuidad exacta
    this.landingFinLook = this.curvaLook.getPoint(0);

    /* Punto donde debe estar el corazón este frame (main.js se lo copia) */
    this.corazonAncla = new THREE.Vector3().fromArray(POS_CORAZON);

    /* Pendiente de salida del landing calculada para que la velocidad de la
       cámara empalme EXACTA con la velocidad de entrada al timeline (nada de
       constantes mágicas: se deriva de las curvas reales, así sobrevive a
       cualquier retoque de posiciones). */
    this.distLanding = this.landingInicioPos.distanceTo(this.landingFinPos);
    const du = 0.002;
    const velEntradaTimeline =
      this.curvaPos.getPoint(0).distanceTo(this.curvaPos.getPoint(du)) /
      (du * (FASES.timelineFin - FASES.landingFin));
    this.pendSalidaLanding = THREE.MathUtils.clamp(
      (velEntradaTimeline * FASES.landingFin) / Math.max(this.distLanding, 0.001),
      1, 6
    );

    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();

    /* Banking: la cámara se ladea apenas hacia adentro de cada curva del
       vuelo (como un avión), suavizado frame a frame. 0 fuera del timeline. */
    this.roll = 0;
    this._tangente = new THREE.Vector3();

    /* Cámara viva: reloj propio para la deriva orgánica (independiente del
       scroll). Nunca se resetea → el mundo respira sin cortes. */
    this.tiempoVida = 0;
  }

  /** Progreso del scroll 0..1 */
  aplicarProgreso(progreso) {
    this.progreso = progreso;
  }

  /** El mouse en NDC produce un paneo mínimo (0 en reduced-motion/mobile) */
  aplicarParallax(mouseNDC, dt) {
    const k = Math.min(1, dt * 3);
    this.parallax.x += (mouseNDC.x * 0.3 * CONFIG.parallaxMouse - this.parallax.x) * k;
    this.parallax.y += (mouseNDC.y * 0.17 * CONFIG.parallaxMouse - this.parallax.y) * k;
  }

  actualizar(dt = 0.016) {
    const p = THREE.MathUtils.clamp(this.progreso, 0, 1);
    let atenParallax = 1;
    let rollObjetivo = 0;

    if (p <= FASES.landingFin) {
      /* ── LANDING (efecto Active Theory) ──
         La cámara desciende DESDE EL PRIMER SCROLL (el mundo pasa de largo:
         inmersión, "el timeline está más abajo y hay que viajar hasta él"),
         mientras el corazón — re-anclado cada frame al punto de mirada —
         queda clavado al centro de la pantalla girando sobre su eje.
         ▸ Fase A (0..landingGiro): descenso LINEAL 1:1 con el scroll: los
           primeros 3-4 golpes de rueda mueven el fondo de forma inmediata.
         ▸ Fase B (landingGiro..1): Hermite cúbico que arranca con la MISMA
           velocidad de la fase A y termina con la MISMA velocidad de entrada
           al timeline (pendSalidaLanding) — sin frenazos ni saltos. */
      const t = FASES.landingFin > 0 ? p / FASES.landingFin : 1;
      this.progresoLanding = t;
      const g = FASES.landingGiro;
      const eA = 0.38;   // fracción del camino recorrida durante la fase A
      let e;
      if (t <= g) {
        e = (t / g) * eA;
      } else {
        const b = (t - g) / (1 - g);
        /* Pendientes en espacio local de la fase B (continuidad C¹ en ambos bordes) */
        const s0 = ((eA / g) * (1 - g)) / (1 - eA);
        const s1 = (this.pendSalidaLanding * (1 - g)) / (1 - eA);
        const h = (s0 + s1 - 2) * b * b * b + (3 - 2 * s0 - s1) * b * b + s0 * b;
        e = eA + (1 - eA) * h;
      }
      this._pos.lerpVectors(this.landingInicioPos, this.landingFinPos, e);
      this._look.lerpVectors(this.landingInicioLook, this.landingFinLook, e);
      /* El corazón se clava al punto de mirada: siempre centrado en pantalla */
      this.corazonAncla.copy(this._look);
      atenParallax = 0.35 + 0.65 * t;

    } else if (p <= FASES.timelineFin) {
      /* ── TIMELINE: vuelo por las cards ── */
      this.progresoLanding = 1;
      const u = (p - FASES.landingFin) / (FASES.timelineFin - FASES.landingFin);
      this.curvaPos.getPoint(u, this._pos);
      this.curvaLook.getPoint(u, this._look);

      /* Banking hacia adentro de la curva (según el rumbo lateral real) */
      this.curvaPos.getTangent(u, this._tangente);
      rollObjetivo = THREE.MathUtils.clamp(-this._tangente.x * 0.55, -0.1, 0.1);

    } else {
      /* ── FINAL: deriva hacia adelante mientras sube el velo ── */
      this.progresoLanding = 1;
      const u = (p - FASES.timelineFin) / (1 - FASES.timelineFin);
      this.curvaPos.getPoint(1, this._pos);
      this.curvaLook.getPoint(1, this._look);
      this._pos.z -= u * 3;
      atenParallax = 1 - u;
    }

    /* ── Cámara viva: deriva orgánica mínima ──
       Suma un vaivén lentísimo de dos frecuencias a la POSICIÓN (antes del
       lookAt, así la cámara re-apunta al mismo objetivo desde un punto que
       flota → paralaje suave, "cámara en mano"). Se atenúa con el resto del
       parallax, así calma en el cierre. En reduced-motion, derivaCamara = 0. */
    this.tiempoVida += dt;
    const ampDeriva = CONFIG.derivaCamara * atenParallax;
    const derivaX = (Math.sin(this.tiempoVida * 0.23) * 0.7 + Math.sin(this.tiempoVida * 0.37 + 1.3) * 0.3) * ampDeriva;
    const derivaY = (Math.cos(this.tiempoVida * 0.19) * 0.6 + Math.sin(this.tiempoVida * 0.41 + 0.7) * 0.25) * ampDeriva;

    this.camara.position.set(
      this._pos.x + this.parallax.x * atenParallax + derivaX,
      this._pos.y + this.parallax.y * atenParallax + derivaY,
      this._pos.z
    );
    /* La mirada apunta SIEMPRE al punto exacto (sin el offset de parallax/
       deriva que sí lleva la posición): así el corazón —anclado a este mismo
       punto durante el landing— queda perfectamente fijo en el centro óptico
       de la cámara, coincidiendo con el "11:11" y la flecha (ambos fijos en
       el centro de la pantalla), mientras el resto del mundo sí parallax-ea. */
    this.camara.lookAt(this._look.x, this._look.y, this._look.z);

    /* Ladeo suave DESPUÉS del lookAt (roll local sobre el eje de vista) +
       un respiro de roll mínimo de la cámara viva. */
    this.roll += (rollObjetivo - this.roll) * Math.min(1, dt * 1.8);
    const rollVivo = CONFIG.derivaCamara > 0 ? Math.sin(this.tiempoVida * 0.26) * 0.0032 * atenParallax : 0;
    this.camara.rotateZ(this.roll + rollVivo);
  }

  /** Índice de la card activa según el progreso (para la UI) */
  momentoActivo() {
    let indice = 0;
    for (let i = 0; i < this.anclas.length; i++) {
      const anterior = i === 0
        ? FASES.landingFin * 0.5
        : (this.anclas[i - 1] + this.anclas[i]) / 2;
      if (this.progreso >= anterior) indice = i;
    }
    return indice;
  }
}
