/* ═══════════════════════════════════════════════════════════════
   Velos de seda — la gran estructura de profundidad del recorrido.

   Reemplazan a las viejas enredaderas de tubos: cortinas ENORMES y
   diáfanas de "seda de luz" (auroras cálidas) que ondulan lentísimo
   a los costados y por encima del corredor de cámara. Al pasar de
   largo dan la escala y el parallax del sitio de referencia, pero
   con materialidad romántica: tela, no estructura.

   Cada velo es un plano subdividido desplazado por ruido en GPU;
   el color son pliegues suaves bordó→rosa con la luz dorada rozando
   el borde superior, y el alfa NUNCA pasa de ~0.13: se miran A TRAVÉS,
   jamás tapan el corazón ni las cards.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CONFIG, PALETA, MOVIMIENTO_REDUCIDO } from './config.js';
import { PROFUNDIDAD } from './momentos.js';
import { RUIDO_SIMPLEX_GLSL } from './ruido.js';

export class VelosSeda {
  constructor(escena) {
    this.grupo = new THREE.Group();
    escena.add(this.grupo);
    this.materiales = [];

    /* ── Ubicaciones ──
       Tres velos fijos envuelven la COLUMNA DEL DESCENSO del landing
       (dos cortinas laterales + un telón de fondo); el resto se reparte
       a lo largo del corredor del timeline alternando lados, con una
       "aurora" cenital cada tantos. */
    const defs = [
      { pos: [-14, 6, -13], rot: [0, 0.55, 0.06], ancho: 20, alto: 36, s: 1.7 },
      { pos: [14.5, 9, -15], rot: [0, -0.6, -0.05], ancho: 18, alto: 38, s: 4.2 },
      { pos: [0, 11, -32], rot: [0, 0, 0.04], ancho: 38, alto: 30, s: 7.9 },
    ];

    const restantes = Math.max(CONFIG.cantidadVelos - defs.length, 2);
    const desde = -26;
    const hasta = PROFUNDIDAD - 12;
    for (let i = 0; i < restantes; i++) {
      const f = restantes === 1 ? 0.5 : i / (restantes - 1);
      const z = THREE.MathUtils.lerp(desde, hasta, f);
      const s = 11.3 + i * 2.71;

      if (i % 3 === 2) {
        /* Aurora cenital: cruza por ENCIMA del corredor, casi horizontal */
        defs.push({
          pos: [Math.sin(s) * 3, 8.5 + Math.sin(s * 2.2) * 1.5, z],
          rot: [-1.25, 0, Math.sin(s) * 0.25],
          ancho: 30, alto: 15, s,
        });
      } else {
        /* Cortina lateral, angulada hacia el eje (la cámara la roza) */
        const lado = i % 2 === 0 ? -1 : 1;
        defs.push({
          pos: [lado * (11.5 + Math.abs(Math.sin(s)) * 3.5), 1 + Math.sin(s * 1.7) * 2.5, z],
          rot: [Math.sin(s) * 0.08, -lado * (0.55 + Math.abs(Math.sin(s * 0.7)) * 0.25), Math.sin(s * 1.3) * 0.07],
          ancho: 15 + Math.abs(Math.sin(s * 2.1)) * 7, alto: 12 + Math.abs(Math.sin(s * 1.4)) * 6, s,
        });
      }
    }

    for (const def of defs) {
      const velo = new THREE.Mesh(
        new THREE.PlaneGeometry(def.ancho, def.alto, 72, 14),
        this._crearMaterial(def.s)
      );
      velo.position.fromArray(def.pos);
      velo.rotation.fromArray(def.rot);
      velo.frustumCulled = false;   // el vértice se desplaza en GPU
      velo.renderOrder = 0;
      this.grupo.add(velo);
    }
  }

  _crearMaterial(semilla) {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uSemilla: { value: semilla },
        uAmplitud: { value: MOVIMIENTO_REDUCIDO ? 0.35 : 1 },
        uIntensidad: { value: 1 },
        uColorA: { value: PALETA.bordo },
        uColorB: { value: PALETA.rosa },
        uColorOro: { value: PALETA.dorado },
      },
      vertexShader: /* glsl */ `
        ${RUIDO_SIMPLEX_GLSL}
        uniform float uTiempo;
        uniform float uSemilla;
        uniform float uAmplitud;
        varying vec2 vUv;
        varying float vDist;
        void main() {
          vUv = uv;
          /* Ondulación de tela bajo el agua: una onda grande y una fina */
          float t = uTiempo * 0.07 + uSemilla;
          vec3 p = position;
          float onda = snoise(vec3(uv.x * 2.2 + uSemilla, uv.y * 1.1, t));
          float rizo = snoise(vec3(uv.x * 5.0, uv.y * 2.6 + uSemilla, t * 1.6));
          p.z += (onda * 1.7 + rizo * 0.35) * uAmplitud;
          p.x += rizo * 0.4 * uAmplitud;

          vec4 pv = modelViewMatrix * vec4(p, 1.0);
          vDist = -pv.z;
          gl_Position = projectionMatrix * pv;
        }
      `,
      fragmentShader: /* glsl */ `
        ${RUIDO_SIMPLEX_GLSL}
        uniform float uTiempo;
        uniform float uSemilla;
        uniform float uIntensidad;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorOro;
        varying vec2 vUv;
        varying float vDist;
        void main() {
          /* Pliegues de seda: bandas suaves que respiran a lo largo del velo */
          float vaiven = snoise(vec3(vUv * 3.0, uTiempo * 0.05 + uSemilla)) * 2.2;
          float pliegues = 0.5 + 0.5 * sin(vUv.x * 12.566 + uSemilla * 3.0 + vaiven);
          pliegues = pow(pliegues, 3.2);   // bandas finas: seda, no niebla

          /* Bordes desvanecidos: jamás se ve un rectángulo */
          float borde = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x)
                      * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.86, vUv.y);

          /* Luz dorada rozando el dobladillo superior */
          float hebraOro = smoothstep(0.55, 0.98, vUv.y);

          vec3 color = mix(uColorA, uColorB, pliegues * 0.8);
          color = mix(color, uColorOro, hebraOro * 0.35 * pliegues);

          /* Desvanecer lo lejano (se funde con la nebulosa) y lo rasante */
          float porDist = (1.0 - smoothstep(22.0, 70.0, vDist)) * smoothstep(2.0, 7.0, vDist);

          float alfa = (0.014 + pliegues * 0.075) * borde * porDist * uIntensidad;
          gl_FragColor = vec4(color * 1.35, alfa);
        }
      `,
    });
    this.materiales.push(material);
    return material;
  }

  actualizar(dt, tiempo, intensidad = 1) {
    for (const m of this.materiales) {
      m.uniforms.uTiempo.value = tiempo;
      m.uniforms.uIntensidad.value = intensidad;
    }
  }

  destruir() {
    this.grupo.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.materiales.forEach((m) => m.dispose());
  }
}
