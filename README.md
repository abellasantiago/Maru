# Santi & Maru — Nuestro recorrido

Sitio de regalo de una sola página. Es un viaje inmersivo en 3D (inspirado en
la sensación de activetheory.net) que cuenta nuestra historia en tres fases,
todas ligadas al scroll. La dirección visual es **"viaje hacia el amanecer"**:
todo el mundo — nebulosa cálida, velos de seda, bokeh — apunta a un
resplandor dorado al final del corredor, que empalma con la pantalla final crema.

1. **Landing** — el sitio abre directo, sin preludio ni pantalla de carga: la
   lluvia que arma el corazón ya está cayendo desde el primer cuadro. Un
   corazón de **point cloud rojo** (miles de partículas llenando un volumen
   3D real, que repelen al cursor) flota en una nebulosa bordó. Al scrollear
   **gira una vuelta completa** mientras el mundo pasa de largo (una frase
   suspendida en el espacio, velos), **se planta de frente** y ahí **se
   desarma en brasas**: se vacía de abajo hacia arriba, el contorno ♥ queda
   dibujado en el aire hasta el final, y las brasas caen y se van hacia el
   corredor. Eso da paso al timeline — que NO se ve de arranque: cada card
   despierta recién cuando la cámara se le acerca lo suficiente, primero
   tenue y borrosa, después nítida.
2. **Timeline** — la cámara vuela por las **cards** (una por momento), con
   banking en las curvas, y cada una entra en foco a su turno. Se navega con el
   scroll, con la sidebar, con las flechas, con el buscador o con el teclado
   (← → pasan de momento; Inicio y Fin van a las puntas). Las flechas
   verticales quedan libres a propósito: son la forma de scrollear con el
   teclado, y acá el scroll ES el viaje.
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
| **La canción** (archivo) | `RUTA_CANCION` en `js/hero/ui.js` |
| **Cuándo arranca la canción** (primer click en cualquier parte del sitio) | `_configurarMusica()` en `js/hero/ui.js` |
| Duración de cada fase del scroll | `FASES` en `js/hero/config.js` |
| Calidad de imagen / resolución de render | `CALIDAD` en `config.js` + `js/hero/calidad.js` |
| Cuándo se desarma el corazón | `DESARME` en `js/hero/config.js` |
| Largo total del scroll | `--alto-recorrido` en `css/estilos.css` |
| Cuántas vueltas gira el corazón en el landing | `CONFIG.vueltasCorazon` en `config.js` |
| Ruta de la cámara (curvas, encuadres y banking) | `js/hero/camara.js` |
| Paleta de colores (única fuente de verdad) | variables CSS en `css/estilos.css` |
| Frases que flotan durante el descenso | `FRASES` en `js/hero/paneles.js` |
| Texto de la pantalla final | sección `#final` en `index.html` |

## Sin preludio: el sitio abre directo

No hay pantalla de carga ni gesto que abrir: `main.js` llama
`corazon.comenzarEntrada()` apenas se crea el corazón, así que la lluvia que
lo arma ya está cayendo desde el primer cuadro que dibuja el mundo.

Lo único que sí depende de un gesto es la **canción**, porque eso no lo
decide el sitio: ningún navegador deja sonar audio sin una interacción real
del visitante. `js/hero/ui.js` la resuelve con un listener de `click` en
`window` que se arma en cuanto arranca la página: el primer click en
cualquier parte del sitio la dispara, con un fundido largo (3600 ms, para que
crezca junto con lo que sea que esté pasando en pantalla en ese momento, no
entrar de golpe) — y a partir de ahí se pausa/reanuda con la cápsula
Santi ♥ Maru (`alternarCancion`), con un fundido corto (1600 ms). El mp3 se
precarga desde el arranque, así el primer compás nunca llega tarde.

Un detalle no obvio: si ese primer click cae justo en la cápsula, el
listener global lo IGNORA a propósito (`this.pill.contains(e.target)`) y
sigue armado. La cápsula ya tiene su propio handler de click que hace sonar
la canción por su cuenta — sin esa guarda, los dos handlers se pisarían: el
global la pondría a sonar y, en el mismo gesto, el de la cápsula la leería
como "ya está sonando" y la pausaría de vuelta.

