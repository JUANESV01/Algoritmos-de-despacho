const $ = id => document.getElementById(id);
const PALETA = ['#0b7285', '#d9480f', '#b8860b', '#364fc7', '#2b8a3e', '#a61e4d', '#5c7080', '#7048e8'];
const COLOR = i => PALETA[i % PALETA.length];
const EJEMPLO = [[0, 5, 2], [1, 3, 1], [2, 1, 3], [3, 2, 4], [4, 4, 2]];
const fmt = n => (Math.round(n * 100) / 100).toString().replace('.', ',');
let procs = [], charts = [], seleccion = 'todos', simulado = false;

/* ---------- Procesos ---------- */
function cargar(d) {
  procs = d.map((x, i) => ({ id: 'P' + (i + 1), a: x[0], b: x[1], p: x[2] }));
  dibujar();
}
function dibujar() {
  $('tb').innerHTML = procs.map((p, i) => `<tr>
    <td><span class="sw" style="background:${COLOR(i)}"></span><b>${p.id}</b></td>
    <td><input type="number" min="0" value="${p.a}" data-i="${i}" data-k="a"></td>
    <td><input type="number" min="1" value="${p.b}" data-i="${i}" data-k="b"></td>
    <td><input type="number" min="0" value="${p.p}" data-i="${i}" data-k="p"></td>
    <td><button class="ib" data-del="${i}" aria-label="Quitar ${p.id}" title="Quitar ${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></td></tr>`).join('');
}
$('tb').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.k) procs[t.dataset.i][t.dataset.k] = Math.max(t.dataset.k === 'b' ? 1 : 0, +t.value || 0);
});
$('tb').addEventListener('click', e => {
  const btn = e.target.closest('[data-del]');
  if (btn && procs.length > 1) {
    procs.splice(+btn.dataset.del, 1);
    procs.forEach((p, i) => p.id = 'P' + (i + 1));
    dibujar();
  }
});
$('add').onclick = () => { procs.push({ id: 'P' + (procs.length + 1), a: 0, b: 1, p: 1 }); dibujar(); };
$('ej1').onclick = () => cargar(EJEMPLO);
$('theme').onclick = () => {
  const r = document.documentElement;
  const oscuro = r.dataset.theme === 'dark' || (!r.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches);
  r.dataset.theme = oscuro ? 'light' : 'dark';
  if (simulado) simular(false);
};

/* ---------- Selector de algoritmo ---------- */
function ajustarQuantum() {
  $('qwrap').style.display = (seleccion === 'rr' || seleccion === 'todos') ? '' : 'none';
}
$('tabs').addEventListener('click', e => {
  const k = e.target.dataset.k;
  if (!k) return;
  seleccion = k;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  ajustarQuantum();
  if (simulado) simular(false);
});

/* ---------- Render ---------- */
function ganttHTML(g) {
  const fin = g[g.length - 1].end;
  const paso = fin <= 30 ? 1 : fin <= 60 ? 2 : 5;
  const filas = procs.map((p, i) => {
    const barras = g.filter(s => s.id === p.id).map(s =>
      `<i class="bar" style="left:${s.start / fin * 100}%;width:${(s.end - s.start) / fin * 100}%;background:${COLOR(i)}" title="${p.id}: ${s.start} a ${s.end}"></i>`).join('');
    return `<div class="grow"><span class="gl">${p.id}</span><div class="gt">${barras}</div></div>`;
  }).join('');
  let marcas = '';
  for (let t = 0; t <= fin; t += paso) marcas += `<span style="left:${t / fin * 100}%">${t}</span>`;
  return `<div class="scroll"><div class="gwrap" style="--n:${fin / paso};min-width:${Math.max(440, fin * 22 + 70)}px">${filas}
    <div class="grow axis"><span class="gl"></span><div class="gt ax">${marcas}</div></div></div></div>`;
}

function tablaHTML(m) {
  return `<div class="scroll" style="margin-top:18px"><table>
    <thead><tr><th>Proceso</th><th>Llegada</th><th>Ráfaga</th><th>Fin</th><th>TS</th><th>TE</th></tr></thead><tbody>
    ${m.filas.map(f => `<tr><td><b>${f.id}</b></td><td>${f.a}</td><td>${f.b}</td><td>${f.fin}</td><td>${f.TS}</td><td>${f.TE}</td></tr>`).join('')}
    <tr class="prom"><td colspan="4">PROMEDIO</td><td>${fmt(m.TS)}</td><td>${fmt(m.TE)}</td></tr></tbody></table></div>
    <div class="avg"><div class="stat te"><small>TE promedio</small><b>${fmt(m.TE)}</b></div><div class="stat ts"><small>TS promedio</small><b>${fmt(m.TS)}</b></div></div>`;
}

/* Explica, con los datos reales de la simulación, los empates que hubo
   y cómo se resolvieron usando el orden de llegada (criterio FIFO). */
function empatesHTML(empates, algoNombre) {
  if (!empates.length) {
    return `<div class="tie ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      <span>Con estos datos, ${algoNombre} no tuvo ningún empate que resolver.</span></div>`;
  }
  const items = empates.map(e => {
    const lista = e.candidatos.map(c => `${c.id} (llegó en t=${c.a})`).join(' y ');
    const criterio = e.porOrdenLlegada
      ? `empatados en ${e.criterio} (valor ${e.valor})`
      : `empatados en ${e.criterio}`;
    const razon = e.porOrdenLlegada
      ? `se eligió <b>${e.elegido}</b> por haber llegado primero`
      : `se eligió <b>${e.elegido}</b> por aparecer primero en la lista de procesos`;
    return `<li><b>t=${e.t}:</b> ${lista} quedaron ${criterio}; el empate se resolvió con el criterio <b>FIFO</b> (orden de llegada), y ${razon}.</li>`;
  }).join('');
  return `<div class="tie"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
    <div><b>Empates detectados y resueltos con FIFO</b><ul>${items}</ul></div></div>`;
}

