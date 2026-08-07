/* ═══════════════════════════════════════════════════════════════
   Post-procesamiento del hero — la "lente" y el "revelado".

   Cadena: Render → UnrealBloom (bajo, cálido, con halación) →
   Output (tonemap + sRGB) → Lente (bokeh + arrastre de velocidad +
   aberración) y Revelado (grade + grano + viñeta + tramado).

   Tres decisiones de arquitectura que conviene entender antes de
   tocar nada:

   ▸ SIN MSAA. El render target llevaba 4 muestras por píxel, y en
     una laptop retina eso costaba 17 ms de cuadro: más que todo el
     resto del post junto. Era herencia de las viejas enredaderas de
     tubos, que sí tenían bordes de geometría. Hoy no queda NADA con
     un borde duro: el corazón y el ambiente son puntos con caída
     suave de alfa, los velos y las fugaces son planos con los bordes
     desvanecidos por shader, la nebulosa es un degradé y las cards
     son DOM. El MSAA no tenía un solo borde que suavizar.

   ▸ LA RESOLUCIÓN LA MANDA EL GOBERNADOR. El composer se configura
     siempre explícitamente con `redimensionar(ancho, alto, escala)`.
     Antes se construía con el tamaño en píxeles CSS y el pixelRatio
     del renderer: en retina eso dejaba todo el post a la MITAD de la
     resolución del canvas (1440×900 estirado a 2880×1800) hasta que
     alguien redimensionara la ventana — y ahí, de golpe, se ponía
     nítido y perdía la mitad de los cuadros.

   ▸ EL BLOOM VA A MENOS RESOLUCIÓN QUE EL CUADRO. Es desenfoque
     puro: calcularlo a resolución completa no agrega nada que se
     pueda ver, y en esta GPU cuesta un tercio del post.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG, PALETA } from './config.js';

/* Lleva un color de la paleta a brillo unitario (el canal más alto = 1) y lo
   mezcla contra el blanco. Sirve para TEÑIR sin oscurecer: multiplicar el
   bloom por un rojo tal cual lo apagaría, y lo que queremos es correrle el
   tono, no bajarle la luz. */
function tinte(color, cantidad) {
  const c = color.clone();
  const pico = Math.max(c.r, c.g, c.b) || 1;
  c.multiplyScalar(1 / pico);
  return new THREE.Vector3(
    THREE.MathUtils.lerp(1, c.r, cantidad),
    THREE.MathUtils.lerp(1, c.g, cantidad),
    THREE.MathUtils.lerp(1, c.b, cantidad)
  );
}

/* Shader final: lente (bokeh + arrastre + aberración) y revelado
   (grade + grano + viñeta + tramado) */
