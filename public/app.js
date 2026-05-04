// PLC Ágora — cliente SPA con modelo LiquidFeedback
import { CARTA } from './carta-data.js';

// Cuando se sirve desde GitHub Pages el sitio vive bajo /<repo>/ y la API
// corre en otro dominio (Render). Localmente todo es relativo a /.
const ON_GH_PAGES = location.hostname.endsWith('.github.io');
const BASE_PATH = ON_GH_PAGES ? '/LiquidFeedback-PLC' : '';
const API_BASE  = ON_GH_PAGES ? 'https://liquidfeedback-plc.onrender.com' : '';
const stripBase = (p) => (BASE_PATH && p.startsWith(BASE_PATH) ? p.slice(BASE_PATH.length) || '/' : p);

const state = { data: null, currentAffiliate: null, ballotDraft: {} };
const $ = (sel, root = document) => root.querySelector(sel);

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v === false || v == null) continue;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

const fmt = {
  date(iso) { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); },
  dateTime(iso) { return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); },
  relTime(iso) {
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return 'hace segundos';
    if (d < 3600) return `hace ${Math.floor(d / 60)} min`;
    if (d < 86400) return `hace ${Math.floor(d / 3600)} h`;
    if (d < 86400 * 30) return `hace ${Math.floor(d / 86400)} días`;
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  },
  timeLeft(ms) {
    if (ms <= 0) return 'venció';
    const d = Math.floor(ms / 86400000);
    const hrs = Math.floor((ms % 86400000) / 3600000);
    if (d > 0) return `${d}d ${hrs}h`;
    const m = Math.floor((ms % 3600000) / 60000);
    return `${hrs}h ${m}m`;
  },
  pct(n) { return Math.round(n * 100) + '%'; },
  romanDay(d = new Date()) {
    const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    return `${String(d.getDate()).padStart(2,'0')} · ${months[d.getMonth()]} · ${d.getFullYear()}`;
  },
};

const PHASE_LABEL = { admission: 'Admisión', discussion: 'Discusión', verification: 'Verificación', voting: 'Votación', finished: 'Cerrada' };
const DIRECTIVE_LABEL = { must: 'debe', should: 'debería', must_not: 'no debe', should_not: 'no debería' };

// ========== API ==========
async function api(path, opts = {}) {
  const r = await fetch(API_BASE + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || 'Error'); }
  return r.json();
}

async function loadState() {
  state.data = await api('/api/state');
  if (!state.currentAffiliate) state.currentAffiliate = state.data.meta.currentAffiliate;
}

// ========== TOAST ==========
let toastTimer;
function toast(msg, kind = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (kind === 'blood' ? ' blood' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ========== FINDERS ==========
const findAff    = (id) => state.data.affiliates.find(a => a.id === id);
const findCel    = (id) => state.data.celulas.find(c => c.id === id);
const findCelBySlug = (slug) => state.data.celulas.find(c => c.slug === slug);
const findIssue  = (id) => state.data.issues.find(i => i.id === id);
const findInit   = (id) => state.data.initiatives.find(i => i.id === id) || state.data.issues.flatMap(is => is.initiatives || []).find(i => i.id === id);
const findPolicy = (id) => state.data.policies.find(p => p.id === id);

function initiativesOfIssue(issueId) {
  const issue = findIssue(issueId);
  return issue?.initiatives || [];
}

function suggestionsOfInit(initiativeId) {
  return state.data.suggestions.filter(s => s.initiativeId === initiativeId);
}

function isSupporting(affId, initId) {
  return !!state.data.supports.find(s => s.affiliateId === affId && s.initiativeId === initId);
}

function delegationResolves(affId, issue) {
  // Para UI: explicar la delegación aplicable al afiliado actual en esta issue
  const d = state.data.delegations;
  const byIssue  = d.find(x => x.from === affId && x.scope === 'issue'  && x.targetId === issue.id);
  const byCelula = d.find(x => x.from === affId && x.scope === 'celula' && x.targetId === issue.celulaId);
  const byGlobal = d.find(x => x.from === affId && x.scope === 'global');
  return byIssue || byCelula || byGlobal;
}

// ========== MASTHEAD ==========
function renderMasthead() {
  $('#masthead-date').textContent = fmt.romanDay();
  $('#masthead-version').textContent = state.data.meta.version;
  $('#colophon-genesis').textContent = 'Génesis · ' + fmt.date(state.data.meta.genesis);

  const current = findAff(state.currentAffiliate);
  $('#switcher-label').textContent = current ? current.name : 'Sin sesión';

  const menu = $('#switcher-menu');
  menu.innerHTML = '';
  for (const a of state.data.affiliates) {
    menu.appendChild(h('button', {
      class: a.id === state.currentAffiliate ? 'current' : '',
      onclick: () => {
        state.currentAffiliate = a.id;
        $('#switcher').classList.remove('open');
        renderMasthead();
        render();
        toast('Sesión: ' + a.name);
      }
    }, `${a.name} · ${a.city}`));
  }

  // Nav active
  const path = stripBase(location.pathname);
  for (const a of document.querySelectorAll('.nav a')) {
    const r = a.getAttribute('data-route');
    let active = false;
    if (r === 'home' && path === '/') active = true;
    else if (r === 'carta' && path === '/carta') active = true;
    else if (r === 'celulas' && (path === '/celulas' || path.startsWith('/celula/'))) active = true;
    else if (r === 'issues' && (path === '/issues' || path.startsWith('/issue/') || path.startsWith('/iniciativa/'))) active = true;
    else if (r === 'delegaciones' && path === '/delegaciones') active = true;
    else if (r === 'auditoria' && path === '/auditoria') active = true;
    a.classList.toggle('active', active);
  }
}

$('#switcher-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#switcher').classList.toggle('open');
});
document.addEventListener('click', () => $('#switcher').classList.remove('open'));

// ========== ROUTING ==========
function go(path) {
  const target = BASE_PATH + path;
  if (target === location.pathname + location.search) return;
  history.pushState({}, '', target);
  render();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
  e.preventDefault();
  go(href);
});

window.addEventListener('popstate', () => render());

// ========== SHARED COMPONENTS ==========

function phasePill(phase) {
  return h('span', { class: 'pill phase phase-' + phase }, PHASE_LABEL[phase]);
}

function sectionHeader(title, sub, tag, dark = false) {
  return h('div', { class: 'section-header' + (dark ? ' section-header--dark' : '') },
    h('div', {},
      h('h2', {}, title),
      sub && h('p', { class: 'section-sub' + (dark ? ' on-dark' : '') }, sub),
    ),
    tag && h('div', { class: 'pill gold' }, tag),
  );
}

function stat(n, label, accent = false) {
  return h('div', { class: 'cell' },
    h('div', { class: 'n' }, h('span', { class: accent ? 'accent' : '' }, String(n))),
    h('span', { class: 'label' }, label),
  );
}

// Support bar: shows supporters vs quorum
function supportBar(init, issue) {
  const quorum = issue.policy.issueQuorum;
  const totalAff = state.data.affiliates.length;
  const quorumAbs = Math.ceil(totalAff * quorum);
  const current = init.support.weight;
  const pctOfQuorum = Math.min(1, current / quorumAbs);
  return h('div', { class: 'support-bar-wrap' },
    h('div', { class: 'support-bar' },
      h('div', { class: 'support-bar-fill' + (current >= quorumAbs ? ' reached' : ''), style: `width:${pctOfQuorum * 100}%` }),
      h('div', { class: 'support-bar-quorum-mark' }),
    ),
    h('div', { class: 'support-bar-legend' },
      h('span', {}, h('strong', {}, current), ' apoyos (', init.support.direct, ' directos + ', init.support.delegated, ' delegados)'),
      h('span', {}, 'quórum · ', h('strong', {}, quorumAbs), '/', totalAff),
    ),
  );
}

