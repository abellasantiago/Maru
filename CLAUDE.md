# CLAUDE.md — Contexto del proyecto

## Descripción

Sitio-regalo de Santi para Maru: un recorrido inmersivo en 3D por los momentos
de la relación. El scroll no mueve contenido en 2D — mueve una cámara por un
mundo. Tres actos: una **obertura** (11:11 en la oscuridad, que se cae con el
primer click), un **landing** con un corazón de partículas que se arma, gira y
se desarma en brasas, un **timeline** de 30 cards de vidrio flotando en un
corredor, y una **pantalla final** ("Que sea eterno.").

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