### La ambientación 3D (capas de profundidad)

Cada capa es un módulo independiente con el mismo contrato
(`actualizar(...)` por frame, `destruir()`); las cantidades viven en
`CONFIG` y los colores salen SIEMPRE de la paleta CSS:

| Capa (de lo infinito a lo cercano) | Módulo |
|---|---|
| Nebulosa envolvente (a lienzo propio, ver abajo) + estrellas + **el amanecer** destino | `js/hero/atmosfera.js` |
| Velos de seda / auroras cálidas (la gran estructura de escala) | `js/hero/velos.js` |
| Bokeh de ensueño + luciérnagas doradas | `js/hero/ambiente.js` |
| Corazón point cloud rojo (repele al cursor, se desarma en brasas) | `js/hero/corazon.js` |

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
cursor y, con el scroll, cada una se suelta como brasa hacia su destino
(`aDispersa`). Ese destino queda abierto a propósito: para que el desarme
forme OTRA COSA más adelante, alcanza con cambiar los `aDispersa` por las
posiciones de la nueva figura. Contrato público (no cambiar al reemplazar
la pieza):

```js
new Corazon(escena)
corazon.comenzarEntrada()      // suelta la lluvia (la llama main.js apenas arranca)
corazon.setGiro(radianes)      // giro sobre su eje (lo maneja el scroll del landing)
corazon.setDesarme(0..1)       // 0 armado → 1 brasas ya apagadas
corazon.setPosicion(v)         // re-anclaje al punto de mirada (landing)
corazon.actualizar(dt, tiempo, mouseNDC, camara, dpr)
corazon.destruir()
```

### El desarme: el río de brasas

El corazón no explota ni se dispersa al azar: **gotea**. Cuatro decisiones
sostienen el efecto, y conviene entenderlas antes de tocar los números:

1. **Se planta antes de soltarse.** El giro completo entra durante el primer
   45% del landing (`DESARME.desde`) con arranque y frenada suaves, y termina
   **de frente**. Por eso `CONFIG.vueltasCorazon` tiene que ser un **entero**:
   si quedara de perfil, el corazón se desarmaría de canto —una columna— y se
   perdería la silueta justo en el momento en que más importa verla.
2. **Se vacía de abajo hacia arriba, y el contorno es lo último.** Cada
   partícula tiene su turno (`aSoltar`), con la banda del contorno esperando
   más que el relleno: queda un instante en que el ♥ está **dibujado en el
   aire, hueco por dentro**. Ese instante es el efecto.
3. **Cae primero, la corriente se la lleva después.** Dos curvas distintas: la
   caída arranca casi lineal (se ve gotear) y el arrastre hacia el corredor
   acelera con `b²`, encogiéndose hacia el amanecer. La caída es corta a
   propósito — el cuadro mide ~10 unidades de alto a esa distancia, y una
   brasa que cae 18 se va por abajo antes de que el barrido la lleve al fondo.
4. **Las brasas son MÁS TENUES que el corazón entero.** La luz que estaba
   concentrada en una figura se reparte por el aire. Es la regla más
   importante de todas: con blending aditivo, las brasas ya sueltas se
   superponen con el cuerpo que todavía no salió, y con el mismo alfa el
   cuadro quema a blanco. Por eso además hay `PARTICULAS_CALIBRADAS`, que
   normaliza ese alfa por la cantidad real de puntos — así el desarme se ve
   igual en un teléfono (3600) que en una pantalla grande (6500).

Las **estelas** (`CONFIG.ecosBrasas`) son la misma geometría dibujada 1–2
veces más con el desarme atrasado un pelín: cada eco muestra dónde estaba la
brasa un instante antes. Es lo que hace que se lean como fuego y no como
puntos que se trasladan, y como la trayectoria acelera, la estela se alarga
sola cuanto más rápido va — igual que el fuego real. Comparten el buffer de
geometría: son dibujados extra, no memoria extra.

