/* ═══════════════════════════════════════════════════════════════
   Atmósfera del mundo — el cielo que envuelve todo el recorrido.

   Tres capas, de lo infinito a lo lejano:
   ▸ DOMO NEBULOSA: esfera envolvente (sigue a la cámara, como un
     cielo real) con nubes FBM cálidas en la paleta bordó/rosa/oro,
     derivando lentísimo. Es el "espacio vasto" del sitio de
     referencia, pero al atardecer, nunca frío.
   ▸ ESTRELLAS: puntitos crema/oro titilando sobre el domo.
   ▸ FUGACES: cada tanto (nunca seguido) una estrella cruza el cielo
     por arriba del cuadro — una hebra finísima con la cabeza
     encendida y la cola apagándose. Es un detalle que se descubre,
     no un efecto: aparece lejos del centro y dura ~1 segundo.
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

/* Radio del cielo: domo a 150, estrellas a 142, fugaces apenas más acá */
const RADIO_FUGAZ = 138;

/* Apoyos para armar la base de pantalla al lanzar una fugaz */
const EJE_Y = new THREE.Vector3(0, 1, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);

export class Atmosfera {
  constructor(escena) {
    /* El cielo (domo + estrellas) SIGUE a la cámara: se percibe infinito.
       El amanecer, en cambio, es un objeto DEL MUNDO: crece al acercarse. */
    this.cielo = new THREE.Group();
    escena.add(this.cielo);

    this._construirDomo();
    this._construirEstrellas();
    this._construirFugaces();
    this._construirAmanecer(escena);

    /* Temporales del lanzamiento de fugaces (sin basura por frame) */
    this._adelante = new THREE.Vector3();
    this._derecha = new THREE.Vector3();
    this._arriba = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._alCorazon = new THREE.Vector3();
    this._ejeX = new THREE.Vector3();
    this._ejeY = new THREE.Vector3();
    this._ejeZ = new THREE.Vector3();
    this._base = new THREE.Matrix4();
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

  /* ── Estrellas fugaces ──
     Cada fugaz es un plano finito que VIVE sobre el domo: se ubica en un
     punto de la esfera y corre por un círculo máximo (tangente), siempre
     de cara a la cámara. Alterna entre espera larga y cruce corto. */
  _construirFugaces() {
    this.fugaces = [];

    for (let i = 0; i < CONFIG.cantidadFugaces; i++) {
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uVida: { value: 0 },
          uOpacidad: { value: 0.7 },
          uDespeje: { value: 1 },      // 0 cerca del corazón: nunca le pasa por encima
          uColorA: { value: PALETA.crema },
          uColorB: { value: PALETA.dorado },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uVida;
          uniform float uOpacidad;
          uniform float uDespeje;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          varying vec2 vUv;
          void main() {
            /* Transversal: un núcleo finísimo con un halo apenas insinuado */
            float t = abs(vUv.y - 0.5) * 2.0;
            float nucleo = exp(-t * t * 52.0);
            float halo   = exp(-t * t * 8.0) * 0.22;

            /* A lo largo: la cola se apaga, la cabeza es el punto encendido */
            float cola = pow(vUv.x, 3.2);
            float cabeza = smoothstep(0.88, 1.0, vUv.x);

            /* Envolvente: entra rápido y se apaga ANTES de frenar, así nunca
               se la ve detenerse ni desaparecer de golpe */
            float env = smoothstep(0.0, 0.10, uVida) * (1.0 - smoothstep(0.55, 1.0, uVida));

            float luz = (nucleo + halo) * cola + cabeza * nucleo * 1.3;
            vec3 color = mix(uColorB, uColorA, cola);   // cabeza crema, cola dorada

            float alfa = luz * env * uOpacidad * uDespeje;
            if (alfa < 0.004) discard;
            gl_FragColor = vec4(color, alfa);
          }
        `,
      });

      /* Plano unitario: el largo y el grosor se eligen en cada lanzamiento */
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      mesh.renderOrder = -7;      // sobre el domo y las estrellas
      mesh.visible = false;
      this.cielo.add(mesh);

      this.fugaces.push({
        mesh,
        material,
        pos: new THREE.Vector3(),
        dir: new THREE.Vector3(),
        vida: 0,
        duracion: 1,
        velocidad: 70,
        /* Primera aparición escalonada: nunca dos juntas al arrancar */
        espera: THREE.MathUtils.randFloat(4, 10) + i * 7,
      });
    }
  }

  /* Elige punto de partida, rumbo y tamaño de un cruce.
     Aparece SIEMPRE por encima del centro óptico (donde vive el corazón)
     y cae en diagonal, como una fugaz de verdad. */
  _lanzarFugaz(fugaz, camara) {
    camara.getWorldDirection(this._adelante);

    /* Base de pantalla (derecha/arriba reales de la cámara). Si la cámara
       mirara casi vertical, el producto cruz degenera: usamos otro apoyo. */
    const apoyo = Math.abs(this._adelante.y) > 0.95 ? EJE_Z : EJE_Y;
    this._derecha.crossVectors(this._adelante, apoyo).normalize();
    this._arriba.crossVectors(this._derecha, this._adelante).normalize();

    /* Punto de partida ATADO AL ENCUADRE REAL: medimos el frustum de la
       cámara y elegimos dentro de él, en la franja de ARRIBA. Si no, con
       constantes fijas la mitad de las fugaces nacería fuera de pantalla
       (y con el fov de mobile, casi todas). */
    const medioAlto = Math.tan(THREE.MathUtils.degToRad(camara.fov * 0.5));
    const medioAncho = medioAlto * camara.aspect;

    fugaz.pos.copy(this._adelante)
      .addScaledVector(this._derecha, medioAncho * THREE.MathUtils.randFloat(-0.72, 0.72))
      .addScaledVector(this._arriba, medioAlto * THREE.MathUtils.randFloat(0.55, 0.95))
      .setLength(RADIO_FUGAZ);

    /* Rumbo: hacia un costado (al azar) y en diagonal hacia abajo, pero
       con poca caída — se apaga arriba, nunca baja hasta el corazón */
    const lado = Math.random() < 0.5 ? -1 : 1;
    fugaz.dir.copy(this._derecha)
      .multiplyScalar(lado * THREE.MathUtils.randFloat(0.6, 1.0))
      .addScaledVector(this._arriba, -THREE.MathUtils.randFloat(0.3, 0.65));

    /* Tangente al domo: la fugaz corre POR el cielo, no lo atraviesa */
    this._normal.copy(fugaz.pos).normalize();
    fugaz.dir.addScaledVector(this._normal, -fugaz.dir.dot(this._normal)).normalize();

    fugaz.vida = 0;
    fugaz.duracion = THREE.MathUtils.randFloat(0.9, 1.4);
    fugaz.velocidad = THREE.MathUtils.randFloat(38, 58);
    fugaz.mesh.scale.set(
      THREE.MathUtils.randFloat(16, 26),   // largo de la estela (~40% del alto del cuadro)
      THREE.MathUtils.randFloat(1.7, 2.6), // grosor (el núcleo es mucho más fino)
      1
    );
    fugaz.material.uniforms.uOpacidad.value = THREE.MathUtils.randFloat(0.55, 0.8);
    fugaz.mesh.visible = true;
  }

  _actualizarFugaces(dt, camara, anclaCorazon) {
    for (const fugaz of this.fugaces) {
      if (!fugaz.mesh.visible) {
        /* En calma: descontando los segundos hasta el próximo cruce */
        fugaz.espera -= dt;
        if (fugaz.espera > 0) continue;
        this._lanzarFugaz(fugaz, camara);
        /* Sin `continue`: el plano DEBE ubicarse y orientarse en este mismo
           frame. Si no, pasa un cuadro entero con la transformación anterior
           —encima de la cámara— y se ve un rectángulo enorme cruzando. */
      } else {
        fugaz.vida += dt / fugaz.duracion;
        if (fugaz.vida >= 1) {
          fugaz.mesh.visible = false;
          fugaz.espera = THREE.MathUtils.randFloat(CONFIG.esperaFugaz[0], CONFIG.esperaFugaz[1]);
          continue;
        }
        /* Avanza y vuelve a pegarse al domo (círculo máximo) */
        fugaz.pos.addScaledVector(fugaz.dir, fugaz.velocidad * dt).setLength(RADIO_FUGAZ);
      }

      this._normal.copy(fugaz.pos).normalize();
      fugaz.dir.addScaledVector(this._normal, -fugaz.dir.dot(this._normal)).normalize();

      /* Orientación: +X local = rumbo (la cabeza va adelante),
         +Z local = hacia la cámara (el plano siempre se ve de frente) */
      this._ejeX.copy(fugaz.dir);
      this._ejeZ.copy(this._normal).negate();
      this._ejeY.crossVectors(this._ejeZ, this._ejeX);
      this._base.makeBasis(this._ejeX, this._ejeY, this._ejeZ);
      fugaz.mesh.quaternion.setFromRotationMatrix(this._base);
      fugaz.mesh.position.copy(fugaz.pos);
      fugaz.material.uniforms.uVida.value = fugaz.vida;

      /* ── El corazón SIEMPRE adelante ──
         Nada puede pasar por encima de él. Como todo el hero es aditivo, la
         profundidad no alcanza (sumar es sumar, venga de adelante o de
         atrás): lo que hacemos es apagar la fugaz cuando su recorrido la
         acerca a la dirección donde está el corazón. */
      let despeje = 1;
      if (anclaCorazon) {
        this._alCorazon.copy(anclaCorazon).sub(camara.position).normalize();
        const angulo = Math.acos(THREE.MathUtils.clamp(this._normal.dot(this._alCorazon), -1, 1));
        despeje = THREE.MathUtils.smoothstep(angulo, 0.30, 0.58);
      }
      fugaz.material.uniforms.uDespeje.value = despeje;
    }
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

  actualizar(dt, tiempo, camara, dpr, anclaCorazon = null) {
    /* El cielo acompaña a la cámara: envolvente e infinito, sin parallax */
    this.cielo.position.copy(camara.position);
    this.materialDomo.uniforms.uTiempo.value = tiempo;
    this.materialDomo.uniforms.uDesplazamiento.value = camara.position.z;
    this.materialEstrellas.uniforms.uTiempo.value = tiempo;
    this.materialEstrellas.uniforms.uDPR.value = dpr;

    this._actualizarFugaces(dt, camara, anclaCorazon);

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
    this.fugaces.forEach((f) => f.material.dispose());
    this.nucleo.material.map.dispose();
    this.nucleo.material.dispose();
    this.halo.material.map.dispose();
    this.halo.material.dispose();
  }
}