// Phase progress: time remaining in the phase
function phaseProgress(issue) {
  if (issue.phase === 'finished') {
    return h('div', { class: 'phase-progress phase-progress--finished' },
      h('span', { class: 'phase-progress-label' }, 'Issue cerrada · ', fmt.date(issue.phaseStartAt)),
    );
  }
  const remainingText = fmt.timeLeft(issue.remainingMs);
  const urgent = issue.remainingMs > 0 && issue.remainingMs < 86400000 * 2;
  return h('div', { class: 'phase-progress' + (urgent ? ' phase-progress--urgent' : '') },
    h('div', { class: 'phase-progress-bar' },
      h('div', { class: 'phase-progress-bar-fill', style: `width:${issue.progress * 100}%` }),
    ),
    h('div', { class: 'phase-progress-legend' },
      h('span', {}, 'Fase ', h('strong', {}, PHASE_LABEL[issue.phase])),
      h('span', {}, remainingText, ' restantes'),
    ),
  );
}

// ========== HOME ==========
function viewHome() {
  const d = state.data;
  const byPhase = (ph) => d.issues.filter(i => i.phase === ph);
  const voting    = byPhase('voting');
  const discussion = byPhase('discussion');
  const verification = byPhase('verification');
  const admission  = byPhase('admission');
  const finished   = byPhase('finished');
  const totalInit = d.initiatives.length;
  const totalSup  = d.supports.length;
  const totalSug  = d.suggestions.length;
  const totalDel  = d.delegations.length;

  const view = h('div');

  // HERO
  view.appendChild(h('section', { class: 'hero' },
    h('div', { class: 'shell' },
      h('div', { class: 'hero-kicker' },
        h('span', {}, 'Democracia líquida'),
        h('span', { class: 'dash' }),
        h('span', {}, 'Edición pública · ' + fmt.romanDay()),
      ),
      h('div', { class: 'hero-grid' },
        h('div', { class: 'rise' },
          h('h1', { html: 'La Organización<br>decide <em class="hl">hoy</em>.' }),
        ),
        h('div', { class: 'rise rise-2' },
          h('p', { class: 'hero-lede', html: '&ldquo;La soberanía reside enteramente en el individuo.&rdquo;' }),
          h('p', { class: 'hero-sub' }, 'Ágora Digital implementa los Artículos 10, 11 y 12 de la Carta. Voto directo sobre cualquier asunto · delegación revocable por ámbito · transparencia radical auditable en tiempo real · deliberación en fases con quórums vinculantes.'),
          h('div', { class: 'hero-cta' },
            h('a', { href: '/issues', 'data-link': '', class: 'btn' }, 'Ver asuntos abiertos', h('span', {}, '→')),
            h('a', { href: '/carta', 'data-link': '', class: 'btn secondary' }, 'Carta de Principios'),
          ),
        ),
      ),
      h('div', { class: 'hero-stats rise rise-3' },
        stat(d.affiliates.length, 'Afiliados'),
        stat(d.issues.length, 'Asuntos activos'),
        stat(voting.length, 'En votación', true),
        stat(totalSup, 'Apoyos registrados'),
        stat(totalSug, 'Sugerencias vivas'),
        stat(totalDel, 'Delegaciones'),
      ),
    ),
  ));

  // FASES (breakdown visual)
  view.appendChild(h('section', { class: 'band band--tight' },
    h('div', { class: 'shell' },
      sectionHeader('Estado del proceso', 'Cada asunto recorre cinco fases antes de convertirse en decisión vinculante.', 'Modelo LF'),
      h('div', { class: 'phase-grid' },
        phaseCard('admission',    admission,    'Reúne apoyos hasta alcanzar el quórum de admisión.'),
        phaseCard('discussion',   discussion,   'Revisión de borradores y sugerencias. Texto móvil.'),
        phaseCard('verification', verification, 'Texto congelado. Iniciativas deben superar quórum.'),
        phaseCard('voting',       voting,       'Ballot preferencial. Gana por Condorcet.'),
        phaseCard('finished',     finished,     'Decisión vinculante archivada en la bitácora.'),
      ),
    ),
  ));

  // EN VOTACIÓN
  if (voting.length) {
    view.appendChild(h('section', { class: 'band' },
      h('div', { class: 'shell' },
        sectionHeader('En votación ahora', 'Ballot preferencial abierto. Rankea las iniciativas competidoras. Delegaciones activas.', voting.length + ' · en curso'),
        h('div', { class: 'issue-grid' }, voting.map(issueCard)),
      ),
    ));
  }

  // EN DISCUSIÓN
  if (discussion.length || verification.length) {
    view.appendChild(h('section', { class: 'band' },
      h('div', { class: 'shell' },
        sectionHeader('En deliberación', 'Iniciativas competidoras acumulando apoyos y sugerencias antes de congelar el texto.', (discussion.length + verification.length) + ' · en trabajo'),
        h('div', { class: 'issue-grid' },
          [...verification, ...discussion].map(issueCard),
        ),
      ),
    ));
  }

  // EN ADMISIÓN
  if (admission.length) {
    view.appendChild(h('section', { class: 'band' },
      h('div', { class: 'shell' },
        sectionHeader('Busca tu apoyo', 'Asuntos recién propuestos que necesitan cruzar el quórum de admisión para entrar a discusión formal.', admission.length + ' · nuevos'),
        h('div', { class: 'issue-grid' }, admission.map(issueCard)),
      ),
    ));
  }

  // CÓMO FUNCIONA
  view.appendChild(h('section', { class: 'band band--dark' },
    h('div', { class: 'shell' },
      sectionHeader('Cómo funciona la democracia líquida', 'Adaptación del modelo de LiquidFeedback a la Carta del PLC.', 'Art. 12', true),
      h('div', { class: 'explainer-grid' },
        explainerCell('01', 'Voto directo', 'Cualquier afiliado puede votar sobre cualquier asunto. No hay funcionarios electos intermediando. Tu voto siempre anula cualquier delegación para ese asunto.'),
        explainerCell('02', 'Delegación revocable', 'Delega tu voto por ámbito: global, por célula, o por asunto específico. La delegación específica tiene prioridad. Revocable al instante.'),
        explainerCell('03', 'Iniciativas competidoras', 'Un asunto puede tener varias propuestas rivales. Se rankean preferencialmente (Condorcet). El status quo también compite.'),
        explainerCell('04', 'Apoyo antes del voto', 'Una iniciativa necesita cruzar un quórum de apoyos para avanzar. El apoyo es visible; puede ser condicional a que se adopten sugerencias.'),
        explainerCell('05', 'Sugerencias estructuradas', 'Cualquier afiliado propone mejoras a una iniciativa con directivas: debe / debería / no debe / no debería. Cada sugerencia recibe votos de aprobación.'),
        explainerCell('06', 'Transparencia radical', 'Cada voto, apoyo, delegación y sugerencia queda firmado y verificable en la bitácora pública (Art. 12.4).'),
      ),
    ),
  ));

  // CÉLULAS GRID
  view.appendChild(h('section', { class: 'band band--tight' },
    h('div', { class: 'shell' },
      sectionHeader('Las seis Células', 'Red descentralizada de tipo mercado libre. Todos los afiliados están a cargo.', 'Título V'),
      celulaGrid(),
    ),
  ));

  // ACTIVIDAD
  view.appendChild(h('section', { class: 'band band--dark' },
    h('div', { class: 'shell' },
      sectionHeader('Bitácora pública', 'Cada acción deja huella verificable.', 'Transparencia · Art. 12.4', true),
      auditTable(d.audit.slice(0, 8), true),
      h('div', { style: 'margin-top:28px' },
        h('a', { href: '/auditoria', 'data-link': '', class: 'btn gold' }, 'Bitácora completa →'),
      ),
    ),
  ));

  return view;
}

function phaseCard(phase, issues, blurb) {
  return h('a', {
    href: `/issues?phase=${phase}`, 'data-link': '',
    class: 'phase-card phase-card--' + phase,
  },
    h('div', { class: 'phase-card-num' }, String(issues.length).padStart(2, '0')),
    h('div', { class: 'phase-card-body' },
      h('div', { class: 'phase-card-title' }, PHASE_LABEL[phase]),
      h('p', { class: 'phase-card-blurb' }, blurb),
    ),
    h('span', { class: 'phase-card-arrow' }, '→'),
  );
}

