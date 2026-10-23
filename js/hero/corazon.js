/* ═══════════════════════════════════════════════════════════════
   Corazón central del hero — point cloud rojo en 3D.

   Miles de partículas rojas llenan un corazón 3D con la SILUETA de
   la curva ♥ clásica (surco profundo, punta elegante) inflada en
   profundidad como un almohadón: de frente es un corazón perfecto,
   girado tiene panza y cuerpo. La nube:

   ▸ ENTRA CAYENDO: apenas arranca el mundo, las partículas llueven
     desde bien arriba y desembocan en la forma, armándola de abajo
     hacia arriba (la punta primero, los lóbulos al final). Mientras
     caen son chispas encendidas; al asentarse se calman. La dispara
     comenzarEntrada(), que llama main.js en cuanto se crea el corazón.
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
import { GLIFOS, TAMANIO_GLIFO, LADO_GLIFO } from './glifos.js';
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

/* Fredoka aporta las siluetas exactas de las dos letras. Las máscaras se
   convierten una sola vez en puntos interiores, perímetro y distancia al
   borde; cada partícula recibe así un destino dentro de un volumen real. */
const PROFUNDIDAD_LETRA = 0.78;

function prepararGlifo(datos) {
  const bytes = Uint8Array.from(atob(datos.bits), c => c.charCodeAt(0));
  const total = TAMANIO_GLIFO * TAMANIO_GLIFO;
  const dentro = new Uint8Array(total);
  const distancia = new Float32Array(total);
  const diagonal = Math.SQRT2;

  for (let i = 0; i < total; i++) {
    dentro[i] = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
    distancia[i] = dentro[i] ? 1000 : 0;
  }
  /* Transformada de distancia con vecindad de ocho: aproxima cuánto puede
     inflarse el frente de cada letra antes de llegar a su silueta. */
  for (let y = 0; y < TAMANIO_GLIFO; y++) {
    for (let x = 0; x < TAMANIO_GLIFO; x++) {
      const i = y * TAMANIO_GLIFO + x;
      if (!dentro[i]) continue;
      if (x > 0) distancia[i] = Math.min(distancia[i], distancia[i - 1] + 1);
      if (y > 0) distancia[i] = Math.min(distancia[i], distancia[i - TAMANIO_GLIFO] + 1);
      if (x > 0 && y > 0) distancia[i] = Math.min(distancia[i], distancia[i - TAMANIO_GLIFO - 1] + diagonal);
      if (x + 1 < TAMANIO_GLIFO && y > 0) distancia[i] = Math.min(distancia[i], distancia[i - TAMANIO_GLIFO + 1] + diagonal);
    }
  }
  for (let y = TAMANIO_GLIFO - 1; y >= 0; y--) {
    for (let x = TAMANIO_GLIFO - 1; x >= 0; x--) {
      const i = y * TAMANIO_GLIFO + x;
      if (!dentro[i]) continue;
      if (x + 1 < TAMANIO_GLIFO) distancia[i] = Math.min(distancia[i], distancia[i + 1] + 1);
      if (y + 1 < TAMANIO_GLIFO) distancia[i] = Math.min(distancia[i], distancia[i + TAMANIO_GLIFO] + 1);
      if (x + 1 < TAMANIO_GLIFO && y + 1 < TAMANIO_GLIFO) distancia[i] = Math.min(distancia[i], distancia[i + TAMANIO_GLIFO + 1] + diagonal);
      if (x > 0 && y + 1 < TAMANIO_GLIFO) distancia[i] = Math.min(distancia[i], distancia[i + TAMANIO_GLIFO - 1] + diagonal);
    }
  }

  const interior = [], borde = [];
  for (let i = 0; i < total; i++) {
    if (!dentro[i]) continue;
    interior.push(i);
    if (distancia[i] < 3.5) borde.push(i);
  }
  return { dentro, distancia, interior, borde };
}

