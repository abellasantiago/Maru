/* ═══════════════════════════════════════════════════════════════
   Fondo de partículas ambientales — "polvo de luz".

   THREE.Points con ShaderMaterial custom (no PointsMaterial):
   ▸ tamaño atenuado por distancia a cámara
   ▸ deriva orgánica por ruido simplex en GPU (nada de random puro)
   ▸ variación de color rosa ↔ dorado ↔ rojo dentro de la paleta
   ▸ titileo suave por partícula
   El bloom del post-procesamiento les da el glow final.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CONFIG, PALETA } from './config.js';
import { RUIDO_SIMPLEX_GLSL } from './ruido.js';

export class ParticulasAmbiente {
  constructor(escena) {
    const cantidad = CONFIG.cantidadParticulas;

    /* ── Atributos por partícula ── */
    const posiciones = new Float32Array(cantidad * 3);
    const semillas = new Float32Array(cantidad);      // fase individual
    const tamanios = new Float32Array(cantidad);      // tamaño base en px
    const mezclas = new Float32Array(cantidad);       // 0..1 → color en la rampa

    const p = new THREE.Vector3();
    for (let i = 0; i < cantidad; i++) {
      /* Volumen que envuelve todo el recorrido de cámara (z +18 → −74),
         con un claro alrededor del corazón (origen) para que respire */
      do {
        p.set(
          THREE.MathUtils.randFloatSpread(34),
          THREE.MathUtils.randFloatSpread(20),
          THREE.MathUtils.randFloat(-74, 18)
        );
      } while (p.length() < 3.4);
      posiciones[i * 3 + 0] = p.x;
      posiciones[i * 3 + 1] = p.y;
      posiciones[i * 3 + 2] = p.z;

      semillas[i] = Math.random() * 100;
      tamanios[i] = THREE.MathUtils.randFloat(5, 17);
      mezclas[i] = Math.random();
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    geometria.setAttribute('semilla', new THREE.BufferAttribute(semillas, 1));
    geometria.setAttribute('tamanio', new THREE.BufferAttribute(tamanios, 1));
    geometria.setAttribute('mezcla', new THREE.BufferAttribute(mezclas, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uAmplitud: { value: CONFIG.amplitudDeriva },
        uColorRosa: { value: PALETA.rojoClaro },
        uColorDorado: { value: PALETA.dorado },
        uColorRojo: { value: PALETA.rojoVivo },
        uDPR: { value: 1 },
      },
      vertexShader: /* glsl */ `
        ${RUIDO_SIMPLEX_GLSL}

        attribute float semilla;
        attribute float tamanio;
        attribute float mezcla;

        uniform float uTiempo;
        uniform float uAmplitud;
        uniform float uDPR;

        varying float vMezcla;
        varying float vSemilla;
        varying float vDist;

        void main() {
          vMezcla = mezcla;
          vSemilla = semilla;

          /* Deriva orgánica: tres muestras de ruido desfasadas por eje.
             El tiempo avanza lento → flotan como polvo, no como lluvia. */
          float t = uTiempo * 0.05;
          vec3 p = position;
          p.x += snoise(vec3(position.xy * 0.12, t + semilla * 0.031)) * uAmplitud;
          p.y += snoise(vec3(position.yz * 0.12, t + semilla * 0.047)) * uAmplitud * 0.8;
          p.z += snoise(vec3(position.zx * 0.12, t + semilla * 0.023)) * uAmplitud * 0.6;

          vec4 posVista = modelViewMatrix * vec4(p, 1.0);
          vDist = -posVista.z;

          /* Tamaño en pantalla atenuado por distancia (perspectiva real) */
          gl_PointSize = tamanio * uDPR * (46.0 / max(vDist, 0.001));
          gl_PointSize = clamp(gl_PointSize, 0.0, 42.0 * uDPR);

          gl_Position = projectionMatrix * posVista;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTiempo;
        uniform vec3 uColorRosa;
        uniform vec3 uColorDorado;
        uniform vec3 uColorRojo;

        varying float vMezcla;
        varying float vSemilla;
        varying float vDist;

        void main() {
          /* Disco suave (el glow duro lo agrega el bloom) */
          float d = length(gl_PointCoord - 0.5);
          float disco = smoothstep(0.5, 0.08, d);

          /* Rampa de color: rosa → dorado → rojo, siempre cálido */
          vec3 color = vMezcla < 0.5
            ? mix(uColorRosa, uColorDorado, vMezcla * 2.0)
            : mix(uColorDorado, uColorRojo, (vMezcla - 0.5) * 2.0);

          /* Titileo individual, lento y desfasado */
          float titileo = 0.72 + 0.28 * sin(uTiempo * (0.6 + fract(vSemilla) * 0.9) + vSemilla);

          /* Desvanecer lo muy lejano (profundidad) y lo muy cercano (evita manchas) */
          float porDistancia = (1.0 - smoothstep(26.0, 64.0, vDist)) * smoothstep(0.6, 3.2, vDist);

          float alfa = disco * titileo * porDistancia * 0.85;
          if (alfa < 0.003) discard;

          gl_FragColor = vec4(color, alfa);
        }
      `,
    });

    this.puntos = new THREE.Points(geometria, this.material);
    this.puntos.frustumCulled = false;  // el volumen envuelve a la cámara siempre
    this.puntos.renderOrder = 1;
    escena.add(this.puntos);
  }

  /* Llamado en cada frame desde el bucle principal */
  actualizar(dt, tiempo, dpr) {
    this.material.uniforms.uTiempo.value = tiempo;
    this.material.uniforms.uDPR.value = dpr;
  }

  destruir() {
    this.puntos.geometry.dispose();
    this.material.dispose();
  }
}