function explainerCell(num, title, body) {
  return h('div', { class: 'explainer-cell' },
    h('div', { class: 'explainer-num' }, num),
    h('h3', {}, title),
    h('p', {}, body),
  );
}

function issueCard(issue) {
  const celula = findCel(issue.celulaId);
  const nInits = issue.initiatives.length;
  const topInit = issue.initiatives.slice().sort((a, b) => b.support.weight - a.support.weight)[0];
  const totalSup = issue.initiatives.reduce((s, i) => s + i.support.weight, 0);
  return h('a', {
    href: `/issue/${issue.id}`, 'data-link': '',
    class: 'issue-card issue-card--' + issue.phase,
  },
    h('div', { class: 'issue-card-head' },
      phasePill(issue.phase),
      h('span', { class: 'issue-card-celula' }, celula.name),
    ),
    h('h3', {}, issue.title),
    h('p', { class: 'issue-card-desc' }, issue.description.slice(0, 180) + (issue.description.length > 180 ? '…' : '')),
    phaseProgress(issue),
    h('div', { class: 'issue-card-stats' },
      h('div', {}, h('span', { class: 'n' }, nInits), h('span', { class: 'lbl' }, 'iniciativa' + (nInits === 1 ? '' : 's'))),
      h('div', {}, h('span', { class: 'n' }, totalSup), h('span', { class: 'lbl' }, 'apoyos total')),
      h('div', {}, h('span', { class: 'n' }, issue.tally?.ballotsCast ?? '—'), h('span', { class: 'lbl' }, 'votos' + (issue.phase === 'voting' ? ' ahora' : ''))),
    ),
    topInit && issue.phase !== 'finished' ? h('div', { class: 'issue-card-top' },
      h('span', { class: 'issue-card-top-label' }, 'Líder en apoyos'),
      h('span', { class: 'issue-card-top-title' }, topInit.title),
    ) : null,
    issue.winningInitiativeId ? h('div', { class: 'issue-card-winner' },
      h('span', { class: 'issue-card-top-label' }, '✓ Ganadora'),
      h('span', { class: 'issue-card-top-title' }, findInit(issue.winningInitiativeId)?.title),
    ) : null,
  );
}

function celulaGrid() {
  const container = h('div', { class: 'celula-grid' });
  for (const c of state.data.celulas) {
    const issues = state.data.issues.filter(i => i.celulaId === c.id);
    const voting = issues.filter(i => i.phase === 'voting').length;
    container.appendChild(h('a', {
      href: `/celula/${c.slug}`, 'data-link': '',
      class: 'celula-card',
    },
      h('div', { class: 'celula-card-code' },
        h('span', {}, 'Célula · ', h('strong', {}, c.code)),
        h('span', {}, 'Art. ', c.article),
      ),
      h('h3', {}, c.name),
      h('p', {}, c.purpose),
      h('div', { class: 'celula-card-footer' },
        h('span', {}, issues.length, ' asunto', issues.length === 1 ? '' : 's', voting ? ` · ${voting} en voto` : ''),
        h('span', { class: 'celula-arrow' }, '↗'),
      ),
    ));
  }
  return container;
}

function auditTable(rows, dark = false) {
  const t = h('div', { class: 'audit-table' });
  for (const r of rows) {
    const actor = findAff(r.actor) || { name: r.actor === 'sistema' ? 'Sistema' : r.actor };
    let detail;
    if (r.kind === 'voto') {
      const iss = findIssue(r.target);
      detail = h('span', {}, actor.name, ' votó en ',
        iss ? h('a', { href: `/issue/${iss.id}`, 'data-link': '', class: 'link-accent' }, iss.title) : r.target);
    } else if (r.kind === 'apoyo') {
      const ini = findInit(r.target);
      detail = h('span', {}, actor.name, ' apoyó ',
        ini ? h('a', { href: `/iniciativa/${ini.id}`, 'data-link': '', class: 'link-accent' }, ini.title) : r.target);
    } else if (r.kind === 'retirar_apoyo') {
      const ini = findInit(r.target);
      detail = h('span', {}, actor.name, ' retiró apoyo a ', ini?.title || r.target);
    } else if (r.kind === 'sugerencia') {
      const ini = findInit(r.target);
      detail = h('span', {}, actor.name, ' sugirió "', DIRECTIVE_LABEL[r.meta?.directive] || '', '" en ',
        ini ? h('a', { href: `/iniciativa/${ini.id}`, 'data-link': '', class: 'link-accent' }, ini.title) : r.target);
    } else if (r.kind === 'issue_nueva') {
      const iss = findIssue(r.target);
      detail = h('span', {}, actor.name, ' propuso asunto "',
        iss ? h('a', { href: `/issue/${iss.id}`, 'data-link': '', class: 'link-accent' }, iss.title) : r.meta?.title || r.target, '"');
    } else if (r.kind === 'iniciativa_nueva') {
      const ini = findInit(r.target);
      detail = h('span', {}, actor.name, ' añadió iniciativa "', ini?.title || r.meta?.title || r.target, '"');
    } else if (r.kind === 'fase_cambio') {
      const iss = findIssue(r.target);
      detail = h('span', {}, 'El sistema avanzó ',
        iss ? h('a', { href: `/issue/${iss.id}`, 'data-link': '', class: 'link-accent' }, iss.title) : r.target,
        ' de ', PHASE_LABEL[r.meta?.from] || r.meta?.from, ' → ', PHASE_LABEL[r.meta?.to] || r.meta?.to);
    } else if (r.kind === 'delegacion') {
      const tgt = findAff(r.target);
      const scope = r.meta?.scope === 'celula' ? findCel(r.meta.targetId)?.name
        : r.meta?.scope === 'issue' ? findIssue(r.meta.targetId)?.title
        : 'toda la plataforma';
      detail = h('span', {}, actor.name, ' delegó en ', tgt?.name || r.target, ' — ', scope);
    } else if (r.kind === 'revocacion') {
      const tgt = findAff(r.target);
      detail = h('span', {}, actor.name, ' revocó delegación en ', tgt?.name || r.target);
    } else {
      detail = r.kind;
    }
    t.appendChild(h('div', { class: 'audit-row' },
      h('span', { class: 'timestamp' }, fmt.dateTime(r.at)),
      h('span', { class: 'kind ' + r.kind }, r.kind.replace(/_/g, ' ')),
      h('span', { class: 'detail' }, detail),
      h('span', { class: 'hash' }, r.id.slice(0, 8)),
    ));
  }
  return t;
}

// ========== /issues LIST ==========
function viewIssues() {
  const params = new URLSearchParams(location.search);
  const phaseFilter = params.get('phase');
  const allIssues = state.data.issues;
  const filtered = phaseFilter ? allIssues.filter(i => i.phase === phaseFilter) : allIssues;

  return h('main',
    h('section', { class: 'shell hero' },
      h('div', { class: 'hero-kicker' },
        h('span', {}, 'Asuntos'),
        h('span', { class: 'dash' }),
        h('span', {}, allIssues.length + ' totales'),
      ),
      h('h1', { class: 'rise' }, 'Asuntos del Partido'),
      h('p', { class: 'hero-lede', style: 'max-width:760px;margin-top:24px' },
        'Cada decisión vinculante pasa por aquí. Inscribí un asunto, acumulá apoyo, proponé iniciativas competidoras, sugerí mejoras, votá preferencialmente.'),
      h('div', { class: 'phase-filter' },
        h('a', { href: '/issues', 'data-link': '', class: 'phase-filter-chip' + (!phaseFilter ? ' active' : '') }, 'Todas · ', allIssues.length),
        ...['admission', 'discussion', 'verification', 'voting', 'finished'].map(ph => {
          const n = allIssues.filter(i => i.phase === ph).length;
          return h('a', { href: `/issues?phase=${ph}`, 'data-link': '', class: 'phase-filter-chip' + (phaseFilter === ph ? ' active' : '') },
            PHASE_LABEL[ph], ' · ', n);
        }),
      ),
    ),
    h('section', { class: 'band' },
      h('div', { class: 'shell' },
        filtered.length
          ? h('div', { class: 'issue-grid' }, filtered.map(issueCard))
          : h('p', { class: 'empty-state' }, 'No hay asuntos en esta fase.'),
      ),
    ),
  );
}

