/* ═══════════════════════════════════════════════════════════════
   Atmósfera del mundo — el cielo que envuelve todo el recorrido.

   Tres capas, de lo infinito a lo lejano:
   ▸ DOMO NEBULOSA: esfera envolvente (sigue a la cámara, como un
     cielo real) con nubes FBM cálidas en la paleta bordó/rosa/oro,
     derivando lentísimo. Es el "espacio vasto" del sitio de
     referencia, pero al atardecer, nunca frío.
   ▸ ESTRELLAS: puntitos crema/oro titilando sobre el domo.
   ▸ EL AMANECER: un resplandor enorme y suave al FINAL del corredor.
     Es el destino del viaje — se ve desde el primer frame, crece al
     acercarse, y empalma con el velo crema de la pantalla final
     (todo el sitio es un viaje hacia esa luz).
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CONFIG, PALETA, ES_MOBILE } from './config.js';
import { PROFUNDIDAD } from './momentos.js';
import { RUIDO_SIMPLEX_GLSL } from './ruido.js';

/* Convierte un THREE.Color + alfa en string CSS (para texturas canvas) */
function rgba(color, alfa) {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alfa})`;
}

/* Textura radial reutilizable (halos, resplandores): degradé del centro
   al borde según las paradas [offset 0..1, colorCSS]. */
function texturaRadial(paradas, tam = 256) {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = tam;
  const ctx = lienzo.getContext('2d');
  const grad = ctx.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  for (const [offset, color] of paradas) grad.addColorStop(offset, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, tam, tam);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

export class Atmosfera {
  constructor(escena) {
    /* El cielo (domo + estrellas) SIGUE a la cámara: se percibe infinito.
       El amanecer, en cambio, es un objeto DEL MUNDO: crece al acercarse. */
    this.cielo = new THREE.Group();
    escena.add(this.cielo);

    this._construirDomo();
    this._construirEstrellas();
    this._construirAmanecer(escena);
  }

  /* ── Domo de nebulosa cálida ── */
  _construirDomo() {
    this.materialDomo = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTiempo: { value: 0 },
        uDesplazamiento: { value: 0 },   // avance de cámara → las nubes viran
        uColorFondo: { value: PALETA.fondo },
        uColorBordo: { value: PALETA.bordo },
        uColorRosa: { value: PALETA.rosa },
        uColorOro: { value: PALETA.dorado },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;   // esfera centrada en la cámara: position ES la dirección
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${RUIDO_SIMPLEX_GLSL}
        uniform float uTiempo;
        uniform float uDesplazamiento;
        uniform vec3 uColorFondo;
        uniform vec3 uColorBordo;
        uniform vec3 uColorRosa;
        uniform vec3 uColorOro;
        varying vec3 vDir;

        void main() {
          vec3 dir = normalize(vDir);

          /* FBM sobre la dirección (dominio esférico continuo, sin costuras).
             El tiempo y el avance de la cámara mueven las nubes DESPACIO. */
          vec3 q = dir * 2.1
                 + vec3(uDesplazamiento * 0.02, uTiempo * 0.008, uTiempo * 0.012);
          float n = snoise(q) * 0.55
                  + snoise(q * 2.3 + 7.2) * 0.28;
          #ifndef MOBILE
          n += snoise(q * 4.9 + 3.1) * 0.17;
          #endif
          float nubes = smoothstep(-0.25, 0.75, n);

          /* Horizonte apenas más cálido que el cenit (peso hacia abajo) */
          float horizonte = 1.0 - abs(dir.y);

          /* Resplandor hacia el destino del viaje (adelante y abajo: -Z).
             Es lo que hace que el fondo "apunte" hacia el amanecer. */
          float alAmanecer = pow(max(dot(dir, normalize(vec3(0.0, -0.18, -1.0))), 0.0), 3.0);

          /* Nubes CONTENIDAS: el cielo debe quedar oscuro para que bokeh
             y cards floten sobre descanso visual, no sobre relleno */
          vec3 color = uColorFondo;
          color = mix(color, uColorBordo, nubes * (0.14 + horizonte * 0.14));
          color = mix(color, uColorRosa, nubes * nubes * 0.05 * horizonte);
          color += uColorOro * alAmanecer * (0.09 + nubes * 0.08);
          color *= 0.78 + horizonte * 0.22;   // el cenit se apaga: foco en el viaje

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    if (ES_MOBILE) this.materialDomo.defines = { MOBILE: 1 };

    const domo = new THREE.Mesh(new THREE.SphereGeometry(150, 42, 28), this.materialDomo);
    domo.renderOrder = -10;      // siempre primero: todo lo demás flota encima
    domo.frustumCulled = false;
    this.cielo.add(domo);
  }

  /* ── Estrellas lejanas (pegadas al domo → sin parallax: infinito) ── */
  _construirEstrellas() {
    const cantidad = CONFIG.cantidadEstrellas;
    const posiciones = new Float32Array(cantidad * 3);
    const semillas = new Float32Array(cantidad);
    const tamanios = new Float32Array(cantidad);
    const mezclas = new Float32Array(cantidad);

    const dir = new THREE.Vector3();
    for (let i = 0; i < cantidad; i++) {
      /* Dirección uniforme en la esfera, a radio casi-domo */
      dir.randomDirection().multiplyScalar(142);
      posiciones[i * 3 + 0] = dir.x;
      posiciones[i * 3 + 1] = dir.y;
      posiciones[i * 3 + 2] = dir.z;
      semillas[i] = Math.random() * 100;
      tamanios[i] = THREE.MathUtils.randFloat(1.0, 2.6);
      mezclas[i] = Math.random();
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    geometria.setAttribute('semilla', new THREE.BufferAttribute(semillas, 1));
    geometria.setAttribute('tamanio', new THREE.BufferAttribute(tamanios, 1));
    geometria.setAttribute('mezcla', new THREE.BufferAttribute(mezclas, 1));

    this.materialEstrellas = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uDPR: { value: 1 },
        uColorA: { value: PALETA.crema },
        uColorB: { value: PALETA.dorado },
      },
      vertexShader: /* glsl */ `
        attribute float semilla;
        attribute float tamanio;
        attribute float mezcla;
        uniform float uDPR;
        varying float vSemilla;
        varying float vMezcla;
        void main() {
          vSemilla = semilla;
          vMezcla = mezcla;
          gl_PointSize = tamanio * uDPR * 1.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTiempo;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vSemilla;
        varying float vMezcla;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float disco = smoothstep(0.5, 0.12, d);
          /* Titileo lento y desfasado, nunca estroboscópico */
          float titileo = 0.45 + 0.55 * sin(uTiempo * (0.3 + fract(vSemilla) * 0.5) + vSemilla);
          vec3 color = mix(uColorA, uColorB, vMezcla * 0.7);
          float alfa = disco * titileo * 0.55;
          if (alfa < 0.01) discard;
          gl_FragColor = vec4(color, alfa);
        }
      `,
    });

    const estrellas = new THREE.Points(geometria, this.materialEstrellas);
    estrellas.renderOrder = -9;
    estrellas.frustumCulled = false;
    this.cielo.add(estrellas);
  }

  /* ── El amanecer: resplandor destino al final del corredor ── */
  _construirAmanecer(escena) {
    const z = PROFUNDIDAD - 48;

    /* Núcleo: crema → oro → rosa, el "sol" suave */
    const matNucleo = new THREE.SpriteMaterial({
      map: texturaRadial([
        [0.0, rgba(PALETA.crema, 0.9)],
        [0.22, rgba(PALETA.dorado, 0.55)],
        [0.55, rgba(PALETA.rosa, 0.20)],
        [1.0, rgba(PALETA.rosa, 0)],
      ]),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.nucleo = new THREE.Sprite(matNucleo);
    /* Bien abajo: durante el landing debe quedar CLARAMENTE debajo del
       corazón (no un brillo pegado a su punta), y en el timeline se ve
       como sol bajo en el horizonte, al fondo del corredor. */
    this.nucleo.position.set(0, -8, z);
    this.nucleo.renderOrder = -8;
    this.escalaNucleo = 72;
    this.nucleo.scale.setScalar(this.escalaNucleo);
    escena.add(this.nucleo);

    /* Halo amplio: el aire alrededor del amanecer, muy tenue */
    const matHalo = new THREE.SpriteMaterial({
      map: texturaRadial([
        [0.0, rgba(PALETA.rosa, 0.30)],
        [0.45, rgba(PALETA.bordo, 0.14)],
        [1.0, rgba(PALETA.bordo, 0)],
      ]),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.45,
    });
    this.halo = new THREE.Sprite(matHalo);
    this.halo.position.set(0, -11, z - 6);
    this.halo.renderOrder = -9;
    this.halo.scale.setScalar(130);
    escena.add(this.halo);
  }

  actualizar(dt, tiempo, camara, dpr) {
    /* El cielo acompaña a la cámara: envolvente e infinito, sin parallax */
    this.cielo.position.copy(camara.position);
    this.materialDomo.uniforms.uTiempo.value = tiempo;
    this.materialDomo.uniforms.uDesplazamiento.value = camara.position.z;
    this.materialEstrellas.uniforms.uTiempo.value = tiempo;
    this.materialEstrellas.uniforms.uDPR.value = dpr;

    /* El amanecer NACE durante el viaje: apagado en el landing (si no,
       asoma como un puntito pegado al corazón), se va encendiendo a medida
       que la cámara avanza por el timeline, y arde pleno en la llegada. */
    const dist = camara.position.distanceTo(this.nucleo.position);
    const cercania = 1 - THREE.MathUtils.smoothstep(dist, 255, 285);

    /* Y respira, lentísimo (~12 s por ciclo) */
    const pulso = 1 + Math.sin(tiempo * 0.5) * 0.035;
    this.nucleo.scale.setScalar(this.escalaNucleo * pulso);
    this.nucleo.material.opacity = (0.85 + Math.sin(tiempo * 0.5) * 0.1) * cercania;
    this.halo.material.opacity = 0.45 * cercania;
  }

  destruir() {
    this.cielo.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.materialDomo.dispose();
    this.materialEstrellas.dispose();
    this.nucleo.material.map.dispose();
    this.nucleo.material.dispose();
    this.halo.material.map.dispose();
    this.halo.material.dispose();
  }
}
