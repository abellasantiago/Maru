# CLAUDE.md — Contexto del proyecto

## Descripción

Sitio-regalo de Santi para Maru: un recorrido inmersivo en 3D por los momentos
de la relación. El scroll no mueve contenido en 2D — mueve una cámara por un
mundo. El sitio abre directo, sin preludio ni pantalla de carga: un
**landing** con un corazón de partículas que ya está cayendo, se arma, gira y
se desarma en brasas, un **timeline** de 39 cards de vidrio flotando en un
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

### 2026-09-10 — feat: fotos de las cards 36–39, y dos mecanismos nuevos de encuadre (ancha + zoom)

- Llegaron las fotos reales de las 4 cards agregadas ayer:
  `Momento-36.webp` … `Momento-39.webp` (Key Conference, Escapada al
  campo, Cuidamos a Alaska, Asadito con Manu y Juanpe). Ya no quedan
  cards vacías ni 404 en consola.
- **Cuidamos a Alaska** era horizontal (1600×900) con Santi y Maru
  pegados al borde izquierdo y la gata pegada al derecho — el recorte
  5:4 de siempre se comía buena parte de los dos costados. Pedido de
  Santi en dos vueltas: primero "agrandá para los costados", después
  "un poco menos, que entre desde mi cara hasta donde termina el gato",
  y por último "achicala un toque más desde la derecha, pegado a la
  cara/hocico de Alaska". Se armó `ancha: true` (nuevo flag en
  `momentos.js`/`paneles.js`/`estilos.css`): la card pasa de 5:4 a ~8:5
  sin cambiar de alto —no toca el ritmo vertical del corredor—, y para
  que el ancho extra no se reparta mitad y mitad (que era el problema:
  centrado, cortaba un poco de cara Y dejaba sillón de sobra después
  del gato) el `encuadre` de esa card pasa a `'0% 50%'` (pegado al
  borde izquierdo), así todo el ancho extra se usa para el lado
  derecho. El ancho final (594px, contra los 470px de siempre) NO salió
  a ojo: se recortó la foto real con los mismos parámetros que usa la
  card (mismo alto, mismo object-fit:cover, mismo alineado a la
  izquierda) probando varios anchos hasta encontrar el punto exacto
  donde el borde derecho queda pegado al hocico sin cortarle la nariz.
- **Escapada al campo (la 37, no la 12 vieja)**: acá el problema no era
  de costados sino de escala — dos jinetes a caballo quedan chicos con
  medio cuadro de cielo de sobra arriba. Pedido: "dale un poquito de
  zoom". Como `encuadre` sólo mueve la posición del recorte (no
  escala), se armó un mecanismo nuevo: `zoom: N` en `momentos.js`, que
  `paneles.js` escribe como variable CSS `--zoom` en el propio `<img>`
  y que se MULTIPLICA (no pisa) con el `scale()` que ya existía para el
  revelado por foco — las dos animaciones conviven sin pelearse.
  Calibrado en 1.15 recortando la foto real en varios valores (1.10 a
  1.28) hasta encontrar el que se sentía "un poquito" sin perder el
  árbol ni los caballos completos.
- Los dos mecanismos quedan documentados en el bloque de instrucciones
  de arriba de `momentos.js` (mismo lugar que `destacado`), disponibles
  para cualquier otra foto que los necesite más adelante.
- Trampa del preview en esta sesión: el `--alto-recorrido` está en vh,
  así que `recorrido.offsetHeight` cambia con la altura de la VENTANA
  del navegador. Navegar con `scrollTo(fraccion * alcance)` justo
  después de un `resize_window` daba resultados erráticos (progreso
  equivocado, a veces clavado en 1) si el layout no había terminado de
  reflow-ear — hubo que reintentar el scroll 2-3 veces con esperas
  cortas entre medio antes de leer `recorrido.progreso`. Aparte, con el
  pane del preview en background el bucle de `gsap.ticker` se pausa de
  verdad (framebuffer negro incluso leyendo píxeles directo con
  `gl.readPixels`, no sólo el screenshot) — a diferencia de la trampa
  del 08-10 (ahí `document.hidden` quedaba pegado en `true` de forma
  espuria), acá `document.hidden` reflejaba la realidad: el pane estaba
  oculto. La captura que ya se había tomado ANTES de que se ocultara
  sirvió como prueba visual igual.