// ========== /issue/:id ==========
function viewIssue(id) {
  const issue = findIssue(id);
  if (!issue) return viewNotFound();
  const celula = findCel(issue.celulaId);
  const policy = issue.policy;
  const me = state.currentAffiliate;
  const myBallot = state.data.ballots.find(b => b.affiliateId === me && b.issueId === issue.id);
  const myDelegate = delegationResolves(me, issue);
  const myDelegateAff = myDelegate ? findAff(myDelegate.to) : null;

  return h('main',
    // Header
    h('section', { class: 'shell issue-header' },
      h('div', { class: 'hero-kicker' },
        h('a', { href: `/celula/${celula.slug}`, 'data-link': '', class: 'link-accent' }, '← ', celula.name),
        h('span', { class: 'dash' }),
        issue.article && h('span', {}, 'Art. ', issue.article),
        h('span', { class: 'dash' }),
        h('span', {}, 'Política · ', policy.name),
      ),
      h('div', { class: 'issue-phase-row' },
        phasePill(issue.phase),
        h('span', { class: 'issue-id' }, 'ID · ', issue.id),
        h('span', { class: 'issue-created' }, 'Abierta ', fmt.relTime(issue.createdAt)),
      ),
      h('h1', { class: 'rise' }, issue.title),
      h('p', { class: 'hero-lede', style: 'max-width:820px;margin-top:20px' }, issue.description),
      phaseProgress(issue),
    ),

    // Delegation notice
    myDelegate ? h('section', { class: 'shell' },
      h('div', { class: 'delegation-banner' },
        h('div', {},
          h('strong', {}, 'Tu voto está delegado.'),
          ' En esta issue se emite en nombre tuyo por ',
          myDelegateAff ? h('a', { href: `/afiliado/${myDelegateAff.id}`, 'data-link': '', class: 'link-accent' }, myDelegateAff.name) : '···',
          ' · ámbito ',
          h('code', {}, myDelegate.scope === 'issue' ? 'issue-específica' : myDelegate.scope === 'celula' ? 'célula' : 'global'),
          '. Votá o apoyá directamente para anular la delegación aquí.',
        ),
        h('a', { href: '/delegaciones', 'data-link': '', class: 'link-accent' }, 'Gestionar →'),
      ),
    ) : null,

    // Voting phase: ballot panel
    issue.phase === 'voting' ? h('section', { class: 'band band--tight' },
      h('div', { class: 'shell' },
        h('div', { class: 'ballot-panel' },
          h('div', { class: 'ballot-header' },
            h('h2', {}, 'Ballot preferencial'),
            h('p', {}, 'Rankeá las iniciativas en orden de preferencia (1 = más preferida). Las que dejes sin rankear se consideran por debajo del status quo.'),
          ),
          ballotForm(issue, myBallot),
        ),
      ),
    ) : null,

    // Finished: show winner + full tally
    issue.phase === 'finished' ? h('section', { class: 'band' },
      h('div', { class: 'shell' }, finishedTally(issue)),
    ) : null,

    // Initiatives list
    h('section', { class: 'band' },
      h('div', { class: 'shell' },
        sectionHeader(
          issue.phase === 'voting' ? 'Iniciativas en la boleta' : issue.phase === 'finished' ? 'Iniciativas competidoras' : 'Iniciativas competidoras',
          issue.phase === 'admission' ? 'Cada iniciativa necesita apoyos para avanzar a discusión.' :
          issue.phase === 'discussion' ? 'Revisá, apoyá, sugerí mejoras. El texto puede cambiar.' :
          issue.phase === 'verification' ? 'Texto congelado. Los apoyos determinan qué iniciativas entran al ballot.' :
          'Rankealas a la izquierda; aquí el detalle de cada una.',
          issue.initiatives.length + ' ' + (issue.initiatives.length === 1 ? 'propuesta' : 'propuestas'),
        ),
        h('div', { class: 'initiatives-list' },
          issue.initiatives.map((ini, idx) => initiativeBlock(ini, issue, idx)),
        ),
      ),
    ),

    // Add new initiative (only in admission/discussion)
    ['admission', 'discussion'].includes(issue.phase) ? h('section', { class: 'band band--dark' },
      h('div', { class: 'shell', style: 'max-width:760px' },
        h('h2', { style: 'margin-bottom:10px' }, 'Proponer iniciativa competidora'),
        h('p', { class: 'subtle on-dark' }, 'Una iniciativa alternativa dentro de este asunto. En votación competirá contra las otras por orden de preferencia.'),
        newInitiativeForm(issue),
      ),
    ) : null,
  );
}

function initiativeBlock(ini, issue, idx) {
  const author = findAff(ini.authorId);
  const me = state.currentAffiliate;
  const mySupport = isSupporting(me, ini.id);
  const suggestions = suggestionsOfInit(ini.id);
  const canSupport = ['admission', 'discussion', 'verification'].includes(issue.phase);
  const quorumAbs = Math.ceil(state.data.affiliates.length * issue.policy.issueQuorum);
  const reachedQuorum = ini.support.weight >= quorumAbs;

  return h('article', { class: 'initiative-block', id: ini.id },
    h('header', { class: 'initiative-block-head' },
      h('div', { class: 'initiative-num' }, String.fromCharCode(65 + idx)),
      h('div', {},
        h('h3', {}, h('a', { href: `/iniciativa/${ini.id}`, 'data-link': '' }, ini.title)),
        h('div', { class: 'initiative-meta' },
          h('span', {}, 'por ', h('a', { href: `/afiliado/${author.id}`, 'data-link': '', class: 'link-accent' }, author.name)),
          h('span', {}, fmt.relTime(ini.createdAt)),
          ini.draftsCount > 1 ? h('span', {}, ini.draftsCount, ' borradores') : null,
          suggestions.length ? h('span', {}, suggestions.length, ' sugerencia', suggestions.length === 1 ? '' : 's') : null,
        ),
      ),
      reachedQuorum ? h('span', { class: 'pill gold' }, '✓ quórum') : h('span', { class: 'pill' }, 'falta ' + (quorumAbs - ini.support.weight)),
    ),
    h('p', { class: 'initiative-summary' }, ini.summary),

    // Support bar
    supportBar(ini, issue),

    // Actions
    canSupport ? h('div', { class: 'initiative-actions' },
      mySupport
        ? h('button', { class: 'btn secondary', onclick: () => doUnsupport(ini.id) }, '◆ Retirar apoyo')
        : h('button', { class: 'btn gold', onclick: () => doSupport(ini.id, false) }, 'Apoyar esta iniciativa'),
      !mySupport ? h('button', { class: 'btn secondary', onclick: () => doSupport(ini.id, true) },
        'Apoyo condicional'
      ) : null,
      h('a', { href: `/iniciativa/${ini.id}`, 'data-link': '', class: 'btn secondary' }, 'Ver detalle →'),
    ) : null,

    // Suggestions preview (top 3)
    suggestions.length ? h('div', { class: 'suggestions-preview' },
      h('div', { class: 'suggestions-preview-head' },
        h('span', {}, 'Sugerencias'),
        h('a', { href: `/iniciativa/${ini.id}#sugerencias`, 'data-link': '', class: 'link-accent' }, 'ver todas →'),
      ),
      ...suggestions.slice(0, 3).map(s => suggestionRow(s, true)),
    ) : null,
  );
}

