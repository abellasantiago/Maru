/* ═══════════════════════════════════════════════════════════════
   La obertura — lo primero que ve Maru.

   Antes de que caiga la primera partícula hay un solo instante:
   oscuridad, una línea suspendida que se revela palabra por palabra
   (de desenfocada a nítida, el mismo idioma visual que usan las
   cards al entrar en foco) y una invitación mínima a tocar.

   El click es el gesto que abre el regalo, y a partir de ahí TODO CAE en la
   misma dirección — es lo que hace que las dos pantallas se sientan una sola
   toma y no un corte:
   ▸ la canción arranca (el navegador sólo permite audio tras un gesto
     real del visitante: por eso el sitio empieza acá y no antes),
   ▸ la lluvia del corazón se suelta enseguida, así cuando la pantalla
     termina de irse el corazón ya se está armando,
   ▸ y la pantalla inicial SE CAE: se descuelga hacia abajo con el peso de
     algo que se suelta, con el borde de arriba difuminado para que lo que
     barre el cuadro sea una línea blanda y no el canto de un rectángulo.

   La obertura no sabe nada del hero: sólo avisa por callbacks. Así el
   orden del espectáculo vive en un lugar (RITMO, acá abajo) y se puede
   reajustar sin tocar main.js.

   Contrato público (main.js):
     new Obertura({ alTocar, alSoltarLluvia, alTerminar })
     · activa (bool, sólo lectura) · presentar()
   ═══════════════════════════════════════════════════════════════ */

import { MOVIMIENTO_REDUCIDO } from './config.js';

/* ▸▸▸ EL TEXTO DE LA OBERTURA — cambialo acá y en ningún otro lado.
   La línea se revela pieza por pieza, así que las pausas naturales caen
   solas entre pieza y pieza: frases cortas funcionan mejor. Una línea
   BREVE (una hora, una fecha) se muestra grande, como un número en
   pantalla; una frase entera se muestra a tamaño de frase. */
const LINEA = '11:11';
const INVITACION = 'hacé click';

/* Coreografía completa, en milisegundos. Cambiar un número acá cambia
   el ritmo del arranque del sitio entero. */
const RITMO = {
  /* Antes del click */
  antesDeLaLinea: 600,      // respiro tras el primer cuadro del mundo
  escalonPieza: 260,        // separación entre pieza y pieza de la línea
  duracionPieza: 1500,      // cuánto tarda cada pieza en enfocarse (= CSS)
  antesDeInvitar: 350,      // tras la última pieza, asoma la invitación

  /* Desde el click. Todo va para el mismo lado: la línea se desenfoca
     HACIA ABAJO y la pantalla se descuelga detrás — un solo movimiento. */
  soltarLluvia: 90,         // casi con el click: la lluvia ya está cayendo
  salidaTexto: 520,         // la línea se disuelve hacia abajo
  retrasoCaida: 240,        // la pantalla se suelta apenas después
  caida: 1250,              // cuánto tarda en irse del cuadro
  fundidoCancion: 3600,     // swell largo: la canción crece con la lluvia
};

/* Hasta cuántos caracteres cuenta como línea BREVE (ver LINEA arriba) */
const LARGO_BREVE = 8;

/* Parte la línea en piezas revelables. Los dos puntos van aparte para que
   "11:11" se lea como una HORA: los pares entran de a uno y el separador
   respira despacio en el medio, como el de un reloj. */
function partirLinea(linea) {
  return linea
    .split(/(\s+|:)/)
    .filter((p) => p !== '')
    .map((p) => ({ texto: p, espacio: /^\s+$/.test(p), separador: p === ':' }));
}