- Rama: trabajado directo sobre `main`.

### 2026-09-09 — feat: 4 cards nuevas (36–39) sin que se mueva el ritmo del scroll

- Cards nuevas al final del timeline, pedidas por Santi: **Key
  Conference** (24 ago 2026), **Escapada al campo** (27 al 30 ago),
  **Cuidamos a Alaska** (31 ago al 7 set) y **Asadito con Manu y Juanpe**
  (6 set). Van con `desc: ''` —no con el texto genérico— y
  `encuadre: '50% 50%'` hasta que estén las fotos (`Momento-36.jpg` …
  `Momento-39.jpg` en `assets/fotos/` + `node
  herramientas/optimizar-fotos.mjs`). Mientras falten, la card se ve como
  un panel de vidrio vacío y la consola tira esos cuatro 404: es lo
  esperado, no hay nada roto.
- El punto real de la sesión fue lo otro: **agregar cards estaba
  acelerando el recorrido entero**. Todas las fases (`FASES` en
  `config.js`) son fracciones del ESPACIADOR entero, y el timeline
  reparte su largo entre (cantidad de cards + 2) segmentos de curva — así
  que cada card nueva le roba scroll a todas las demás sin que nadie
  toque una sola constante. Con 32 cards eran los 74vh por card
  calibrados; venía bajando sin que se notara (35 cards → 68.1vh) y con
  39 caía a 61.5vh: las cards pasarían 10% más rápido de lo que Santi
  venía viendo. Veredicto de Santi: *"que el ritmo del scroll quede como
  antes"* — o sea, clavado en los 68.1vh de las 35 cards.
- No alcanzaba con estirar `--alto-recorrido`: eso estira TODO
  proporcionalmente, incluido el landing (que se habría vuelto 9% más
  lento) y el velo del final. La receta correcta —anotada ahora en el
  comentario de `FASES`— es fijar en vh lo que no se mueve y despejar las
  fracciones: `landingFin = 390 / alto` y `timelineFin = (alto − 90) /
  alto`. Con alto = 3272vh (3000 + 4×68, exactamente las cards nuevas y
  nada más) queda `landingFin: 0.1192` y `timelineFin: 0.9725`.
- Trampa que había que cazar aparte: hay cuatro umbrales que son
  fracciones ABSOLUTAS del espaciador y por lo tanto NO se reescalan
  solos — el velo crema (`+0.015` y `0.995` en `main.js`), el fade del
  contador/coordenadas (`0.03` en `ui.js`) y el corte de la UI de cards
  (`+0.005`). Sin tocarlos, el dissolve final habría durado 24.5vh en vez
  de 30 (18% más rápido) y el contador se habría ido 8vh más tarde.
  Reescalados por 3000/3272 → `+0.01375`, `0.99542`, `0.0275` y
  `+0.00458`.
- Verificado midiendo, no a ojo: tabla de landmarks en vh antes (35
  cards) vs ahora (39) — landing 390 = 390, vh por card 68.11 = 68.10,
  contador se esfuma a los 90 = 90 (89 medido en vivo), velo empieza 45
  después y dura 30 en los dos casos, UI de cards se va a los 15, cola
  final 90 = 90. Lo único que crece es el timeline: 2520 → 2792vh. En el
  navegador: `FASES` cargado con los valores nuevos, 39 anclas separadas
  68.1vh, el velo pasa de 0 en todo el corredor a 0.362 en 0.99 y 1 al
  final, y los únicos errores de consola son los cuatro 404 de las fotos.
- Quedan dos cards llamadas **"Escapada al campo"** (la 12, de octubre
  2025, y la 37): Santi dijo que por ahora no pasa nada. La sidebar y el
  buscador muestran las dos entradas.
