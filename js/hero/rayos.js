/* ═══════════════════════════════════════════════════════════════
   Rayos de luz detrás del corazón (god rays).

   Un único plano gigante que vive DETRÁS del corazón y siempre mira
   a la cámara. Sobre él, un abanico de haces cálidos que nacen del
   mismo punto que el corazón y se abren hacia afuera, girando
   lentísimo. No es un gráfico: es el aire con luz.

   Tres reglas para que quede detallista y no invasivo:
   ▸ El centro queda VACÍO (el corazón nunca se apoya sobre relleno).
   ▸ El alfa máximo es ridículamente bajo (~0.11): lo que se ve casi
     todo lo pone el bloom del post-proceso.
   ▸ Vive sólo en el landing: se enciende cuando el corazón termina
     de armarse y se apaga cuando se desarma.

   Contrato público (main.js):
     new Rayos(escena) · setAncla(v, camara) · setIntensidad(0..1)
     · actualizar(tiempo) · destruir()
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CONFIG, PALETA } from './config.js';
import { RUIDO_SIMPLEX_GLSL } from './ruido.js';

/* Tamaño del plano y cuánto se hunde por detrás del corazón. Con 46 de
   lado a ~8 unidades de distancia el abanico desborda el cuadro: nunca
   se ve un borde recto, sólo luz que se abre. */
const LADO = 46;
const DETRAS = 8;

export class Rayos {
  constructor(escena) {
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,        // vive detrás del corazón por composición, no por profundidad
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uIntensidad: { value: 0 },
        uColorOro: { value: PALETA.dorado },
        uColorRosa: { value: PALETA.rosa },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${RUIDO_SIMPLEX_GLSL}
        uniform float uTiempo;
        uniform float uIntensidad;
        uniform vec3 uColorOro;
        uniform vec3 uColorRosa;
        varying vec2 vUv;

        void main() {
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;          // 0 en el centro → 1 en el borde
          float a = atan(p.y, p.x);

          /* El abanico entero gira lentísimo (una vuelta cada ~5 min) y
             el ruido lo deforma bastante: no se leen "rayos" dibujados
             sino zonas de aire más cálido que otras. */
          float giro = a + uTiempo * 0.021;
          float ondula = snoise(vec3(cos(giro) * 1.6, sin(giro) * 1.6, uTiempo * 0.035)) * 0.75;
          float base = giro + ondula;

          /* Dos lóbulos MUY anchos y sin bordes: exponente bajo = esfumado.
             Nunca llega a 0, así no hay contraste duro entre haz y fondo. */
          float haces = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(base * 2.0), 1.6);

          /* Centro despejado (ahí va el corazón) y disolución larguísima
             hacia afuera: jamás se ve el rectángulo ni dónde termina */
          float radial = smoothstep(0.08, 0.52, r) * (1.0 - smoothstep(0.55, 1.0, r));

          vec3 color = mix(uColorOro, uColorRosa, smoothstep(0.15, 0.85, r));

          float alfa = haces * radial * uIntensidad;
          if (alfa < 0.002) discard;
          gl_FragColor = vec4(color, alfa);
        }
      `,
    });

    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(LADO, LADO), this.material);
    this.malla.renderOrder = -6;      // después del cielo, antes del corazón
    this.malla.frustumCulled = false;
    this.malla.visible = false;
    escena.add(this.malla);

    this._haciaAdelante = new THREE.Vector3();
  }

  /** Se planta detrás del ancla del corazón, de cara a la cámara */
  setAncla(ancla, camara) {
    if (!this.malla.visible) return;
    camara.getWorldDirection(this._haciaAdelante);
    this.malla.position.copy(ancla).addScaledVector(this._haciaAdelante, DETRAS);
    this.malla.quaternion.copy(camara.quaternion);
  }

  /** 0..1 — apagado del todo se va del render (ahorra un pase a pantalla completa) */
  setIntensidad(v) {
    const i = THREE.MathUtils.clamp(v, 0, 1);
    this.material.uniforms.uIntensidad.value = i * CONFIG.intensidadRayos;
    this.malla.visible = i > 0.004;
  }

  actualizar(tiempo) {
    if (this.malla.visible) this.material.uniforms.uTiempo.value = tiempo;
  }

  destruir() {
    this.malla.geometry.dispose();
    this.material.dispose();
  }
}