const LenteShader = {
  defines: {
    MUESTRAS: CONFIG.muestrasBokeh,
  },
  uniforms: {
    tDiffuse: { value: null },
    uTiempo: { value: 0 },
    uGrano: { value: CONFIG.grano },
    uGranoEnNegros: { value: CONFIG.granoEnNegros },
    uVineta: { value: CONFIG.vineta },
    uAberracion: { value: CONFIG.aberracion },
    uEnfoque: { value: CONFIG.enfoque },
    uRadioNitido: { value: CONFIG.radioNitido },
    uArrastre: { value: 0 },
    uTramado: { value: CONFIG.tramado },
    uAspect: { value: 1 },
    /* Píxeles CSS del cuadro: el grano se mide contra ESTO y no contra los
       píxeles reales, así el grano conserva su tamaño físico aunque el
       gobernador cambie la escala de render (si no, al subir la calidad el
       grano se volvía polvo invisible y al bajarla, manchones). */
    uResolucionCSS: { value: new THREE.Vector2(1, 1) },
    uTinteSombras: { value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTiempo;
    uniform float uGrano;
    uniform float uGranoEnNegros;
    uniform float uVineta;
    uniform float uAberracion;
    uniform float uEnfoque;
    uniform float uRadioNitido;
    uniform float uArrastre;
    uniform float uTramado;
    uniform float uAspect;
    uniform vec2 uResolucionCSS;
    uniform vec3 uTinteSombras;
    varying vec2 vUv;

    const float ANGULO_AUREO = 2.39996323;

    /* Hash sin usar sin(): el clásico fract(sin(dot(...)) * 43758.5) dibuja
       bandas diagonales visibles en las zonas oscuras —y este sitio es casi
       todo zona oscura— porque el seno de un flotante grande pierde
       precisión de forma REGULAR. Este devuelve ruido parejo de verdad. */
    float azar(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * 0.1031);
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }

    float luminancia(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

    void main() {
      vec2 hacia = vUv - 0.5;

      /* ── Radio de lente ──
         Distancia al centro medida en la GEOMETRÍA REAL de la pantalla
         (corregida por aspecto) y normalizada para que la esquina valga
         siempre 1, en cualquier proporción. Sin la corrección, en una
         pantalla 16:10 el desenfoque y la viñeta llegaban igual de fuerte al
         borde de arriba que al de los costados, que están mucho más lejos
         del eje óptico: se leía como un degradé puesto encima y no como una
         lente. Con esto, el borde ancho pesa lo que tiene que pesar. */
      vec2 radial = hacia * vec2(uAspect, 1.0);
      float d = length(radial) / length(vec2(uAspect, 1.0) * 0.5);

      /* Aberración cromática de lente, sólo hacia los bordes (crece con el
         cuadrado de la distancia al centro): el centro queda intacto */
      vec2 despl = hacia * dot(hacia, hacia) * uAberracion;

      /* ── Enfoque cinematográfico + arrastre de velocidad ──
         Círculo de confusión: 0 en el centro (nítido) → 1 hacia los bordes.
         El sujeto (corazón / card enfocada) vive en el centro y queda limpio;
         el mundo de alrededor se ablanda como una lente de foco corto.
         El ARRASTRE es lo que agrega el scroll rápido: las muestras además se
         corren hacia el centro, y el cuadro se estira como en una toma
         acelerando por un túnel. Crece con la distancia al centro (en el eje
         óptico no hay desplazamiento), igual que el movimiento real. */
      float coc = smoothstep(uRadioNitido, 1.0, d);
      float radio = coc * uEnfoque;
      float arrastre = uArrastre * d;

      vec3 col;
      if (radio > 0.0002 || arrastre > 0.0002) {
        /* Disco de MUESTRAS puntos en espiral de ángulo áureo: reparte las
           muestras sin dejar los anillos concéntricos que se veían con dos
           vueltas de seis, y por eso rinde mucho más por muestra. La espiral
           arranca GIRADA DISTINTO EN CADA PÍXEL para que lo poco que quede sin
           cubrir se lea como grano y no como estructura — es lo que permite
           bajar la cuenta sin que se note.
           (Se probó ajustar la cantidad de muestras al tamaño del desenfoque,
           con un break dentro del bucle. No sirvió: la GPU trabaja de a grupos
           de píxeles vecinos y corre siempre las iteraciones del que más pide,
           así que ahorró 0.2 ms a cambio de bastante complejidad.) */
        float giro = azar(gl_FragCoord.xy) * 6.2831853;
        vec3 acc = vec3(0.0);
        float peso = 0.0;
        for (int i = 0; i < MUESTRAS; i++) {
          float t = (float(i) + 0.5) / float(MUESTRAS);
          float a = float(i) * ANGULO_AUREO + giro;
          /* sqrt(t): reparto uniforme por ÁREA, no por radio (si no, el
             centro del disco queda sobre-muestreado y el bokeh se apelmaza) */
          vec2 off = vec2(cos(a), sin(a)) * sqrt(t) * radio;
          off.x /= uAspect;
          vec2 uvm = vUv + off - hacia * (arrastre * t);
          vec3 m = texture2D(tDiffuse, uvm).rgb;
          /* Las luces pesan más que el fondo: así una chispa fuera de foco se
             abre como un CÍRCULO de luz —bokeh de verdad— en vez de diluirse
             en el promedio hasta desaparecer. */
          float w = 1.0 + luminancia(m) * 1.6;
          acc += m * w;
          peso += w;
        }
        col = acc / max(peso, 0.0001);
        /* La aberración se insinúa sobre el resultado ya blando del borde */
        col.r = mix(col.r, texture2D(tDiffuse, vUv - despl).r, 0.6);
        col.b = mix(col.b, texture2D(tDiffuse, vUv + despl).b, 0.6);
      } else {
        col = texture2D(tDiffuse, vUv).rgb;
        col.r = texture2D(tDiffuse, vUv - despl).r;
        col.b = texture2D(tDiffuse, vUv + despl).b;
      }

      /* ── Revelado ──
         Curva S suavísima: planta los negros y hace rodar las altas luces en
         vez de cortarlas. Es lo que separa una imagen "de pantalla" de una
         imagen "de copia" — el hero es casi todo sombra, y sin esto la
         nebulosa queda lechosa. */
      col = clamp(col, 0.0, 1.0);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);

      float luma = luminancia(col);
      /* Las sombras viran al bordó de la paleta (nunca gris) y las altas
         luces se entibian: el mismo revelado cálido de toda la dirección. */
      col += uTinteSombras * (1.0 - smoothstep(0.0, 0.42, luma)) * 0.05;
      col.r += smoothstep(0.5, 1.0, luma) * 0.025;
      col = mix(vec3(luma), col, 1.07);   // un punto de saturación

      /* ── Grano de película ──
         Pegado a los MEDIOS TONOS, como el haluro de plata real: casi nada en
         el negro (si no, la nebulosa hierve) y casi nada en la luz quemada. */
      vec2 celda = vUv * uResolucionCSS;
      float grano = azar(celda + floor(uTiempo * 24.0) * 71.7) - 0.5;
      float pesoGrano = mix(uGranoEnNegros, 1.0, clamp(4.0 * luma * (1.0 - luma), 0.0, 1.0));
      col += grano * uGrano * pesoGrano;

      /* Viñeta suave hacia los bordes, cierra la composición */
      col *= 1.0 - smoothstep(0.50, 1.15, d) * uVineta;

      /* ── Tramado ──
         Última operación antes de escribir el píxel. La salida es de 8 bits y
         este sitio es un degradé bordó oscurísimo de punta a punta: sin esto
         se ven las bandas, y en una pantalla buena de laptop se ven MUCHO.
         Ruido triangular (diferencia de dos uniformes): es el que rompe el
         escalón sin agregar textura propia. */
      float r1 = azar(gl_FragCoord.xy + fract(uTiempo) * 13.7);
      float r2 = azar(gl_FragCoord.xy + 61.3 - fract(uTiempo) * 7.1);
      col += (r1 - r2) * (uTramado / 255.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class PostProceso {
  constructor(renderizador, escena, camara) {
    /* El tamaño real lo fija redimensionar() enseguida: acá sólo hace falta
       un objetivo válido para que el composer se construya. */
    const objetivo = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      samples: 0,                // ver la nota de arriba: no había qué suavizar
    });

    this.composer = new EffectComposer(renderizador, objetivo);
    this.composer.addPass(new RenderPass(escena, camara));

    /* Bloom bajo: glow dorado-rosado sin lavar los colores */
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(2, 2),
      CONFIG.bloom.fuerza,
      CONFIG.bloom.radio,
      CONFIG.bloom.umbral
    );

    /* ── Halación ──
       Los cinco niveles del bloom van del más ceñido al más ancho. Los
       ceñidos quedan neutros (el brillo pegado a la fuente es blanco) y los
       anchos se tiñen hacia el oro y el rojo de la paleta: es el sangrado
       rojizo que deja la película alrededor de una luz fuerte, y acá además
       tiene un efecto práctico — con blending aditivo el glow blanco sube los
       tres canales y satura; teñido, el halo se queda en la paleta. */
    const h = CONFIG.tinteHalacion;
    this.bloom.bloomTintColors = [
      tinte(PALETA.crema, 0.15 * h),
      tinte(PALETA.dorado, 0.30 * h),
      tinte(PALETA.dorado, 0.60 * h),
      tinte(PALETA.rojoClaro, 0.75 * h),
      tinte(PALETA.rojoVivo, 0.95 * h),
    ];
    this.bloom.compositeMaterial.uniforms.bloomTintColors.value = this.bloom.bloomTintColors;
    this.composer.addPass(this.bloom);

    /* Tonemapping + conversión a sRGB */
    this.composer.addPass(new OutputPass());

    /* Lente + revelado al final, sobre la imagen ya tonemapeada */
    this.pasoLente = new ShaderPass(LenteShader);
    this.pasoLente.uniforms.uTinteSombras.value.set(
      PALETA.bordo.r, PALETA.bordo.g, PALETA.bordo.b
    );
    this.composer.addPass(this.pasoLente);

    this.escala = 1;
  }

  actualizar(tiempo) {
    this.pasoLente.uniforms.uTiempo.value = tiempo;
  }

  /**
   * Multiplicador del bloom (1 = el de siempre). Lo usa el desarme del
   * corazón: cuando las brasas se sueltan, el cuadro entero se enciende
   * un poco y vuelve solo — el fuego contagia la luz de toda la toma.
   */
  setImpulsoBrillo(factor) {
    this.bloom.strength = CONFIG.bloom.fuerza * factor;
  }

  /**
   * Arrastre radial por velocidad de scroll (0 = quieto, 1 = a fondo).
   * Lo alimenta main.js con la misma velocidad suavizada que abre el FOV.
   */
  setArrastre(cantidad) {
    this.pasoLente.uniforms.uArrastre.value = cantidad * CONFIG.arrastreVelocidad;
  }

  render(dt) {
    this.composer.render(dt);
  }

  /**
   * @param {number} ancho  ancho en píxeles CSS
   * @param {number} alto   alto en píxeles CSS
   * @param {number} escala píxeles reales por píxel CSS (la manda calidad.js)
   */
  redimensionar(ancho, alto, escala = this.escala) {
    this.escala = escala;
    this.composer.setPixelRatio(escala);
    this.composer.setSize(ancho, alto);
    /* setSize del composer le pasa la resolución COMPLETA a cada pase, así
       que el bloom hay que volver a achicarlo después — si no, el ahorro se
       pierde en silencio cada vez que se redimensiona. */
    this.bloom.setSize(
      Math.max(2, Math.round(ancho * escala * CONFIG.bloomEscala)),
      Math.max(2, Math.round(alto * escala * CONFIG.bloomEscala))
    );
    this.pasoLente.uniforms.uAspect.value = ancho / Math.max(alto, 1);
    this.pasoLente.uniforms.uResolucionCSS.value.set(ancho, alto);
  }
}