function suggestionRow(s, compact = false) {
  const me = state.currentAffiliate;
  const myRating = s.plusRaters?.includes(me) ? 'plus' : s.minusRaters?.includes(me) ? 'minus' : null;
  const author = findAff(s.authorId);
  return h('div', { class: 'suggestion-row' + (compact ? ' suggestion-row--compact' : '') },
    h('span', { class: 'suggestion-directive suggestion-directive--' + s.directive }, DIRECTIVE_LABEL[s.directive]),
    h('div', { class: 'suggestion-content' },
      h('p', {}, s.content),
      !compact ? h('div', { class: 'suggestion-meta' },
        h('span', {}, 'por ', author?.name),
        h('span', {}, fmt.relTime(s.createdAt)),
      ) : null,
    ),
    h('div', { class: 'suggestion-rating' },
      h('button', {
        class: 'rate' + (myRating === 'plus' ? ' active' : ''),
        onclick: (e) => { e.stopPropagation(); doRate(s.id, myRating === 'plus' ? 'clear' : 'plus'); },
      }, '+', h('span', { class: 'n' }, s.stats.plus)),
      h('button', {
        class: 'rate' + (myRating === 'minus' ? ' active' : ''),
        onclick: (e) => { e.stopPropagation(); doRate(s.id, myRating === 'minus' ? 'clear' : 'minus'); },
      }, '−', h('span', { class: 'n' }, s.stats.minus)),
    ),
  );
}

function ballotForm(issue, myBallot) {
  if (!state.ballotDraft[issue.id]) {
    state.ballotDraft[issue.id] = myBallot ? { ...myBallot.rankings } : {};
  }
  const draft = state.ballotDraft[issue.id];

  const updateSummary = () => {
    const sumEl = document.querySelector('.ballot-summary');
    const btn = document.querySelector('.ballot-submit-btn');
    const hasAny = Object.keys(draft).length > 0;
    if (sumEl) {
      if (!hasAny) sumEl.textContent = 'Seleccioná al menos una preferencia.';
      else sumEl.textContent = 'Ballot: ' + Object.entries(draft).sort((a,b)=>a[1]-b[1]).map(([id,r]) => {
        const letter = String.fromCharCode(65 + issue.initiatives.findIndex(x => x.id === id));
        return `${r}·${letter}`;
      }).join(' · ');
    }
    if (btn) btn.disabled = !hasAny;
  };

  return h('div', { class: 'ballot-panel-inner' },
    h('div', { class: 'ballot-grid' },
      issue.initiatives.map((ini, idx) => h('div', { class: 'ballot-row' },
        h('span', { class: 'ballot-row-letter' }, String.fromCharCode(65 + idx)),
        h('div', { class: 'ballot-row-title' },
          h('a', { href: `/iniciativa/${ini.id}`, 'data-link': '' }, ini.title),
          h('p', {}, ini.summary.slice(0, 140) + (ini.summary.length > 140 ? '…' : '')),
        ),
        h('div', { class: 'ballot-row-rank' },
          h('label', {}, 'Preferencia'),
          (() => {
            const sel = h('select', {
              onchange: (e) => {
                const v = e.target.value;
                if (v === '') delete draft[ini.id];
                else draft[ini.id] = Number(v);
                updateSummary();
              },
            },
              h('option', { value: '' }, '—'),
              ...[1,2,3,4,5].map(n => h('option', { value: n, selected: draft[ini.id] === n ? true : null }, String(n))),
              h('option', { value: 99, selected: draft[ini.id] === 99 ? true : null }, 'Status quo'),
            );
            return sel;
          })(),
        ),
      )),
    ),
    h('div', { class: 'ballot-actions' },
      h('p', { class: 'ballot-summary' },
        Object.keys(draft).length
          ? 'Ballot: ' + Object.entries(draft).sort((a,b)=>a[1]-b[1]).map(([id,r]) => {
              const letter = String.fromCharCode(65 + issue.initiatives.findIndex(x => x.id === id));
              return `${r}·${letter}`;
            }).join(' · ')
          : 'Seleccioná al menos una preferencia.'),
      h('button', {
        class: 'btn gold ballot-submit-btn',
        disabled: !Object.keys(draft).length ? true : null,
        onclick: () => submitBallot(issue.id, draft),
      }, myBallot ? 'Actualizar ballot →' : 'Registrar ballot →'),
      myBallot ? h('span', { class: 'ballot-note' }, 'Ballot previo registrado ', fmt.relTime(myBallot.at)) : null,
    ),
  );
}

function finishedTally(issue) {
  const tally = issue.tally;
  if (!tally) return h('div', {}, 'Sin datos');
  const sorted = tally.ids.slice().sort((a, b) => tally.approvalCount[b] - tally.approvalCount[a]);
  const maxApprove = Math.max(...Object.values(tally.approvalCount), 1);
  return h('div', { class: 'finished-tally' },
    h('div', { class: 'finished-winner' },
      h('span', { class: 'finished-winner-label' }, '✓ Decisión vinculante'),
      h('h2', {}, findInit(tally.winner)?.title || '—'),
      h('p', {}, 'Ganadora por ', tally.ballotsCast, ' ballots computados (Condorcet simplificado).'),
    ),
    h('div', { class: 'finished-ranking' },
      sorted.map((id, idx) => {
        const ini = findInit(id);
        return h('div', { class: 'finished-row' },
          h('span', { class: 'finished-pos' }, idx + 1 + '°'),
          h('div', { class: 'finished-title' }, ini?.title),
          h('div', { class: 'finished-bar' },
            h('div', { class: 'finished-bar-fill' + (id === tally.winner ? ' winner' : ''), style: `width:${(tally.approvalCount[id] / maxApprove) * 100}%` }),
          ),
          h('span', { class: 'finished-score' }, tally.approvalCount[id], ' aprob.'),
        );
      }),
    ),
  );
}

async function doSupport(initiativeId, potential) {
  try {
    await api('/api/support', { method: 'POST', body: { affiliateId: state.currentAffiliate, initiativeId, potential }});
    toast(potential ? 'Apoyo condicional registrado' : 'Apoyo registrado');
    await loadState(); render();
  } catch (err) { toast('Error: ' + err.message, 'blood'); }
}

async function doUnsupport(initiativeId) {
  try {
    await api('/api/unsupport', { method: 'POST', body: { affiliateId: state.currentAffiliate, initiativeId }});
    toast('Apoyo retirado');
    await loadState(); render();
  } catch (err) { toast('Error: ' + err.message, 'blood'); }
}

async function doRate(suggestionId, rating) {
  try {
    await api('/api/suggestion/rate', { method: 'POST', body: { suggestionId, affiliateId: state.currentAffiliate, rating }});
    await loadState(); render();
  } catch (err) { toast('Error: ' + err.message, 'blood'); }
}

async function submitBallot(issueId, rankings) {
  try {
    await api('/api/vote', { method: 'POST', body: { affiliateId: state.currentAffiliate, issueId, rankings }});
    toast('Ballot registrado');
    delete state.ballotDraft[issueId];
    await loadState(); render();
  } catch (err) { toast('Error: ' + err.message, 'blood'); }
}

function newInitiativeForm(issue) {
  return h('form', { class: 'form-stack', onsubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const res = await api('/api/initiative', { method: 'POST', body: {
        issueId: issue.id, authorId: state.currentAffiliate,
        title: f.get('title'), summary: f.get('summary'),
      }});
      toast('Iniciativa registrada');
      await loadState(); go(`/iniciativa/${res.id}`);
    } catch (err) { toast('Error: ' + err.message, 'blood'); }
  }},
    h('div', { class: 'form-row' },
      h('label', {}, 'Título de la iniciativa'),
      h('input', { name: 'title', required: true, placeholder: 'Ej. "Modelo híbrido con sidechain..."' }),
    ),
    h('div', { class: 'form-row' },
      h('label', {}, 'Resumen operativo'),
      h('textarea', { name: 'summary', required: true, placeholder: 'Breve descripción de la propuesta y su ventaja frente a las alternativas.' }),
    ),
    h('button', { type: 'submit', class: 'btn gold' }, 'Añadir iniciativa →'),
  );
}

