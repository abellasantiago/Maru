import test from 'node:test';
import assert from 'node:assert/strict';
import { MOMENTOS } from '../js/hero/momentos.js';
import { buscarMomentos } from '../js/hero/busqueda.js';

test('los títulos repetidos conservan todas las coincidencias y sus fechas', () => {
  const resultados = buscarMomentos(MOMENTOS, 'Escapada al campo');
  assert.deepEqual(resultados.map(({ indice }) => indice), [11, 36]);
  assert.notEqual(resultados[0].momento.fecha, resultados[1].momento.fecha);
});

test('se puede desambiguar por año y buscar sin tildes ni espacios del nombre', () => {
  assert.deepEqual(buscarMomentos(MOMENTOS, 'escapada 2026').map(({ indice }) => indice), [36]);
  assert.deepEqual(buscarMomentos(MOMENTOS, 'cafe misterio').map(({ indice }) => indice), [23]);
  assert.ok(buscarMomentos(MOMENTOS, 'keymood').some(({ indice }) => indice === 19));
});

test('las fechas iniciales ordenan el índice y sitúan los rangos en su primer mes', () => {
  assert.equal(MOMENTOS.length, 45);
  assert.deepEqual(MOMENTOS[36].fechaInicio, { dia: 27, mes: 7, anio: 2026 });
  assert.deepEqual(MOMENTOS[37].fechaInicio, { dia: 31, mes: 7, anio: 2026 });
  for (let i = 1; i < MOMENTOS.length; i++) {
    const clave = ({ anio, mes, dia }) => anio * 10000 + (mes + 1) * 100 + dia;
    assert.ok(clave(MOMENTOS[i].fechaInicio) >= clave(MOMENTOS[i - 1].fechaInicio));
  }
});
