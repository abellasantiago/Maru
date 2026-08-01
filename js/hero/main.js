/* ═══════════════════════════════════════════════════════════════
   Orquestador del hero inmersivo.

   Une todas las piezas sobre UN ÚNICO WebGLRenderer persistente:
   ▸ escena WebGL — atmósfera (nebulosa + estrellas + fugaces +
     amanecer), velos de seda, bokeh + luciérnagas, rayos de luz y
     corazón — con post-procesamiento (bloom cálido + aberración +
     grano + viñeta)
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
import { CONFIG, PALETA, MOVIMIENTO_REDUCIDO, FASES, DESARME, POS_CORAZON } from './config.js';
import { MOMENTOS } from './momentos.js';
import { Atmosfera } from './atmosfera.js';
import { VelosSeda } from './velos.js';
import { AmbienteEnsueno } from './ambiente.js';
import { Corazon } from './corazon.js';
import { Rayos } from './rayos.js';
import { PanelesVidrio } from './paneles.js';
import { RecorridoCamara } from './camara.js';
import { PostProceso } from './postproceso.js';
import { CursorCereza } from './cursor.js';
import { InterfazHero } from './ui.js';
import { Obertura } from './obertura.js';

/* gsap, ScrollTrigger y Lenis llegan como globales desde /js/vendor/ */
gsap.registerPlugin(ScrollTrigger);