Ojo con dos cosas al tocar esto: el destino de cada brasa está escrito en
**ejes del mundo** y el shader lo contra-rota por el giro del corazón (así
cae siempre hacia el mismo lado, gire como gire); y todo el hero es aditivo,
así que **el oro sube los tres canales** y satura a blanco mucho antes que el
rojo — de ahí que la mezcla a dorado sea tan baja y se enfríe tan rápido.

## Vida y profundidad (capas de inmersión)

Tres toques que le dan cuerpo al hero, suaves y sin estorbar al centro:

| Efecto | Dónde | Perilla |
|---|---|---|
| **Enfoque cinematográfico** (foco corto: centro nítido, bordes blandos) | `js/hero/postproceso.js` | `CONFIG.enfoque`, `radioNitido` |
| **Tilt 3D + brillo especular** de las cards al pasar el cursor | `js/hero/paneles.js` + CSS `.panel-tilt`/`.panel-brillo` | ángulo en el `pointermove` |
| **Cámara viva** (deriva orgánica mínima, "cámara en mano") | `js/hero/camara.js` | `CONFIG.derivaCamara` |

Todos respetan `prefers-reduced-motion` (deriva y tilt se apagan) y el táctil
(sin tilt/brillo, que necesitan hover).

## La calidad de imagen se mide, no se elige

En una pantalla retina hay **cuatro veces más píxeles** que en la misma
pantalla a 1×, y este hero es todo relleno: una nebulosa a pantalla completa,
miles de puntos aditivos superpuestos y un bloom de radio ancho. Dibujar eso a
resolución nativa en una laptop cuesta mucho, y no hay constante que sirva —
la misma pantalla de 13" puede ser una Intel de 2019 o una M4.

Por eso la resolución no está escrita en ningún lado: se **mide en marcha**
(`js/hero/calidad.js`). El gobernador junta el tiempo de cada cuadro en
ventanas de un segundo, se queda con la mediana —un tirón suelto no puede
bajarle la calidad a todo el sitio— y mueve la escala de render entre 1× y 2×
en escalones de 0.25. Si mantiene el refresco dos ventanas seguidas, PRUEBA
subir un escalón; si esa prueba sale mal, vuelve y anota ese techo para no
intentarlo nunca más (un cambio de resolución se ve, y una máquina justo en el
límite oscilando para siempre es peor que quedarse abajo).

Se prueba en vez de deducir por una razón concreta: con vsync, el tiempo entre
cuadros está **cuantizado**. A 60 Hz, un cuadro que tarda 14 ms y uno que tarda
16.6 se miden los dos como 16.7; el que tarda 16.8 pierde el pase y se mide
como 33. No existe el "17.5", así que no hay forma de leer cuánto margen sobra.

En una máquina holgada el resultado es indistinguible de fijar todo al máximo;
en una justa, el sitio se ve todo lo nítido que puede sin perder fluidez.

### Dónde se fue el tiempo de cuadro (medido, no estimado)

Todo lo de abajo salió de medir en una MacBook Pro 13" (Intel Iris Plus 645,
1440×900 @2×), que es el peor caso realista. Vale la pena tenerlo a mano antes
de agregar cualquier efecto nuevo:

| Qué | Costo | Qué se hizo |
|---|---|---|
| MSAA ×4 en el render target | **17 ms** | Se sacó. Era de las viejas enredaderas de tubos; hoy no hay un solo borde de geometría que suavizar (puntos con caída de alfa, planos con bordes desvanecidos, cards en DOM). |
| Nebulosa (FBM a pantalla completa) | **13 ms** | Se dibuja a un lienzo aparte al 32% y se estira. Son nubes suavísimas: no hay diferencia visible, y con el aire que sobró pasó de 3 octavas a 4 con deformación de dominio. |
| Velos de seda | **4.5 ms** | El ruido de los pliegues se mudó del fragment al vertex shader. Son planos enormes y superpuestos: era un ruido simplex por píxel. |
| Bloom a resolución completa | ~4 ms | Va al 45% (`bloomEscala`). Es desenfoque puro. |
| Disco de bokeh | ~0.11 ms por muestra | 14 muestras en espiral de ángulo áureo, con la espiral girada distinto en cada píxel. |