// ========== /iniciativa/:id ==========
function viewIniciativa(id) {
  const ini = findInit(id);
  if (!ini) return viewNotFound();
  const issue = findIssue(ini.issueId);
  const celula = findCel(issue.celulaId);
  const author = findAff(ini.authorId);
  const suggestions = suggestionsOfInit(ini.id);
  const drafts = state.data.drafts.filter(d => d.initiativeId === ini.id).sort((a, b) => b.version - a.version);
  const support = ini.support || (issue.initiatives.find(x => x.id === ini.id)?.support);

  return h('main',
    h('section', { class: 'shell hero' },
      h('div', { class: 'hero-kicker' },
        h('a', { href: `/issue/${issue.id}`, 'data-link': '', class: 'link-accent' }, '← ', issue.title),
        h('span', { class: 'dash' }),
        h('span', {}, celula.name),
      ),
      h('div', { class: 'issue-phase-row' },
        phasePill(issue.phase),
        h('span', {}, 'por ', h('a', { href: `/afiliado/${author.id}`, 'data-link': '', class: 'link-accent' }, author.name)),
        h('span', {}, fmt.date(ini.createdAt)),
        h('span', {}, 'ID · ', ini.id),
      ),
      h('h1', { class: 'rise' }, ini.title),
      h('p', { class: 'init-description' }, ini.summary),
    ),

    // Support
    h('section', { class: 'band band--tight' },
      h('div', { class: 'shell' },
        h('h2', { style: 'font-size:32px;margin-bottom:24px' }, 'Apoyo'),
        support ? supportBar({ support }, issue) : null,
        h('div', { style: 'margin-top:20px;display:flex;gap:12px;flex-wrap:wrap' },
          ['admission', 'discussion', 'verification'].includes(issue.phase)
            ? (isSupporting(state.currentAffiliate, ini.id)
              ? h('button', { class: 'btn secondary', onclick: () => doUnsupport(ini.id) }, '◆ Retirar apoyo')
              : h('button', { class: 'btn gold', onclick: () => doSupport(ini.id, false) }, 'Apoyar esta iniciativa'))
            : null,
        ),
      ),
    ),

    // Drafts
    drafts.length > 1 ? h('section', { class: 'band' },
      h('div', { class: 'shell' },
        sectionHeader('Historial de borradores', 'Cada revisión preserva el estado anterior. El texto aprobado será el de la versión vigente al momento del voto.', drafts.length + ' versiones'),
        h('div', { class: 'drafts-list' }, drafts.map(d => h('div', { class: 'draft-row' },
          h('span', { class: 'draft-version' }, 'v', d.version),
          h('div', {},
            h('p', {}, d.content),
            h('div', { class: 'draft-meta' }, fmt.date(d.createdAt), ' · ', findAff(d.authorId)?.name),
          ),
        ))),
      ),
    ) : null,

    // Suggestions
    h('section', { class: 'band', id: 'sugerencias' },
      h('div', { class: 'shell' },
        sectionHeader('Sugerencias', 'Directivas estructuradas para mejorar la iniciativa. Cada afiliado puede apoyar o rechazar cada sugerencia.', suggestions.length + ' totales'),
        suggestions.length
          ? h('div', { class: 'suggestions-list' }, suggestions.map(s => suggestionRow(s, false)))
          : h('p', { class: 'empty-state' }, 'Sin sugerencias registradas.'),
        h('div', { style: 'margin-top:32px;max-width:640px' },
          h('h3', { style: 'margin-bottom:16px' }, 'Nueva sugerencia'),
          newSuggestionForm(ini.id),
        ),
      ),
    ),
  );
}

function newSuggestionForm(initiativeId) {
  return h('form', { class: 'form-stack', onsubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api('/api/suggestion', { method: 'POST', body: {
        initiativeId, authorId: state.currentAffiliate,
        directive: f.get('directive'), content: f.get('content'),
      }});
      toast('Sugerencia registrada');
      e.target.reset();
      await loadState(); render();
    } catch (err) { toast('Error: ' + err.message, 'blood'); }
  }},
    h('div', { class: 'form-row' },
      h('label', {}, 'Directiva'),
      h('select', { name: 'directive', required: true },
        h('option', { value: 'must' }, 'DEBE — requisito absoluto'),
        h('option', { value: 'should' }, 'DEBERÍA — fuerte preferencia'),
        h('option', { value: 'should_not' }, 'NO DEBERÍA — objeción'),
        h('option', { value: 'must_not' }, 'NO DEBE — prohibición'),
      ),
    ),
    h('div', { class: 'form-row' },
      h('label', {}, 'Contenido'),
      h('textarea', { name: 'content', required: true, placeholder: 'Qué específicamente cambiar, añadir o remover.' }),
    ),
    h('button', { type: 'submit', class: 'btn gold' }, 'Registrar sugerencia →'),
  );
}

// ========== /celulas + /celula/:slug ==========
function viewCelulas() {
  return h('main',
    h('section', { class: 'shell hero' },
      h('div', { class: 'hero-kicker' },
        h('span', {}, 'Título V'),
        h('span', { class: 'dash' }),
        h('span', {}, 'Artículos 13 al 18'),
      ),
      h('h1', { class: 'rise' }, 'Células internas'),
      h('p', { class: 'hero-lede', style: 'max-width:720px;margin-top:24px' },
        'No son departamentos en una jerarquía, sino células especializadas que sirven a toda la Organización en una red descentralizada de tipo mercado libre.'),
    ),
    h('section', { class: 'band' },
      h('div', { class: 'shell' }, celulaGrid()),
    ),
  );
}

function viewCelula(slug) {
  const c = findCelBySlug(slug);
  if (!c) return viewNotFound();
  const issues = state.data.issues.filter(i => i.celulaId === c.id);
  const byPhase = {
    admission: issues.filter(i => i.phase === 'admission'),
    discussion: issues.filter(i => i.phase === 'discussion'),
    verification: issues.filter(i => i.phase === 'verification'),
    voting: issues.filter(i => i.phase === 'voting'),
    finished: issues.filter(i => i.phase === 'finished'),
  };

  return h('main',
    h('section', { class: 'shell hero' },
      h('div', { class: 'hero-kicker' },
        h('a', { href: '/celulas', 'data-link': '', class: 'link-accent' }, '← Todas las células'),
        h('span', { class: 'dash' }),
        h('span', {}, 'Célula ', c.code, ' · Art. ', c.article),
      ),
      h('h1', { class: 'rise' }, c.name),
      h('p', { class: 'hero-lede', style: 'max-width:820px;margin-top:24px' }, c.purpose),
      h('div', { class: 'hero-stats', style: 'margin-top:40px' },
        stat(issues.length, 'Asuntos totales'),
        stat(byPhase.voting.length, 'En votación', true),
        stat(byPhase.discussion.length + byPhase.verification.length, 'En deliberación'),
        stat(byPhase.admission.length, 'Buscando apoyo'),
      ),
    ),
    ...['voting', 'verification', 'discussion', 'admission', 'finished'].map(ph => {
      const list = byPhase[ph];
      if (!list.length) return null;
      return h('section', { class: 'band' },
        h('div', { class: 'shell' },
          sectionHeader(PHASE_LABEL[ph], null, list.length + ' · en esta célula'),
          h('div', { class: 'issue-grid' }, list.map(issueCard)),
        ),
      );
    }),
    h('section', { class: 'band band--dark' },
      h('div', { class: 'shell', style: 'max-width:760px' },
        h('h2', { style: 'margin-bottom:10px' }, 'Proponer nuevo asunto'),
        h('p', { class: 'subtle on-dark' }, 'Se abre en fase de admisión y necesitará cruzar el quórum para pasar a discusión.'),
        newIssueForm(c),
      ),
    ),
  );
}