export class Obertura {
  /**
   * @param {object} llamadas
   * @param {() => void} llamadas.alTocar        instante del click (música)
   * @param {() => void} llamadas.alSoltarLluvia el corazón empieza a caer
   * @param {() => void} llamadas.alTerminar     la obertura ya no existe
   */
  constructor({ alTocar, alSoltarLluvia, alTerminar }) {
    this.el = document.getElementById('obertura');
    this.activa = !!this.el;
    if (!this.activa) return;

    this.alTocar = alTocar;
    this.alSoltarLluvia = alSoltarLluvia;
    this.alTerminar = alTerminar;
    this._abierta = false;
    this._presentada = false;
    this._lluviaSuelta = false;
    this._relojes = [];

    this.lineaEl = document.getElementById('obertura-linea');
    this.invitacionEl = document.getElementById('obertura-invitacion');
    this.invitacionEl.textContent = INVITACION;

    /* Una línea corta se muestra GRANDE (es un número en pantalla, no una
       frase); una frase entera conserva su tamaño de lectura. */
    if (LINEA.replace(/\s/g, '').length <= LARGO_BREVE) {
      this.lineaEl.classList.add('breve');
    }

    /* La línea se parte en piezas: cada una es su propio revelado */
    this.piezas = [];
    for (const pieza of partirLinea(LINEA)) {
      if (pieza.espacio) {
        this.lineaEl.appendChild(document.createTextNode(' '));
        continue;
      }
      const span = document.createElement('span');
      span.className = 'obertura-pieza' + (pieza.separador ? ' separador' : '');
      span.textContent = pieza.texto;
      this.lineaEl.appendChild(span);
      this.piezas.push(span);
    }

    /* Cualquier punto de la pantalla abre: el click no es un botón que
       hay que acertar, es un gesto sobre el regalo entero. */
    this.el.addEventListener('pointerdown', () => this._abrir());
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this._abrir();
      }
    });

    /* Mientras la obertura vive, el recorrido no arranca: si el visitante
       (o el navegador) empuja el scroll, vuelve solo al principio. */
    this._frenarScroll = () => { if (!this._abierta) window.scrollTo(0, 0); };
    window.addEventListener('scroll', this._frenarScroll, { passive: true });
  }

  /** Lo llama main.js cuando el mundo ya dibujó su primer cuadro: recién
      ahí la línea empieza a aparecer (nunca sobre una pantalla en blanco). */
  presentar() {
    if (!this.activa || this._presentada) return;
    this._presentada = true;
    this.invitacionEl.focus({ preventScroll: true });

    if (MOVIMIENTO_REDUCIDO) {
      this.piezas.forEach((p) => p.classList.add('revelada'));
      this.el.classList.add('lista');
      return;
    }

    this.piezas.forEach((pieza, i) => {
      this._enEspera(() => pieza.classList.add('revelada'),
        RITMO.antesDeLaLinea + i * RITMO.escalonPieza);
    });
    this._enEspera(() => this.el.classList.add('lista'),
      RITMO.antesDeLaLinea + (this.piezas.length - 1) * RITMO.escalonPieza
      + RITMO.duracionPieza + RITMO.antesDeInvitar);
  }

  /* ── El click: se abre el regalo ── */
  _abrir() {
    if (this._abierta) return;
    this._abierta = true;

    this.el.style.pointerEvents = 'none';
    this.invitacionEl.blur();
    this.alTocar();

    /* La lluvia arranca casi con el click: para cuando la pantalla termina
       de caer, el corazón ya se está armando a la vista. */
    this._enEspera(() => this._soltarLluvia(), RITMO.soltarLluvia);

    /* La invitación viene asomando por una animación CSS, y una animación
       le gana al estilo en línea: si tweeneáramos su opacidad de una, no
       pasaría nada y el cartelito se iría cayendo con la pantalla, todavía
       titilando. Así que primero congelamos su valor actual en línea, la
       clase .cayendo apaga la animación, y recién ahí lo desvanecemos. */
    this.invitacionEl.style.opacity = getComputedStyle(this.invitacionEl).opacity;
    this.el.classList.add('cayendo');
    gsap.to(this.invitacionEl, { opacity: 0, duration: 0.24, ease: 'none' });

    if (MOVIMIENTO_REDUCIDO) {
      gsap.to(this.el, { opacity: 0, duration: 0.5, ease: 'power2.out', onComplete: () => this._retirar() });
      return;
    }

    /* La línea se va como llegó pero al revés, y HACIA ABAJO: desenfoca y
       se descuelga en la misma dirección que la pantalla que la sostiene. */
    gsap.to(this.piezas, {
      opacity: 0,
      y: 26,
      filter: 'blur(20px)',
      duration: RITMO.salidaTexto / 1000,
      ease: 'power2.in',
      stagger: 0.05,
    });

    /* ── La caída ──
       La pantalla se descuelga con el peso de algo que se suelta (ease de
       entrada = acelera como una caída) y se va por abajo. La clase
       .cayendo (ya puesta arriba) le difumina el borde de arriba, así lo
       que barre el cuadro es una línea blanda y no el canto de un
       rectángulo. 112% para que el difuminado también salga del encuadre. */
    gsap.to(this.el, {
      yPercent: 112,
      duration: RITMO.caida / 1000,
      delay: RITMO.retrasoCaida / 1000,
      ease: 'power2.in',
      onComplete: () => this._retirar(),
    });
  }

  /* Una sola vez, pase lo que pase. El reloj de arriba es el camino normal;
     _retirar() la suelta también, por si el iris llegara a terminar antes de
     que ese reloj salte (una pestaña que estuvo en segundo plano, un salto
     de cuadro). Sin este seguro, al retirar se cancelaba el reloj pendiente
     y el corazón NUNCA caía: quedaba un mundo vacío para siempre. */
  _soltarLluvia() {
    if (this._lluviaSuelta) return;
    this._lluviaSuelta = true;
    this.alSoltarLluvia();
  }

  _retirar() {
    this.el.remove();
    window.removeEventListener('scroll', this._frenarScroll);
    this._relojes.forEach(clearTimeout);
    this._relojes.length = 0;
    this._soltarLluvia();
    this.alTerminar();
  }

  /* setTimeout con registro, para poder cancelar todo al retirar */
  _enEspera(fn, ms) {
    this._relojes.push(setTimeout(fn, ms));
  }
}
