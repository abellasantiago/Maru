# CLAUDE.md — Contexto del proyecto

## Descripción

Sitio-regalo de Santi para Maru: un recorrido inmersivo en 3D por los momentos
de la relación. El scroll no mueve contenido en 2D — mueve una cámara por un
mundo. El sitio abre directo, sin preludio ni pantalla de carga: un
**landing** con un corazón de partículas que ya está cayendo, se arma, gira y
se desarma en brasas, un **timeline** de 30 cards de vidrio flotando en un
corredor, y una **pantalla final** ("Que sea eterno."). La canción arranca
con el primer click en cualquier parte del sitio.

Lo importante del sitio es la experiencia visual: tiene que verse de cine.

## Stack

- **Three.js** (vendorizado en `js/vendor/three/`) — WebGL + CSS3DRenderer
- **GSAP + ScrollTrigger + Lenis** (vendorizados) — scroll suave y progreso
- Shaders GLSL propios con ruido simplex compartido (`js/hero/ruido.js`)
- Post-proceso: bloom + profundidad de campo + aberración + grano + viñeta
- Sin build step: HTML/CSS/ESM servidos estáticos. `node herramientas/dev-servidor.mjs`
- `sharp` sólo para optimizar fotos (`herramientas/optimizar-fotos.mjs`)

## Dónde está cada cosa

**El README.md es la documentación de verdad** — explica cada capa, el porqué
de las decisiones no obvias y qué tocar para cambiar cada cosa. Empezar ahí.

Reglas que conviene tener en la cabeza antes de tocar el hero:

- **Todo el hero es aditivo.** Miles de puntos sumándose queman a blanco muy
  rápido, y el oro sube los tres canales (satura antes que el rojo). Cualquier
  alfa nuevo se calibra contra la cantidad real de partículas.
- **NaN en un shader = rectángulo negro gigante**, porque el blur del bloom lo
  esparce. De ahí los `if (!(alfa > x)) discard;` negados y evitar `pow()` con
  base posiblemente negativa.
- **La paleta vive sólo en las variables CSS** de `:root`; los shaders la leen
  desde ahí (`config.js`).
- El corazón tiene un contrato público estable — se puede reemplazar la pieza
  sin tocar el resto.

## Historial de cambios

### 2026-08-07 — perf+feat: que se vea de cine en la laptop de 13"

- Punto de partida MEDIDO en la máquina real de Santi (MacBook Pro 13",
  Intel Iris Plus 645, 1440×900 @2×): el landing corría a **31 ms por
  cuadro (~31 fps)** y, encima, **todo el post-proceso se dibujaba a la
  mitad de la resolución de la pantalla**. El composer se construía con el
  tamaño en píxeles CSS en vez del tamaño del buffer real, así que en retina
  el cuadro salía de 1440×900 estirado a 2880×1800 — hasta que alguien
  redimensionaba la ventana y ahí se ponía nítido de golpe… y perdía la
  mitad de los cuadros. Hoy: **14 ms a 2160×1350**. Más del doble de píxeles
  reales y el doble de fluidez.
- **El MSAA ×4 costaba 17 ms de cuadro y no suavizaba nada.** Era herencia
  de las viejas enredaderas de tubos; hoy no queda un solo borde de
  geometría (puntos con caída de alfa, planos con los bordes desvanecidos
  por shader, cards en DOM). Fuera.
- **La nebulosa se dibuja a un lienzo propio al 32% y se estira** a pantalla
  completa (`escenaDomo` + `rtDomo` + telón en `atmosfera.js`). Costaba
  13 ms —la mitad del cuadro— porque es un FBM de ruido simplex evaluado en
  cada píxel, y lo que dibuja son nubes suavísimas: a esa resolución no hay
  diferencia visible. Con el aire que sobró pasó de 3 octavas a 4 con
  deformación de dominio, que es lo que le da hebras en vez de manchas.
- **Los velos costaban 4.5 ms por un ruido simplex POR PÍXEL** en el
  fragment shader; son planos enormes y superpuestos, o sea muchísimo
  relleno. El ruido se mudó al vertex shader (72 divisiones = 24 vértices
  por ciclo: indistinguible) y quedaron en 1.1 ms.