function grafica(canvasId, etiquetas, datasets) {
  const cs = getComputedStyle(document.documentElement);
  const tx = cs.getPropertyValue('--mu').trim(), grid = cs.getPropertyValue('--bd').trim();
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  charts.push(new Chart($(canvasId), {
    type: 'bar',
    data: { labels: etiquetas, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      elements: { bar: { borderRadius: 8, borderSkipped: false } },
      plugins: { legend: { labels: { color: tx, boxWidth: 12, boxHeight: 12 } } },
      scales: {
        x: { ticks: { color: tx }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: tx }, grid: { color: grid } }
      }
    }
  }));
}

function simular(scroll = true) {
  charts.forEach(c => c.destroy()); charts = [];
  const q = Math.max(1, +$('q').value || 1);
  const todos = [
    { k: 'fifo', n: 'FIFO', c: '#0b7285', d: 'Atiende por orden de llegada, sin interrupciones. Es también el criterio que usan los demás algoritmos para romper empates.', f: () => fifo(procs) },
    { k: 'sjf', n: 'SJF', c: '#d9480f', d: 'Elige la ráfaga más corta entre los procesos ya llegados (no expulsivo). Si hay empate, se aplica FIFO.', f: () => sjf(procs) },
    { k: 'prioridad', n: 'Prioridad', c: '#b8860b', d: 'Elige la prioridad más alta, es decir el número menor (no expulsivo). Si hay empate, se aplica FIFO.', f: () => prioridad(procs) },
    { k: 'rr', n: `Round Robin (q=${q})`, c: '#364fc7', d: 'Turnos rotativos de duración q; expulsa al agotarse el quantum. Si dos procesos llegan al mismo tiempo, entran a la cola en orden de definición (FIFO).', f: () => roundRobin(procs, q) }
  ];
  const activos = (seleccion === 'todos' ? todos : todos.filter(a => a.k === seleccion))
    .map(a => { const r = a.f(); return { ...a, g: r.gantt, empates: r.empates, m: metricas(r.gantt, procs) }; });

  let h = activos.map(r => `<section class="card"><h2><span class="n">${r.n}</span></h2>
    <p class="sub">${r.d}</p>${ganttHTML(r.g)}${tablaHTML(r.m)}
    ${empatesHTML(r.empates, r.n)}
    ${activos.length === 1 ? `<div class="charts"><div><h3>TE y TS por proceso</h3><div class="cbox"><canvas id="cu"></canvas></div></div></div>` : ''}
    </section>`).join('');

  if (activos.length > 1) {
    const mejor = k => Math.min(...activos.map(r => r.m[k]));
    const cl = (r, k) => r.m[k] === mejor(k) ? 'best' : '';
    const gan = k => activos.filter(r => r.m[k] === mejor(k)).map(r => r.n).join(', ');
    h += `<section class="card"><h2><span class="n">Comparación</span></h2>
      <div class="scroll"><table><thead><tr><th>Algoritmo</th><th>TE promedio</th><th>TS promedio</th></tr></thead><tbody>
      ${activos.map(r => `<tr><td><span class="sw" style="background:${r.c}"></span><b>${r.n}</b></td><td class="${cl(r, 'TE')}">${fmt(r.m.TE)}</td><td class="${cl(r, 'TS')}">${fmt(r.m.TS)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="charts">
        <div><h3>TE y TS promedio por algoritmo</h3><div class="cbox"><canvas id="c1"></canvas></div></div>
        <div><h3>TE por proceso</h3><div class="cbox"><canvas id="c2"></canvas></div></div>
        <div><h3>TS por proceso</h3><div class="cbox"><canvas id="c3"></canvas></div></div>
      </div>
      <div class="concl"><b>Conclusión:</b> el menor TE promedio (${fmt(mejor('TE'))}) lo obtiene <b>${gan('TE')}</b> y el menor TS promedio (${fmt(mejor('TS'))}) lo obtiene <b>${gan('TS')}</b>. SJF suele minimizar la espera pero puede causar inanición; FIFO puede generar el efecto convoy si un proceso largo llega primero; Prioridad puede dejar sin CPU a los procesos de baja prioridad; y Round Robin reparte mejor la CPU, aunque depende del quantum. Nota que FIFO no solo es un algoritmo en sí, también es el criterio de desempate por defecto en SJF y Prioridad. Los valores en verde azulado son los mejores.</div></section>`;
  }
  $('out').innerHTML = h;

  const TE = '#0b7285', TS = '#d9480f', ids = procs.map(p => p.id);
  if (activos.length === 1) {
    const m = activos[0].m;
    grafica('cu', ids, [
      { label: 'TE (espera)', data: m.filas.map(f => f.TE), backgroundColor: TE },
      { label: 'TS (en el sistema)', data: m.filas.map(f => f.TS), backgroundColor: TS }]);
  } else {
    grafica('c1', activos.map(r => r.n), [
      { label: 'TE promedio', data: activos.map(r => +r.m.TE.toFixed(2)), backgroundColor: TE },
      { label: 'TS promedio', data: activos.map(r => +r.m.TS.toFixed(2)), backgroundColor: TS }]);
    const por = k => activos.map(r => ({ label: r.n, data: r.m.filas.map(f => f[k]), backgroundColor: r.c }));
    grafica('c2', ids, por('TE'));
    grafica('c3', ids, por('TS'));
  }
  simulado = true;
  if (scroll) $('out').scrollIntoView({ behavior: 'smooth' });
}
$('run').onclick = () => simular();
cargar(EJEMPLO);
ajustarQuantum();
