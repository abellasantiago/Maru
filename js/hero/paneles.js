/* ═══════════════════════════════════════════════════════════════
   Paneles de vidrio flotando en profundidad (glassmorphism 3D).

   Son elementos DOM reales dentro de un CSS3DRenderer sincronizado
   con la misma cámara del WebGL: así el backdrop-filter desenfoca
   de verdad las partículas que pasan por detrás (vidrio esmerilado
   real, no simulado) y el texto/la foto se mantienen nítidos a
   cualquier tamaño.

   Cada panel:
   ▸ flota con deriva de ingravidez (posición y rotación oscilan)
   ▸ expone --foco (0..1) al CSS: la foto se revela al llegar al
     centro de la pantalla (borrosa/velada → nítida)
   ▸ es clickeable: navega con la cámara hasta su momento
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { CONFIG, MOVIMIENTO_REDUCIDO } from './config.js';
import { MOMENTOS } from './momentos.js';

/* Frase que flota EN EL ESPACIO durante el descenso del landing: la cámara
   la pasa de largo (parallax real, no overlay). Vive a mitad del descenso
   (el mundo baja de y=16 a y≈0). */
const FRASES = [
  { texto: 'un viaje por nuestra historia', pos: [2.5, 8.6, -3], rotY: -0.12 },
];

