/* ═══════════════════════════════════════════════════════════════
   Corazón central del hero — point cloud rojo en 3D.

   Miles de partículas rojas llenan un corazón 3D con la SILUETA de
   la curva ♥ clásica (surco profundo, punta elegante) inflada en
   profundidad como un almohadón: de frente es un corazón perfecto,
   girado tiene panza y cuerpo. La nube:

   ▸ ENTRA CAYENDO: cuando el visitante abre la obertura, las
     partículas llueven desde bien arriba y desembocan en la forma,
     armándola de abajo hacia arriba (la punta primero, los lóbulos
     al final). Mientras caen son chispas encendidas; al asentarse se
     calman. La entrada NO arranca sola: la suelta comenzarEntrada().
   ▸ respira y vibra con vida propia (ruido orgánico en GPU)
   ▸ REPELE al cursor: las partículas se apartan en 3D alrededor
     del punto donde el mouse toca el plano del corazón, y vuelven
     solas a su lugar
   ▸ gira sobre su eje con el scroll (setGiro, lo maneja main.js)
   ▸ al avanzar el landing SE DESARMA EN BRASAS: cada partícula se
     suelta a su turno (el corazón se vacía de abajo hacia arriba y
     el contorno —la silueta— es lo último en irse), se enciende un
     instante y la corriente se la lleva hacia el corredor, cayendo
     y hundiéndose en profundidad. El resultado es un río de brasas
     que baja del corazón y enciende el camino hacia el amanecer.

   Contrato público (main.js):
     new Corazon(escena) · setGiro(rad) · setPosicion(v)
     · setDesarme(0..1) · comenzarEntrada()
     · actualizar(dt, tiempo, mouseNDC, camara, dpr)
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

/* Cantidad de partículas con la que se calibró el brillo de las BRASAS.
   Importa porque el blending es aditivo: en el desarme, las brasas ya
   sueltas se superponen con el cuerpo del corazón que todavía no salió, y
   con casi el doble de puntos (escritorio: 6500) el mismo alfa por
   partícula suma el doble en pantalla y quema el cuadro a blanco. El
   corazón EN REPOSO no lleva esta corrección: ese brillo ya estaba
   afinado y se ve igual de bien con cualquier cantidad. */
const PARTICULAS_CALIBRADAS = 3600;