function puntoEnGlifo(glifo, enBorde) {
  const celdas = enBorde ? glifo.borde : glifo.interior;
  const i = celdas[Math.floor(Math.random() * celdas.length)];
  const x = ((i % TAMANIO_GLIFO + Math.random()) / TAMANIO_GLIFO - 0.5) * LADO_GLIFO;
  const y = (0.5 - (Math.floor(i / TAMANIO_GLIFO) + Math.random()) / TAMANIO_GLIFO) * LADO_GLIFO;
  const semiProfundidad = PROFUNDIDAD_LETRA * Math.sqrt(Math.min(glifo.distancia[i] / 23, 1));
  return { x, y, z: THREE.MathUtils.randFloatSpread(2 * semiProfundidad) };
}

function aciertaGlifo(glifo, x, y) {
  const px = Math.floor((x / LADO_GLIFO + 0.5) * TAMANIO_GLIFO);
  const py = Math.floor((0.5 - y / LADO_GLIFO) * TAMANIO_GLIFO);
  if (px < 0 || py < 0 || px >= TAMANIO_GLIFO || py >= TAMANIO_GLIFO) return false;
  if (glifo.dentro[py * TAMANIO_GLIFO + px]) return true;
  /* Un margen pequeño hace cómodos los clics cerca de las curvas. */
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const xx = px + dx, yy = py + dy;
      if (xx >= 0 && yy >= 0 && xx < TAMANIO_GLIFO && yy < TAMANIO_GLIFO &&
          glifo.dentro[yy * TAMANIO_GLIFO + xx]) return true;
    }
  }
  return false;
}

/* Fracción de la entrada que se va en ESCALONAR la lluvia. El resto
   (1 − esto) es lo que tarda cada partícula en su propia caída: con
   0.58 las primeras ya están asentadas mientras las últimas recién
   salen, que es lo que hace que el corazón se "llene" y no aparezca. */
const ESCALONADO_ENTRADA = 0.58;

/* Cantidad de partículas con la que se calibró el brillo del corazón.
   Importa porque el blending es aditivo: el doble de puntos con el mismo
   alfa es el doble de luz sumada en el mismo lugar, y el cuadro quema a
   blanco. Con esto, subir `particulasCorazon` DENSIFICA la nube (la silueta
   se afina, el volumen se llena) sin encenderla de más. */
const PARTICULAS_CALIBRADAS = 3600;

/* Cuánto se corrige el corazón EN REPOSO, de 0 (nada: más puntos = más luz)
   a 1 (compensación total: la luz se reparte y el brillo queda clavado).
   No va en 1 a propósito: una nube más densa TIENE que verse un poco más
   rica que una rala, si no la diferencia no se nota. 0.8 deja que gane un
   pelo de cuerpo sin acercarse al blanco. Las BRASAS, en cambio, se
   corrigen del todo (ver uDensidad en el shader): ahí las que ya salieron
   se superponen con el cuerpo que todavía no salió y el margen es nulo. */
