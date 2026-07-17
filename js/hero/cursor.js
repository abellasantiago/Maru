/* ═══════════════════════════════════════════════════════════════
   Cursor personalizado — las cerezas del logo de Pachá.

   ▸ Las cerezas siguen al mouse SIN retardo (la punta del tallo es
     la punta real del cursor: usabilidad primero).
   ▸ Sobre elementos interactivos, las cerezas crecen apenas.
   Solo se activa con puntero fino (nunca en táctil).
   ═══════════════════════════════════════════════════════════════ */

import { ES_TACTIL } from './config.js';

const SELECTOR_INTERACTIVO = 'a, button, input, .panel-vidrio, [data-interactivo]';

export class CursorCereza {
  constructor() {
    this.activo = !ES_TACTIL && window.matchMedia('(pointer: fine)').matches;
    if (!this.activo) return;

    this.cereza = document.getElementById('cursor-cereza');

    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.visible = false;

    document.body.classList.add('cursor-cereza-activo');

    window.addEventListener('pointermove', (e) => {
      this.x = e.clientX;
      this.y = e.clientY;
      if (!this.visible) {
        this.visible = true;
        this.cereza.style.opacity = '1';
      }
    }, { passive: true });

    /* Ocultar cuando el mouse sale de la ventana */
    document.addEventListener('mouseleave', () => {
      this.visible = false;
      this.cereza.style.opacity = '0';
    });

    /* Crecer sobre lo interactivo (delegación: sirve para paneles creados luego) */
    document.addEventListener('mouseover', (e) => {
      const es = e.target.closest(SELECTOR_INTERACTIVO);
      this.cereza.classList.toggle('interactivo', !!es);
    });
  }

  actualizar(dt) {
    if (!this.activo || !this.visible) return;

    /* Cerezas: posición exacta del mouse */
    this.cereza.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
  }
}