- **La resolución ya no se elige: se mide** (`js/hero/calidad.js`, nuevo).
  El gobernador busca la escala más alta sostenible entre 1× y 2×. Detalle
  que hay que tener en la cabeza para tocarlo: con vsync el tiempo entre
  cuadros está CUANTIZADO (a 60 Hz, 14 ms y 16.6 ms se miden los dos como
  16.7; 16.8 se mide como 33), así que no se puede deducir cuánto margen
  sobra — hay que probar a subir y volver si sale mal, anotando el techo
  para no oscilar. Simulado contra los costos reales medidos: converge en
  ≤2 cambios en todos los escenarios (Intel → 1.5×, M-series → 2×).
- Con el presupuesto liberado subió TODO: corazón 6500 → 11 000 partículas,
  luciérnagas 480 → 760, estrellas 620 → 1100, bokeh 150 → 200, velos
  10 → 13, ecos de brasas 2 → 3. El alfa del corazón EN REPOSO ahora también
  se normaliza por cantidad (`uDensidadReposo`, 80% de corrección): sin eso,
  con blending aditivo el doble de puntos es el doble de luz y el contorno
  quemaba a blanco — que es exactamente lo que pasaba antes (mirá una
  captura vieja: la silueta era BLANCA, no roja). Verificado midiendo
  píxeles en todo el recorrido: cero quemados, pico 750/765.
- Post-proceso nuevo: radio de lente corregido por aspecto (en 16:10 el
  desenfoque y la viñeta pegaban igual arriba que en los costados, que están
  mucho más lejos del eje óptico), bokeh en espiral de ángulo áureo con las
  luces pesando más que el fondo, halación cálida en los niveles anchos del
  bloom, curva S de revelado, grano pegado a los medios tonos y tramado de
  un nivel contra el banding (todo el sitio es un degradé bordó oscurísimo
  en 8 bits: sin tramar se ven las bandas).
- **Arrastre de velocidad**: al scrollear rápido el cuadro se estira
  radialmente hacia afuera, como una toma acelerando por un túnel. Reusa el
  disco de muestras del bokeh, así que no cuesta un pase aparte.
- Movilidad y navegación: Lenis de 1.15 a 1.0 (el trackpad de Mac ya trae su
  propia inercia; encima del suavizado se sentía el volante flojo) y
  navegación por teclado (← → de momento en momento, Inicio/Fin a las
  puntas). Las flechas VERTICALES quedan libres a propósito: son la forma de
  scrollear con el teclado y acá el scroll es el viaje.
- Bug de detección que valía para cualquier máquina: `ES_MOBILE` miraba
  `max-width: 760px` de la VENTANA. Abrir el sitio en una ventana angosta y
  después agrandarla dejaba la calidad de teléfono clavada para siempre
  (esas constantes se evalúan una sola vez y con ellas se construyen los
  buffers). Ahora mira la PANTALLA, que no cambia al redimensionar.
- Trampa de la que caí DOS veces en esta sesión: **una comilla invertida
  dentro de un comentario GLSL** corta el template literal y rompe el módulo
  entero, con un error de sintaxis que apunta a una palabra del shader y no
  dice nada útil. Chequeo rápido: las comillas invertidas de cada archivo de
  `js/hero/` tienen que ser PARES.
- Rama: `claude/macbook-13-optimization-ba32e6`.

### 2026-08-06 — feat: coordenadas de un lugar nuestro en el monograma, contador menos incrustado

- El monograma (arriba a la izquierda, vacío desde siempre) pasa a tener
  contenido: las coordenadas de un lugar especial de Santi y Maru, en
  `.monograma-coord` dentro de `#monograma`. Mismo lenguaje que la fecha de
  las cards (línea dorada + texto tracked) para no inventar un vocabulario
  visual nuevo — se armaron mockups comparando dónde ponerla, cómo tratarla
  y qué interacción darle antes de tocar el código real.
