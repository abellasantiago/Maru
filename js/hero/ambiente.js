/* ═══════════════════════════════════════════════════════════════
   Ambiente de ensueño — bokeh + luciérnagas.

   Reemplaza al viejo "polvo de luz" (miles de puntos que invadían
   la pantalla) por la receta de la fotografía romántica:

   ▸ BOKEH: pocas luces GRANDES, desenfocadas y muy tenues, como
     luces de una noche cálida fuera de foco. Al pasar cerca de la
     cámara se deslizan enormes y suaves — profundidad pura, sin
     ruido. Cada una insinúa el anillo de lente de un bokeh real.
   ▸ LUCIÉRNAGAS: chispas doradas mínimas que titilan despacio,
     repartidas lejos del centro.

   Ambas capas despejan un corredor central (el descenso del corazón
   y el tubo del timeline): la imagen importante queda siempre limpia.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CONFIG, PALETA, POS_CORAZON, MOVIMIENTO_REDUCIDO } from './config.js';
import { PROFUNDIDAD } from './momentos.js';
import { RUIDO_SIMPLEX_GLSL } from './ruido.js';

/* ¿El punto invade los corredores que deben quedar despejados? */
function invadeCorredor(p, margenLanding, margenTubo) {
  /* Columna del descenso del landing (el corazón viaja por acá) */
  const enColumna = Math.abs(p.x) < margenLanding && p.z > -7 && p.z < 13 && p.y > -4;
  /* Tubo del vuelo del timeline (la cámara viaja por el eje z) */
  const enTubo = Math.abs(p.x) < margenTubo && Math.abs(p.y) < margenTubo && p.z < -9;
  return enColumna || enTubo;
}

/* Distribuye `cantidad` puntos en el volumen del recorrido, despejando corredores */
function distribuir(cantidad, margenLanding, margenTubo) {
  const posiciones = new Float32Array(cantidad * 3);
  const zFondo = PROFUNDIDAD - 18;
  const yTecho = POS_CORAZON[1] + 7;
  const p = new THREE.Vector3();
  for (let i = 0; i < cantidad; i++) {
    let intentos = 0;
    do {
      p.set(
        THREE.MathUtils.randFloatSpread(56),
        THREE.MathUtils.randFloat(-9, yTecho),
        THREE.MathUtils.randFloat(zFondo, 18)
      );
      intentos++;
    } while (invadeCorredor(p, margenLanding, margenTubo) && intentos < 30);
    posiciones[i * 3 + 0] = p.x;
    posiciones[i * 3 + 1] = p.y;
    posiciones[i * 3 + 2] = p.z;
  }
  return posiciones;
}

export class AmbienteEnsueno {
  constructor(escena) {
    this.materiales = [];
    this._construirBokeh(escena);
    this._construirLuciernagas(escena);
  }

