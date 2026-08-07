/* ═══════════════════════════════════════════════════════════════
   Interfaz del hero: sidebar de momentos, buscador, indicador de
   panel activo con flechas y contador de tiempo juntos.

   Todo navega llamando a `irAMomento(indice)`, que provee main.js
   (scroll suave de Lenis hasta el ancla de cámara del momento).
   ═══════════════════════════════════════════════════════════════ */

import { MOMENTOS } from './momentos.js';
import { FASES, MOVIMIENTO_REDUCIDO } from './config.js';
import { ContadorJuntos } from './contador.js';

/* Canción del sitio. Arranca con el PRIMER click en cualquier parte del
   sitio (ver _configurarMusica) y desde ahí se pausa/reanuda con la
   cápsula Santi ♥ Maru. */
const RUTA_CANCION = 'assets/musica/beautiful-crazy.mp3';
const VOLUMEN_CANCION = 0.85;

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
   * @param {(destinoPx:number)=>void} irAScroll  vuela a un punto del recorrido
   */
  constructor(irAMomento, irAScroll) {
    this.irAMomento = irAMomento;
    this.irAScroll = irAScroll;
    this.indiceActivo = 0;
    this.progreso = 0;

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

    /* ── Coordenadas del monograma: decodifican al pasar el cursor ── */
    this._configurarCoordenadas();

    /* ── Teclado: recorrer los momentos sin tocar el mouse ── */
    this._configurarTeclado();
  }

  /* Navegación por teclado.

     Sólo se toman las flechas HORIZONTALES (y Inicio/Fin). Las verticales
     quedan libres a propósito: son la forma en que el navegador scrollea, y
     el scroll acá ES el viaje — robárselas rompería la única forma de
     recorrer el sitio con el teclado. Las horizontales, en cambio, no hacen
     nada en una página de una sola columna, así que son de la casa: pasan de
     un momento al siguiente, como las flechas del indicador. */
  _configurarTeclado() {
    window.addEventListener('keydown', (e) => {
      /* Escribiendo en el buscador, las flechas son del buscador */
      const foco = document.activeElement;
      if (foco && (foco.tagName === 'INPUT' || foco.tagName === 'TEXTAREA')) return;
      /* Con modificadores son atajos del sistema o del navegador */
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const enLanding = this.progreso < FASES.landingFin * 0.9;
      const ultimo = MOMENTOS.length - 1;

      switch (e.key) {
        case 'ArrowRight':
          /* Desde el landing, la primera flecha entra al timeline */
          this.irAMomento(enLanding ? 0 : Math.min(ultimo, this.indiceActivo + 1));
          break;
        case 'ArrowLeft':
          if (enLanding) return;
          this.irAMomento(Math.max(0, this.indiceActivo - 1));
          break;
        case 'Home':
          this.irAScroll(0);
          break;
        case 'End':
          this.irAScroll(document.documentElement.scrollHeight);
          break;
        default:
          return;
      }
      e.preventDefault();
    });
  }

  /* La canción se PRECARGA desde el arranque para que entre lista apenas
     llegue el primer click (si esperáramos a ese click para ni siquiera
     empezar a cargar el mp3, el primer compás llegaría tarde). Entra y sale
     siempre con un fundido de volumen, y el latido de la cápsula se acelera
     mientras suena. */
  _configurarMusica() {
    this.pill = document.getElementById('nav-pill');
    this._fadeAudio = null;

    this.audio = new Audio(RUTA_CANCION);
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.audio.volume = 0;

    this.pill.addEventListener('click', () => this.alternarCancion());

    /* La canción arranca con el PRIMER click en cualquier parte del sitio:
       es el gesto real que los navegadores exigen para poder sonar audio, y
       de paso es el que abre el regalo. Un solo disparo — si ese primer
       click cae justo en la cápsula, la dejamos: su propio handler de
       arriba ya la hace sonar por su cuenta (alternarCancion), y este
       listener sigue armado esperando el próximo click en cualquier otro
       lado del sitio.

       La coordenada del monograma queda afuera por el mismo motivo: abre el
       mapa en otra pestaña y se lleva el foco, así que el fundido largo de
       entrada (3600 ms, pensado para crecer con la lluvia del corazón) se
       tocaría entero en una pestaña que nadie está mirando. El listener
       sigue armado para el próximo click acá adentro. */
    const primerClick = (e) => {
      if (this.pill.contains(e.target)) return;
      if (this.coordEl && this.coordEl.contains(e.target)) return;
      window.removeEventListener('click', primerClick);
      this.reproducirCancion(3600);
    };
    window.addEventListener('click', primerClick, { passive: true });
  }

  /**
   * Arranca la canción con un fundido de entrada.
   * @param {number} duracionFundido  ms del swell (el primer click del
   *   sitio pide uno largo: la canción tiene que CRECER con la lluvia del
   *   corazón, no entrar de golpe; la cápsula usa el corto por defecto).
   */
  reproducirCancion(duracionFundido = 1600) {
    return this.audio.play().then(() => {
      this.pill.classList.add('tocando');
      this._fundirVolumen(VOLUMEN_CANCION, duracionFundido);
    }).catch(() => {
      console.warn(`No pude reproducir la canción (${RUTA_CANCION})`);
    });
  }

  pausarCancion() {
    this.pill.classList.remove('tocando');
    this._fundirVolumen(0, 500, () => this.audio.pause());
  }

  alternarCancion() {
    if (this.audio.paused) this.reproducirCancion();
    else this.pausarCancion();
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

  /* Coordenadas de un lugar nuestro, en el monograma. El reposo apagado y el
     enfoque al pasar el cursor son puro CSS (ver el @media del monograma);
     acá sólo vive lo que el CSS no puede hacer: los dígitos decodifican de
     izquierda a derecha al entrar el cursor, como si la coordenada se
     encontrara. En táctil no hay hover, así que no se arma nada. */
  _configurarCoordenadas() {
    /* this.coordEl se cachea siempre (setProgreso lo esfuma con el scroll
       en todos los dispositivos); lo demás es sólo para puntero fino. */
    const contenedor = this.coordEl = document.getElementById('monograma-coord');

    const soportaHover = !MOVIMIENTO_REDUCIDO && window.matchMedia('(pointer: fine)').matches;
    if (!soportaHover) return;

    const texto = contenedor.querySelector('.monograma-coord-texto');
    const original = texto.textContent;
    const digitos = '0123456789';
    let cuadro = null;

    const decodificar = () => {
      if (cuadro) cancelAnimationFrame(cuadro);
      const inicio = performance.now();
      const paso = (ahora) => {
        const transcurrido = ahora - inicio;
        let listo = true;
        let salida = '';
        for (let i = 0; i < original.length; i++) {
          const c = original[i];
          if (c < '0' || c > '9') { salida += c; continue; }
          if (transcurrido >= i * 26 + 200) {
            salida += c;
          } else {
            salida += digitos[(Math.random() * 10) | 0];
            listo = false;
          }
        }
        texto.textContent = salida;
        cuadro = listo ? null : requestAnimationFrame(paso);
      };
      cuadro = requestAnimationFrame(paso);
    };

    contenedor.addEventListener('pointerenter', decodificar, { passive: true });
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
    this.progreso = progreso;
    /* Contador de tiempo juntos: sólo al comienzo del landing */
    this.contadorEl.classList.toggle('oculto', progreso >= 0.03);
    /* Coordenadas del monograma: mismo criterio — un detalle del arranque,
       se esfuma apenas se empieza a scrollear */
    this.coordEl.classList.toggle('oculto', progreso >= 0.03);

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