const CORRECCION_REPOSO = 0.8;

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
       con el reloj real, pero SÓLO desde que comenzarEntrada() la suelta. */
    this.entrada = 0;
    this.iniciada = false;
    this.forma = 0;          // 0 corazón · 1 M · 2 S
    this.formaDesde = 0;
    this.formaHacia = 0;
    this.progresoForma = 1;
    this._glifoM = prepararGlifo(GLIFOS.M);
    this._glifoS = prepararGlifo(GLIFOS.S);

    this._construirNube();

    /* Temporales para proyectar el mouse al plano del corazón */
    this._rayo = new THREE.Ray();
    this._plano = new THREE.Plane();
    this._normal = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._punto = new THREE.Vector3();
    this._mouseSuavizado = new THREE.Vector3(99, 99, 99);
    this._mouseRastro = new THREE.Vector3(99, 99, 99);
    this._mouseAnterior = new THREE.Vector3();
    this._direccionMouse = new THREE.Vector2();
    this._punteroVigente = false;
    this.velocidadMouse = 0;
  }

  _construirNube() {
    const cantidad = CONFIG.particulasCorazon;
    const posiciones = new Float32Array(cantidad * 3);
    const dispersas = new Float32Array(cantidad * 3);
    const caidas = new Float32Array(cantidad * 3);
    const formaM = new Float32Array(cantidad * 3);
    const formaS = new Float32Array(cantidad * 3);
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
    this._contorno = contorno;
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

      /* Cada partícula ya conoce sus coordenadas en las dos letras. Así el
         clic transforma la nube existente: no crea texto ni cambia de objeto. */
      const pM = puntoEnGlifo(this._glifoM, enContorno);
      const pS = puntoEnGlifo(this._glifoS, enContorno);
      formaM[i * 3 + 0] = pM.x;
      formaM[i * 3 + 1] = pM.y;
      formaM[i * 3 + 2] = pM.z;
      formaS[i * 3 + 0] = pS.x;
      formaS[i * 3 + 1] = pS.y;
      formaS[i * 3 + 2] = pS.z;

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
    geometria.setAttribute('aFormaM', new THREE.BufferAttribute(formaM, 3));
    geometria.setAttribute('aFormaS', new THREE.BufferAttribute(formaS, 3));
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
        uFormaDesde: { value: 0 },
        uFormaHacia: { value: 0 },
        uProgresoForma: { value: 1 },
        uOpacidad: { value: 1 },
        uFuerza: { value: 0 },
        uVelocidadMouse: { value: 0 },
        uDireccionMouse: { value: new THREE.Vector2() },
        uGiro: { value: 0 },
        uRetrasoEco: { value: retrasoEco },
        uAlfaEco: { value: 1 },
        uDensidad: {
          value: Math.min(1, PARTICULAS_CALIBRADAS / CONFIG.particulasCorazon),
        },
        uDensidadReposo: {
          value: THREE.MathUtils.lerp(
            1,
            Math.min(1, PARTICULAS_CALIBRADAS / CONFIG.particulasCorazon),
            CORRECCION_REPOSO
          ),
        },
        uMouseLocal: { value: new THREE.Vector3(99, 99, 99) },  // lejos al arrancar
        uMouseRastro: { value: new THREE.Vector3(99, 99, 99) },
        uColorRojo: { value: PALETA.rojo },
        uColorVivo: { value: PALETA.rojoVivo },
        uColorClaro: { value: PALETA.rojoClaro },
        uColorOro: { value: PALETA.dorado },
      },
      vertexShader: /* glsl */ `
        ${RUIDO_SIMPLEX_GLSL}
        attribute vec3 aDispersa;
        attribute vec3 aCaida;
        attribute vec3 aFormaM;
        attribute vec3 aFormaS;
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
        uniform float uFormaDesde;
        uniform float uFormaHacia;
        uniform float uProgresoForma;
        uniform float uFuerza;
        uniform float uVelocidadMouse;
        uniform vec2 uDireccionMouse;
        uniform float uGiro;
        uniform float uRetrasoEco;
        uniform vec3 uMouseLocal;
        uniform vec3 uMouseRastro;
        varying float vSemilla;
        varying float vBrillo;
        varying float vSuperficie;
        varying float vChispa;
        varying float vEntrada;
        varying float vBrasa;
        varying float vChispazo;
        varying float vCerca;
        varying float vDist;
        varying float vFiguraM;
        varying float vFiguraS;
        varying float vCambio;
        varying float vLuzCursor;
        varying float vLuzRastro;
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
          float remolinoEntrada = uTiempo * 1.15 + semilla * 4.1;
          p.x += sin(remolinoEntrada) * 0.30 * enElAire;
          p.z += cos(remolinoEntrada * 0.83) * 0.22 * enElAire;
          p.y += sin(caida * 3.14159265) * 0.08 * enElAire;

          /* Corazón ↔ M ↔ S. El golpe de aire en el centro de la transición
             hace que las partículas viajen entre siluetas antes de asentarse. */
          float desdeM = step(0.5, uFormaDesde);
          float desdeS = step(1.5, uFormaDesde);
          float haciaM = step(0.5, uFormaHacia);
          float haciaS = step(1.5, uFormaHacia);
          vec3 formaDesde = mix(mix(position, aFormaM, desdeM), aFormaS, desdeS);
          vec3 formaHacia = mix(mix(position, aFormaM, haciaM), aFormaS, haciaS);
          float progresoMorfosis = smoothstep(0.0, 1.0, uProgresoForma);
          float fuerzaMorfosis = sin(progresoMorfosis * 3.14159265)
                               * smoothstep(0.45, 0.82, uEntrada);
          vec3 forma = mix(formaDesde, formaHacia, progresoMorfosis);
          forma.xy += vec2(-forma.y, forma.x) * fuerzaMorfosis * 0.075;
          forma += normalize(forma + vec3(0.0, 0.0, 0.001)) * fuerzaMorfosis * 0.10;
          float yaEntro = smoothstep(0.72, 1.0, uEntrada);
          p = mix(p, forma, yaEntro);
          vFiguraM = haciaM * (1.0 - haciaS);
          vFiguraS = haciaS;
          vCambio = max(fuerzaMorfosis, 0.0);

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

          /* Repulsión suave con inercia: el cursor despeja la nube y,
             cuando se mueve, arrastra apenas los puntos próximos. El
             rastro de luz usa la misma nube, sin otro sistema de partículas. */
          vec3 delta = p - uMouseLocal;
          float dm = length(delta);
          float activoMouse = uFuerza * (1.0 - des) * llegada;
          float campo = exp(-dm * dm * 1.45);
          float rep = activoMouse * campo * (0.48 + 0.20 * uVelocidadMouse);
          p += (delta / max(dm, 0.05)) * rep;
          p.xy += uDireccionMouse * activoMouse * campo * uVelocidadMouse * 0.12;
          float dRastro = length(forma - uMouseRastro);
          vLuzCursor = activoMouse * exp(-dm * dm * 1.75);
          vLuzRastro = activoMouse * uVelocidadMouse
                      * exp(-dRastro * dRastro * 1.8);

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
          gl_PointSize *= 1.0 + 0.14 * enElAire + 0.18 * vCambio;
          gl_PointSize *= 1.0 + 0.11 * max(vFiguraM, vFiguraS);
          gl_PointSize *= 1.0 + 0.22 * vLuzCursor + 0.11 * vLuzRastro;
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
        uniform float uDensidadReposo;
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
        varying float vFiguraM;
        varying float vFiguraS;
        varying float vCambio;
        varying float vLuzCursor;
        varying float vLuzRastro;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float disco = exp(-d * d * 34.0) * 0.68
                      + exp(-d * d * 142.0) * 0.32;

          /* Rojo profundo → rojo vivo según la luz (arriba más vivo);
             la cáscara, apenas más clara: la silueta ♥ se lee nítida
             mientras gira. Las chispas tiran a rosa claro. */
          vec3 color = mix(uColorRojo, uColorVivo, vBrillo);
          color = mix(color, uColorClaro, vSuperficie * 0.4 + vChispa * 0.55);
          /* Una sola paleta para corazón, M y S. El cursor ilumina al
             aumentar la intensidad de las mismas partículas rojas. */

          /* Titileo suave; las chispas laten mucho más hondo */
          float onda = sin(uTiempo * (1.3 + vChispa * 1.2) + vSemilla * 3.0);
          float titileo = mix(0.72 + 0.28 * onda, 0.35 + 0.65 * onda * onda, vChispa);

          /* ── Entrada ──
             La partícula no existe hasta que se descuelga (así las que
             esperan turno no se ven flotando arriba), y mientras cae es
             una chispa encendida que se apaga al asentarse. */
          float aparecer = smoothstep(0.0, 0.10, vEntrada);
          float cayendo = 1.0 + 1.42 * (1.0 - smoothstep(0.30, 1.0, vEntrada));

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
             Los dos extremos van corregidos por la cantidad real de
             partículas (ver PARTICULAS_CALIBRADAS), con distinta mano: el
             corazón armado apenas —una nube más densa puede permitirse ser un
             poco más rica—, y la brasa suelta del todo, porque ahí no hay
             margen. Así el corazón se ve igual de encendido con 3600 puntos
             en un teléfono que con 11000 en una laptop, y lo que cambia es la
             FINURA de la nube, que es justamente lo que se quiere ganar. */
          float repartida = mix(uDensidadReposo, 0.22 * uDensidad, smoothstep(0.01, 0.26, vBrasa));

          /* Las que pasan al ras del lente se disuelven ANTES de llegar:
             se leen como chispas fuera de foco cruzando el cuadro, nunca
             como una mancha que lo tapa. */
          float alRas = mix(1.0, 0.45 * smoothstep(0.6, 3.2, vDist), vCerca);

          /* Alfa contenida: miles de puntos aditivos + bloom queman rápido;
             el corazón debe leerse ROJO, no blanco */
          float alfa = disco * titileo * (0.20 + vSuperficie * 0.15 + vChispa * 0.25)
                     * uOpacidad * aparecer * cayendo * uAlfaEco
                     * repartida * (1.0 + vChispazo * 0.55) * (1.0 - apagon) * alRas;
          alfa *= 1.0 + vLuzCursor * 0.65 + vLuzRastro * 0.25;
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

  /** Avanza en el ciclo corazón → M → S → corazón si el clic cae sobre
      el trazo visible. */
  alternarForma(mouseNDC, camara) {
    if (!this.grupo.visible || this.entrada < 0.995 || this.desarme > 0.01) return false;
    if (!this._proyectarPuntero(mouseNDC, camara)) return false;
    const x = this._punto.x, y = this._punto.y;
    const aciertaCorazon = dentroDelCorazon(x, y, this._contorno)
      || distanciaAlContorno(x, y, this._contorno) < 0.22;
    const aciertaM = aciertaGlifo(this._glifoM, x, y);
    const aciertaS = aciertaGlifo(this._glifoS, x, y);
    const coincide = this.formaHacia === 0 ? aciertaCorazon
      : this.formaHacia === 1 ? aciertaM : aciertaS;
    if (!coincide) return false;

    const siguiente = (this.formaHacia + 1) % 3;
    this.formaDesde = this.formaHacia;
    this.formaHacia = siguiente;
    this.forma = siguiente;
    this.progresoForma = 0;
    return true;
  }

  _proyectarPuntero(mouseNDC, camara) {
    this.grupo.updateMatrixWorld();
    camara.getWorldDirection(this._normal);
    this._plano.setFromNormalAndCoplanarPoint(this._normal, this.grupo.position);
    this._v.set(mouseNDC.x, mouseNDC.y, 0.5).unproject(camara);
    this._rayo.origin.copy(camara.position);
    this._rayo.direction.copy(this._v.sub(camara.position)).normalize();
    if (!this._rayo.intersectPlane(this._plano, this._punto)) return false;
    this.grupo.worldToLocal(this._punto);
    return true;
  }

  /* Re-anclaje por frame: durante el landing el corazón se posiciona en el
     punto de mirada de la cámara → queda clavado al centro de la pantalla
     mientras el mundo se desplaza detrás (efecto Active Theory). */
  setPosicion(v) { this.grupo.position.copy(v); }

  /** Suelta la lluvia de la entrada. Lo llama main.js apenas se crea el
      corazón: no hay preludio ni gesto que la demore. */
  comenzarEntrada() { this.iniciada = true; }

  /** 0 = corazón armado · 1 = brasas ya apagadas.
     El apagado real es POR PARTÍCULA (cada brasa muere a su tiempo, ver
     el shader); esto es la red de seguridad que garantiza que al final
     del desarme no quede nada encendido. */
  setDesarme(v) {
    this.desarme = THREE.MathUtils.clamp(v, 0, 1);
    if (this.desarme > 0.01 && this.formaHacia !== 0) {
      this.formaDesde = this.formaHacia;
      this.formaHacia = 0;
      this.forma = 0;
      this.progresoForma = 0;
    }
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

    /* Entrada: corre con el reloj real, una sola vez, desde que
       comenzarEntrada() la suelta (antes de eso las partículas esperan
       arriba, invisibles — pero eso dura un instante: no hay preludio). */
    if (this.iniciada && this.entrada < 1) {
      this.entrada = Math.min(this.entrada + dt / CONFIG.duracionEntrada, 1);
    }
    if (this.progresoForma < 1) {
      this.progresoForma = Math.min(1, this.progresoForma + dt / CONFIG.duracionCambioFigura);
    }

    /* Respiración: escala oscilante muy leve, loop infinito (~4 s) */
    const pulso = 1 + Math.sin(tiempo * 1.55) * CONFIG.amplitudRespiracion;
    this.grupo.scale.setScalar(pulso);

    /* Las letras muestran un poco más de perfil para que se lea su espesor.
       El giro del scroll conserva su recorrido completo. */
    const presenciaLetra = THREE.MathUtils.lerp(
      this.formaDesde === 0 ? 0 : 1,
      this.formaHacia === 0 ? 0 : 1,
      THREE.MathUtils.smoothstep(this.progresoForma, 0, 1)
    );
    this.grupo.rotation.y = this.rotacionScroll
      + Math.sin(tiempo * 0.18) * (0.09 + 0.10 * presenciaLetra)
      + Math.sin(tiempo * 0.31 + 0.4) * 0.05 * presenciaLetra;

    /* ── Cursor → espacio local de la figura ──
       El punto inmediato mueve la repulsión; uno más lento deja un reflejo
       fugaz detrás. La velocidad modula el empuje, sin afectar al reposo. */
    let objetivo = 0;
    let velocidadObjetivo = 0;
    if (CONFIG.parallaxMouse > 0 && hayMouse && this._proyectarPuntero(mouseNDC, camara)) {
      if (!this._punteroVigente) {
        this._mouseSuavizado.copy(this._punto);
        this._mouseRastro.copy(this._punto);
        this._mouseAnterior.copy(this._punto);
        this._punteroVigente = true;
      } else {
        this._v.subVectors(this._punto, this._mouseAnterior);
        const distancia = Math.hypot(this._v.x, this._v.y);
        if (distancia > 0.001) {
          this._direccionMouse.set(this._v.x / distancia, this._v.y / distancia);
          velocidadObjetivo = Math.min(1, distancia / Math.max(dt, 0.016) / 5.5);
        }
      }
      this._mouseAnterior.copy(this._punto);
      this._mouseSuavizado.lerp(this._punto, Math.min(1, dt * 18));
      this._mouseRastro.lerp(this._mouseSuavizado, Math.min(1, dt * 5));
      objetivo = 1 - THREE.MathUtils.smoothstep(this._punto.length(), 1.8, 3.2);
    } else {
      this._punteroVigente = false;
    }
    this.fuerzaMouse += (objetivo - this.fuerzaMouse) * Math.min(1, dt * 5);
    this.velocidadMouse += (velocidadObjetivo - this.velocidadMouse)
      * Math.min(1, dt * (velocidadObjetivo > this.velocidadMouse ? 15 : 7));

    /* Las estelas arrancan apagadas y se encienden con el desarme, si no
       se verían como una nube doble sobre el corazón quieto. */
    const fuerzaEstela = THREE.MathUtils.smoothstep(this.desarme, 0.012, 0.06);

    this.materiales.forEach((m, capa) => {
      const u = m.uniforms;
      u.uTiempo.value = tiempo;
      u.uDPR.value = dpr;
      u.uDesarme.value = this.desarme;
      u.uEntrada.value = this.entrada;
      u.uFormaDesde.value = this.formaDesde;
      u.uFormaHacia.value = this.formaHacia;
      u.uProgresoForma.value = this.progresoForma;
      u.uOpacidad.value = this.opacidad;
      u.uFuerza.value = this.fuerzaMouse;
      u.uVelocidadMouse.value = this.velocidadMouse;
      u.uDireccionMouse.value.copy(this._direccionMouse);
      u.uMouseLocal.value.copy(this._mouseSuavizado);
      u.uMouseRastro.value.copy(this._mouseRastro);
      u.uGiro.value = this.grupo.rotation.y;
      /* Cada eco es más tenue que el anterior: la estela se apaga hacia
         atrás, como el rastro de una brasa de verdad. */
      u.uAlfaEco.value = capa === 0 ? 1 : Math.pow(0.46, capa) * fuerzaEstela;
    });
  }

  destruir() {
    this.geometria.dispose();
    this.materiales.forEach((m) => m.dispose());
  }
}