  /* ── Bokeh: luces grandes fuera de foco ── */
  _construirBokeh(escena) {
    const cantidad = CONFIG.cantidadBokeh;
    const posiciones = distribuir(cantidad, 3.6, 2.4);
    const semillas = new Float32Array(cantidad);
    const tamanios = new Float32Array(cantidad);
    const mezclas = new Float32Array(cantidad);
    const alfas = new Float32Array(cantidad);
    for (let i = 0; i < cantidad; i++) {
      semillas[i] = Math.random() * 100;
      tamanios[i] = THREE.MathUtils.randFloat(18, 56);
      mezclas[i] = Math.random();
      alfas[i] = THREE.MathUtils.randFloat(0.035, 0.10);
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    geometria.setAttribute('semilla', new THREE.BufferAttribute(semillas, 1));
    geometria.setAttribute('tamanio', new THREE.BufferAttribute(tamanios, 1));
    geometria.setAttribute('mezcla', new THREE.BufferAttribute(mezclas, 1));
    geometria.setAttribute('alfaBase', new THREE.BufferAttribute(alfas, 1));

    this.materialBokeh = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uDPR: { value: 1 },
        uAmplitud: { value: MOVIMIENTO_REDUCIDO ? 0.2 : 0.8 },
        uIntensidad: { value: 1 },
        uColorCrema: { value: PALETA.crema },
        uColorOro: { value: PALETA.dorado },
        uColorRosa: { value: PALETA.rosa },
      },
      vertexShader: /* glsl */ `
        ${RUIDO_SIMPLEX_GLSL}
        attribute float semilla;
        attribute float tamanio;
        attribute float mezcla;
        attribute float alfaBase;
        uniform float uTiempo;
        uniform float uDPR;
        uniform float uAmplitud;
        varying float vSemilla;
        varying float vMezcla;
        varying float vAlfaBase;
        varying float vDist;
        void main() {
          vSemilla = semilla;
          vMezcla = mezcla;
          vAlfaBase = alfaBase;

          /* Deriva lentísima: luces suspendidas, no lluvia */
          float t = uTiempo * 0.03;
          vec3 p = position;
          p.x += snoise(vec3(position.yz * 0.08, t + semilla * 0.031)) * uAmplitud;
          p.y += snoise(vec3(position.zx * 0.08, t + semilla * 0.047)) * uAmplitud * 0.7;
          p.z += snoise(vec3(position.xy * 0.08, t + semilla * 0.023)) * uAmplitud * 0.5;

          vec4 pv = modelViewMatrix * vec4(p, 1.0);
          vDist = -pv.z;
          gl_PointSize = tamanio * uDPR * (46.0 / max(vDist, 0.001));
          gl_PointSize = clamp(gl_PointSize, 0.0, 100.0 * uDPR);
          gl_Position = projectionMatrix * pv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTiempo;
        uniform float uIntensidad;
        uniform vec3 uColorCrema;
        uniform vec3 uColorOro;
        uniform vec3 uColorRosa;
        varying float vSemilla;
        varying float vMezcla;
        varying float vAlfaBase;
        varying float vDist;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;   // 0 centro → 1 borde

          /* Disco desenfocado + anillo de lente apenas insinuado */
          float disco = smoothstep(1.0, 0.55, d);
          float anillo = smoothstep(0.98, 0.85, d) * smoothstep(0.55, 0.8, d);
          float luz = disco * (0.6 + anillo * 0.4);

          /* Rampa cálida: crema → oro → rosa */
          vec3 color = vMezcla < 0.5
            ? mix(uColorCrema, uColorOro, vMezcla * 2.0)
            : mix(uColorOro, uColorRosa, (vMezcla - 0.5) * 2.0);

          /* Respiración lenta, individual */
          float respira = 0.82 + 0.18 * sin(uTiempo * 0.4 + vSemilla);

          /* Cerca de la cámara se funde (nunca una mancha que tapa),
             lejos se disuelve en la nebulosa */
          float porDist = smoothstep(2.2, 5.5, vDist) * (1.0 - smoothstep(42.0, 88.0, vDist));

          float alfa = luz * vAlfaBase * respira * porDist * uIntensidad;
          if (alfa < 0.004) discard;
          gl_FragColor = vec4(color, alfa);
        }
      `,
    });
    this.materiales.push(this.materialBokeh);

    const puntos = new THREE.Points(geometria, this.materialBokeh);
    puntos.frustumCulled = false;
    puntos.renderOrder = 1;
    escena.add(puntos);
    this.bokeh = puntos;
  }

  /* ── Luciérnagas: chispas doradas mínimas ── */
  _construirLuciernagas(escena) {
    const cantidad = CONFIG.cantidadLuciernagas;
    const posiciones = distribuir(cantidad, 3.0, 1.9);
    const semillas = new Float32Array(cantidad);
    const tamanios = new Float32Array(cantidad);
    const mezclas = new Float32Array(cantidad);
    for (let i = 0; i < cantidad; i++) {
      semillas[i] = Math.random() * 100;
      tamanios[i] = THREE.MathUtils.randFloat(2.5, 5.5);
      mezclas[i] = Math.random();
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    geometria.setAttribute('semilla', new THREE.BufferAttribute(semillas, 1));
    geometria.setAttribute('tamanio', new THREE.BufferAttribute(tamanios, 1));
    geometria.setAttribute('mezcla', new THREE.BufferAttribute(mezclas, 1));

    this.materialLuciernagas = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uDPR: { value: 1 },
        uAmplitud: { value: MOVIMIENTO_REDUCIDO ? 0.15 : 0.5 },
        uIntensidad: { value: 1 },
        uColorA: { value: PALETA.dorado },
        uColorB: { value: PALETA.rojoClaro },
      },
      vertexShader: /* glsl */ `
        ${RUIDO_SIMPLEX_GLSL}
        attribute float semilla;
        attribute float tamanio;
        attribute float mezcla;
        uniform float uTiempo;
        uniform float uDPR;
        uniform float uAmplitud;
        varying float vSemilla;
        varying float vMezcla;
        varying float vDist;
        void main() {
          vSemilla = semilla;
          vMezcla = mezcla;

          /* Vuelo errático y lento, como luciérnaga de verdad */
          float t = uTiempo * 0.06;
          vec3 p = position;
          p.x += snoise(vec3(position.yz * 0.2, t + semilla * 0.03)) * uAmplitud;
          p.y += snoise(vec3(position.zx * 0.2, t + semilla * 0.05)) * uAmplitud;
          p.z += snoise(vec3(position.xy * 0.2, t + semilla * 0.02)) * uAmplitud * 0.6;

          vec4 pv = modelViewMatrix * vec4(p, 1.0);
          vDist = -pv.z;
          gl_PointSize = tamanio * uDPR * (40.0 / max(vDist, 0.001));
          gl_PointSize = clamp(gl_PointSize, 0.0, 14.0 * uDPR);
          gl_Position = projectionMatrix * pv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTiempo;
        uniform float uIntensidad;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vSemilla;
        varying float vMezcla;
        varying float vDist;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float disco = smoothstep(0.5, 0.1, d);

          /* Titileo con carácter: casi apagada, con pulsos brillantes */
          float onda = 0.5 + 0.5 * sin(uTiempo * (0.5 + fract(vSemilla) * 0.7) + vSemilla * 4.0);
          float titileo = 0.15 + 0.85 * onda * onda * onda;

          vec3 color = mix(uColorA, uColorB, vMezcla * 0.6);
          float porDist = smoothstep(0.8, 2.5, vDist) * (1.0 - smoothstep(30.0, 75.0, vDist));

          float alfa = disco * titileo * 0.55 * porDist * uIntensidad;
          if (alfa < 0.006) discard;
          gl_FragColor = vec4(color, alfa);
        }
      `,
    });
    this.materiales.push(this.materialLuciernagas);

    const puntos = new THREE.Points(geometria, this.materialLuciernagas);
    puntos.frustumCulled = false;
    puntos.renderOrder = 1;
    escena.add(puntos);
    this.luciernagas = puntos;
  }

  actualizar(dt, tiempo, dpr, intensidad = 1) {
    for (const m of this.materiales) {
      m.uniforms.uTiempo.value = tiempo;
      m.uniforms.uDPR.value = dpr;
      m.uniforms.uIntensidad.value = intensidad;
    }
  }

  destruir() {
    this.bokeh.geometry.dispose();
    this.luciernagas.geometry.dispose();
    this.materiales.forEach((m) => m.dispose());
  }
}
