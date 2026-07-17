/* ═══════════════════════════════════════════════════════════════
   Post-procesamiento del hero.

   Cadena: Render → UnrealBloom (bajo, cálido) → Output (tonemap +
   sRGB) → Grano de película + viñeta (en espacio de pantalla, al
   final, para controlar la textura exacta que se ve).
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG } from './config.js';

/* Shader propio: enfoque cinematográfico (DoF suave) + aberración cromática
   radial + grano animado + viñeta */
const GranoVinetaShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTiempo: { value: 0 },
    uGrano: { value: CONFIG.grano },
    uVineta: { value: CONFIG.vineta },
    uAberracion: { value: CONFIG.aberracion },
    uEnfoque: { value: CONFIG.enfoque },
    uRadioNitido: { value: CONFIG.radioNitido },
    uAspect: { value: 1 },
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
    uniform float uVineta;
    uniform float uAberracion;
    uniform float uEnfoque;
    uniform float uRadioNitido;
    uniform float uAspect;
    varying vec2 vUv;

    /* Hash barato para el grano (cambia cada frame con uTiempo) */
    float azar(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 hacia = vUv - 0.5;
      float d = length(hacia);

      /* Aberración cromática de lente, sólo hacia los bordes (crece con
         el cuadrado de la distancia al centro): el centro queda intacto */
      vec2 despl = hacia * dot(hacia, hacia) * uAberracion;

      /* ── Enfoque cinematográfico (profundidad de campo suave) ──
         Círculo de confusión: 0 en el centro (nítido) → 1 hacia los bordes.
         El sujeto (corazón / card enfocada) vive en el centro y queda limpio;
         el mundo de alrededor se ablanda como una lente de foco corto. */
      float coc = smoothstep(uRadioNitido, 0.72, d);
      float radio = coc * uEnfoque;

      vec3 col;
      if (radio > 0.0002) {
        /* Disco de 12 muestras en dos anillos (procedural, sin arrays const
           para máxima compatibilidad), corregido por aspecto. */
        vec3 acc = texture2D(tDiffuse, vUv).rgb;
        float wsum = 1.0;
        for (int i = 0; i < 6; i++) {
          float a = float(i) / 6.0 * 6.2831853;
          vec2 o1 = vec2(cos(a), sin(a)) * radio * 0.55;
          o1.x /= uAspect;
          acc += texture2D(tDiffuse, vUv + o1).rgb; wsum += 1.0;
          vec2 o2 = vec2(cos(a + 0.5236), sin(a + 0.5236)) * radio;
          o2.x /= uAspect;
          acc += texture2D(tDiffuse, vUv + o2).rgb; wsum += 1.0;
        }
        col = acc / wsum;
        /* La aberración se insinúa sobre el resultado ya blando del borde */
        col.r = mix(col.r, texture2D(tDiffuse, vUv - despl).r, 0.6);
        col.b = mix(col.b, texture2D(tDiffuse, vUv + despl).b, 0.6);
      } else {
        col = texture2D(tDiffuse, vUv).rgb;
        col.r = texture2D(tDiffuse, vUv - despl).r;
        col.b = texture2D(tDiffuse, vUv + despl).b;
      }
      vec4 color = vec4(col, 1.0);

      /* Grano de película: textura cinematográfica, nunca "app" */
      float grano = azar(vUv * vec2(1131.7, 967.3) + fract(uTiempo) * 43.7) - 0.5;
      color.rgb += grano * uGrano;

      /* Viñeta suave hacia los bordes, cierra la composición */
      color.rgb *= 1.0 - smoothstep(0.38, 0.86, d) * uVineta;

      gl_FragColor = color;
    }
  `,
};

export class PostProceso {
  constructor(renderizador, escena, camara) {
    const tamanio = renderizador.getSize(new THREE.Vector2());

    /* Render target con MSAA (WebGL2) para bordes limpios en los tubos */
    const objetivo = new THREE.WebGLRenderTarget(tamanio.x, tamanio.y, {
      type: THREE.HalfFloatType,
      samples: 4,
    });

    this.composer = new EffectComposer(renderizador, objetivo);
    this.composer.addPass(new RenderPass(escena, camara));

    /* Bloom bajo: glow dorado-rosado sin lavar los colores */
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(tamanio.x, tamanio.y),
      CONFIG.bloom.fuerza,
      CONFIG.bloom.radio,
      CONFIG.bloom.umbral
    );
    this.composer.addPass(this.bloom);

    /* Tonemapping + conversión a sRGB */
    this.composer.addPass(new OutputPass());

    /* Enfoque + grano + viñeta al final, sobre la imagen ya tonemapeada */
    this.pasoGrano = new ShaderPass(GranoVinetaShader);
    this.pasoGrano.uniforms.uAspect.value = tamanio.x / Math.max(tamanio.y, 1);
    this.composer.addPass(this.pasoGrano);
  }

  actualizar(tiempo) {
    this.pasoGrano.uniforms.uTiempo.value = tiempo;
  }

  render(dt) {
    this.composer.render(dt);
  }

  redimensionar(ancho, alto) {
    this.composer.setSize(ancho, alto);
    this.pasoGrano.uniforms.uAspect.value = ancho / Math.max(alto, 1);
  }
}
