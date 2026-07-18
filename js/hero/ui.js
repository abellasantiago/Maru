/* ═══════════════════════════════════════════════════════════════
   Interfaz del hero: sidebar de momentos, buscador, indicador de
   panel activo con flechas y contador de tiempo juntos.

   Todo navega llamando a `irAMomento(indice)`, que provee main.js
   (scroll suave de Lenis hasta el ancla de cámara del momento).
   ═══════════════════════════════════════════════════════════════ */

import { MOMENTOS } from './momentos.js';
import { FASES } from './config.js';
import { ContadorJuntos } from './contador.js';

/* Canción del sitio: arranca/pausa clickeando la cápsula Santi ♥ Maru */
const RUTA_CANCION = 'assets/musica/beautiful-crazy.mp3';

/* Normaliza texto para buscar: minúsculas y sin tildes */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export class InterfazHero {
  /**
   * @param {(indice:number)=>void} irAMomento  navega al momento i
   */
  constructor(irAMomento) {
    this.irAMomento = irAMomento;
    this.indiceActivo = 0;

    /* ── Sidebar: un punto por momento ── */
    const sidebar = document.getElementById('sidebar-momentos');
    this.itemsSidebar = MOMENTOS.map((momento, indice) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'sidebar-item';
      boton.setAttribute('aria-label', `Ir a: ${momento.titulo}`);
      boton.innerHTML = `
        <span class="sidebar-punto"></span>
        <span class="sidebar-etiqueta">${momento.titulo}</span>
      `;
      boton.addEventListener('click', () => irAMomento(indice));
      sidebar.appendChild(boton);
      return boton;
    });

    /* ── Indicador + flechas ── */
    this.elActual = document.getElementById('indicador-actual');
    this.elTitulo = document.getElementById('indicador-titulo');
    document.getElementById('indicador-total').textContent =
      String(MOMENTOS.length).padStart(2, '0');

    document.getElementById('indicador-prev').addEventListener('click', () =>
      irAMomento(Math.max(0, this.indiceActivo - 1))
    );
    document.getElementById('indicador-next').addEventListener('click', () =>
      irAMomento(Math.min(MOMENTOS.length - 1, this.indiceActivo + 1))
    );

    /* ── Buscador: salta al momento por palabra clave o fecha ── */
    const formulario = document.getElementById('buscador');
    const input = document.getElementById('buscador-input');
    const placeholderOriginal = input.placeholder;

    formulario.addEventListener('submit', (e) => {
      e.preventDefault();
      const consulta = normalizar(input.value);
      if (!consulta) return;

      const indice = MOMENTOS.findIndex((m) => {
        const campos = [m.titulo, m.fecha, ...m.claves].map(normalizar);
        return campos.some((c) => c.includes(consulta) || consulta.includes(c));
      });

      if (indice >= 0) {
        input.value = '';
        input.blur();
        irAMomento(indice);
      } else {
        /* No encontrado: sacudida + mensaje temporal, tono íntimo */
        formulario.classList.remove('sin-resultado');
        void formulario.offsetWidth; // reinicia la animación
        formulario.classList.add('sin-resultado');
        input.value = '';
        input.placeholder = 'no encontré ese momento… probá otra palabra';
        setTimeout(() => { input.placeholder = placeholderOriginal; }, 2600);
      }
    });

    /* ── Contador de tiempo juntos (bajo el corazón, sólo en el landing) ── */
    this.contadorEl = document.getElementById('contador-juntos');
    this.contador = new ContadorJuntos(this.contadorEl);

    /* ── Música: la cápsula Santi ♥ Maru es el botón de play/pausa ── */
    this._configurarMusica();
  }

  /* La canción se carga recién en el primer click (si el mp3 no está,
     no ensuciamos la carga inicial con un 404) y entra/sale con un
     fade suave. El latido de la cápsula se enciende mientras suena. */
  _configurarMusica() {
    const pill = document.getElementById('nav-pill');
    this.audio = null;
    this._fadeAudio = null;

    pill.addEventListener('click', () => {
      if (!this.audio) {
        this.audio = new Audio(RUTA_CANCION);
        this.audio.loop = true;
        this.audio.volume = 0;
      }

      if (this.audio.paused) {
        this.audio.play().then(() => {
          pill.classList.add('tocando');
          this._fundirVolumen(0.85, 1600);
        }).catch(() => {
          console.warn(`No encontré la canción en ${RUTA_CANCION}`);
        });
      } else {
        pill.classList.remove('tocando');
        this._fundirVolumen(0, 500, () => this.audio.pause());
      }
    });
  }

  /* Fade lineal de volumen con rAF; cancela el fade anterior si lo hay */
  _fundirVolumen(destino, duracionMs, alTerminar) {
    if (this._fadeAudio) cancelAnimationFrame(this._fadeAudio);
    const desde = this.audio.volume;
    const t0 = performance.now();
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / duracionMs);
      this.audio.volume = desde + (destino - desde) * k;
      if (k < 1) {
        this._fadeAudio = requestAnimationFrame(paso);
      } else {
        this._fadeAudio = null;
        if (alTerminar) alTerminar();
      }
    };
    this._fadeAudio = requestAnimationFrame(paso);
  }

  /** Actualiza sidebar + contador según el momento activo */
  setActivo(indice) {
    if (indice === this.indiceActivo) return;
    this.indiceActivo = indice;
    this.itemsSidebar.forEach((el, i) => el.classList.toggle('activo', i === indice));
    this.elActual.textContent = String(indice + 1).padStart(2, '0');
    this.elTitulo.textContent = MOMENTOS[indice].titulo;
  }

  /** Progreso 0..1 del hero: muestra/oculta la UI según la fase del recorrido */
  setProgreso(progreso) {
    /* Contador de tiempo juntos: sólo al comienzo del landing */
    this.contadorEl.classList.toggle('oculto', progreso >= 0.03);

    /* La UI de cards (sidebar, buscador, indicador) vive sólo en el timeline:
       oculta durante el landing del corazón y cuando llega la pantalla final. */
    const enLanding = progreso < FASES.landingFin * 0.9;
    const enFinal = progreso > FASES.timelineFin + 0.005;
    const uiCards = !enLanding && !enFinal;
    for (const id of ['sidebar-momentos', 'buscador', 'indicador']) {
      document.getElementById(id).classList.toggle('oculto', !uiCards);
    }
    /* El monograma acompaña todo el recorrido y sólo se va en el cierre */
    document.getElementById('monograma').classList.toggle('oculto', enFinal);
  }

  /** Estado inicial: marca el primer momento y deja la UI en modo landing
     (sidebar/buscador/indicador ocultos, contador visible) desde el primer frame. */
  iniciar() {
    this.itemsSidebar[0].classList.add('activo');
    this.setProgreso(0);
  }
}