export class PanelesVidrio {
  /**
   * @param {THREE.Scene} escenaCSS  escena exclusiva del CSS3DRenderer
   * @param {HTMLElement} contenedor #capa-css3d
   * @param {(indice:number)=>void} alClickear callback de navegación
   */
  constructor(contenedor, alClickear) {
    this.escenaCSS = new THREE.Scene();

    this.renderizador = new CSS3DRenderer({ element: contenedor });
    this.renderizador.setSize(window.innerWidth, window.innerHeight);

    this.items = [];

    /* El tilt/brillo de las cards vive sólo con puntero fino (hay hover) y
       sin reduced-motion; en táctil las cards quedan planas y estables. */
    const soportaTilt = !MOVIMIENTO_REDUCIDO && window.matchMedia('(pointer: fine)').matches;

    MOMENTOS.forEach((momento, indice) => {
      const el = document.createElement('div');
      el.className = 'panel-vidrio' + (momento.destacado ? ' destacado' : '');
      el.dataset.momento = momento.id;
      /* .panel-interior es un div propio para la animación de entrada
         (translateY/scale): el.style.transform ya lo usa CSS3DRenderer
         para posicionar el panel en el espacio 3D, así que el "asentarse"
         al aparecer necesita su propio elemento, sin pisarse. */
      el.innerHTML = `
        <div class="panel-interior">
          <div class="panel-tilt">
            <figure class="panel-foto">
              <img src="${momento.foto}" alt="${momento.titulo}" draggable="false">
              <div class="panel-grano"></div>
            </figure>
            <header class="panel-info">
              <span class="panel-fecha">${momento.fecha}</span>
              <span class="panel-palabra">${momento.titulo}</span>
              ${momento.desc ? `<span class="panel-desc">${momento.desc}</span>` : ''}
            </header>
            <div class="panel-brillo" aria-hidden="true"></div>
          </div>
        </div>
      `;
      el.addEventListener('click', () => alClickear(indice));

      /* Tilt 3D + brillo especular al pasar el cursor: la card se inclina
         como un objeto con peso y la luz le resbala por el vidrio. Sólo con
         puntero fino y sin reduced-motion (en táctil no hay hover). */
      if (soportaTilt) {
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          const rx = (e.clientX - r.left) / r.width;
          const ry = (e.clientY - r.top) / r.height;
          el.style.setProperty('--tiltY', ((rx - 0.5) * 12).toFixed(2) + 'deg');
          el.style.setProperty('--tiltX', (-(ry - 0.5) * 12).toFixed(2) + 'deg');
          el.style.setProperty('--mx', (rx * 100).toFixed(1) + '%');
          el.style.setProperty('--my', (ry * 100).toFixed(1) + '%');
          el.classList.add('tilt-activo');
        }, { passive: true });
        el.addEventListener('pointerleave', () => {
          el.style.setProperty('--tiltX', '0deg');
          el.style.setProperty('--tiltY', '0deg');
          el.classList.remove('tilt-activo');
        });
      }

      const objeto = new CSS3DObject(el);
      /* Un div de 440px pasa a medir 4.4 unidades de mundo */
      objeto.scale.setScalar(CONFIG.escalaCSS3D);
      objeto.position.fromArray(momento.posicion);
      objeto.rotation.fromArray(momento.rotacion);
      this.escenaCSS.add(objeto);

      this.items.push({
        el,
        objeto,
        base: new THREE.Vector3().fromArray(momento.posicion),
        rotBase: new THREE.Euler().fromArray(momento.rotacion),
        fase: indice * 1.73,   // desfase para que no floten sincronizados
        foco: 0,
      });
    });

    /* ── Frases del descenso (mismo espacio 3D que los paneles) ── */
    this.frases = FRASES.map((frase, i) => {
      const el = document.createElement('div');
      el.className = 'frase-viaje';
      el.textContent = frase.texto;

      const objeto = new CSS3DObject(el);
      objeto.scale.setScalar(CONFIG.escalaCSS3D);
      objeto.position.fromArray(frase.pos);
      objeto.rotation.y = frase.rotY;
      this.escenaCSS.add(objeto);
      return { el, objeto, baseX: frase.pos[0], fase: i * 2.4 };
    });

    this._v = new THREE.Vector3(); // temporal reutilizable
  }

  actualizar(dt, tiempo, camara) {
    const deriva = MOVIMIENTO_REDUCIDO ? 0 : 1;

    for (const item of this.items) {
      /* ── Deriva de ingravidez: flotación lenta en posición y giro ── */
      const f = item.fase;
      item.objeto.position.set(
        item.base.x + Math.sin(tiempo * 0.24 + f) * 0.14 * deriva,
        item.base.y + Math.sin(tiempo * 0.31 + f * 2.1) * 0.11 * deriva,
        item.base.z + Math.sin(tiempo * 0.18 + f * 0.7) * 0.09 * deriva
      );
      item.objeto.rotation.set(
        item.rotBase.x + Math.sin(tiempo * 0.21 + f) * 0.012 * deriva,
        item.rotBase.y + Math.sin(tiempo * 0.17 + f * 1.4) * 0.016 * deriva,
        item.rotBase.z + Math.sin(tiempo * 0.26 + f * 0.5) * 0.008 * deriva
      );

      /* ── Foco: cuánto "llegó" el panel al centro de la pantalla ── */
      this._v.copy(item.objeto.position).project(camara);
      const delante = this._v.z < 1;
      const distCamara = item.objeto.position.distanceTo(camara.position);
      let foco = 0;
      if (delante) {
        /* Cerca del centro en pantalla y a distancia de lectura → foco 1 */
        const distCentro = Math.hypot(this._v.x, this._v.y * 0.85);
        const enPantalla = 1 - THREE.MathUtils.smoothstep(distCentro, 0.18, 0.95);
        const porCercania = 1 - THREE.MathUtils.smoothstep(distCamara, 5.5, 17);
        foco = enPantalla * porCercania;
      }
      /* Suavizado temporal para que el revelado respire, sin saltos */
      item.foco += (foco - item.foco) * Math.min(1, dt * 6);
      item.el.style.setProperty('--foco', item.foco.toFixed(3));

      /* ── Revelado por DISTANCIA, individual ──
         El timeline NO se ve de arranque: cada card está totalmente
         invisible (revelado 0) hasta que la cámara se le acerca bastante,
         recién ahí empieza a asomar — oscura y velada primero, con cuerpo
         y luz plena sólo ya cerca. Sin piso: de lejos no hay nada, ni
         insinuado. Umbrales angostos (11 → 5) para que despierte tarde,
         cerca del momento en que va a quedar en foco. */
      const revelado = 1 - THREE.MathUtils.smoothstep(distCamara, 5, 11);
      item.el.style.setProperty('--revelado', revelado.toFixed(3));

      /* ── Optimización: sólo pintamos lo razonablemente cercano ──
         Los paneles detrás de la cámara, muy profundos o aún no revelados
         se ocultan; los de media distancia pierden el backdrop-filter (el
         blur es lo más caro). Usamos objeto.visible: el CSS3DRenderer lo
         traduce a display y, además, se saltea el cálculo de transform de
         los ocultos. */
      item.objeto.visible = delante && distCamara < 95 && revelado > 0.004;
      item.el.classList.toggle('lejos', distCamara > 24);
    }

    /* ── Frases del descenso: visibles mientras la cámara pasa a su altura ──
       Se encienden al entrar en cuadro (|Δy| chico) y sólo existen en el
       landing (la cámara del timeline vuela a y≈0..1: la compuerta las apaga). */
    const compuertaLanding = THREE.MathUtils.smoothstep(camara.position.y, 1.2, 2.2);
    for (const frase of this.frases) {
      const dy = Math.abs(camara.position.y - frase.objeto.position.y);
      const opacidad = (1 - THREE.MathUtils.smoothstep(dy, 2.8, 4.5)) * compuertaLanding;
      frase.objeto.visible = opacidad > 0.01;
      if (frase.objeto.visible) {
        frase.el.style.opacity = opacidad.toFixed(3);
        /* Deriva mínima: flotan, no están clavadas */
        frase.objeto.position.x =
          frase.baseX + Math.sin(tiempo * 0.3 + frase.fase) * 0.15 * (MOVIMIENTO_REDUCIDO ? 0 : 1);
      }
    }
  }

  render(camara) {
    this.renderizador.render(this.escenaCSS, camara);
  }

  redimensionar(ancho, alto) {
    this.renderizador.setSize(ancho, alto);
  }

  /* Posiciones base (para que la cámara calcule sus anclas de foco) */
  get posiciones() {
    return this.items.map((i) => i.base);
  }
}
