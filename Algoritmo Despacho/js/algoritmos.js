/* Algoritmos de planificación. Cada uno devuelve:
   { gantt: [{id, start, end}], empates: [...] }
   gantt.id = null significa CPU ociosa.
   Proceso: {id, a: llegada, b: ráfaga, p: prioridad} */

function agregar(g, id, s, e) {
  const l = g[g.length - 1];
  if (l && l.id === id && l.end === s) l.end = e;
  else g.push({ id, start: s, end: e });
}

/**
 * Planificador no expulsivo genérico.
 * clave(p)            -> valor por el que se elige al "mejor" proceso listo (menor es mejor).
 * nombreCriterio      -> texto del criterio principal, para explicarlo en la interfaz.
 * desempatePorLlegada -> si hay empate en `clave`, ¿se rompe por orden de llegada (FIFO)?
 *                        (en FIFO mismo, el empate se rompe por el orden en que se definieron).
 */
function noExpulsivo(lista, clave, nombreCriterio, desempatePorLlegada) {
  const idx = id => lista.findIndex(o => o.id === id);
  let rest = lista.map(p => ({ ...p })), t = 0;
  const g = [], empates = [];

  while (rest.length) {
    const listos = rest.filter(p => p.a <= t);
    if (!listos.length) {
      const n = Math.min(...rest.map(p => p.a));
      agregar(g, null, t, n); t = n; continue;
    }
    const minVal = Math.min(...listos.map(clave));
    const empatados = listos.filter(p => clave(p) === minVal);

    if (empatados.length > 1) {
      empatados.sort((x, y) => desempatePorLlegada ? (x.a - y.a || idx(x.id) - idx(y.id)) : idx(x.id) - idx(y.id));
      empates.push({
        t, criterio: nombreCriterio, valor: minVal,
        candidatos: empatados.map(p => ({ id: p.id, a: p.a })),
        elegido: empatados[0].id,
        porOrdenLlegada: desempatePorLlegada
      });
    } else {
      empatados.sort((x, y) => desempatePorLlegada ? (x.a - y.a) : 0);
    }

    const p = empatados[0];
    agregar(g, p.id, t, t + p.b); t += p.b;
    rest = rest.filter(x => x !== p);
  }
  return { gantt: g, empates };
}

const fifo = l => noExpulsivo(l, p => p.a, 'orden de llegada', false);
const sjf = l => noExpulsivo(l, p => p.b, 'ráfaga más corta', true);
const prioridad = l => noExpulsivo(l, p => p.p, 'mayor prioridad (número menor)', true);

function roundRobin(lista, q) {
  const idx = id => lista.findIndex(o => o.id === id);
  const ps = lista.map(p => ({ ...p, r: p.b })).sort((x, y) => x.a - y.a || idx(x.id) - idx(y.id));
  const g = [], cola = [], empates = [];
  let t = 0, i = 0;

  // Empate real de RR: procesos que llegan exactamente al mismo tiempo entran
  // a la cola en el orden en que fueron definidos (misma idea de FIFO).
  const porLlegada = {};
  lista.forEach(p => (porLlegada[p.a] ||= []).push(p.id));
  Object.entries(porLlegada).forEach(([a, ids]) => {
    if (ids.length > 1) {
      empates.push({
        t: +a, criterio: 'llegada simultánea', valor: +a,
        candidatos: ids.map(id => ({ id, a: +a })),
        elegido: [...ids].sort((x, y) => idx(x) - idx(y))[0],
        porOrdenLlegada: false
      });
    }
  });

  const encolar = () => { while (i < ps.length && ps[i].a <= t) cola.push(ps[i++]); };
  encolar();
  while (cola.length || i < ps.length) {
    if (!cola.length) { agregar(g, null, t, ps[i].a); t = ps[i].a; encolar(); continue; }
    const p = cola.shift(), d = Math.min(q, p.r);
    agregar(g, p.id, t, t + d); t += d; p.r -= d;
    encolar();               // primero los que llegaron durante el turno
    if (p.r > 0) cola.push(p); // luego el proceso interrumpido
  }
  return { gantt: g, empates };
}

/* TS = fin - llegada      TE = TS - ráfaga */
function metricas(g, lista) {
  const filas = lista.map(p => {
    const fin = Math.max(...g.filter(s => s.id === p.id).map(s => s.end));
    return { id: p.id, a: p.a, b: p.b, fin, TS: fin - p.a, TE: fin - p.a - p.b };
  });
  const prom = k => filas.reduce((s, x) => s + x[k], 0) / filas.length;
  return { filas, TE: prom('TE'), TS: prom('TS') };
}
