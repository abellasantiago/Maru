/* ═══════════════════════════════════════════════════════════════
   Gobernador de calidad — busca la resolución más alta que la
   máquina pueda sostener a 60 cuadros por segundo.

   El problema: en una pantalla retina de laptop hay 4 veces más
   píxeles que en la misma pantalla a 1×, y este hero es todo
   relleno (nebulosa a pantalla completa, miles de puntos aditivos,
   bloom de radio ancho). Una GPU integrada dibuja eso a 2× en unos
   26 ms —38 cuadros por segundo— y a 1.5× en 15. La diferencia
   entre esas dos cifras se SIENTE más que cualquier efecto que se
   pueda agregar: una cámara que vuela a 30 fps se lee como un video
   trabado, por lindo que esté cada cuadro suelto.

   Y no hay constante que resuelva esto: la misma laptop de 13" puede
   ser una Intel de 2019 o una M4. Por eso se mide en marcha.

   Cómo funciona:
   ▸ Junta el tiempo de cada cuadro en una ventana de ~1 segundo y se
     queda con la MEDIANA (un tirón suelto —una foto que termina de
     decodificar, el recolector de basura— no puede bajar la calidad
     de todo el sitio).
   ▸ Si la mediana pasa el techo, baja un escalón.
   ▸ Si venimos manteniendo el refresco DOS ventanas seguidas, prueba
     subir uno. Es una prueba y no una deducción a propósito: con
     vsync, el tiempo entre cuadros está cuantizado y no se puede leer
     cuánto margen sobra (ver los umbrales en config.js).
   ▸ Si esa prueba sale mal, vuelve y ANOTA ESE TECHO: no lo intenta
     nunca más. Sin eso, una máquina justo en el límite quedaría
     cambiando de resolución para siempre, que es peor que quedarse
     abajo — un cambio de resolución SE VE.

   El resultado en una máquina holgada es indistinguible de fijar la
   calidad al máximo; en una justa, el sitio se ve todo lo nítido que
   puede sin perder la fluidez.
   ═══════════════════════════════════════════════════════════════ */

import { CALIDAD } from './config.js';

/* Cuadros por ventana de medición (~1 s a 60 Hz) */
const VENTANA = 58;

/* Cuadros de gracia al arrancar: los primeros son siempre lentos (compilación
   de shaders, subida de texturas, primer layout de las cards) y no dicen nada
   sobre lo que la máquina puede sostener después. Generoso a propósito —
   2.5 segundos— para que la primera prueba de subir caiga DESPUÉS de que la
   lluvia terminó de armar el corazón: ese es el momento en que hay que estar
   mirando el sitio, no un cambio de resolución. */
const GRACIA = 150;

/* Cuadros de espera después de cambiar la escala: reasignar los render targets
   deja una estela de cuadros lentos que no hay que leer como veredicto. */
const REPOSO = 42;

/* Ventanas buenas seguidas que hacen falta antes de arriesgar una subida.
   Con una sola, cualquier tramo tranquilo del recorrido dispararía una prueba. */
const VENTANAS_PARA_SUBIR = 2;

export class GobernadorCalidad {
  /**
   * @param {(escala:number)=>void} alCambiar  aplica la nueva escala de render
   */
  constructor(alCambiar) {
    this.alCambiar = alCambiar;
    this.escala = CALIDAD.escalaInicial;
    /* Techo aprendido: arranca en el máximo del dispositivo y sólo BAJA,
       cuando un intento de subir sale mal. */
    this.techo = CALIDAD.escalaMaxima;

    this.muestras = [];
    this.ignorar = GRACIA;
    /* Escala desde la que se subió, para poder volver si sale mal */
    this._probando = 0;
    this._buenas = 0;
  }

  /** Un cuadro más. `ms` es el delta real entre cuadros. */
  registrar(ms) {
    /* Un delta enorme es una pestaña que volvió de segundo plano o el sistema
       que se distrajo, no la escena: no dice nada del costo real. */
    if (ms > 120) { this.ignorar = Math.max(this.ignorar, REPOSO); return; }
    if (this.ignorar > 0) { this.ignorar--; return; }

    this.muestras.push(ms);
    if (this.muestras.length < VENTANA) return;

    const mediana = this._mediana();
    this.muestras.length = 0;

    if (mediana > CALIDAD.techoMs) {
      /* No llegamos. Si veníamos de una prueba de subir, ESA es la frontera:
         se anota como techo y no se vuelve a intentar. */
      if (this._probando) {
        this.techo = this._probando;
        this._probando = 0;
      }
      this._buenas = 0;
      this._aplicar(this.escala - CALIDAD.escalon);
      return;
    }

    if (mediana > CALIDAD.holgadoMs) {
      /* Ni bien ni mal: no perdemos cuadros pero tampoco sobra. Nos quedamos
         donde estamos, que es exactamente lo que se busca. */
      this._probando = 0;
      this._buenas = 0;
      return;
    }

    /* Mantenemos el refresco. La prueba anterior (si la hubo) quedó confirmada. */
    this._probando = 0;
    this._buenas++;

    if (this._buenas >= VENTANAS_PARA_SUBIR && this.escala < this.techo) {
      this._buenas = 0;
      this._probando = this.escala;
      this._aplicar(this.escala + CALIDAD.escalon);
    }
  }

  _mediana() {
    const orden = this.muestras.slice().sort((a, b) => a - b);
    return orden[orden.length >> 1];
  }

  _aplicar(escala) {
    const nueva = Math.min(
      Math.max(escala, CALIDAD.escalaMinima),
      Math.min(this.techo, CALIDAD.escalaMaxima)
    );
    /* Comparación con margen: las sumas de 0.25 acumulan error binario */
    if (Math.abs(nueva - this.escala) < 0.01) { this._probando = 0; return; }
    this.escala = nueva;
    this.ignorar = REPOSO;
    this.alCambiar(nueva);
  }
}
