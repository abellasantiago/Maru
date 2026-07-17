/* ═══════════════════════════════════════════════════════════════
   Orquestador del hero inmersivo.

   Une todas las piezas sobre UN ÚNICO WebGLRenderer persistente:
   ▸ escena WebGL — atmósfera (nebulosa + estrellas + amanecer),
     velos de seda, bokeh + luciérnagas y corazón — con
     post-procesamiento (bloom cálido + aberración + grano + viñeta)
   ▸ escena CSS3D (paneles de vidrio + frases del descenso) con la
     MISMA cámara
   ▸ Lenis (scroll suave) + ScrollTrigger (progreso 0..1) → cámara
   ▸ UI (sidebar, buscador, indicador, variantes del corazón)
   ▸ velo de transición hero → timeline

   El bucle corre con delta time real (no asume 60 fps) y se PAUSA
   por completo cuando el usuario pasa a la pantalla final o cuando
   la pestaña queda oculta — nunca quemamos GPU de fondo.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CONFIG, PALETA, MOVIMIENTO_REDUCIDO, FASES, POS_CORAZON } from './config.js';
import { MOMENTOS } from './momentos.js';
import { Atmosfera } from './atmosfera.js';
import { VelosSeda } from './velos.js';
import { AmbienteEnsueno } from './ambiente.js';
import { Corazon } from './corazon.js';
import { PanelesVidrio } from './paneles.js';
import { RecorridoCamara } from './camara.js';
import { PostProceso } from './postproceso.js';
import { CursorCereza } from './cursor.js';
import { InterfazHero } from './ui.js';

/* gsap, ScrollTrigger y Lenis llegan como globales desde /js/vendor/ */
gsap.registerPlugin(ScrollTrigger);

class HeroInmersivo {
  constructor() {
    /* ── Renderer único y persistente ── */
    this.lienzo = document.getElementById('lienzo-webgl');
    this.renderizador = new THREE.WebGLRenderer({
      canvas: this.lienzo,
      antialias: false,          // el MSAA vive en el render target del composer
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.dpr = Math.min(window.devicePixelRatio, CONFIG.dprMaximo);
    this.renderizador.setPixelRatio(this.dpr);
    this.renderizador.setSize(window.innerWidth, window.innerHeight);
    this.renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderizador.toneMappingExposure = 1.05;

    /* ── Escena y cámara compartida (WebGL + CSS3D) ── */
    this.escena = new THREE.Scene();
    this.escena.background = PALETA.fondo.clone();

    this.camara = new THREE.PerspectiveCamera(
      CONFIG.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      CONFIG.camaraLejos           // el amanecer del final vive a ~z -280
    );
    /* Arranca a la altura del corazón (landing); el recorrido la baja al timeline */
    this.camara.position.set(0, POS_CORAZON[1], 10);

    /* ── Piezas de la escena (de lo infinito a lo cercano) ── */
    this.atmosfera = new Atmosfera(this.escena);
    this.velos = new VelosSeda(this.escena);
    this.ambiente = new AmbienteEnsueno(this.escena);
    this.corazon = new Corazon(this.escena);
    this.paneles = new PanelesVidrio(
      document.getElementById('capa-css3d'),
      (indice) => this.irAMomento(indice)
    );
    this.recorrido = new RecorridoCamara(this.camara);
    this.postproceso = new PostProceso(this.renderizador, this.escena, this.camara);
    this.cursor = new CursorCereza();

    /* ── Estado ── */
    this.mouseNDC = new THREE.Vector2(0, 0);
    this.tiempo = 0;
    this.activo = true;          // ¿renderizamos este frame?
    this.veloEl = document.getElementById('velo-transicion');
    this._progresoPrevio = 0;        // para medir la velocidad del scroll
    this._velScroll = 0;             // velocidad suavizada (respiración del FOV)

    /* ── UI ── */
    this.ui = new InterfazHero((indice) => this.irAMomento(indice));
    this.ui.iniciar();

    this._configurarScroll();
    this._configurarEventos();
    this._iniciarBucle();
  }

  /* ── Lenis + ScrollTrigger: el scroll ES la línea de tiempo ── */
  _configurarScroll() {
    this.lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
    });
    this.lenis.on('scroll', ScrollTrigger.update);

    const recorridoEl = document.getElementById('recorrido');

    ScrollTrigger.create({
      trigger: recorridoEl,
      start: 'top top',
      end: 'bottom bottom',
      /* Mapeo 1:1 progreso → cámara; el único suavizado es el de Lenis */
      onUpdate: (st) => {
        const p = st.progress;
        this.recorrido.aplicarProgreso(p);
        this._actualizarCorazon(p);
        this._actualizarVelo(p);
        this.ui.setProgreso(p);
        this.ui.setActivo(this.recorrido.momentoActivo());
      },
      /* Al salir del hero (pantalla final): pausa total */
      onLeave: () => this._pausar(),
      onEnterBack: () => this._reanudar(),
    });
  }

  /* Corazón del landing: gira sobre su eje con el scroll y, sobre el final
     del descenso, SE DESARMA — cada partícula roja vuela hacia su punto de
     dispersión y se disuelve en el mundo, dándole paso al timeline. */
  _actualizarCorazon(progreso) {
    /* Sub-progreso 0..1 dentro del landing */
    const land = Math.min(progreso / FASES.landingFin, 1);

    /* Giro sobre su eje, proporcional al avance dentro del landing */
    this.corazon.setGiro(land * CONFIG.vueltasCorazon * Math.PI * 2);

    /* Desarme ANTES de que el landing termine (queda totalmente disperso
       al 85% del landing): nunca se superpone con el foco de las cards,
       que recién cobran cuerpo al final del descenso (ver paneles.js). */
    this.corazon.setDesarme(THREE.MathUtils.smoothstep(land, 0.45, 0.85));
  }

