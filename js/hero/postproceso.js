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

/* Shader propio: grano animado muy sutil + viñeta bordó */
const GranoVinetaShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTiempo: { value: 0 },
    uGrano: { value: CONFIG.grano },
    uVineta: { value: CONFIG.vineta },
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
    varying vec2 vUv;

    /* Hash barato para el grano (cambia cada frame con uTiempo) */
    float azar(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      /* Grano de película: textura cinematográfica, nunca "app" */
      float grano = azar(vUv * vec2(1131.7, 967.3) + fract(uTiempo) * 43.7) - 0.5;
      color.rgb += grano * uGrano;

      /* Viñeta suave hacia los bordes, cierra la composición */
      float d = distance(vUv, vec2(0.5));
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

    /* Grano + viñeta al final, sobre la imagen ya tonemapeada */
    this.pasoGrano = new ShaderPass(GranoVinetaShader);
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
  }
}
