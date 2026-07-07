/* ═══════════════════════════════════════════════════════════════
   Estructura orgánica de fondo — capa intermedia de profundidad.

   Reinterpretación floral/romántica del gran objeto orgánico del
   sitio de referencia: enredaderas estilizadas (tubos sinuosos con
   fresnel bordó traslúcido) que ondulan despacio, salpicadas de
   "brotes" de luz dorada. Viven detrás de los paneles y a los
   costados del corredor de cámara: dan contexto de profundidad sin
   competir nunca con el corazón ni con los paneles.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { PALETA, ES_MOBILE } from './config.js';
import { PROFUNDIDAD } from './momentos.js';
import { RUIDO_SIMPLEX_GLSL } from './ruido.js';

/* Genera una curva sinuosa vertical, como rama que sube */
function curvaEnredadera(xBase, zBase, semilla, alto = 30) {
  const puntos = [];
  const pasos = 9;
  for (let i = 0; i <= pasos; i++) {
    const f = i / pasos;
    const y = THREE.MathUtils.lerp(-alto * 0.55, alto * 0.55, f);
    puntos.push(new THREE.Vector3(
      xBase + Math.sin(f * Math.PI * 2.2 + semilla) * 2.6 + Math.sin(f * 9 + semilla * 2) * 0.7,
      y,
      zBase + Math.cos(f * Math.PI * 1.7 + semilla) * 3.2
    ));
  }
  return new THREE.CatmullRomCurve3(puntos);
}