  /* Velo crema del final: dissolve de la última card hacia la pantalla de cierre */
  _actualizarVelo(progreso) {
    const opacidad = THREE.MathUtils.smoothstep(progreso, FASES.timelineFin + 0.015, 0.995);
    this.veloEl.style.opacity = opacidad.toFixed(3);
  }

  /* Scroll suave hasta el ancla de cámara del momento pedido */
  irAMomento(indice) {
    const recorridoEl = document.getElementById('recorrido');
    const alcance = recorridoEl.offsetHeight - window.innerHeight;
    const destino = this.recorrido.anclas[indice] * alcance;
    this.lenis.scrollTo(destino, {
      duration: MOVIMIENTO_REDUCIDO ? 0.3 : 2.4,
      easing: (t) => 1 - Math.pow(1 - t, 3),   // easeOutCubic: dolly con aterrizaje suave
    });
  }

  _configurarEventos() {
    /* Mouse en coordenadas normalizadas (parallax + reacción del corazón) */
    window.addEventListener('pointermove', (e) => {
      this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }, { passive: true });

    window.addEventListener('resize', () => this._redimensionar());

    /* Pestaña oculta → no renderizar */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._pausar(false);
      else if (!this._fueraDelHero) this._reanudar();
    });
  }

  _redimensionar() {
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio, CONFIG.dprMaximo);
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
    this.renderizador.setPixelRatio(this.dpr);
    this.renderizador.setSize(ancho, alto);
    this.postproceso.redimensionar(ancho, alto);
    this.paneles.redimensionar(ancho, alto);
  }

  /* Pausa completa del hero (renderizado + visibilidad de capas) */
  _pausar(ocultarCapas = true) {
    this.activo = false;
    if (ocultarCapas) {
      this._fueraDelHero = true;
      this.lienzo.style.visibility = 'hidden';
      document.getElementById('capa-css3d').style.visibility = 'hidden';
    }
  }

  _reanudar() {
    this.activo = true;
    this._fueraDelHero = false;
    this.lienzo.style.visibility = 'visible';
    document.getElementById('capa-css3d').style.visibility = 'visible';
  }

  /* ── Bucle único: Lenis + escena, con delta time real ── */
  _iniciarBucle() {
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add((tiempoSeg, deltaMs) => {
      /* Lenis SIEMPRE corre (el scroll debe seguir suave en el timeline) */
      this.lenis.raf(tiempoSeg * 1000);

      /* Delta acotado: una pestaña dormida no dispara saltos gigantes */
      const dt = Math.min(deltaMs / 1000, 0.05);

      /* El cursor personalizado se actualiza SIEMPRE, aún con el hero pausado.
         (Si sólo corriera con el hero activo, en la pantalla final quedaría
         congelado — y como el cursor nativo está oculto, parecería trabado.) */
      this.cursor.actualizar(dt);

      if (!this.activo) return;

      this.tiempo += dt;

      /* Cámara: progreso del scroll + parallax de mouse + banking */
      this.recorrido.aplicarParallax(this.mouseNDC, dt);
      this.recorrido.actualizar(dt);

      /* Respiración del FOV: scrollear rápido abre apenas el campo visual
         (sensación de velocidad); al frenar vuelve solo. */
      const vel = Math.abs(this.recorrido.progreso - this._progresoPrevio) / Math.max(dt, 1e-4);
      this._progresoPrevio = this.recorrido.progreso;
      this._velScroll += (vel - this._velScroll) * Math.min(1, dt * 3);
      const fovObjetivo = CONFIG.fov + Math.min(this._velScroll * 90, 3.2);
      if (Math.abs(this.camara.fov - fovObjetivo) > 0.02) {
        this.camara.fov = fovObjetivo;
        this.camara.updateProjectionMatrix();
      }

      /* Durante el landing, el corazón se clava al punto de mirada de la
         cámara: queda fijo en el centro girando mientras el mundo (velos,
         pétalos, bokeh) se desplaza con el scroll — efecto Active Theory. */
      if (this.recorrido.progresoLanding < 1) {
        this.corazon.setPosicion(this.recorrido.corazonAncla);
      }

      /* Intensidad del fondo: contenida durante el landing (el corredor
         central ya está despejado, así el corazón se ve limpio) y sube al
         entrar al timeline. Arranca en 0.5: presencia suficiente para que
         el desplazamiento del mundo se PERCIBA desde el primer scroll. */
      const intensidadFondo = 0.5 + 0.5 * THREE.MathUtils.smoothstep(
        this.recorrido.progreso, 0, FASES.landingFin * 0.85
      );

      /* Piezas animadas */
      this.atmosfera.actualizar(dt, this.tiempo, this.camara, this.dpr);
      this.velos.actualizar(dt, this.tiempo, intensidadFondo);
      this.ambiente.actualizar(dt, this.tiempo, this.dpr, intensidadFondo);
      this.corazon.actualizar(dt, this.tiempo, this.mouseNDC, this.camara, this.dpr);
      this.paneles.actualizar(dt, this.tiempo, this.camara);
      this.postproceso.actualizar(this.tiempo);

      /* Render: WebGL con post-proceso + capa CSS3D con la misma cámara */
      this.postproceso.render(dt);
      this.paneles.render(this.camara);
    });
  }
}

/* Arranque. La instancia queda expuesta para integraciones (timeline)
   y depuración: window.hero.pausar() / reanudar() si hiciera falta. */
window.hero = new HeroInmersivo();