export class Corazon {
  constructor(escena) {
    this.grupo = new THREE.Group();
    this.grupo.position.fromArray(POS_CORAZON);   // arriba en el mundo (ver config)
    escena.add(this.grupo);

    /* Estado controlado por el scroll desde main.js */
    this.rotacionScroll = 0;
    this.desarme = 0;        // 0 = corazón armado · 1 = brasas ya apagadas
    this.opacidad = 1;       // red de seguridad del final del desarme
    this.fuerzaMouse = 0;    // presencia del cursor, suavizada

    /* Entrada: 0 = lluvia esperando arriba · 1 = corazón armado. Avanza
       con el reloj real, pero SÓLO desde que la obertura la suelta. */
    this.entrada = 0;
    this.iniciada = false;

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

    /* Del desarme: cuándo se suelta cada brasa, cuánto la hace girar el
       remolino y si es una de las que pasan al ras del lente. */
    const soltares = new Float32Array(cantidad);
    const remolinos = new Float32Array(cantidad);
    const cercanas = new Float32Array(cantidad);

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

      /* ── Desarme: a dónde se la lleva la corriente ──
         El destino se escribe en ejes DEL MUNDO (el shader lo contra-rota
         por el giro del corazón), así la brasa cae siempre hacia el mismo
         lado, gire como gire el corazón mientras se desarma. */
      const alRasDelLente = Math.random() < CONFIG.brasasCerca;
      cercanas[i] = alRasDelLente ? 1 : 0;

      if (alRasDelLente) {
        /* Chispa que cruza el cuadro y se va POR DELANTE de la cámara
           (+Z es hacia el visitante): profundidad de verdad, el plano se
           atraviesa. Se disuelven antes de llegar (ver el shader). */
        dir.set(
          THREE.MathUtils.randFloatSpread(9.5),
          THREE.MathUtils.randFloat(-5.5, 2.5),
          THREE.MathUtils.randFloat(7, 15)
        );
      } else {
        /* El río: se inclina hacia el eje del corredor, cae, y se hunde en
           profundidad. La convergencia es SUAVE y el desparramo lateral
           ancho a propósito: si todas apuntan al mismo eje se apilan en una
           columna, y miles de puntos aditivos apilados queman a blanco.
           `hondura` reparte cuánto llega cada una: las de adelante caen
           cerca, las del fondo se van lejísimo y quedan como una hebra de
           luz apuntando al amanecer. */
        const hondura = Math.random() * Math.random();   // sesgo a las cercanas
        dir.set(
          -x * THREE.MathUtils.randFloat(0.15, 0.5) + THREE.MathUtils.randFloatSpread(5.5),
          /* La caída es CORTA a propósito: el cuadro mide ~10 unidades de
             alto a esta distancia, y una brasa que cae 18 se va por abajo
             antes de que el barrido alcance a llevársela al fondo. Cae lo
             justo para que se lea como que cae, y después manda el fondo. */
          -THREE.MathUtils.randFloat(3.5, 10) - hondura * 5,
          -(12 + hondura * 78)
        );
      }
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

      /* ── Turno de soltarse ──
         El corazón se VACÍA de abajo hacia arriba (igual que se armó) y
         el CONTORNO aguanta más que el relleno: por un instante queda la
         silueta ♥ dibujada en el aire, ya hueca por dentro, antes de
         irse también. Ese instante es el corazón del efecto.
         El azar pesa bastante en el turno a propósito: si se soltaran
         todas juntas, miles de chispazos simultáneos en el mismo volumen
         queman el cuadro a blanco. Repartidas, el corazón GOTEA. */
      soltares[i] = THREE.MathUtils.clamp(
        altura * 0.30 + (enContorno ? 0.26 : 0) + Math.random() * 0.26,
        0, 0.68
      );
      /* Vórtice: todas giran para el mismo lado (se lee como una corriente,
         no como ruido), con magnitud propia. Las del lente casi no giran. */
      remolinos[i] = CONFIG.remolinoBrasas *
        THREE.MathUtils.randFloat(0.25, 1) * (alRasDelLente ? 0.15 : 1);
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
    geometria.setAttribute('aSoltar', new THREE.BufferAttribute(soltares, 1));
    geometria.setAttribute('aRemolino', new THREE.BufferAttribute(remolinos, 1));
    geometria.setAttribute('aCerca', new THREE.BufferAttribute(cercanas, 1));
    this.geometria = geometria;

    /* ── La nube y sus ecos ──
       Los ECOS son la MISMA geometría dibujada con el desarme atrasado
       un pelín: cada uno muestra dónde estaba la brasa un instante antes.
       Apilados, son la estela de movimiento — lo que hace que el desarme
       se lea como fuego cayendo y no como puntos que se trasladan. Como
       la trayectoria acelera (b²), la estela se ALARGA sola cuanto más
       rápido va la brasa, que es exactamente lo que hace el fuego real. */
    this.materiales = [];
    this.nubes = [];

    const capas = 1 + CONFIG.ecosBrasas;
    for (let capa = 0; capa < capas; capa++) {
      const material = this._crearMaterial(capa * CONFIG.retrasoEco);
      const nube = new THREE.Points(geometria, material);
      nube.frustumCulled = false;
      /* Los ecos se dibujan ANTES que la nube real: la cabeza de la brasa
         queda siempre encima de su propia estela. */
      nube.renderOrder = capa === 0 ? 2 : 1;
      if (capa > 0) nube.visible = false;   // sólo existen durante el desarme
      this.grupo.add(nube);
      this.nubes.push(nube);
    }
    /* La primera es la nube real; el resto son estelas */
    this.material = this.materiales[0];
    this.ecos = this.nubes.slice(1);
  }