export class EstructuraOrganica {
  constructor(escena) {
    this.grupo = new THREE.Group();
    escena.add(this.grupo);
    this.materiales = [];

    /* Material compartido de las ramas: fresnel bordó, aditivo y tenue */
    const crearMaterialRama = () => {
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTiempo: { value: 0 },
          uColor: { value: PALETA.bordo },
          uColorBrillo: { value: PALETA.rojoClaro },
          uIntensidad: { value: 1 },
        },
        vertexShader: /* glsl */ `
          ${RUIDO_SIMPLEX_GLSL}
          uniform float uTiempo;
          varying vec3 vNormalVista;
          varying vec3 vPosVista;
          void main() {
            /* Ondulación lenta de toda la rama, como tela bajo el agua */
            vec3 p = position;
            float vaiven = snoise(vec3(position.y * 0.08, uTiempo * 0.1, position.z * 0.05));
            p.x += vaiven * 0.9;
            p.z += snoise(vec3(position.y * 0.06, uTiempo * 0.08, 7.0)) * 0.7;

            vNormalVista = normalize(normalMatrix * normal);
            vec4 pv = modelViewMatrix * vec4(p, 1.0);
            vPosVista = pv.xyz;
            gl_Position = projectionMatrix * pv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform vec3 uColorBrillo;
          uniform float uIntensidad;
          varying vec3 vNormalVista;
          varying vec3 vPosVista;
          void main() {
            vec3 haciaCamara = normalize(-vPosVista);
            /* clamp: evita pow con base negativa (NaN) en bordes rasantes */
            float fresnel = pow(clamp(1.0 - abs(dot(vNormalVista, haciaCamara)), 0.0, 1.0), 2.0);
            /* Se desvanece con la distancia para fundirse con el fondo */
            float porDistancia = 1.0 - smoothstep(18.0, 70.0, -vPosVista.z);
            vec3 color = mix(uColor, uColorBrillo, fresnel * 0.7);
            float alfa = (0.04 + fresnel * 0.24) * porDistancia * uIntensidad;
            gl_FragColor = vec4(color * 1.4, alfa);
          }
        `,
      });
      this.materiales.push(m);
      return m;
    };

    /* Enredaderas repartidas a lo largo de TODO el corredor (z 0 → PROFUNDIDAD),
       alternando lados, para que siempre haya profundidad de fondo al viajar. */
    const cantidad = ES_MOBILE ? 5 : 9;
    const largo = Math.abs(PROFUNDIDAD) + 14;
    const definiciones = [];
    for (let i = 0; i < cantidad; i++) {
      const lado = i % 2 === 0 ? -1 : 1;
      definiciones.push({
        x: lado * (6.5 + (i % 3) * 1.2),
        z: -12 - (i / Math.max(1, cantidad - 1)) * largo,
        s: i * 2.3,
      });
    }

    const puntosBrotes = [];
    for (const def of definiciones) {
      const curva = curvaEnredadera(def.x, def.z, def.s);
      const tubo = new THREE.Mesh(
        new THREE.TubeGeometry(curva, 140, 0.22, 8, false),
        crearMaterialRama()
      );
      tubo.renderOrder = 0;
      this.grupo.add(tubo);

      /* Ramas secundarias más finas, desprendidas de la principal */
      for (let r = 0; r < 2; r++) {
        const origen = curva.getPointAt(0.25 + r * 0.4);
        const sub = curvaEnredadera(origen.x + (r ? 1.6 : -1.4), origen.z, def.s + r * 3.1, 14);
        const tuboSub = new THREE.Mesh(
          new THREE.TubeGeometry(sub, 80, 0.09, 6, false),
          crearMaterialRama()
        );
        tuboSub.position.y = origen.y * 0.4;
        this.grupo.add(tuboSub);
      }

      /* Brotes: puntitos de luz dorada salpicados sobre la rama */
      for (let b = 0; b < 26; b++) {
        const p = curva.getPointAt(Math.random());
        puntosBrotes.push(
          p.x + THREE.MathUtils.randFloatSpread(1.2),
          p.y + THREE.MathUtils.randFloatSpread(1.2),
          p.z + THREE.MathUtils.randFloatSpread(1.2)
        );
      }
    }

    /* Sistema mínimo de brotes (florcitas de luz) */
    const geoBrotes = new THREE.BufferGeometry();
    geoBrotes.setAttribute('position', new THREE.BufferAttribute(new Float32Array(puntosBrotes), 3));
    const semillas = new Float32Array(puntosBrotes.length / 3);
    for (let i = 0; i < semillas.length; i++) semillas[i] = Math.random() * 100;
    geoBrotes.setAttribute('semilla', new THREE.BufferAttribute(semillas, 1));

    this.materialBrotes = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uDPR: { value: 1 },
        uColor: { value: PALETA.dorado },
        uIntensidad: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float semilla;
        uniform float uTiempo;
        uniform float uDPR;
        varying float vSemilla;
        varying float vDist;
        void main() {
          vSemilla = semilla;
          vec4 pv = modelViewMatrix * vec4(position, 1.0);
          vDist = -pv.z;
          gl_PointSize = (7.0 + fract(semilla * 0.13) * 8.0) * uDPR * (40.0 / max(vDist, 0.001));
          gl_Position = projectionMatrix * pv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTiempo;
        uniform vec3 uColor;
        uniform float uIntensidad;
        varying float vSemilla;
        varying float vDist;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float disco = smoothstep(0.5, 0.1, d);
          float titileo = 0.55 + 0.45 * sin(uTiempo * 0.9 + vSemilla * 4.0);
          float porDistancia = 1.0 - smoothstep(16.0, 70.0, vDist);
          float alfa = disco * titileo * porDistancia * 0.7 * uIntensidad;
          if (alfa < 0.006) discard;
          gl_FragColor = vec4(uColor, alfa);
        }
      `,
    });
    this.materiales.push(this.materialBrotes);

    this.brotes = new THREE.Points(geoBrotes, this.materialBrotes);
    this.brotes.frustumCulled = false;
    this.grupo.add(this.brotes);
  }

  actualizar(dt, tiempo, dpr, intensidad = 1) {
    for (const m of this.materiales) {
      if (m.uniforms.uTiempo) m.uniforms.uTiempo.value = tiempo;
      if (m.uniforms.uDPR) m.uniforms.uDPR.value = dpr;
      if (m.uniforms.uIntensidad) m.uniforms.uIntensidad.value = intensidad;
    }
  }

  destruir() {
    this.grupo.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.materiales.forEach((m) => m.dispose());
  }
}