function newIssueForm(celula) {
  return h('form', { class: 'form-stack', onsubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const res = await api('/api/issue', { method: 'POST', body: {
        title: f.get('title'), celulaId: celula.id, policyId: f.get('policyId'),
        article: f.get('article') ? Number(f.get('article')) : null,
        description: f.get('description'),
        authorId: state.currentAffiliate,
        initiativeTitle: f.get('initiativeTitle'),
        initiativeSummary: f.get('initiativeSummary'),
      }});
      toast('Asunto abierto');
      await loadState(); go(`/issue/${res.issueId}`);
    } catch (err) { toast('Error: ' + err.message, 'blood'); }
  }},
    h('div', { class: 'form-row' },
      h('label', {}, 'Título del asunto'),
      h('input', { name: 'title', required: true }),
    ),
    h('div', { class: 'form-row' },
      h('label', {}, 'Política aplicable'),
      h('select', { name: 'policyId' },
        ...state.data.policies.map(p => h('option', { value: p.id }, p.name, ' — ', p.description)),
      ),
    ),
    h('div', { class: 'form-row' },
      h('label', {}, 'Artículo relacionado (opcional)'),
      h('input', { name: 'article', type: 'number', min: 1, max: 20 }),
    ),
    h('div', { class: 'form-row' },
      h('label', {}, 'Descripción del asunto'),
      h('textarea', { name: 'description', required: true }),
    ),
    h('hr', { class: 'rule--thin', style: 'margin:8px 0;border-color:#ffffff33' }),
    h('div', { class: 'form-row' },
      h('label', {}, 'Primera iniciativa · Título'),
      h('input', { name: 'initiativeTitle', required: true }),
    ),
    h('div', { class: 'form-row' },
      h('label', {}, 'Primera iniciativa · Resumen'),
      h('textarea', { name: 'initiativeSummary', required: true }),
    ),
    h('button', { type: 'submit', class: 'btn gold' }, 'Abrir asunto en admisión →'),
  );
}

// ========== /delegaciones ==========
function viewDelegaciones() {
  const me = state.currentAffiliate;
  const mine = state.data.delegations.filter(d => d.from === me);
  const incoming = state.data.delegations.filter(d => d.to === me);

  return h('main',
    h('section', { class: 'shell hero' },
      h('div', { class: 'hero-kicker' },
        h('span', {}, 'Art. 12.2'),
        h('span', { class: 'dash' }),
        h('span', {}, 'Delegación revocable'),
      ),
      h('h1', { class: 'rise' }, 'Delegaciones'),
      h('p', { class: 'hero-lede', style: 'max-width:720px;margin-top:20px' },
        'Delegá por ámbito: global, por célula, o por asunto específico. La más específica gana. El voto directo siempre anula la delegación.'),
    ),
    h('section', { class: 'band' },
      h('div', { class: 'shell' },
        sectionHeader('Delegaciones que emito', 'Quién vota en mi nombre y sobre qué.', mine.length + ' activas'),
        mine.length
          ? h('div', { class: 'deleg-panel' }, mine.map(d => delegRow(d, true)))
          : h('p', { class: 'empty-state' }, 'No has delegado tu voto.'),
      ),
    ),
    h('section', { class: 'band' },
      h('div', { class: 'shell' },
        sectionHeader('Delegaciones recibidas', 'Afiliados que confían su voto en tu decisión.', incoming.length + ' recibidas'),
        incoming.length
          ? h('div', { class: 'deleg-panel' }, incoming.map(d => delegRow(d, false)))
          : h('p', { class: 'empty-state' }, 'Nadie ha delegado su voto en ti.'),
      ),
    ),
    h('section', { class: 'band band--dark' },
      h('div', { class: 'shell', style: 'max-width:720px' },
        h('h2', { style: 'margin-bottom:10px' }, 'Nueva delegación'),
        h('p', { class: 'subtle on-dark' }, 'Revocable con efecto inmediato.'),
        delegForm(),
      ),
    ),
  );
}

function delegRow(d, outgoing) {
  const from = findAff(d.from);
  const to = findAff(d.to);
  const scopeLabel = d.scope === 'global' ? 'Todos los asuntos'
    : d.scope === 'celula' ? `Célula · ${findCel(d.targetId)?.name}`
    : `Asunto · ${findIssue(d.targetId)?.title}`;

  return h('div', { class: 'deleg-row' },
    h('span', { class: 'who' }, outgoing ? 'yo' : from.name,
      ' ', h('span', { class: 'arrow' }, '→'), ' ',
      h('a', { href: `/afiliado/${(outgoing ? to : from).id}`, 'data-link': '' }, outgoing ? to.name : 'yo'),
    ),
    h('span', { class: 'scope' }, scopeLabel),
    outgoing
      ? h('button', { onclick: async () => {
          try { await api('/api/revoke', { method: 'POST', body: { delegationId: d.id, from: d.from } });
            toast('Delegación revocada'); await loadState(); render();
          } catch (err) { toast('Error: ' + err.message, 'blood'); }
        }}, 'Revocar')
      : h('span', { class: 'mono', style: 'font-size:11px;color:var(--ink-2)' }, fmt.date(d.createdAt)),
  );
}

function delegForm() {
  const others = state.data.affiliates.filter(a => a.id !== state.currentAffiliate);
  const form = h('form', { class: 'form-stack', onsubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const scope = f.get('scope');
    const targetId = scope === 'global' ? null : f.get('targetId');
    try {
      await api('/api/delegate', { method: 'POST', body: { from: state.currentAffiliate, to: f.get('to'), scope, targetId }});
      toast('Delegación registrada'); await loadState(); render();
    } catch (err) { toast('Error: ' + err.message, 'blood'); }
  }},
    h('div', { class: 'form-row' },
      h('label', {}, 'Delegar en'),
      h('select', { name: 'to', required: true },
        h('option', { value: '' }, '— selecciona afiliado —'),
        ...others.map(a => h('option', { value: a.id }, a.name, ' · ', a.city)),
      ),
    ),
    h('div', { class: 'form-row' },
      h('label', {}, 'Ámbito'),
      h('select', { name: 'scope', onchange: (e) => {
        const v = e.target.value;
        const sel = form.querySelector('[name=targetId]');
        const row = sel.closest('.form-row');
        row.style.display = v === 'global' ? 'none' : 'grid';
        sel.innerHTML = '';
        if (v === 'celula') state.data.celulas.forEach(c => sel.appendChild(h('option', { value: c.id }, c.name)));
        else if (v === 'issue') state.data.issues.forEach(i => sel.appendChild(h('option', { value: i.id }, i.title)));
      }},
        h('option', { value: 'global' }, 'Toda la plataforma (default)'),
        h('option', { value: 'celula' }, 'Una célula específica'),
        h('option', { value: 'issue' }, 'Un asunto específico'),
      ),
    ),
    h('div', { class: 'form-row', style: 'display:none' },
      h('label', {}, 'Destino específico'),
      h('select', { name: 'targetId' }),
    ),
    h('button', { type: 'submit', class: 'btn gold' }, 'Registrar delegación →'),
  );
  return form;
}

// ========== /afiliado/:id ==========
function viewAfiliado(id) {
  const a = findAff(id);
  if (!a) return viewNotFound();
  const ballots = state.data.ballots.filter(b => b.affiliateId === a.id);
  const supports = state.data.supports.filter(s => s.affiliateId === a.id);
  const outgoing = state.data.delegations.filter(d => d.from === a.id);
  const incoming = state.data.delegations.filter(d => d.to === a.id);

  return h('main',
    h('section', { class: 'shell hero' },
      h('div', { class: 'hero-kicker' },
        h('a', { href: '/delegaciones', 'data-link': '', class: 'link-accent' }, '← Delegaciones'),
        h('span', { class: 'dash' }),
        h('span', {}, 'Afiliado · ', a.handle),
      ),
      h('h1', { class: 'rise' }, a.name),
      h('p', { class: 'hero-lede', style: 'margin-top:16px;max-width:720px' }, a.bio),
      h('div', { class: 'hero-stats', style: 'margin-top:40px' },
        stat(ballots.length, 'Ballots emitidos'),
        stat(supports.length, 'Apoyos activos'),
        stat(outgoing.length, 'Delegaciones emitidas'),
        stat(incoming.length, 'Delegaciones recibidas', true),
      ),
    ),
    ballots.length ? h('section', { class: 'band' },
      h('div', { class: 'shell' },
        sectionHeader('Ballots emitidos', null, ballots.length + ' total'),
        h('div', {}, ballots.map(b => {
          const iss = findIssue(b.issueId);
          return h('a', { href: `/issue/${iss.id}`, 'data-link': '', class: 'ballot-history-row' },
            h('span', { class: 'vote-glyph vote-glyph-favor' }, '◆'),
            h('div', {},
              h('span', { style: 'font-family:var(--display);font-size:20px' }, iss.title),
              h('div', { class: 'mono', style: 'font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);margin-top:4px' },
                Object.entries(b.rankings).sort((x,y)=>x[1]-y[1]).map(([iid,r])=>{
                  const idx = iss.initiatives.findIndex(x=>x.id===iid);
                  return `${r}·${String.fromCharCode(65+idx)}`;
                }).join(' · ')),
            ),
            h('span', { class: 'mono', style: 'font-size:11px;color:var(--ink-3)' }, fmt.relTime(b.at)),
          );
        })),
      ),
    ) : null,
    supports.length ? h('section', { class: 'band' },
      h('div', { class: 'shell' },
        sectionHeader('Apoyos activos', null, supports.length + ' total'),
        h('div', {}, supports.map(s => {
          const ini = findInit(s.initiativeId);
          if (!ini) return null;
          return h('a', { href: `/iniciativa/${ini.id}`, 'data-link': '', class: 'ballot-history-row' },
            h('span', { class: 'vote-glyph vote-glyph-favor' }, s.potential ? '~' : '✓'),
            h('div', {},
              h('span', { style: 'font-family:var(--display);font-size:20px' }, ini.title),
              h('div', { class: 'mono', style: 'font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);margin-top:4px' },
                s.potential ? 'apoyo condicional' : 'apoyo firme'),
            ),
            h('span', { class: 'mono', style: 'font-size:11px;color:var(--ink-3)' }, fmt.relTime(s.at)),
          );
        })),
      ),
    ) : null,
  );
}

