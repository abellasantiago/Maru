/* Un hilo de brasas une el desarme del corazón con la primera fotografía.
   Es una única nube pequeña: el frente luminoso avanza con el scroll por un
   arco 3D, deja una estela tenue y entrega la luz a la card. */

import * as THREE from 'three';
import { PALETA, MOVIMIENTO_REDUCIDO } from './config.js';

const CURVA_GLSL = /* glsl */ `
  vec3 punto(float t) {
    float s = 1.0 - t;
    vec3 control1 = mix(uInicio, uDestino, 0.27) + vec3(0.0, -0.8, -1.4);
    vec3 control2 = mix(uInicio, uDestino, 0.72) + vec3(uDestino.x * 0.2, 0.95, 1.5);
    return s*s*s*uInicio + 3.0*s*s*t*control1
         + 3.0*s*t*t*control2 + t*t*t*uDestino;
  }
`;

export class HiloLuz {
  constructor(escena, destino) {
    const cantidad = MOVIMIENTO_REDUCIDO ? 100 : 520;
    const posiciones = new Float32Array(cantidad * 3);
    const camino = new Float32Array(cantidad);
    const desvio = new Float32Array(cantidad * 3);
    const tamano = new Float32Array(cantidad);
    const semilla = new Float32Array(cantidad);

    for (let i = 0; i < cantidad; i++) {
      camino[i] = (i + Math.random() * 0.75) / cantidad;
      desvio[i * 3] = THREE.MathUtils.randFloatSpread(2);
      desvio[i * 3 + 1] = THREE.MathUtils.randFloatSpread(2);
      desvio[i * 3 + 2] = THREE.MathUtils.randFloatSpread(2);
      tamano[i] = THREE.MathUtils.randFloat(2.2, 3.9);
      semilla[i] = Math.random();
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    geometria.setAttribute('aCamino', new THREE.BufferAttribute(camino, 1));
    geometria.setAttribute('aDesvio', new THREE.BufferAttribute(desvio, 3));
    geometria.setAttribute('aTamano', new THREE.BufferAttribute(tamano, 1));
    geometria.setAttribute('aSemilla', new THREE.BufferAttribute(semilla, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uInicio: { value: new THREE.Vector3() },
        uDestino: { value: new THREE.Vector3().fromArray(destino).add(new THREE.Vector3(0, 0, 0.45)) },
        uAvance: { value: 0 },
        uPresencia: { value: 0 },
        uTiempo: { value: 0 },
        uDPR: { value: 1 },
        uRojo: { value: PALETA.rojoClaro },
        uDorado: { value: PALETA.dorado },
      },
      vertexShader: /* glsl */ `
        attribute float aCamino;
        attribute vec3 aDesvio;
        attribute float aTamano;
        attribute float aSemilla;
        uniform vec3 uInicio;
        uniform vec3 uDestino;
        uniform float uAvance;
        uniform float uPresencia;
        uniform float uTiempo;
        uniform float uDPR;
        varying float vAlfa;
        varying float vCabeza;
        varying float vSemilla;
        ${CURVA_GLSL}
        void main() {
          float t = clamp(aCamino + sin(uTiempo * 1.4 + aSemilla * 17.0) * 0.006, 0.0, 1.0);
          vec3 p = punto(t);
          float cuerpo = sin(t * 3.14159265);
          p += aDesvio * (0.045 + cuerpo * 0.23);
          float estela = 1.0 - smoothstep(uAvance - 0.12, uAvance + 0.035, t);
          float cabeza = exp(-pow((t - uAvance) / 0.10, 2.0));
          vCabeza = cabeza;
          vSemilla = aSemilla;
          vAlfa = uPresencia * (0.22 * estela + 0.85 * cabeza)
                * (0.6 + aSemilla * 0.4);
          vec4 vista = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(13.0, aTamano * (32.0 / max(-vista.z, 1.0))
                       * (1.0 + cabeza * 0.5)) * uDPR;
          gl_Position = projectionMatrix * vista;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uRojo;
        uniform vec3 uDorado;
        varying float vAlfa;
        varying float vCabeza;
        varying float vSemilla;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          float luz = exp(-r*r*65.0) * 0.75 + exp(-r*r*11.0) * 0.16;
          float alfa = luz * vAlfa * 0.62;
          if (!(alfa > 0.003)) discard;
          vec3 color = mix(uRojo, uDorado, 0.16 + vCabeza * 0.36 + vSemilla * 0.1);
          gl_FragColor = vec4(color, alfa);
        }
      `,
    });

    this.puntos = new THREE.Points(geometria, this.material);
    this.puntos.frustumCulled = false;
    this.puntos.visible = false;
    this.puntos.renderOrder = 3;
    escena.add(this.puntos);

    /* Una gasa ancha y muy tenue reúne los puntos en una dirección visible.
       No es un tubo sólido: los bordes se pierden en el aire y las chispas
       siguen dibujando el camino. */
    const cortes = 72;
    const tCinta = new Float32Array((cortes + 1) * 2);
    const lado = new Float32Array((cortes + 1) * 2);
    const caras = [];
    for (let i = 0; i <= cortes; i++) {
      for (let b = 0; b < 2; b++) {
        tCinta[i * 2 + b] = i / cortes;
        lado[i * 2 + b] = b === 0 ? -1 : 1;
      }
      if (i < cortes) {
        const k = i * 2;
        caras.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const cintaGeometria = new THREE.BufferGeometry();
    cintaGeometria.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array((cortes + 1) * 2 * 3), 3
    ));
    cintaGeometria.setAttribute('aCamino', new THREE.BufferAttribute(tCinta, 1));
    cintaGeometria.setAttribute('aLado', new THREE.BufferAttribute(lado, 1));
    cintaGeometria.setIndex(caras);
    this.cintaMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uInicio: this.material.uniforms.uInicio,
        uDestino: this.material.uniforms.uDestino,
        uAvance: this.material.uniforms.uAvance,
        uPresencia: this.material.uniforms.uPresencia,
        uCamara: { value: new THREE.Vector3() },
        uRojo: this.material.uniforms.uRojo,
        uDorado: this.material.uniforms.uDorado,
      },
      vertexShader: /* glsl */ `
        attribute float aCamino;
        attribute float aLado;
        uniform vec3 uInicio;
        uniform vec3 uDestino;
        uniform vec3 uCamara;
        uniform float uAvance;
        uniform float uPresencia;
        varying float vAlfa;
        varying float vLado;
        varying float vCabeza;
        ${CURVA_GLSL}
        void main() {
          float t = aCamino;
          vec3 p = punto(t);
          vec3 tangente = normalize(punto(min(t + 0.01, 1.0))
                            - punto(max(t - 0.01, 0.0)));
          vec3 haciaCamara = normalize(uCamara - p);
          vec3 lateral = cross(tangente, haciaCamara);
          if (length(lateral) < 0.01) lateral = vec3(1.0, 0.0, 0.0);
          lateral = normalize(lateral);
          p += lateral * aLado * (0.14 + sin(t * 3.14159265) * 0.23);
          float estela = 1.0 - smoothstep(uAvance - 0.08, uAvance + 0.045, t);
          float cabeza = exp(-pow((t - uAvance) / 0.13, 2.0));
          vCabeza = cabeza;
          vLado = aLado;
          vAlfa = uPresencia * (0.06 * estela + 0.28 * cabeza);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uRojo;
        uniform vec3 uDorado;
        varying float vAlfa;
        varying float vLado;
        varying float vCabeza;
        void main() {
          float centro = pow(max(0.0, 1.0 - abs(vLado)), 1.6);
          float alfa = vAlfa * centro;
          if (!(alfa > 0.002)) discard;
          gl_FragColor = vec4(mix(uRojo, uDorado, 0.15 + vCabeza * 0.32), alfa);
        }
      `,
    });
    this.cinta = new THREE.Mesh(cintaGeometria, this.cintaMaterial);
    this.cinta.frustumCulled = false;
    this.cinta.visible = false;
    this.cinta.renderOrder = 2;
    escena.add(this.cinta);
  }

  actualizar(tiempo, inicio, avance, presencia, dpr, camara) {
    this.puntos.visible = presencia > 0.002;
    this.cinta.visible = this.puntos.visible && !MOVIMIENTO_REDUCIDO;
    if (!this.puntos.visible) return;
    const u = this.material.uniforms;
    u.uInicio.value.copy(inicio);
    u.uAvance.value = avance;
    u.uPresencia.value = presencia;
    u.uTiempo.value = MOVIMIENTO_REDUCIDO ? 0 : tiempo;
    u.uDPR.value = dpr;
    this.cintaMaterial.uniforms.uCamara.value.copy(camara.position);
  }
}
