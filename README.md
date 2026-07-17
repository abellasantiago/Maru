# Santi & Maru — Nuestro recorrido

Sitio de regalo de una sola página. Es un viaje inmersivo en 3D (inspirado en
la sensación de activetheory.net) que cuenta nuestra historia en tres fases,
todas ligadas al scroll. La dirección visual es **"viaje hacia el amanecer"**:
todo el mundo — nebulosa cálida, velos de seda, bokeh — apunta a un
resplandor dorado al final del corredor, que empalma con la pantalla final crema.

1. **Landing** — un corazón de **point cloud rojo** (miles de partículas
   llenando un volumen 3D real, que repelen al cursor) flota en una nebulosa
   bordó. Al scrollear **gira sobre su eje** mientras el mundo pasa de largo
   (una frase suspendida en el espacio, velos) y al final **se desarma**:
   cada partícula vuela a su punto de dispersión, dando paso al timeline —
   que NO se ve de arranque: cada card despierta recién cuando la cámara
   se le acerca lo suficiente, primero tenue y borrosa, después nítida.
2. **Timeline** — la cámara vuela por las **cards** (una por momento), con
   banking en las curvas, y cada una entra en foco a su turno. Se navega con el
   scroll, con la sidebar, con las flechas o con el buscador.
3. **Final** — la cámara se acerca al amanecer y un velo crema disuelve hacia
   la pantalla de cierre ("llegar a la luz").

## Cómo correrlo

Sin build tools. Solo un servidor estático (los módulos ES no andan con `file://`):

```
python -m http.server 8123
```

y abrir `http://localhost:8123`. **No necesita internet, nunca**: Three.js, GSAP,
ScrollTrigger, Lenis y las fuentes están vendorizados (`js/vendor/`, `assets/fuentes/`).

> `herramientas/dev-servidor.mjs` es un server SÓLO de desarrollo (agrega un
> endpoint de capturas para verificar). Para el sitio real, cualquier estático alcanza.

## Dónde tocar cada cosa

| Qué | Dónde |
|---|---|
| **Los momentos** (fecha, título, texto, palabras del buscador, hito destacado) | `js/hero/momentos.js` → array `DATOS` |
| **Fotos reales** (reemplazar placeholders) | `assets/fotos/Momento-01.jpg` … |
| Duración de cada fase del scroll | `FASES` en `js/hero/config.js` |
| Largo total del scroll | `--alto-recorrido` en `css/estilos.css` |
| Cuántas vueltas gira el corazón en el landing | `CONFIG.vueltasCorazon` en `config.js` |
| Ruta de la cámara (curvas, encuadres y banking) | `js/hero/camara.js` |
| Paleta de colores (única fuente de verdad) | variables CSS en `css/estilos.css` |
| Frases que flotan durante el descenso | `FRASES` en `js/hero/paneles.js` |
| Texto de la pantalla final | sección `#final` en `index.html` |

### La ambientación 3D (capas de profundidad)

Cada capa es un módulo independiente con el mismo contrato
(`actualizar(...)` por frame, `destruir()`); las cantidades viven en
`CONFIG` y los colores salen SIEMPRE de la paleta CSS:

| Capa (de lo infinito a lo cercano) | Módulo |
|---|---|
| Nebulosa envolvente + estrellas + **el amanecer** destino | `js/hero/atmosfera.js` |
| Velos de seda / auroras cálidas (la gran estructura de escala) | `js/hero/velos.js` |
| Bokeh de ensueño + luciérnagas doradas | `js/hero/ambiente.js` |
| Corazón point cloud rojo (repele al cursor, se desarma al scrollear) | `js/hero/corazon.js` |

Regla de oro de la ambientación: **el centro de la pantalla queda despejado**
(el bokeh y las luciérnagas despejan un corredor; los velos nunca pasan de
alfa ~0.1) — la profundidad se siente en los costados, nunca tapa al corazón
ni a las cards.

