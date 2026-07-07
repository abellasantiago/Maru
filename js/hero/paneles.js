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

    MOMENTOS.forEach((momento, indice) => {
      const el = document.createElement('div');
      el.className = 'panel-vidrio' + (momento.destacado ? ' destacado' : '');
      el.dataset.momento = momento.id;
      el.innerHTML = `
        <figure class="panel-foto">
          <img src="${momento.foto}" alt="${momento.titulo}" draggable="false">
          <div class="panel-grano"></div>
        </figure>
        <header class="panel-info">
          <span class="panel-fecha">${momento.fecha}</span>
          <span class="panel-palabra">${momento.titulo}</span>
          ${momento.desc ? `<span class="panel-desc">${momento.desc}</span>` : ''}
        </header>
      `;
      el.addEventListener('click', () => alClickear(indice));

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

    this._v = new THREE.Vector3(); // temporal reutilizable
  }

  actualizar(dt, tiempo, camara) {
    const deriva = MOVIMIENTO_REDUCIDO ? 0 : 1;
    /* Durante el landing (cámara aún frente al corazón) las cards no se
       muestran: el corazón queda solo, como en la referencia. */
    const enLanding = camara.position.z > 7.5;

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

      /* ── Optimización (clave con 23 paneles): sólo pintamos los cercanos ──
         Los que quedan detrás de la cámara o muy lejos se ocultan; los de
         media distancia pierden el backdrop-filter (el blur es lo más caro).
         Usamos objeto.visible: el CSS3DRenderer lo traduce a display y, además,
         se saltea el cálculo de transform de los ocultos. */
      item.objeto.visible = !enLanding && delante && distCamara < 48;
      item.el.classList.toggle('lejos', distCamara > 24);
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
