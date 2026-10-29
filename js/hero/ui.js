/* ═══════════════════════════════════════════════════════════════
   Interfaz del hero: sidebar de momentos, buscador, indicador de
   panel activo con flechas y contador de tiempo juntos.

   Todo navega llamando a `irAMomento(indice)`, que provee main.js
   (scroll suave de Lenis hasta el ancla de cámara del momento).
   ═══════════════════════════════════════════════════════════════ */

import { MOMENTOS, NOMBRES_MESES } from './momentos.js';
import { FASES, MOVIMIENTO_REDUCIDO, ALTO_RECORRIDO_VH } from './config.js';
import { ContadorJuntos } from './contador.js';
import { buscarMomentos } from './busqueda.js';

/* Canción del sitio. Arranca con el PRIMER click en cualquier parte del
   sitio (ver _configurarMusica) y desde ahí se pausa/reanuda con la
   cápsula Santi ♥ Maru. */
const RUTA_CANCION = 'assets/musica/beautiful-crazy.mp3';
const VOLUMEN_CANCION = 0.85;

export class InterfazHero {
  /**
   * @param {(indice:number)=>void} irAMomento  navega al momento i
   * @param {(destinoPx:number)=>void} irAScroll  vuela a un punto del recorrido
   */
  constructor(irAMomento, irAScroll) {
    this.irAMomento = irAMomento;
    this.irAScroll = irAScroll;
    this.indiceActivo = -1;
    this.progreso = 0;

    this._construirIndice();

    /* ── Indicador + flechas ── */
    this.elActual = document.getElementById('indicador-actual');
    this.elTitulo = document.getElementById('indicador-titulo');
    this.elFecha = document.getElementById('indicador-fecha');
    this.botonPrev = document.getElementById('indicador-prev');
    this.botonNext = document.getElementById('indicador-next');
    document.getElementById('indicador-total').textContent =
      String(MOMENTOS.length).padStart(2, '0');

    this.botonPrev.addEventListener('click', () =>
      this._irAMomento(Math.max(0, this.indiceActivo - 1))
    );
    this.botonNext.addEventListener('click', () =>
      this._irAMomento(Math.min(MOMENTOS.length - 1, this.indiceActivo + 1))
    );

    this._configurarBusqueda();

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

  /* El índice conserva el riel de puntos, pero sólo abre un nivel a la vez.
     <details>/<summary> resuelve Enter, Espacio y estado accesible sin
     controles paralelos ni 39 botones superpuestos. */
  _construirIndice() {
    this.sidebar = document.getElementById('sidebar-momentos');
    this.itemsSidebar = new Array(MOMENTOS.length);
    this.gruposAnio = new Map();
    this.gruposMes = new Map();
    const agrupados = new Map();

    MOMENTOS.forEach((momento, indice) => {
      const { anio, mes } = momento.fechaInicio;
      if (!agrupados.has(anio)) agrupados.set(anio, new Map());
      const meses = agrupados.get(anio);
      if (!meses.has(mes)) meses.set(mes, []);
      meses.get(mes).push({ momento, indice });
    });

    const control = (texto, clase) => {
      const summary = document.createElement('summary');
      summary.className = `sidebar-control ${clase}`;
      const punto = document.createElement('span');
      punto.className = 'sidebar-punto';
      punto.setAttribute('aria-hidden', 'true');
      const etiqueta = document.createElement('span');
      etiqueta.className = 'sidebar-etiqueta';
      etiqueta.textContent = texto;
      summary.append(punto, etiqueta);
      return summary;
    };

    for (const [anio, meses] of agrupados) {
      const grupoAnio = document.createElement('details');
      grupoAnio.className = 'sidebar-anio';
      grupoAnio.append(control(String(anio), 'sidebar-anio-control'));
      const listaMeses = document.createElement('div');
      listaMeses.className = 'sidebar-lista-meses';
      grupoAnio.append(listaMeses);
      this.gruposAnio.set(anio, grupoAnio);

      for (const [mes, recuerdos] of meses) {
        const grupoMes = document.createElement('details');
        grupoMes.className = 'sidebar-mes';
        grupoMes.append(control(NOMBRES_MESES[mes], 'sidebar-mes-control'));
        const listaMomentos = document.createElement('div');
        listaMomentos.className = 'sidebar-lista-momentos';
        grupoMes.append(listaMomentos);
        listaMeses.append(grupoMes);
        this.gruposMes.set(`${anio}-${mes}`, grupoMes);

        for (const { momento, indice } of recuerdos) {
          const boton = document.createElement('button');
          boton.type = 'button';
          boton.className = 'sidebar-item';
          boton.setAttribute('aria-label', `Ir a: ${momento.titulo}, ${momento.fecha}`);
          boton.title = `${momento.titulo} · ${momento.fecha}`;
          const punto = document.createElement('span');
          punto.className = 'sidebar-punto';
          punto.setAttribute('aria-hidden', 'true');
          const etiqueta = document.createElement('span');
          etiqueta.className = 'sidebar-etiqueta';
          etiqueta.textContent = momento.titulo;
          boton.append(punto, etiqueta);
          boton.addEventListener('click', () => this._irAMomento(indice));
          listaMomentos.append(boton);
          this.itemsSidebar[indice] = boton;
        }
      }

      grupoAnio.addEventListener('toggle', () => {
        if (grupoAnio.open) {
          for (const otro of this.gruposAnio.values()) if (otro !== grupoAnio) otro.open = false;
        } else {
          for (const mes of grupoAnio.querySelectorAll('.sidebar-mes')) mes.open = false;
        }
        this.sidebar.classList.toggle('expandido',
          [...this.gruposAnio.values()].some((grupo) => grupo.open));
      });
      this.sidebar.append(grupoAnio);
    }

    for (const grupoMes of this.gruposMes.values()) {
      grupoMes.addEventListener('toggle', () => {
        if (!grupoMes.open) return;
        for (const otro of grupoMes.parentElement.querySelectorAll('.sidebar-mes')) {
          if (otro !== grupoMes) otro.open = false;
        }
      });
    }
  }

  _cerrarIndice() {
    for (const grupo of this.gruposAnio.values()) grupo.open = false;
    this.sidebar.classList.remove('expandido');
  }

  _irAMomento(indice) {
    this._cerrarIndice();
    this.irAMomento(indice);
  }

  _configurarBusqueda() {
    const formulario = this.formularioBusqueda = document.getElementById('buscador');
    const input = this.inputBusqueda = document.getElementById('buscador-input');
    const panel = this.panelResultados = document.getElementById('buscador-resultados');
    this.resultados = [];
    this.resultadoSeleccionado = -1;

    const cerrar = () => {
      panel.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      this.resultadoSeleccionado = -1;
    };
    this.cerrarBusqueda = cerrar;

    const seleccionar = (indice) => {
      if (indice < 0 || indice >= this.resultados.length) return;
      const destino = this.resultados[indice].indice;
      cerrar();
      input.value = '';
      input.blur();
      this._irAMomento(destino);
    };

    const marcar = (indice) => {
      this.resultadoSeleccionado = indice;
      for (const [i, el] of [...panel.querySelectorAll('.buscador-resultado')].entries()) {
        el.classList.toggle('seleccionado', i === indice);
        el.setAttribute('aria-selected', String(i === indice));
        if (i === indice) el.scrollIntoView({ block: 'nearest' });
      }
      if (indice >= 0) input.setAttribute('aria-activedescendant', `resultado-${indice}`);
      else input.removeAttribute('aria-activedescendant');
    };

    const mostrar = () => {
      const consulta = input.value.trim();
      if (!consulta) { cerrar(); return; }
      this.resultados = buscarMomentos(MOMENTOS, consulta);
      this.resultadoSeleccionado = -1;
      panel.replaceChildren();
      if (!this.resultados.length) {
        const vacio = document.createElement('p');
        vacio.className = 'buscador-vacio';
        vacio.textContent = 'No encontramos ese recuerdo. Probá otra palabra o fecha.';
        panel.append(vacio);
      } else {
        if (this.resultados.length > 1) {
          const ayuda = document.createElement('p');
          ayuda.className = 'buscador-ayuda';
          ayuda.setAttribute('role', 'presentation');
          ayuda.textContent = `${this.resultados.length} recuerdos · elegí uno`;
          panel.append(ayuda);
        }
        this.resultados.forEach(({ momento, indice }, i) => {
          const opcion = document.createElement('button');
          opcion.type = 'button';
          opcion.id = `resultado-${i}`;
          opcion.className = 'buscador-resultado';
          opcion.setAttribute('role', 'option');
          opcion.setAttribute('aria-selected', 'false');
          const titulo = document.createElement('span');
          titulo.className = 'buscador-resultado-titulo';
          titulo.textContent = momento.titulo;
          const fecha = document.createElement('span');
          fecha.className = 'buscador-resultado-fecha';
          fecha.textContent = momento.fecha;
          const numero = document.createElement('span');
          numero.className = 'buscador-resultado-numero';
          numero.textContent = String(indice + 1).padStart(2, '0');
          opcion.append(numero, titulo, fecha);
          opcion.addEventListener('click', () => seleccionar(i));
          panel.append(opcion);
        });
      }
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      input.removeAttribute('aria-activedescendant');
    };

    input.addEventListener('input', mostrar);
    input.addEventListener('focus', () => {
      this._cerrarIndice();
      if (input.value.trim()) mostrar();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { cerrar(); input.blur(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (panel.hidden) mostrar();
      if (!this.resultados.length) return;
      e.preventDefault();
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      marcar((this.resultadoSeleccionado + paso + this.resultados.length) % this.resultados.length);
    });
    formulario.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      if (panel.hidden) mostrar();
      if (this.resultados.length === 1) seleccionar(0);
      else if (this.resultadoSeleccionado >= 0) seleccionar(this.resultadoSeleccionado);
      else if (!this.resultados.length) {
        formulario.classList.remove('sin-resultado');
        void formulario.offsetWidth;
        formulario.classList.add('sin-resultado');
      } else {
        marcar(0); // con varios resultados, pedir elección explícita
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!formulario.contains(e.target)) cerrar();
    });
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
      if (foco && (foco.tagName === 'INPUT' || foco.tagName === 'TEXTAREA' ||
        this.formularioBusqueda.contains(foco) || this.sidebar.contains(foco))) return;
      /* Con modificadores son atajos del sistema o del navegador */
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const enLanding = this.progreso < FASES.landingFin * 0.9;
      const ultimo = MOMENTOS.length - 1;

      switch (e.key) {
        case 'ArrowRight':
          /* Desde el landing, la primera flecha entra al timeline */
          this._irAMomento(enLanding ? 0 : Math.min(ultimo, this.indiceActivo + 1));
          break;
        case 'ArrowLeft':
          if (enLanding) return;
          this._irAMomento(Math.max(0, this.indiceActivo - 1));
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
      /* rAF fecha el inicio del cuadro: en el primer paso puede ser
         anterior a t0. Acotar ambos extremos evita un volumen negativo. */
      const k = Math.max(0, Math.min(1, (t - t0) / duracionMs));
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
    if (this.indiceActivo >= 0) {
      const anterior = MOMENTOS[this.indiceActivo];
      this.itemsSidebar[this.indiceActivo].classList.remove('activo');
      this.itemsSidebar[this.indiceActivo].removeAttribute('aria-current');
      this.gruposAnio.get(anterior.fechaInicio.anio).classList.remove('activo');
      this.gruposMes.get(`${anterior.fechaInicio.anio}-${anterior.fechaInicio.mes}`).classList.remove('activo');
    }
    this.indiceActivo = indice;
    const momento = MOMENTOS[indice];
    this.itemsSidebar[indice].classList.add('activo');
    this.itemsSidebar[indice].setAttribute('aria-current', 'location');
    this.gruposAnio.get(momento.fechaInicio.anio).classList.add('activo');
    this.gruposMes.get(`${momento.fechaInicio.anio}-${momento.fechaInicio.mes}`).classList.add('activo');
    this.elActual.textContent = String(indice + 1).padStart(2, '0');
    this.elTitulo.textContent = momento.titulo;
    this.elFecha.textContent = momento.fecha;
    this.botonPrev.disabled = indice === 0;
    this.botonNext.disabled = indice === MOMENTOS.length - 1;
  }

  /** Progreso 0..1 del hero: muestra/oculta la UI según la fase del recorrido */
  setProgreso(progreso, anclasPausa = []) {
    this.progreso = progreso;
    /* Contador de tiempo juntos: sólo al comienzo del landing. El umbral es
       fracción del espaciador entero (≈90vh de scroll): se reescala si cambia
       --alto-recorrido, para que se esfume después del mismo recorrido real. */
    this.contadorEl.classList.toggle('oculto', progreso >= 90 / ALTO_RECORRIDO_VH);
    /* Coordenadas del monograma: mismo criterio — un detalle del arranque,
       se esfuma apenas se empieza a scrollear */
    this.coordEl.classList.toggle('oculto', progreso >= 90 / ALTO_RECORRIDO_VH);

    /* La UI de cards (sidebar, buscador, indicador) vive sólo en el timeline:
       oculta durante el landing del corazón y cuando llega la pantalla final. */
    const enLanding = progreso < FASES.landingFin * 0.9;
    const enFinal = progreso > FASES.timelineFin + 15 / ALTO_RECORRIDO_VH;
    const enPausa = anclasPausa.some((ancla) =>
      Math.abs(progreso - ancla) < 38 / ALTO_RECORRIDO_VH);
    const uiCards = !enLanding && !enFinal && !enPausa;
    if (!uiCards && !this.panelResultados.hidden) this.cerrarBusqueda();
    for (const id of ['sidebar-momentos', 'buscador', 'indicador']) {
      document.getElementById(id).classList.toggle('oculto', !uiCards);
    }
    /* El monograma acompaña todo el recorrido y sólo se va en el cierre */
    document.getElementById('monograma').classList.toggle('oculto', enFinal);
  }

  /** Estado inicial: marca el primer momento y deja la UI en modo landing
     (sidebar/buscador/indicador ocultos, contador visible) desde el primer frame. */
  iniciar() {
    this.setActivo(0);
    this.setProgreso(0);
  }
}