// ========== /auditoria ==========
function viewAuditoria() {
  return h('main',
    h('section', { class: 'shell hero' },
      h('div', { class: 'hero-kicker' },
        h('span', {}, 'Art. 12.4'),
        h('span', { class: 'dash' }),
        h('span', {}, 'Transparencia radical'),
      ),
      h('h1', { class: 'rise' }, 'Bitácora pública'),
      h('p', { class: 'hero-lede', style: 'max-width:760px;margin-top:20px' },
        'Cada acción del Partido deja huella verificable. Votos, apoyos, sugerencias, delegaciones, cambios de fase, nuevas iniciativas — firmadas, ordenadas, auditables.'),
      h('div', { class: 'hero-stats', style: 'margin-top:40px' },
        stat(state.data.audit.length, 'Eventos', true),
        stat(state.data.ballots.length, 'Ballots'),
        stat(state.data.supports.length, 'Apoyos'),
        stat(state.data.suggestions.length, 'Sugerencias'),
      ),
    ),
    h('section', { class: 'band' },
      h('div', { class: 'shell' }, auditTable(state.data.audit)),
    ),
  );
}

// ========== /carta ==========
function viewCarta() {
  return h('main',
    h('section', { class: 'shell carta' },
      h('p', { class: 'subtitle rise' }, 'Documento fundacional · Inmutable · Artículo 20'),
      h('h1', { class: 'rise rise-1', html: 'Carta de Principios<br><em class="hl">y Estatutos Orgánicos</em>' }),
      h('div', { style: 'text-align:center;font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-2)' },
        'Partido Libertario de Cuba'),

      h('div', { class: 'carta-titulo rise rise-2' },
        h('h2', {},
          h('span', { class: 'roman' }, 'Preámbulo'),
          CARTA.preambulo.heading),
        h('div', { class: 'preambulo' },
          h('p', { class: 'dropcap' }, CARTA.preambulo.body))),

      ...CARTA.titulos.map(t => h('div', { class: 'carta-titulo' },
        h('h2', {},
          h('span', { class: 'roman' }, `Título ${t.roman}`),
          t.name),
        ...t.articulos.map(a => renderArticulo(a)))),

      h('div', { style: 'margin-top:96px;padding:48px 0;border-top:3px double var(--ink);border-bottom:3px double var(--ink);text-align:center' },
        h('p', { style: 'font-family:var(--display);font-style:italic;font-size:26px;line-height:1.4;max-width:640px;margin:0 auto' },
          h('span', { class: 'ornament' }, '☙'),
          ' Todos los afiliados están a cargo. ',
          h('span', { class: 'ornament' }, '❧')),
        h('p', { style: 'margin-top:18px;font-family:var(--mono);font-size:11px;letter-spacing:.24em;text-transform:uppercase' },
          'Este documento es inmutable · Art. 20')),
    ),
  );
}

function renderArticulo(a) {
  return h('div', { class: 'carta-articulo' },
    h('div', { class: 'carta-articulo-num' },
      h('small', {}, 'Art.'),
      String(a.n).padStart(2, '0')),
    h('div', { class: 'carta-articulo-body' },
      h('h4', {}, a.title),
      h('div', { html: a.body }),
      a.live ? renderSidenote(a.live) : null));
}

function renderSidenote(live) {
  if (live.type === 'initiative') {
    // compatible con viejo modelo: buscar issue relacionada
    const iss = state.data.issues.find(i => i.initiatives?.some(x => x.id === live.ref))
             || state.data.issues.find(i => i.article === 12); // fallback
    const ini = findInit(live.ref);
    const target = iss ? `/issue/${iss.id}` : ini ? `/iniciativa/${ini.id}` : null;
    if (!target) return null;
    return h('div', { class: 'sidenote' },
      h('span', { class: 'label' }, 'En proceso en el Ágora'),
      h('a', { href: target, 'data-link': '' }, ini?.title || 'Ver detalle'),
    );
  }
  if (live.type === 'celula') {
    const c = findCel(live.ref);
    if (!c) return null;
    const issues = state.data.issues.filter(i => i.celulaId === c.id);
    return h('div', { class: 'sidenote' },
      h('span', { class: 'label' }, 'Célula activa · ' + c.code),
      h('a', { href: `/celula/${c.slug}`, 'data-link': '' }, c.name),
      h('div', { style: 'margin-top:8px' }, `${issues.length} asunto${issues.length === 1 ? '' : 's'}`),
    );
  }
  if (live.type === 'multi') {
    return h('div', { class: 'sidenote' },
      h('span', { class: 'label' }, 'Iniciativas relacionadas'),
      ...live.refs.map(r => {
        const ini = findInit(r); if (!ini) return null;
        return h('div', {},
          h('a', { href: `/iniciativa/${ini.id}`, 'data-link': '' }, '▸ ', ini.title));
      }));
  }
  return null;
}

// ========== 404 ==========
function viewNotFound() {
  return h('main',
    h('section', { class: 'shell', style: 'padding:120px 0;text-align:center' },
      h('h1', { class: 'big-404' }, '404'),
      h('p', { style: 'font-family:var(--display);font-size:28px;font-style:italic;margin-bottom:24px' }, 'Este registro no existe en la bitácora.'),
      h('a', { href: '/', 'data-link': '', class: 'btn' }, '← Volver al Ágora'),
    ),
  );
}

// ========== Render dispatcher ==========
function render() {
  renderMasthead();
  const view = $('#view');
  view.innerHTML = '';
  const path = stripBase(location.pathname);

  let content;
  if (path === '/' || path === '') content = viewHome();
  else if (path === '/carta') content = viewCarta();
  else if (path === '/celulas') content = viewCelulas();
  else if (path.startsWith('/celula/')) content = viewCelula(path.split('/')[2]);
  else if (path === '/issues' || path === '/iniciativas') content = viewIssues();
  else if (path.startsWith('/issue/')) content = viewIssue(path.split('/')[2]);
  else if (path.startsWith('/iniciativa/')) content = viewIniciativa(path.split('/')[2]);
  else if (path === '/delegaciones') content = viewDelegaciones();
  else if (path.startsWith('/afiliado/')) content = viewAfiliado(path.split('/')[2]);
  else if (path === '/auditoria') content = viewAuditoria();
  else content = viewNotFound();

  view.appendChild(content);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ========== Boot ==========
(async () => {
  // Reescribe anclas estáticas que apuntan a /api/* cuando la API vive en otro dominio.
  if (API_BASE) {
    document.querySelectorAll('a[href^="/api/"]').forEach(a => {
      a.href = API_BASE + a.getAttribute('href');
    });
  }
  try {
    await loadState();
    render();
  } catch (err) {
    console.error(err);
    $('#view').innerHTML = `<div class="shell" style="padding:80px 0"><h1>Error</h1><p>${err.message}</p></div>`;
  }
})();