- Con puntero fino nace apagada y con un pelo de blur (`opacity 0.32`,
  `blur(1.4px)`) y al pasar el cursor se enfoca mientras los dígitos
  decodifican de izquierda a derecha (los símbolos ° ' " S W no se tocan).
  Todo el reposo/hover vive en `@media (pointer: fine) and
  (prefers-reduced-motion: no-preference)` — a propósito NO en una clase
  que agrega el JS, porque eso llega después del primer cuadro y se veía
  como un parpadeo al cargar la página. En táctil queda fija y nítida, sin
  depender de un hover que ahí no existe.
- Es un detalle del arranque, no un elemento permanente: se esfuma con el
  scroll al mismo umbral que el contador de tiempo juntos
  (`progreso >= 0.03`), reusando su mecanismo (`.oculto`, `setProgreso` en
  `ui.js`).
- Es un `<a>` real a Maps (coordenada convertida a decimal en el `href`),
  abre en pestaña nueva. Por eso queda afuera del listener del primer click
  que dispara la canción — si no, el fundido largo de 3600ms se tocaba
  entero en una pestaña que nadie está mirando.
- De paso, el contador de tiempo juntos queda menos "incrustado": opacity
  0.8→0.6, `blur(0.35px)`, sombra oscura aflojada (12px/0.5 → 18px/0.34) y
  halo dorado más abierto (18px/0.22 → 28px/0.26) — la sombra ceñida era la
  que le daba el relieve de grabado contra la nebulosa.
- Trampa de debugging para la próxima: en el preview de este entorno, una
  transición CSS activa en un elemento ya renderizado le gana a `!important`
  (incluso puesto a mano vía `el.style`) y queda trabada por el throttle de
  la pestaña de fondo — así se explicaban computed styles que no cuadraban.
  Se confirma probando la regla en un elemento nuevo sin render previo.
- Rama: trabajado directo sobre `main`.

### 2026-08-02 (3) — feat: fecha de las cards con línea dorada, título sin itálica

- Santi no estaba conforme con el texto de las cards del timeline. Se
  armó un mockup comparando 6 tratamientos tipográficos posibles (con las
  fuentes y paleta reales del sitio) y eligió **"línea de tiempo"**: la
  fecha se integra con una rayita dorada antes en vez de flotar como
  cartel suelto.
- `panel-fecha` pasa de rojo-claro a `--color-dorado`, con tracking bajado
  de 0.3em a 0.14em (0.3 se leía como cartel/alarma) y una `panel-fecha-raya`
  nueva (línea de 14px) antes del texto.
- Único ajuste sobre la opción elegida: el título (`panel-palabra`) pierde
  la itálica — Santi lo pidió derecho, "que se lea normal". Queda en
  Cormorant Garamond 600 upright en vez de italic 600.
- El override `.destacado .panel-fecha { color: dorado }` se saca: quedó
  redundante porque la fecha ya es dorada para todas las cards (el hito
  especial se sigue distinguiendo por el marco/glow dorado de la card).
- Rama: trabajado directo sobre `main`.

### 2026-08-02 (2) — feat: se saca el preludio entero, la canción arranca con el primer click

- Veredicto de Santi sobre el umbral (ver entrada anterior, mismo día):
  *"no me gustó"*. Decisión: nada de preludio — **el sitio carga directo con
  la lluvia del corazón ya cayendo**, sin pantalla intermedia de ningún tipo.
- Se borran `js/hero/umbral.js` y `js/hero/obertura.js` enteros (los dos
  intentos: el SVG en DOM y el anillo en WebGL). `main.js` llama
  `corazon.comenzarEntrada()` directo en el constructor — ya no hay
  `if (!obertura.activa)`, ni Lenis arranca parado, ni hace falta el velo de
  `#obertura` en el HTML/CSS.
- **La canción ya no tiene una "apertura" que la dispare**: ahora un listener
  de `click` en `window` (armado en `ui.js` desde el arranque) la suelta con
  el primer click en cualquier parte del sitio, con el mismo fundido largo
  (3600 ms) que antes tenía la obertura.
- Trampa evitada a propósito: si ese primer click cae en la cápsula
  Santi ♥ Maru, el listener global lo ignora (`pill.contains(e.target)`) y
  sigue armado para el próximo click en otro lado. Sin esa guarda, el handler
  propio de la cápsula (`alternarCancion`) vería `audio.paused === false`
  —porque `.play()` ya lo puso en `false`— y pausaría la canción en el mismo
  gesto que la arrancó.
- Rama: trabajado directo sobre `main`.

### 2026-08-02 (1) — feat: el umbral, un preludio en 3D (reemplaza el 11:11) — DESCARTADO

> Esta entrada documenta un diseño que se hizo y se sacó el mismo día (ver
> entrada de arriba). Queda como registro de qué se probó y por qué no
> convenció, no como estado actual del sitio.

- La obertura deja de ser una **capa de DOM puesta adelante** del sitio y
  pasa a ser un **preludio en WebGL dentro de la misma escena**
  (`js/hero/umbral.js`, nuevo): miles de partículas se encienden muy lejos,
  vienen en espiral hacia el lente con estelas y arman un anillo de luz que
  **se cierra dando la vuelta** — esa es la barra de carga, disfrazada.
  Cerrado, respira y **estalla hacia la cámara**: nos deja del otro lado con
  el corazón ya lloviendo. No hay corte, se pasa a través.
- Primer intento descartado: un corazón SVG trazándose en el DOM. Se veía
  plano y ajeno al resto del sitio — **si todo el hero es WebGL, el preludio
  también tiene que serlo**, o se nota que es otra cosa pegada adelante.
- **Ya no hay click.** El umbral se arma y se abre solo. Como los navegadores
  no dejan sonar audio sin un gesto real, `ui.js` intenta la canción en la
  apertura y, si la bloquean, la deja ARMADA: entra sola con el primer
  movimiento de Maru (que es enseguida, hay que scrollear para ver algo).
- Reparto: `umbral.js` dibuja, `obertura.js` sólo lleva el reloj (`RITMO`) y
  avisa por callbacks, y `#obertura` queda como un escudo transparente.
- Bug encontrado probando en el navegador: el tween de la salida destruye el
  umbral en su `onComplete`, y el del velo —otro tween— escribía `setVelo`
  sobre `null` si se resolvían en el mismo tick (pasa con `lagSmoothing(0)`
  y una pestaña que vuelve de segundo plano). Se rompía el arranque entero.
  Arreglado con **un solo punto de escritura** (`_aplicar()`) y guarda.
- Calibrado midiendo píxeles del canvas real, no a ojo: halo y resplandor
  interior van bajos porque subirlos APLANA la silueta (contraste aro/centro
  1,38 → 2,55), y cero píxeles quemados a blanco (pico 640/765).
- Rama: trabajado directo sobre `main`.

### 2026-08-01 — feat: obertura 11:11, canción con el primer click y desarme en brasas

- Nuevo módulo `js/hero/obertura.js`: primera pantalla con **11:11** suspendido
  en la oscuridad, revelado pieza por pieza de desenfocado a nítido, con los dos
  puntos respirando como los de un reloj. La invitación "hacé click" asoma cada
  3 segundos.
- **Todo cae para el mismo lado**: con el click, el 11:11 se disuelve hacia
  abajo, la pantalla inicial se descuelga hacia abajo (borde superior
  difuminado) y detrás las partículas ya están lloviendo. Las dos pantallas se
  leen como una sola toma en vez de un corte.
- La canción arranca con ese mismo click (fundido largo, crece con la lluvia).
  El mp3 se **precarga** desde el arranque: el navegador no deja sonar audio
  antes de un gesto real, y sin precarga el primer compás llegaba tarde.
- El corazón **se desarma en brasas**: completa su giro y se planta de frente,
  se vacía de abajo hacia arriba dejando el contorno ♥ dibujado en el aire, y
  las brasas caen y se van hacia el corredor con estelas de movimiento.
- `vueltasCorazon` pasa a ser entero por diseño: si el corazón queda de perfil
  al desarmarse, se lee como una columna y se pierde la silueta.
- Brillo de las brasas normalizado por cantidad de partículas
  (`PARTICULAS_CALIBRADAS`): el desarme se ve igual en teléfono (3600) que en
  pantalla grande (6500). Sin eso, el mismo shader quemaba el cuadro a blanco.
- Rama: trabajado directo sobre `main`.

## Pendiente

Fases 2–4 de la propuesta visual: nombre revelado en el hero, capítulos y hilo
de luz en el timeline, y darle vida a la pantalla final.