### Agregar / quitar / reordenar momentos

Se edita **solo** el array `DATOS` en `momentos.js`. La posición 3D de cada card,
las anclas de cámara, la sidebar, el indicador (`NN / total`) y el buscador se
recalculan solos a partir de ese array. Las fotos se buscan por índice
(`momento-01.jpg`, `momento-02.jpg`, …), así que conviene mantener ese nombrado.

Para marcar un hito especial (como "nos pusimos de novios") se le pone
`destacado: true` y la card toma un marco/glow dorado.

### El timeline despierta, no aparece

Cada card tiene su propio `--revelado` (0..1) según la distancia a la cámara
(`js/hero/paneles.js`): a lo lejos es **0 puro** (invisible, ni insinuada) y
sólo empieza a asomar — oscura y velada — cuando la cámara está a menos de
~11 unidades; a menos de ~5 queda del todo nítida y luminosa. Los umbrales
son esos dos números en `paneles.js` (`smoothstep(distCamara, 5, 11)`): subir
el primero retrasa aún más el despertar, bajar el segundo lo hace más brusco.

## El corazón es modular

`js/hero/corazon.js` es un point cloud rojo: miles de partículas llenan un
corazón 3D construido inflando la curva ♥ clásica como un almohadón (de
frente, silueta perfecta con surco profundo; girado, panza y cuerpo), con el
contorno reforzado por una banda de partículas más brillantes. Repelen al
cursor y, con el scroll, cada una vuela hacia su punto de dispersión (`aDispersa`).
Ese destino queda abierto a propósito: para que el desarme forme OTRA COSA
más adelante, alcanza con cambiar los `aDispersa` por las posiciones de la
nueva figura. Contrato público (no cambiar al reemplazar la pieza):

```js
new Corazon(escena)
corazon.setGiro(radianes)      // giro sobre su eje (lo maneja el scroll del landing)
corazon.setDesarme(0..1)       // 0 armado → 1 disperso (el fade vive al final)
corazon.setPosicion(v)         // re-anclaje al punto de mirada (landing)
corazon.actualizar(dt, tiempo, mouseNDC, camara, dpr)
corazon.destruir()
```

## Vida y profundidad (capas de inmersión)

Tres toques que le dan cuerpo al hero, suaves y sin estorbar al centro:

| Efecto | Dónde | Perilla |
|---|---|---|
| **Enfoque cinematográfico** (foco corto: centro nítido, bordes blandos) | `js/hero/postproceso.js` | `CONFIG.enfoque`, `radioNitido` |
| **Tilt 3D + brillo especular** de las cards al pasar el cursor | `js/hero/paneles.js` + CSS `.panel-tilt`/`.panel-brillo` | ángulo en el `pointermove` |
| **Cámara viva** (deriva orgánica mínima, "cámara en mano") | `js/hero/camara.js` | `CONFIG.derivaCamara` |

Todos respetan `prefers-reduced-motion` (deriva y tilt se apagan) y el táctil
(sin tilt/brillo, que necesitan hover).

## Performance y accesibilidad

- **Un solo WebGLRenderer** para todo. Los paneles son DOM (CSS3D) pero sólo
  se pintan los cercanos y ya revelados (`objeto.visible = false` mientras
  --revelado es 0: ni siquiera se agregan al DOM); los del medio sueltan el
  `backdrop-filter` (el blur es lo más caro).
- La ambientación es barata a propósito: pocas luces grandes (150 bokeh) en
  vez de miles de puntos, velos como planos desplazados en GPU y un domo que
  sigue a la cámara.
- El hero se **pausa** al entrar a la pantalla final; el **cursor sigue vivo**
  (se actualiza siempre, aún con el hero pausado).
- `prefers-reduced-motion`: menos elementos, ondulación mínima, sin parallax
  ni mecidos.
- Mobile: menos elementos, nebulosa con menos octavas de ruido, cámara con FOV
  más amplio, cursor nativo.
