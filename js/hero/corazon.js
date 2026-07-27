/* ═══════════════════════════════════════════════════════════════
   Corazón central del hero — point cloud rojo en 3D.

   Miles de partículas rojas llenan un corazón 3D con la SILUETA de
   la curva ♥ clásica (surco profundo, punta elegante) inflada en
   profundidad como un almohadón: de frente es un corazón perfecto,
   girado tiene panza y cuerpo. La nube:

   ▸ ENTRA CAYENDO: al cargar el sitio las partículas llueven desde
     bien arriba y desembocan en la forma, armándola de abajo hacia
     arriba (la punta primero, los lóbulos al final). Mientras caen
     son chispas encendidas; al asentarse se calman. Es sólo la
     entrada: el corazón que queda es exactamente el de siempre.
   ▸ respira y vibra con vida propia (ruido orgánico en GPU)
   ▸ REPELE al cursor: las partículas se apartan en 3D alrededor
     del punto donde el mouse toca el plano del corazón, y vuelven
     solas a su lugar
   ▸ gira sobre su eje con el scroll (setGiro, lo maneja main.js)
   ▸ al avanzar el landing SE DESARMA: cada partícula vuela hacia
     su propio punto de dispersión (setDesarme 0..1). El destino
     final de esas partículas queda abierto — hoy se disuelven en
     el mundo; mañana pueden re-armarse en otra forma.

   Contrato público (main.js):
     new Corazon(escena) · setGiro(rad) · setPosicion(v)
     · setDesarme(0..1) · actualizar(dt, tiempo, mouseNDC, camara, dpr)
     · entrada (0..1, sólo lectura) · destruir()
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CONFIG, PALETA, POS_CORAZON } from './config.js';
import { RUIDO_SIMPLEX_GLSL } from './ruido.js';

/* ── La forma: curva paramétrica CLÁSICA del corazón (surco profundo,
   lóbulos llenos, punta elegante) inflada en profundidad como un
   almohadón. La silueta frontal es un ♥ de verdad — no la versión
   implícita regordeta que probamos antes. ── */

const ESCALA = 0.11;         // 16·2·escala ≈ 3.5 de ancho, ~3.1 de alto
const CENTRADO_Y = 2.75;     // centra el rango vertical de la curva

function puntoCorazon2D(t) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return { x: x * ESCALA, y: (y + CENTRADO_Y) * ESCALA };
}

/* Test punto-dentro-de-polígono (2D) contra el contorno del corazón */
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

/* Distancia mínima de un punto al contorno (para inflar el almohadón) */
function distanciaAlContorno(x, y, contorno) {
  let min = Infinity;
  for (const c of contorno) {
    const dx = x - c.x, dy = y - c.y;
    const d = dx * dx + dy * dy;
    if (d < min) min = d;
  }
  return Math.sqrt(min);
}

/* Semiespesor del almohadón según qué tan adentro está el punto:
   panza llena al centro, afinándose hacia el borde (silueta nítida) */
const PROFUNDIDAD_MAX = 0.7;
function semiEspesor(dBorde) {
  return PROFUNDIDAD_MAX * Math.sqrt(Math.min(dBorde / 0.48, 1));
}

/* Fracción de la entrada que se va en ESCALONAR la lluvia. El resto
   (1 − esto) es lo que tarda cada partícula en su propia caída: con
   0.58 las primeras ya están asentadas mientras las últimas recién
   salen, que es lo que hace que el corazón se "llene" y no aparezca. */
const ESCALONADO_ENTRADA = 0.58;

