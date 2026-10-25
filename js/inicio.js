/* Arranque separado del grafo 3D: un error de sintaxis, de red o de WebGL
   no puede dejar el velo de carga tapando la página para siempre. */
const aviso = document.getElementById('error-inicio');
document.getElementById('reintentar-inicio').addEventListener('click', () => location.reload());

try {
  await import('./hero/main.js');
} catch (error) {
  console.error('No se pudo iniciar el recorrido:', error);
  document.body.classList.remove('cursor-cereza-activo');
  document.getElementById('velo-carga').classList.add('listo');
  aviso.hidden = false;
}