- Rama: trabajado directo sobre `main`.

### 2026-08-10 (2) — perf: recorte de emergencia de resolución durante el desarme

- El arreglo anterior de hoy (sacar los ecos de brasas) no alcanzó: Santi
  reportó que se sigue trabando SIEMPRE que pasa por el desarme del
  corazón, tanto bajando hacia el timeline como volviendo hacia arriba.
  Ese "siempre, en los dos sentidos" es la pista clave — descarta que sea
  sólo "el gobernador de calidad no tuvo tiempo de reaccionar la primera
  vez" (esa teoría sólo explicaría la primera pasada).
- La causa real: el gobernador (`calidad.js`) mide la MEDIANA de casi 1
  segundo de cuadros a propósito, para que un tirón suelto no le baje la
  calidad a todo el sitio. Pero eso lo deja CIEGO ante un pico corto y
  repetido como el desarme: dura menos que esa ventana de medición y
  queda metido entre tramos livianos (el corazón armado antes, el
  timeline después) — la mediana nunca lo lee como "caro", así que el
  gobernador nunca aprende a bajar ahí, sin importar cuántas veces se
  cruce la zona. Es un punto ciego estructural del instrumento (mediana
  de ~1s), no un problema de que tarde en reaccionar.
- La solución no es un gobernador global más nervioso (eso haría titilar
  la calidad en cualquier tirón suelto en cualquier parte del sitio):
  es una excepción LOCAL. `corazon.desarme` ya es la bandera perfecta —
  vale 0 mientras está armado, sube 0→1 SÓLO durante la ventana en que
  se suelta, y queda en 1 el resto del sitio (timeline incluido), en
  cualquier sentido de scroll. Ahora, apenas ese valor entra en (0,1),
  main.js corta la escala de render al piso (1.0) EN EL INSTANTE, sin
  esperar ninguna medición, y la devuelve a lo que el gobernador tenía
  elegido al salir. Mientras dura el recorte, se deja de alimentar al
  gobernador (esos cuadros corren distinto a propósito y lo confundirían
  — vería margen de sobra y probaría subir la escala general con el dato
  menos representativo de todos).
- `_cooldownRecorte` (20 cuadros) evita que alguien scrolleando justo en
  el borde de la ventana dispare un cambio de resolución por cuadro —
  cada cambio reasigna los render targets del composer/bloom/nebulosa,
  así que thrashear ahí sería peor que el problema original.
- Verificado con un barrido sintético de 800 pasos (400 bajando + 400
  subiendo) usando el mecanismo real del bucle: ahorro de 12.5ms a
  5.8ms en el desarme (10.9ms de margen bajo el límite de 60fps), sólo
  5 cambios de escala en total —sin thrashing—, cero errores de JS/GL,
  sin artefactos visuales a la escala reducida.
- Trampa del preview en esta sesión: `document.hidden` quedó pegado en
  `true` de forma persistente, lo que en algún punto pausó el
  COMPOSITOR de pantalla (no sólo rAF) — un screenshot mostraba negro
  puro mientras `gl.readPixels` directo del framebuffer confirmaba
  contenido normal. Un `resize_window` lo despertó. Lección: cuando el
  screenshot no cuadra con lo que dicen las mediciones de GPU, confiar
  en el framebuffer, no en la captura.

### 2026-08-10 (1) — perf: sacar los ecos de brasas, se comían el margen del desarme

- Reportado por Santi: el sitio se trababa "en algunas partes", en concreto
  al desarmarse el corazón. Antes de tocar nada se midió cuadro a cuadro
  (apagando/prendiendo cada eco) para no adivinar: **no había ningún tirón
  puntual** ni compilación tardía de shaders (18 programas todo el tiempo,
  constante) — era costo SOSTENIDO, y el sospechoso ya estaba anotado como
  "la perilla más cara" desde la sesión del 08-07.