Resultado en esa máquina: el landing pasó de **31 ms por cuadro dibujando el
post a media resolución** (1440×900 estirado a 2880×1800) a **14 ms dibujando a
2160×1350** — más del doble de píxeles reales y el doble de cuadros por segundo.

> Trampa que había: el composer se construía con el tamaño en píxeles CSS en
> vez del tamaño del buffer real, así que en retina TODO el post-proceso corría
> a la mitad de resolución… hasta que alguien redimensionaba la ventana, y ahí
> se ponía nítido de golpe y perdía la mitad de los cuadros. Hoy la resolución
> se fija siempre explícitamente desde `_aplicarTamanio()` en `main.js`, que es
> el único lugar que la escribe.

## La lente y el revelado

El pase final (`js/hero/postproceso.js`) es una lente y un laboratorio de
revelado, en ese orden:

- **Radio de lente corregido por aspecto.** La distancia al centro se mide en
  la geometría real de la pantalla y se normaliza para que la esquina valga 1
  en cualquier proporción. Sin eso, en 16:10 el desenfoque y la viñeta pegaban
  igual de fuerte arriba que en los costados —que están mucho más lejos del eje
  óptico— y se leía como un degradé puesto encima, no como una lente.
- **Bokeh en espiral de ángulo áureo**, con las luces pesando más que el fondo:
  una chispa fuera de foco se abre como un círculo de luz en vez de diluirse.
- **Arrastre de velocidad**: al scrollear rápido el cuadro se estira
  radialmente hacia afuera, como una toma acelerando por un túnel. Reusa el
  mismo disco de muestras, así que no cuesta un pase aparte.
- **Halación**: los niveles anchos del bloom se tiñen hacia el oro y el rojo de
  la paleta (el sangrado rojizo de la película alrededor de una luz fuerte).
  De paso resuelve un problema viejo: el glow blanco sube los tres canales y
  satura; teñido, el halo se queda dentro de la paleta.
- **Revelado**: curva S suave (planta los negros, hace rodar las altas luces),
  sombras que viran al bordó y altas luces entibiadas.
- **Grano de película** pegado a los medios tonos, como el haluro real: casi
  nada en el negro (si no, la nebulosa hierve) y casi nada en la luz quemada.
  Se mide contra los píxeles CSS y no contra los reales, así conserva su tamaño
  físico aunque cambie la escala de render.
- **Tramado** de un nivel, lo último antes de escribir el píxel. Todo el sitio
  es un degradé bordó oscurísimo y la salida es de 8 bits: sin esto se ven las
  bandas, y en una pantalla buena se ven mucho.

## Performance y accesibilidad

- **Un solo WebGLRenderer** para todo. Los paneles son DOM (CSS3D) pero sólo
  se pintan los cercanos y ya revelados (`objeto.visible = false` mientras
  --revelado es 0: ni siquiera se agregan al DOM); los del medio sueltan el
  `backdrop-filter` (el blur es lo más caro).
- La ambientación es barata a propósito: pocas luces grandes (200 bokeh) en
  vez de miles de puntos, velos como planos desplazados en GPU y un domo que
  sigue a la cámara y se dibuja a un tercio de resolución.
- Las partículas del corazón sí son muchas (11 000 en escritorio) porque son
  la imagen del sitio, pero el alfa **se normaliza por la cantidad**
  (`uDensidad` / `uDensidadReposo` en `corazon.js`): con blending aditivo, el
  doble de puntos con el mismo alfa es el doble de luz sumada y el cuadro
  quema a blanco. Con la corrección, subir la cifra densifica la nube —afina
  la silueta, llena el volumen— sin encenderla de más. Medido en todo el
  recorrido: **cero píxeles quemados**, pico 750 de 765.
- El hero se **pausa** al entrar a la pantalla final; el **cursor sigue vivo**
  (se actualiza siempre, aún con el hero pausado).
- `prefers-reduced-motion`: menos elementos, ondulación mínima, sin parallax
  ni mecidos. El desarme del corazón pierde las estelas y el remolino.
- Mobile: menos elementos, nebulosa con menos octavas de ruido, cámara con FOV
  más amplio, cursor nativo.
