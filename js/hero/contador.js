/* ═══════════════════════════════════════════════════════════════
   Contador de tiempo juntos — en vivo, bajo el corazón del landing.

   Una sola línea poética en serif itálica que cuenta cuánto llevamos
   de novios desde el 20/09/2025 a las 16:00, descompuesto en meses
   CALENDARIO reales (no bloques de 30 días) + días, horas, minutos y
   segundos restantes. Se actualiza cada segundo.
   ═══════════════════════════════════════════════════════════════ */

/* Mes 8 = septiembre (los meses de Date van de 0 a 11) */
const INICIO = new Date(2025, 8, 20, 16, 0, 0);

const MS_DIA = 86400000;
const MS_HORA = 3600000;
const MS_MIN = 60000;

/* "1 mes" / "2 meses", "1 día" / "2 días", … */
function plural(n, singular, plurales) {
  return `${n} ${n === 1 ? singular : plurales}`;
}

/* Descompone ahora−INICIO en meses calendario + resto exacto */
function descomponer(ahora) {
  /* Cantidad de meses calendario completos transcurridos: avanzamos el
     aniversario mensual y retrocedemos uno si nos pasamos de "ahora". */
  let meses =
    (ahora.getFullYear() - INICIO.getFullYear()) * 12 +
    (ahora.getMonth() - INICIO.getMonth());
  let ancla = new Date(INICIO);
  ancla.setMonth(INICIO.getMonth() + meses);
  if (ancla > ahora) {
    meses -= 1;
    ancla = new Date(INICIO);
    ancla.setMonth(INICIO.getMonth() + meses);
  }

  let resto = ahora - ancla;
  const dias = Math.floor(resto / MS_DIA);
  resto -= dias * MS_DIA;
  const horas = Math.floor(resto / MS_HORA);
  resto -= horas * MS_HORA;
  const minutos = Math.floor(resto / MS_MIN);
  const segundos = Math.floor((resto - minutos * MS_MIN) / 1000);

  return { meses, dias, horas, minutos, segundos };
}

export class ContadorJuntos {
  /** @param {HTMLElement} el  contenedor fijo bajo el corazón */
  constructor(el) {
    this.el = el;
    this._tick = this._tick.bind(this);
    this._tick();
    /* Cada 250 ms: el segundo cambia sin drift perceptible y el costo
       de escribir textContent cuatro veces por segundo es despreciable. */
    this.intervalo = setInterval(this._tick, 250);
  }

  _tick() {
    const t = descomponer(new Date());
    const texto = [
      plural(t.meses, 'mes', 'meses'),
      plural(t.dias, 'día', 'días'),
      plural(t.horas, 'hora', 'horas'),
      plural(t.minutos, 'minuto', 'minutos'),
      plural(t.segundos, 'segundo', 'segundos'),
    ].join(', ');
    if (texto !== this._previo) {
      this.el.textContent = texto;
      this._previo = texto;
    }
  }
}