export class Corazon {
  constructor(escena) {
    this.grupo = new THREE.Group();
    this.grupo.position.fromArray(POS_CORAZON);   // arriba en el mundo (ver config)
    escena.add(this.grupo);

    /* Estado controlado por el scroll desde main.js */
    this.rotacionScroll = 0;
    this.desarme = 0;        // 0 = corazón armado · 1 = totalmente disperso
    this.opacidad = 1;       // derivada del desarme (fade del final)
    this.fuerzaMouse = 0;    // presencia del cursor, suavizada

    /* Entrada: avanza con el reloj real (no con el scroll) apenas carga
       el sitio. 0 = lluvia arriba · 1 = corazón armado. */
    this.entrada = 0;

    this._construirNube();

    /* Temporales para proyectar el mouse al plano del corazón */
    this._rayo = new THREE.Ray();
    this._plano = new THREE.Plane();
    this._normal = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._punto = new THREE.Vector3();
  }

  _construirNube() {
    const cantidad = CONFIG.particulasCorazon;
    const posiciones = new Float32Array(cantidad * 3);
    const dispersas = new Float32Array(cantidad * 3);
    const caidas = new Float32Array(cantidad * 3);
    const retardos = new Float32Array(cantidad);
    const semillas = new Float32Array(cantidad);
    const tamanios = new Float32Array(cantidad);
    const brillos = new Float32Array(cantidad);
    const superficies = new Float32Array(cantidad);

    const chispas = new Float32Array(cantidad);

    /* Contorno fino de la curva (test de interior + distancias + banda) */
    const contorno = [];
    for (let i = 0; i < 140; i++) {
      contorno.push(puntoCorazon2D((i / 140) * Math.PI * 2));
    }
    /* Rango vertical real de la curva (para el gradiente de luz) */
    const yMin = -14.25 * ESCALA, yMax = 14.25 * ESCALA;

    const dir = new THREE.Vector3();
    for (let i = 0; i < cantidad; i++) {
      /* 22%: banda del CONTORNO (la silueta ♥ se dibuja nítida y encendida).
         78%: relleno del almohadón por muestreo de rechazo. */
      const enContorno = i < cantidad * 0.22;
      let x, y, z, dBorde;

      if (enContorno) {
        const p = puntoCorazon2D(Math.random() * Math.PI * 2);
        /* Apenas hacia adentro y con espesor propio: un trazo con cuerpo */
        x = p.x * THREE.MathUtils.randFloat(0.94, 1.0);
        y = p.y * THREE.MathUtils.randFloat(0.94, 1.0);
        dBorde = 0.03;
        z = THREE.MathUtils.randFloatSpread(2 * semiEspesor(0.08));
      } else {
        /* Caja de muestreo = bounding box de la curva a ESCALA actual */
        let intentos = 0;
        do {
          x = THREE.MathUtils.randFloat(-16.1 * ESCALA, 16.1 * ESCALA);
          y = THREE.MathUtils.randFloat(-14.4 * ESCALA, 14.4 * ESCALA);
          intentos++;
        } while (!dentroDelCorazon(x, y, contorno) && intentos < 50);
        dBorde = distanciaAlContorno(x, y, contorno);
        z = THREE.MathUtils.randFloatSpread(2 * semiEspesor(dBorde));
      }

      const esSuperficie =
        (enContorno || dBorde < 0.09 || Math.abs(z) > semiEspesor(dBorde) * 0.8) ? 1 : 0;
      /* ~4%: chispas — puntitos rosa claro que titilan fuerte (vida de joya) */
      const esChispa = Math.random() < 0.04 ? 1 : 0;

      posiciones[i * 3 + 0] = x;
      posiciones[i * 3 + 1] = y;
      posiciones[i * 3 + 2] = z;

      /* Punto de dispersión propio: dirección al azar (leve sesgo hacia
         arriba y afuera), lejos — el desarme del scroll viaja hacia ahí */
      dir.randomDirection();
      dir.y = dir.y * 0.7 + 0.35;
      dir.normalize().multiplyScalar(THREE.MathUtils.randFloat(2.5, 8.5));
      dispersas[i * 3 + 0] = dir.x;
      dispersas[i * 3 + 1] = dir.y;
      dispersas[i * 3 + 2] = dir.z;

      /* ── Entrada: de dónde cae esta partícula y cuándo ──
         Sale de una columna de luz bien arriba, apenas más ancha que el
         corazón (así la lluvia "desemboca" en la forma en vez de caer en
         un cilindro perfecto). El retardo va mayormente con la ALTURA de
         su destino: se llena de abajo hacia arriba —la punta primero, los
         lóbulos al final— con un resto al azar para que no sea un barrido. */
      caidas[i * 3 + 0] = x * 0.45 + THREE.MathUtils.randFloatSpread(2.4);
      caidas[i * 3 + 1] = THREE.MathUtils.randFloat(6.5, 19);
      caidas[i * 3 + 2] = z * 0.45 + THREE.MathUtils.randFloatSpread(2.0);

      semillas[i] = Math.random() * 100;
      /* Luz desde arriba: los lóbulos más vivos, la punta más profunda */
      const altura = THREE.MathUtils.clamp((y - yMin) / (yMax - yMin), 0, 1);
      retardos[i] = THREE.MathUtils.clamp(altura * 0.64 + Math.random() * 0.36, 0, 1);
      brillos[i] = THREE.MathUtils.clamp(Math.random() * 0.55 + altura * 0.45, 0, 1);
      superficies[i] = esSuperficie;
      chispas[i] = esChispa;
      tamanios[i] = esChispa
        ? THREE.MathUtils.randFloat(3.4, 5.4)
        : esSuperficie
          ? THREE.MathUtils.randFloat(2.3, 4.4)
          : THREE.MathUtils.randFloat(1.4, 2.9);
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    geometria.setAttribute('aDispersa', new THREE.BufferAttribute(dispersas, 3));
    geometria.setAttribute('aCaida', new THREE.BufferAttribute(caidas, 3));
    geometria.setAttribute('aRetardo', new THREE.BufferAttribute(retardos, 1));
    geometria.setAttribute('semilla', new THREE.BufferAttribute(semillas, 1));
    geometria.setAttribute('tamanio', new THREE.BufferAttribute(tamanios, 1));
    geometria.setAttribute('aBrillo', new THREE.BufferAttribute(brillos, 1));
    geometria.setAttribute('aSuperficie', new THREE.BufferAttribute(superficies, 1));
    geometria.setAttribute('aChispa', new THREE.BufferAttribute(chispas, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTiempo: { value: 0 },
        uDPR: { value: 1 },
        uDesarme: { value: 0 },
        uEntrada: { value: 0 },
        uOpacidad: { value: 1 },
        uFuerza: { value: 0 },
        uMouseLocal: { value: new THREE.Vector3(99, 99, 99) },  // lejos al arrancar
        uColorRojo: { value: PALETA.rojo },
        uColorVivo: { value: PALETA.rojoVivo },
        uColorClaro: { value: PALETA.rojoClaro },
      },
      vertexShader: /* glsl */ `
        ${RUIDO_SIMPLEX_GLSL}
        attribute vec3 aDispersa;
        attribute vec3 aCaida;
        attribute float aRetardo;
        attribute float semilla;
        attribute float tamanio;
        attribute float aBrillo;
        attribute float aSuperficie;
        attribute float aChispa;
        uniform float uTiempo;
        uniform float uDPR;
        uniform float uDesarme;
        uniform float uEntrada;
        uniform float uFuerza;
        uniform vec3 uMouseLocal;
        varying float vSemilla;
        varying float vBrillo;
        varying float vSuperficie;
        varying float vChispa;
        varying float vEntrada;
        void main() {
          vSemilla = semilla;
          vBrillo = aBrillo;
          vSuperficie = aSuperficie;
          vChispa = aChispa;

          vec3 p = position;

          /* ── Entrada: la partícula cae desde su punto en el cielo ──
             Cada una espera su turno (aRetardo) y hace su propia caída
             dentro de la ventana restante. easeOutCubic: se descuelga
             rápido y aterriza suave, sin frenazo. */
          float caida = clamp(
            (uEntrada - aRetardo * ${ESCALONADO_ENTRADA.toFixed(2)}) /
            ${(1 - ESCALONADO_ENTRADA).toFixed(2)}, 0.0, 1.0);
          vEntrada = caida;
          float llegada = 1.0 - pow(1.0 - caida, 3.0);
          float enElAire = 1.0 - llegada;

          /* Va perdiendo altura y, de paso, se mece: la lluvia se curva
             hacia la forma en vez de caer en líneas rectas. */
          p += aCaida * enElAire;
          p.x += sin(uTiempo * 1.6 + semilla * 5.7) * 0.22 * enElAire;
          p.z += cos(uTiempo * 1.3 + semilla * 4.1) * 0.16 * enElAire;

          /* Vida propia: vibración orgánica CONTENIDA (la silueta debe
             quedar nítida), que crece recién al desarmarse. Mientras la
             partícula viaja no vibra: el trazo de la caída queda limpio. */
          float amp = (0.018 + uDesarme * 0.24) * llegada;
          p.x += snoise(vec3(position.yz * 1.8, uTiempo * 0.32 + semilla)) * amp;
          p.y += snoise(vec3(position.zx * 1.8, uTiempo * 0.28 + semilla)) * amp;
          p.z += snoise(vec3(position.xy * 1.8, uTiempo * 0.30 + semilla)) * amp;

          /* Repulsión del cursor en 3D (sólo con el corazón ya armado):
             las partículas se apartan del punto tocado y vuelven solas.
             Radio acorde al corazón grande (~2.7 de alto). */
          vec3 delta = p - uMouseLocal;
          float d = length(delta);
          float rep = uFuerza * 0.55 * exp(-d * d * 1.6) * (1.0 - uDesarme) * llegada;
          p += (delta / max(d, 0.05)) * rep;

          /* Desarme: cada partícula viaja hacia su punto de dispersión */
          p += aDispersa * uDesarme;

          vec4 pv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = tamanio * uDPR * (40.0 / max(-pv.z, 0.001));
          /* Cayendo es una gota de luz un poco más gorda que en reposo */
          gl_PointSize *= 1.0 + 0.45 * enElAire;
          gl_PointSize = min(gl_PointSize, 11.0 * uDPR);
          gl_Position = projectionMatrix * pv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTiempo;
        uniform float uOpacidad;
        uniform vec3 uColorRojo;
        uniform vec3 uColorVivo;
        uniform vec3 uColorClaro;
        varying float vSemilla;
        varying float vBrillo;
        varying float vSuperficie;
        varying float vChispa;
        varying float vEntrada;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float disco = smoothstep(0.5, 0.08, d);

          /* Rojo profundo → rojo vivo según la luz (arriba más vivo);
             la cáscara, apenas más clara: la silueta ♥ se lee nítida
             mientras gira. Las chispas tiran a rosa claro. */
          vec3 color = mix(uColorRojo, uColorVivo, vBrillo);
          color = mix(color, uColorClaro, vSuperficie * 0.4 + vChispa * 0.55);

          /* Titileo suave; las chispas laten mucho más hondo */
          float onda = sin(uTiempo * (1.3 + vChispa * 1.2) + vSemilla * 3.0);
          float titileo = mix(0.72 + 0.28 * onda, 0.35 + 0.65 * onda * onda, vChispa);

          /* ── Entrada ──
             La partícula no existe hasta que se descuelga (así las que
             esperan turno no se ven flotando arriba), y mientras cae es
             una chispa encendida que se apaga al asentarse. */
          float aparecer = smoothstep(0.0, 0.10, vEntrada);
          float cayendo = 1.0 + 1.25 * (1.0 - smoothstep(0.30, 1.0, vEntrada));

          /* Alfa contenida: miles de puntos aditivos + bloom queman rápido;
             el corazón debe leerse ROJO, no blanco */
          float alfa = disco * titileo * (0.20 + vSuperficie * 0.15 + vChispa * 0.25)
                     * uOpacidad * aparecer * cayendo;
          if (alfa < 0.004) discard;
          /* Cayendo tira apenas al claro: gota de luz antes que brasa */
          color = mix(color, uColorClaro, (cayendo - 1.0) * 0.30);
          gl_FragColor = vec4(color, alfa);
        }
      `,
    });

    this.nube = new THREE.Points(geometria, this.material);
    this.nube.frustumCulled = false;
    this.grupo.add(this.nube);
  }

