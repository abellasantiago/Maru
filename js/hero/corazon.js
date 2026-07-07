/* ═══════════════════════════════════════════════════════════════
   Corazón central del hero — pieza MODULAR y reemplazable.

   Dos variantes conviven para poder compararlas en vivo (toggle en
   la UI, arriba a la derecha):

   ▸ "cristal": trazo de vidrio — tubo fino siguiendo la curva
     paramétrica del corazón + relleno traslúcido con fresnel.
   ▸ "luz": nube de partículas que dibujan el corazón (contorno +
     interior), antesala de la futura dirección "Corazón de luz"
     (ensamblado desde puntos dispersos — ya aprobada aparte).

   Contrato público (NO cambiar al reemplazar la pieza):
     new Corazon(escena) · setVariante(nombre) · actualizar(dt, tiempo, mouseNDC, camara) · destruir()
   Todo lo interno puede reescribirse sin tocar el resto del hero.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CONFIG, PALETA, POS_CORAZON } from './config.js';
import { RUIDO_SIMPLEX_GLSL } from './ruido.js';

/* Curva paramétrica clásica del corazón, normalizada a ~2.2 de alto */
function puntoCorazon(t, escala = 0.07) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return new THREE.Vector3(x * escala, (y + 2.5) * escala, 0);
}

/* Test punto-dentro-de-polígono (2D) para rellenar el interior */
function dentroDelCorazon(x, y, contorno) {
  let dentro = false;
  for (let i = 0, j = contorno.length - 1; i < contorno.length; j = i++) {
    const a = contorno[i], b = contorno[j];
    if ((a.y > y) !== (b.y > y) &&
        x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      dentro = !dentro;
    }
  }
  return dentro;
}

export class Corazon {
  constructor(escena) {
    this.grupo = new THREE.Group();
    this.grupo.position.fromArray(POS_CORAZON);   // arriba en el mundo (ver config)
    escena.add(this.grupo);

    /* Fuerza de reacción al mouse (0..1), suavizada frame a frame */
    this.fuerzaMouse = 0;
    this.materiales = [];

    /* Estado controlado por el scroll desde main.js:
       ▸ rotacionScroll: giro sobre su eje mientras se scrollea el landing.
       ▸ opacidad: 1 visible → 0 esfumado al entrar al timeline. */
    this.rotacionScroll = 0;
    this.opacidad = 1;

    this._construirCristal();
    this._construirLuz();

    this.variante = 'cristal';
    this.varianteCristal.visible = true;
    this.varianteLuz.visible = false;
  }

  /* ── Variante A: corazón de cristal (trazo de vidrio + fresnel) ── */
  _construirCristal() {
    this.varianteCristal = new THREE.Group();

    const puntos = [];
    for (let i = 0; i < 140; i++) {
      puntos.push(puntoCorazon((i / 140) * Math.PI * 2));
    }
    const curva = new THREE.CatmullRomCurve3(puntos, true);

    /* Trazo: tubo fino que el bloom convierte en filamento brillante */
    const geoTubo = new THREE.TubeGeometry(curva, 260, 0.028, 10, true);
    const matTubo = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uMouse: { value: 0 },
        uOpacidad: { value: 1 },
        uColorBase: { value: PALETA.rojoClaro },
        uColorBorde: { value: PALETA.dorado },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormalVista;
        varying vec3 vPosVista;
        void main() {
          vNormalVista = normalize(normalMatrix * normal);
          vec4 pv = modelViewMatrix * vec4(position, 1.0);
          vPosVista = pv.xyz;
          gl_Position = projectionMatrix * pv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTiempo;
        uniform float uMouse;
        uniform float uOpacidad;
        uniform vec3 uColorBase;
        uniform vec3 uColorBorde;
        varying vec3 vNormalVista;
        varying vec3 vPosVista;
        void main() {
          /* Fresnel: los bordes rasantes brillan como filo de vidrio.
             El clamp evita base negativa en pow (NaN que el bloom esparce). */
          vec3 haciaCamara = normalize(-vPosVista);
          float fresnel = pow(clamp(1.0 - abs(dot(vNormalVista, haciaCamara)), 0.0, 1.0), 1.6);
          vec3 color = mix(uColorBase, uColorBorde, fresnel);
          /* El mouse cercano intensifica el brillo, sutil */
          float brillo = 0.9 + fresnel * 0.9 + uMouse * 0.5;
          gl_FragColor = vec4(color * brillo, (0.5 + fresnel * 0.5) * uOpacidad);
        }
      `,
    });
    this.varianteCristal.add(new THREE.Mesh(geoTubo, matTubo));

    /* Relleno: lámina traslúcida apenas visible detrás del trazo */
    const forma = new THREE.Shape();
    puntos.forEach((p, i) => (i === 0 ? forma.moveTo(p.x, p.y) : forma.lineTo(p.x, p.y)));
    const geoLamina = new THREE.ShapeGeometry(forma, 24);
    const matLamina = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uMouse: { value: 0 },
        uOpacidad: { value: 1 },
        uColor: { value: PALETA.rojo },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv2;
        void main() {
          vUv2 = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uMouse;
        uniform float uOpacidad;
        uniform vec3 uColor;
        varying vec2 vUv2;
        void main() {
          /* Degradé vertical: más denso abajo, como cristal con peso */
          float grad = smoothstep(1.3, -1.3, vUv2.y);
          float alfa = (0.045 + grad * 0.075 + uMouse * 0.05) * uOpacidad;
          gl_FragColor = vec4(uColor * 1.2, alfa);
        }
      `,
    });
    this.varianteCristal.add(new THREE.Mesh(geoLamina, matLamina));