  _crearMaterial(retrasoEco) {
    const material = new THREE.ShaderMaterial({
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
        uGiro: { value: 0 },
        uRetrasoEco: { value: retrasoEco },
        uAlfaEco: { value: 1 },
        uDensidad: {
          value: Math.min(1, PARTICULAS_CALIBRADAS / CONFIG.particulasCorazon),
        },
        uMouseLocal: { value: new THREE.Vector3(99, 99, 99) },  // lejos al arrancar
        uColorRojo: { value: PALETA.rojo },
        uColorVivo: { value: PALETA.rojoVivo },
        uColorClaro: { value: PALETA.rojoClaro },
        uColorOro: { value: PALETA.dorado },
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
        attribute float aSoltar;
        attribute float aRemolino;
        attribute float aCerca;
        uniform float uTiempo;
        uniform float uDPR;
        uniform float uDesarme;
        uniform float uEntrada;
        uniform float uFuerza;
        uniform float uGiro;
        uniform float uRetrasoEco;
        uniform vec3 uMouseLocal;
        varying float vSemilla;
        varying float vBrillo;
        varying float vSuperficie;
        varying float vChispa;
        varying float vEntrada;
        varying float vBrasa;
        varying float vChispazo;
        varying float vCerca;
        varying float vDist;
        void main() {
          vSemilla = semilla;
          vBrillo = aBrillo;
          vSuperficie = aSuperficie;
          vChispa = aChispa;
          vCerca = aCerca;

          vec3 p = position;

          /* ── Entrada: la partícula cae desde su punto en el cielo ──
             Cada una espera su turno (aRetardo) y hace su propia caída
             dentro de la ventana restante. easeOutCubic: se descuelga
             rápido y aterriza suave, sin frenazo. */
          float caida = clamp(
            (uEntrada - aRetardo * ${ESCALONADO_ENTRADA.toFixed(2)}) /
            ${(1 - ESCALONADO_ENTRADA).toFixed(2)}, 0.0, 1.0);
          vEntrada = caida;
          /* easeOutCubic por multiplicación, no con pow(): más barato y sin
             el riesgo de NaN que tiene pow() con base negativa. */
          float resta = 1.0 - caida;
          float llegada = 1.0 - resta * resta * resta;
          float enElAire = 1.0 - llegada;

          /* Va perdiendo altura y, de paso, se mece: la lluvia se curva
             hacia la forma en vez de caer en líneas rectas. */
          p += aCaida * enElAire;
          p.x += sin(uTiempo * 1.6 + semilla * 5.7) * 0.22 * enElAire;
          p.z += cos(uTiempo * 1.3 + semilla * 4.1) * 0.16 * enElAire;

          /* ── Desarme: la partícula se suelta y se vuelve BRASA ──
             uRetrasoEco atrasa el reloj de esta capa: los ecos muestran
             dónde estaba la brasa un instante antes (la estela).
             Cada una espera su turno (aSoltar) y desde ahí corre su
             propio progreso b, de 0 (todavía en la forma) a 1 (apagada). */
          float des = max(uDesarme - uRetrasoEco, 0.0);
          float b = clamp((des - aSoltar) / max(1.0 - aSoltar, 0.001), 0.0, 1.0);
          vBrasa = b;
          /* Al soltarse, la brasa CHISPEA: un golpe corto de luz y tamaño.
             El factor "libre" evita que el chispazo se vea en las que aún
             no salieron: b = 0 significa tanto "no salió" como "recién
             salió", y sin ese filtro chispearían todas desde el arranque. */
          float libre = smoothstep(0.0, 0.02, b);
          float chispazo = libre * exp(-b * b * 30.0);
          vChispazo = chispazo;

          /* Vida propia: vibración orgánica CONTENIDA mientras el corazón
             está armado (la silueta debe quedar nítida) y mucho más suelta
             cuando ya es brasa. Mientras la partícula ENTRA no vibra: el
             trazo de la lluvia queda limpio. */
          float amp = (0.018 + b * 0.32) * llegada;
          p.x += snoise(vec3(position.yz * 1.8, uTiempo * 0.32 + semilla)) * amp;
          p.y += snoise(vec3(position.zx * 1.8, uTiempo * 0.28 + semilla)) * amp;
          p.z += snoise(vec3(position.xy * 1.8, uTiempo * 0.30 + semilla)) * amp;

          /* Repulsión del cursor en 3D (sólo con el corazón ya armado):
             las partículas se apartan del punto tocado y vuelven solas.
             Radio acorde al corazón grande (~2.7 de alto). */
          vec3 delta = p - uMouseLocal;
          float dm = length(delta);
          float rep = uFuerza * 0.55 * exp(-dm * dm * 1.6) * (1.0 - des) * llegada;
          p += (delta / max(dm, 0.05)) * rep;

          /* Se abre: un empujón mínimo hacia afuera desde el cuerpo del
             corazón, para que la forma SE SUELTE antes de que la corriente
             se la lleve (si no, el río arranca sin que el ♥ se despegue). */
          float abrir = 1.0 - (1.0 - b) * (1.0 - b);
          p += (position / max(length(position), 0.001)) * 0.42 * abrir;

          /* La corriente. Dos tiempos distintos, que es lo que la hace
             leerse como fuego llevado por el viento y no como una
             explosión:
             ▸ CAE enseguida — el corazón se vacía a la vista, gota a gota;
             ▸ y el ARRASTRE hacia el corredor arranca despacio y acelera
               fuerte: primero la brasa cae, después la corriente se la
               lleva al fondo, encogiéndose hacia el amanecer.
             El destino está escrito en ejes del MUNDO, así que lo
             contra-rotamos por el giro del corazón —la brasa cae siempre
             hacia el mismo lado, gire como gire— y le sumamos el remolino,
             que le da al río su vórtice. */
          float caer = b * (0.55 + 0.45 * b);
          float arrastre = b * b * (0.35 + 0.65 * b);
          vec3 flujo = vec3(aDispersa.xy * caer, aDispersa.z * arrastre);
          float ang = -uGiro + b * aRemolino;
          float ca = cos(ang), sa = sin(ang);
          p += vec3(flujo.x * ca + flujo.z * sa, flujo.y, -flujo.x * sa + flujo.z * ca);

          /* Y tiembla: aire caliente subiendo alrededor de la brasa */
          p.y += sin(uTiempo * 2.6 + semilla * 6.3) * 0.05 * b;

          vec4 pv = modelViewMatrix * vec4(p, 1.0);
          vDist = -pv.z;

          gl_PointSize = tamanio * uDPR * (40.0 / max(-pv.z, 0.001));
          /* Cayendo es una gota de luz un poco más gorda que en reposo, y
             al soltarse como brasa vuelve a crecer con el chispazo */
          gl_PointSize *= 1.0 + 0.45 * enElAire + 0.6 * chispazo;
          /* Las que pasan al ras del lente pueden crecer mucho más: son
             chispas fuera de foco, y para eso necesitan tamaño real. */
          gl_PointSize = min(gl_PointSize, mix(11.0, 34.0, aCerca) * uDPR);
          gl_Position = projectionMatrix * pv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTiempo;
        uniform float uOpacidad;
        uniform float uAlfaEco;
        uniform float uDensidad;
        uniform vec3 uColorRojo;
        uniform vec3 uColorVivo;
        uniform vec3 uColorClaro;
        uniform vec3 uColorOro;
        varying float vSemilla;
        varying float vBrillo;
        varying float vSuperficie;
        varying float vChispa;
        varying float vEntrada;
        varying float vBrasa;
        varying float vChispazo;
        varying float vCerca;
        varying float vDist;
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

          /* ── Brasa ──
             Al soltarse se ENCIENDE (oro), viajando se enfría de vuelta
             hacia el rojo, y se apaga a su propio tiempo: el río se
             adelgaza de a poco en vez de cortarse todo junto.
             Ojo con el oro: sumado (blending aditivo) sube los TRES
             canales, así que satura a blanco mucho antes que el rojo.
             Por eso la mezcla es baja y se enfría rápido. */
          float libre = smoothstep(0.0, 0.02, vBrasa);
          float calor = libre * (0.26 + 0.74 * vChispazo)
                      * (1.0 - smoothstep(0.18, 0.7, vBrasa));
          color = mix(color, uColorOro, calor * 0.34);
          float apagon = smoothstep(0.52 + fract(vSemilla) * 0.36, 1.0, vBrasa);

          /* La brasa suelta es MÁS TENUE que el corazón entero: la luz que
             estaba concentrada en una figura se reparte por el aire. Lo
             único más brillante que el reposo es el chispazo del instante
             en que se suelta. Sin esta atenuación, miles de puntos
             aditivos viajando juntos queman el cuadro a blanco.
             uDensidad corrige por la cantidad real de partículas: el
             desarme se ve igual de encendido en un teléfono que en una
             pantalla grande (ver PARTICULAS_CALIBRADAS). */
          float repartida = mix(1.0, 0.22 * uDensidad, smoothstep(0.01, 0.26, vBrasa));

          /* Las que pasan al ras del lente se disuelven ANTES de llegar:
             se leen como chispas fuera de foco cruzando el cuadro, nunca
             como una mancha que lo tapa. */
          float alRas = mix(1.0, 0.45 * smoothstep(0.6, 3.2, vDist), vCerca);

          /* Alfa contenida: miles de puntos aditivos + bloom queman rápido;
             el corazón debe leerse ROJO, no blanco */
          float alfa = disco * titileo * (0.20 + vSuperficie * 0.15 + vChispa * 0.25)
                     * uOpacidad * aparecer * cayendo * uAlfaEco
                     * repartida * (1.0 + vChispazo * 0.55) * (1.0 - apagon) * alRas;
          if (!(alfa > 0.004)) discard;      // negado: así también cae el NaN
          /* Cayendo tira apenas al claro: gota de luz antes que brasa */
          color = mix(color, uColorClaro, (cayendo - 1.0) * 0.30);
          gl_FragColor = vec4(color, alfa);
        }
      `,
    });
    this.materiales.push(material);
    return material;
  }

  /* ── Control desde el scroll (main.js) ── */
  setGiro(radianes) { this.rotacionScroll = radianes; }

  /* Re-anclaje por frame: durante el landing el corazón se posiciona en el
     punto de mirada de la cámara → queda clavado al centro de la pantalla
     mientras el mundo se desplaza detrás (efecto Active Theory). */
  setPosicion(v) { this.grupo.position.copy(v); }

  /** Suelta la lluvia de la entrada. Lo llama la obertura con el click:
      el corazón empieza a caer exactamente cuando arranca la canción. */
  comenzarEntrada() { this.iniciada = true; }

  /** 0 = corazón armado · 1 = brasas ya apagadas.
     El apagado real es POR PARTÍCULA (cada brasa muere a su tiempo, ver
     el shader); esto es la red de seguridad que garantiza que al final
     del desarme no quede nada encendido. */
  setDesarme(v) {
    this.desarme = THREE.MathUtils.clamp(v, 0, 1);
    this.opacidad = 1 - THREE.MathUtils.smoothstep(this.desarme, 0.90, 1.0);
    /* Todo apagado: fuera del render (ahorra GPU) */
    this.grupo.visible = this.opacidad > 0.004;
    /* Las estelas sólo existen mientras hay brasas viajando */
    const conEstela = this.grupo.visible && this.desarme > 0.012;
    for (const eco of this.ecos) eco.visible = conEstela;
  }

  /**
   * @param {boolean} hayMouse  ¿el visitante movió el puntero alguna vez?
   *   Sin esto, mouseNDC arranca en (0,0) —el centro exacto de la pantalla,
   *   que es donde vive el corazón— y el corazón nacía con un agujero de
   *   repulsión en el medio, como si el cursor estuviera clavado ahí.
   */
  actualizar(dt, tiempo, mouseNDC, camara, dpr, hayMouse = false) {
    if (!this.grupo.visible) return;   // apagado: nada que animar

    /* Entrada: corre con el reloj real, una sola vez, desde que la
       obertura la suelta (antes de eso las partículas esperan arriba,
       invisibles). */
    if (this.iniciada && this.entrada < 1) {
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
    if (CONFIG.parallaxMouse > 0 && hayMouse) {
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

    /* Las estelas arrancan apagadas y se encienden con el desarme, si no
       se verían como una nube doble sobre el corazón quieto. */
    const fuerzaEstela = THREE.MathUtils.smoothstep(this.desarme, 0.012, 0.06);

    this.materiales.forEach((m, capa) => {
      const u = m.uniforms;
      u.uTiempo.value = tiempo;
      u.uDPR.value = dpr;
      u.uDesarme.value = this.desarme;
      u.uEntrada.value = this.entrada;
      u.uOpacidad.value = this.opacidad;
      u.uFuerza.value = this.fuerzaMouse;
      u.uGiro.value = this.grupo.rotation.y;
      /* Cada eco es más tenue que el anterior: la estela se apaga hacia
         atrás, como el rastro de una brasa de verdad. */
      u.uAlfaEco.value = capa === 0 ? 1 : Math.pow(0.46, capa) * fuerzaEstela;
      if (capa > 0) u.uMouseLocal.value.copy(this.material.uniforms.uMouseLocal.value);
    });
  }

  destruir() {
    this.geometria.dispose();
    this.materiales.forEach((m) => m.dispose());
  }
}