  /* ── Control desde el scroll (main.js) ── */
  setGiro(radianes) { this.rotacionScroll = radianes; }

  /* Re-anclaje por frame: durante el landing el corazón se posiciona en el
     punto de mirada de la cámara → queda clavado al centro de la pantalla
     mientras el mundo se desplaza detrás (efecto Active Theory). */
  setPosicion(v) { this.grupo.position.copy(v); }

  /** 0 = corazón armado · 1 = partículas totalmente dispersas.
     El fade final ocurre sobre el último tramo del desarme. */
  setDesarme(v) {
    this.desarme = THREE.MathUtils.clamp(v, 0, 1);
    this.opacidad = 1 - THREE.MathUtils.smoothstep(this.desarme, 0.78, 1.0);
    /* Totalmente disperso y desvanecido: fuera del render (ahorra GPU) */
    this.grupo.visible = this.opacidad > 0.004;
  }

  actualizar(dt, tiempo, mouseNDC, camara, dpr) {
    if (!this.grupo.visible) return;   // disperso: nada que animar

    /* Entrada: corre con el reloj real, una sola vez, apenas carga el sitio */
    if (this.entrada < 1) {
      this.entrada = Math.min(this.entrada + dt / CONFIG.duracionEntrada, 1);
    }

    /* Respiración: escala oscilante muy leve, loop infinito (~4 s) */
    const pulso = 1 + Math.sin(tiempo * 1.55) * CONFIG.amplitudRespiracion;
    this.grupo.scale.setScalar(pulso);

    /* Giro: leve vaivén de flotación + giro sobre su eje ligado al scroll */
    this.grupo.rotation.y = Math.sin(tiempo * 0.18) * 0.09 + this.rotacionScroll;

    /* ── Cursor → espacio local del corazón ──
       Intersecamos el rayo del mouse con el plano que pasa por el corazón
       mirando a cámara, y lo llevamos a coordenadas locales (así el punto
       repelido acompaña también el GIRO del corazón). */
    let objetivo = 0;
    if (CONFIG.parallaxMouse > 0) {
      this.grupo.updateMatrixWorld();
      camara.getWorldDirection(this._normal);
      this._plano.setFromNormalAndCoplanarPoint(this._normal, this.grupo.position);
      this._v.set(mouseNDC.x, mouseNDC.y, 0.5).unproject(camara);
      this._rayo.origin.copy(camara.position);
      this._rayo.direction.copy(this._v.sub(camara.position)).normalize();
      if (this._rayo.intersectPlane(this._plano, this._punto)) {
        this.grupo.worldToLocal(this._punto);
        this.material.uniforms.uMouseLocal.value.lerp(this._punto, Math.min(1, dt * 10));
        /* La fuerza sube cuando el cursor está sobre el corazón (grande: ~3) */
        objetivo = 1 - THREE.MathUtils.smoothstep(this._punto.length(), 1.8, 3.2);
      }
    }
    this.fuerzaMouse += (objetivo - this.fuerzaMouse) * Math.min(1, dt * 5);

    const u = this.material.uniforms;
    u.uTiempo.value = tiempo;
    u.uDPR.value = dpr;
    u.uDesarme.value = this.desarme;
    u.uEntrada.value = this.entrada;
    u.uOpacidad.value = this.opacidad;
    u.uFuerza.value = this.fuerzaMouse;
  }

  destruir() {
    this.nube.geometry.dispose();
    this.material.dispose();
  }
}