class HeroInmersivo {
  constructor() {
    /* ── Arranque siempre desde el principio ──
       Al refrescar, el navegador restaura el scroll anterior: el hero se
       montaba con la cámara en el landing mientras el scroll decía "mitad
       del timeline", y en ese cuadro suelto el amanecer (un resplandor
       enorme y cálido) llenaba la pantalla. De ahí el destello rojo.
       Con esto, un refresh siempre vuelve al comienzo del viaje. */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    /* El navegador puede restaurar el scroll DESPUÉS de que corra esto, así
       que lo volvemos a poner en cero cuando termina de cargar todo. */
    window.addEventListener('load', () => window.scrollTo(0, 0), { once: true });

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
    this.rayos = new Rayos(this.escena);
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
    /* ¿El visitante movió el puntero alguna vez? mouseNDC arranca en (0,0),
       que es el centro EXACTO de la pantalla — o sea, justo encima del
       corazón. Sin este flag, el corazón nace con un agujero de repulsión
       en el medio, como si el cursor estuviera clavado ahí. */
    this.hayMouse = false;
    this.tiempo = 0;
    this.activo = true;          // ¿renderizamos este frame?
    this.veloEl = document.getElementById('velo-transicion');
    this.veloCargaEl = document.getElementById('velo-carga');
    /* Red de seguridad: si el bucle nunca llegara a dibujar (WebGL caído,
       pestaña en segundo plano al abrir), el velo igual se retira y nadie
       se queda mirando una pantalla vacía. */
    setTimeout(() => this._retirarVeloCarga(), 2500);
    this._progresoPrevio = 0;        // para medir la velocidad del scroll
    this._velScroll = 0;             // velocidad suavizada (respiración del FOV)

    /* ── UI ── */
    this.ui = new InterfazHero((indice) => this.irAMomento(indice));
    this.ui.iniciar();

    /* ── La obertura ──
       El sitio no empieza al cargar: empieza cuando Maru toca la pantalla.
       Ese gesto es lo que arranca la canción (el navegador no deja sonar
       audio antes de una interacción real), suelta la lluvia del corazón
       y abre el iris. Hasta entonces el mundo ya está vivo, pero tapado. */
    this.obertura = new Obertura({
      alTocar: () => this.ui.reproducirCancion(3600),
      alSoltarLluvia: () => this.corazon.comenzarEntrada(),
      alTerminar: () => {
        this.lenis.start();
        document.body.classList.remove('obertura-activa');
      },
    });
    /* Sin obertura (por si faltara el markup) el corazón cae solo: el
       sitio nunca queda esperando un click que no puede llegar. */
    if (!this.obertura.activa) this.corazon.comenzarEntrada();

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
    /* Mientras dura la obertura el recorrido está congelado: el viaje no
       puede arrancar antes de que se abra el regalo. */
    if (this.obertura.activa) this.lenis.stop();

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

  /* Corazón del landing, en dos tiempos:
     ▸ GIRA sobre su eje mientras se desciende, y termina de girar JUSTO
       cuando va a empezar a desarmarse — plantado de frente, mostrando
       la silueta ♥ entera. Ese "se planta" es lo que le da peso al
       momento siguiente (y si siguiera girando, se desarmaría de canto).
     ▸ SE DESARMA EN BRASAS: cada partícula se suelta a su turno, se
       enciende y la corriente se la lleva hacia el corredor. */
  _actualizarCorazon(progreso) {
    /* Sub-progreso 0..1 dentro del landing */
    const land = Math.min(progreso / FASES.landingFin, 1);

    /* El giro entero entra antes de DESARME.desde, con arranque y frenada
       suaves (smoothstep): el corazón acelera, gira y se planta. */
    const giro = THREE.MathUtils.smoothstep(land, 0, DESARME.desde);
    this.corazon.setGiro(giro * CONFIG.vueltasCorazon * Math.PI * 2);

    this.corazon.setDesarme(
      THREE.MathUtils.smoothstep(land, DESARME.desde, DESARME.hasta)
    );
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
      this.hayMouse = true;
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

  /* El mundo ya dibujó su primer cuadro: sacamos el velo de carga y recién
     ahí la obertura empieza a revelar su línea (nunca sobre un cuadro en
     blanco). El velo y la obertura son del mismo color, así que el relevo
     entre los dos no se ve. */
  _retirarVeloCarga() {
    if (this._veloRetirado) return;
    this._veloRetirado = true;
    this.veloCargaEl.classList.add('listo');
    this.obertura.presentar();
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

      /* Rayos de luz: viven exactamente lo que dura el corazón. Nacen
         cuando la lluvia de la entrada termina de armarlo y se apagan
         mientras se desarma — nunca asoman en el timeline. Y justo cuando
         las brasas se sueltan dan un ESTALLIDO: la luz que el corazón
         tenía contenida se escapa con ellas. */
      const soltandose = Math.sin(Math.PI * this.corazon.desarme);
      this.rayos.setIntensidad(
        THREE.MathUtils.smoothstep(this.corazon.entrada, 0.55, 1) *
        (1 - THREE.MathUtils.smoothstep(this.recorrido.progresoLanding, 0.5, 0.92)) *
        (1 + soltandose * 0.45)
      );
      this.rayos.setAncla(this.recorrido.corazonAncla, this.camara);
      this.rayos.actualizar(this.tiempo);

      /* El cuadro entero se enciende un poco mientras el río de brasas
         está en el aire, y vuelve solo cuando terminan de apagarse.
         Contenido a propósito: el bloom de este sitio tiene radio grande,
         y pasarse acá lava el cuadro entero en vez de encenderlo. */
      this.postproceso.setImpulsoBrillo(1 + soltandose * 0.14);

      /* Intensidad del fondo: contenida durante el landing (el corredor
         central ya está despejado, así el corazón se ve limpio) y sube al
         entrar al timeline. Arranca en 0.5: presencia suficiente para que
         el desplazamiento del mundo se PERCIBA desde el primer scroll. */
      const intensidadFondo = 0.5 + 0.5 * THREE.MathUtils.smoothstep(
        this.recorrido.progreso, 0, FASES.landingFin * 0.85
      );

      /* Piezas animadas. El ambiente recibe además el parallax de mouse:
         lo que está CERCA se corre contra la cámara y lo lejano no se
         entera → el mundo gana capas en vez de moverse en bloque. */
      /* El ancla va sólo mientras el corazón esté en pantalla: es lo que las
         fugaces esquivan. Ya disperso, el ancla queda vieja y no hay nada
         que esquivar. */
      this.atmosfera.actualizar(dt, this.tiempo, this.camara, this.dpr,
        this.corazon.grupo.visible ? this.recorrido.corazonAncla : null);
      this.velos.actualizar(dt, this.tiempo, intensidadFondo);
      this.ambiente.actualizar(dt, this.tiempo, this.dpr, intensidadFondo, this.recorrido.parallax);
      this.corazon.actualizar(dt, this.tiempo, this.mouseNDC, this.camara, this.dpr, this.hayMouse);
      this.paneles.actualizar(dt, this.tiempo, this.camara);
      this.postproceso.actualizar(this.tiempo);

      /* Render: WebGL con post-proceso + capa CSS3D con la misma cámara */
      this.postproceso.render(dt);
      this.paneles.render(this.camara);

      /* Ya hay imagen de verdad en pantalla: recién ahora sacamos el velo
         de carga (si lo sacáramos antes, se vería el cuadro en blanco). */
      this._retirarVeloCarga();
    });
  }
}

/* Arranque. La instancia queda expuesta para integraciones (timeline)
   y depuración: window.hero.pausar() / reanudar() si hiciera falta. */
window.hero = new HeroInmersivo();