    this.materiales.push(matTubo, matLamina);
    this._matsCristal = [matTubo, matLamina];
    this.grupo.add(this.varianteCristal);
  }

  /* ── Variante B: corazón de luz (nube de partículas) ── */
  _construirLuz() {
    const cantidad = CONFIG.particulasCorazon;
    const contorno = [];
    for (let i = 0; i < 90; i++) {
      contorno.push(puntoCorazon((i / 90) * Math.PI * 2));
    }

    const posiciones = new Float32Array(cantidad * 3);
    const semillas = new Float32Array(cantidad);
    const tamanios = new Float32Array(cantidad);

    for (let i = 0; i < cantidad; i++) {
      let p;
      if (i < cantidad * 0.55) {
        /* 55%: sobre el contorno, con leve espesor */
        const base = puntoCorazon(Math.random() * Math.PI * 2);
        p = base.add(new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(0.09),
          THREE.MathUtils.randFloatSpread(0.09),
          THREE.MathUtils.randFloatSpread(0.16)
        ));
      } else {
        /* 45%: interior, por muestreo de rechazo contra el polígono */
        let x, y, intentos = 0;
        do {
          x = THREE.MathUtils.randFloatSpread(2.4);
          y = THREE.MathUtils.randFloat(-1.15, 1.05);
          intentos++;
        } while (!dentroDelCorazon(x, y, contorno) && intentos < 40);
        p = new THREE.Vector3(x, y, THREE.MathUtils.randFloatSpread(0.22));
      }
      posiciones[i * 3 + 0] = p.x;
      posiciones[i * 3 + 1] = p.y;
      posiciones[i * 3 + 2] = p.z;
      semillas[i] = Math.random() * 100;
      tamanios[i] = THREE.MathUtils.randFloat(3, 8.5);
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    geometria.setAttribute('semilla', new THREE.BufferAttribute(semillas, 1));
    geometria.setAttribute('tamanio', new THREE.BufferAttribute(tamanios, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uMouse: { value: 0 },
        uOpacidad: { value: 1 },
        uDPR: { value: 1 },
        uColorA: { value: PALETA.rojoVivo },
        uColorB: { value: PALETA.dorado },
      },
      vertexShader: /* glsl */ `
        ${RUIDO_SIMPLEX_GLSL}
        attribute float semilla;
        attribute float tamanio;
        uniform float uTiempo;
        uniform float uMouse;
        uniform float uDPR;
        varying float vSemilla;
        varying float vDist;
        void main() {
          vSemilla = semilla;
          /* Vibración orgánica alrededor de su lugar; el mouse la amplifica */
          float amp = 0.035 + uMouse * 0.06;
          vec3 p = position;
          p.x += snoise(vec3(position.yz * 2.0, uTiempo * 0.32 + semilla)) * amp;
          p.y += snoise(vec3(position.zx * 2.0, uTiempo * 0.28 + semilla)) * amp;
          p.z += snoise(vec3(position.xy * 2.0, uTiempo * 0.30 + semilla)) * amp;

          vec4 posVista = modelViewMatrix * vec4(p, 1.0);
          vDist = -posVista.z;
          gl_PointSize = tamanio * uDPR * (40.0 / max(vDist, 0.001));
          gl_Position = projectionMatrix * posVista;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTiempo;
        uniform float uMouse;
        uniform float uOpacidad;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vSemilla;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float disco = smoothstep(0.5, 0.06, d);
          vec3 color = mix(uColorA, uColorB, fract(vSemilla * 0.37));
          float titileo = 0.65 + 0.35 * sin(uTiempo * 1.4 + vSemilla * 3.0);
          /* Alfa contenida: la suma aditiva de ~mil puntos + bloom quema
             rápido; el corazón debe leerse como forma, no como mancha */
          float alfa = disco * titileo * (0.34 + uMouse * 0.2) * uOpacidad;
          if (alfa < 0.004) discard;
          gl_FragColor = vec4(color * (0.85 + uMouse * 0.35), alfa);
        }
      `,
    });

    this.varianteLuz = new THREE.Points(geometria, material);
    this.varianteLuz.frustumCulled = false;
    this.materiales.push(material);
    this._matLuz = material;
    this.grupo.add(this.varianteLuz);
  }

  /* Cambia de variante con un fundido cruzado corto */
  setVariante(nombre) {
    if (nombre === this.variante) return;
    this.variante = nombre;

    const entra = nombre === 'cristal' ? this.varianteCristal : this.varianteLuz;
    const sale = nombre === 'cristal' ? this.varianteLuz : this.varianteCristal;
    const matsEntra = nombre === 'cristal' ? this._matsCristal : [this._matLuz];
    const matsSale = nombre === 'cristal' ? [this._matLuz] : this._matsCristal;

    entra.visible = true;
    matsEntra.forEach((m) =>
      gsap.fromTo(m.uniforms.uOpacidad, { value: 0 }, { value: 1, duration: 0.8, ease: 'power2.out' })
    );
    matsSale.forEach((m) =>
      gsap.to(m.uniforms.uOpacidad, {
        value: 0,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => { sale.visible = false; },
      })
    );
  }

  /* ── Control desde el scroll (main.js) ── */
  setGiro(radianes) { this.rotacionScroll = radianes; }
  setOpacidad(o) {
    this.opacidad = o;
    /* Cuando está totalmente esfumado, lo sacamos del render (ahorra draw calls) */
    this.grupo.visible = o > 0.004;
  }

  actualizar(dt, tiempo, mouseNDC, camara, dpr) {
    if (!this.grupo.visible) return;   // esfumado: nada que animar

    /* Respiración: escala oscilante muy leve, loop infinito (~4 s) */
    const pulso = 1 + Math.sin(tiempo * 1.55) * CONFIG.amplitudRespiracion;
    this.grupo.scale.setScalar(pulso);

    /* Giro: leve vaivén de flotación + giro sobre su eje ligado al scroll */
    this.grupo.rotation.y = Math.sin(tiempo * 0.18) * 0.09 + this.rotacionScroll;

    /* Cercanía del mouse en pantalla → reacción (brillo/vibración) */
    let objetivo = 0;
    if (CONFIG.parallaxMouse > 0) {
      const proyectado = this.grupo.position.clone().project(camara);
      if (proyectado.z < 1) {
        const dist = Math.hypot(mouseNDC.x - proyectado.x, mouseNDC.y - proyectado.y);
        objetivo = 1 - THREE.MathUtils.smoothstep(dist, 0.12, 0.55);
      }
    }
    this.fuerzaMouse += (objetivo - this.fuerzaMouse) * Math.min(1, dt * 5);

    for (const m of this.materiales) {
      if (m.uniforms.uTiempo) m.uniforms.uTiempo.value = tiempo;
      if (m.uniforms.uMouse) m.uniforms.uMouse.value = this.fuerzaMouse;
      if (m.uniforms.uDPR) m.uniforms.uDPR.value = dpr;
      /* La opacidad maestra maneja el esfumado del corazón hacia el timeline */
      if (m.uniforms.uOpacidad) m.uniforms.uOpacidad.value = this.opacidad;
    }
  }

  destruir() {
    this.grupo.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.materiales.forEach((m) => m.dispose());
  }
}