- `ecosBrasas: 3` significa que el corazón (11 000 puntos) se dibuja
  **cuatro veces por cuadro** durante el desarme (la nube real + 3 estelas,
  cada una el mismo costo que la nube entera). Medido con el viewport en
  su tamaño real —la primera pasada dio números absurdos porque el pane
  del preview se había achicado a 0×0 sin que el JS se enterara—: cada eco
  cuesta ~1.2 ms, y el desarme (ya el momento más pesado del recorrido)
  corría a **15.5 ms**, a un milímetro de los 16.7 ms que dan los 60 fps.
  El efecto más elaborado del sitio era también el que trababa la máquina
  justo cuando había que mirarlo.
- `ecosBrasas: 0` en escritorio (config.js): el desarme baja a **9.1 ms**
  y el pico desaparece del recorrido entero — el momento más caro pasa a
  ser el landing normal (10.3 ms), con margen de sobra en todos lados. El
  ahorro real (6.4 ms) fue MAYOR que lo que predecía sólo apagar los
  meshes (3.5 ms): con un solo material en vez de cuatro se ahorran
  también las escrituras de uniforms y el bind/validación de los otros
  tres programas — costo de CPU que no se ve apagando objetos sueltos.
- Mobile se queda con `ecosBrasas: 1` — ahí la nube tiene 3600 puntos, no
  11 000, así que un eco cuesta un tercio y todavía entra en el cuadro.
  Documentado en el comentario del config para que no se lea como
  inconsistencia la próxima vez que alguien lo mire.
- Se pierde el rastro de movimiento detrás de cada brasa (se leen más
  como puntos que se trasladan que como fuego cayendo); la silueta, el
  goteo y el vaciado de abajo hacia arriba quedan intactos. Verificado
  visualmente y midiendo píxeles: 738/765 de pico, cero quemados.
- De paso: pull con 3 cards nuevas (33, 34, 35) que Santi había agregado
  directo en `main` mientras tanto — sin conflicto, el trabajo de
  performance no tocaba `momentos.js` ni las fotos.

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
- **La capa DOM no aparece en ninguna medición de WebGL, y pesa.** Lo delató
  el propio gobernador: la escena entraba cómoda a 1.5× (13 ms medidos) y
  aun así el sitio no sostenía el refresco, porque el compositor tiene su
  propio trabajo. Dos arreglos: (1) el `backdrop-filter` de las cards ahora
  lo sueltan las que están a más de 9 unidades — el umbral estaba en 24, o
  sea que NO SE ACTIVABA NUNCA, porque la card ya desaparece del DOM a las
  11 — y el radio bajó de 12 a 10 px (el esmerilado sólo se ve en el marco
  de 14 px que rodea a la foto); (2) `--foco` y `--revelado` se escribían
  cada cuadro aunque no cambiaran, y alimentan filter/transform/opacity/
  box-shadow de varios descendientes: cada escritura recalcula estilos y
  vuelve a filtrar una foto de casi un megapíxel. Ahora sólo se escriben si
  el valor cambió (`_escribir` en `paneles.js`).
- Trampa de la que caí DOS veces en esta sesión: **una comilla invertida
  dentro de un comentario GLSL** corta el template literal y rompe el módulo
  entero, con un error de sintaxis que apunta a una palabra del shader y no
  dice nada útil. Chequeo rápido: las comillas invertidas de cada archivo de
  `js/hero/` tienen que ser PARES.
- Verificado con las 32 cards (entró Posada del Mar): cero píxeles quemados
  en los 10 puntos del recorrido, peor caso 13.3 ms a 1.5× y 10.5 ms a 1.25×.
- Queda pendiente de confirmar EN EL NAVEGADOR REAL en qué escalón se planta
  el gobernador. En el preview de este entorno (Electron, con la pestaña
  entrando y saliendo de segundo plano) se plantó en 1.25×, pero ese no es un
  veredicto limpio: cualquier medición ahí arrastra el sobrecosto del propio
  Electron. Para verlo: `window.hero.gobernador.escala` en la consola después
  de unos segundos de scrollear.
- Rama mergeada: `claude/macbook-13-optimization-ba32e6` → `main`.

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
