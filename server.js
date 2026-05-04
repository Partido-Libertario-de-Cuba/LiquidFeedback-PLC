// LiquidFeedback-PLC — servidor local
// Modelo LF: policies, issues (contenedores), initiatives (competidoras),
// supporters, suggestions, drafts, ballots preferenciales, delegations.
import { createServer } from 'node:http';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { seed } from './seed.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DB_PATH = resolve(__dirname, 'db.json');
const PUBLIC = resolve(__dirname, 'public');
const PORT = Number(process.env.PORT || 4711);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2': 'font/woff2',
  '.png':  'image/png',
};

async function loadDB() {
  try {
    await access(DB_PATH);
    return JSON.parse(await readFile(DB_PATH, 'utf8'));
  } catch {
    const initial = seed();
    await writeFile(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
}

async function saveDB(db) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

function log(db, entry) {
  db.audit.unshift({ id: randomUUID(), at: new Date().toISOString(), ...entry });
  if (db.audit.length > 500) db.audit.length = 500;
}

// ========== DELEGATION ==========
// Prioridad: issue > celula > global.
function resolveDelegate(db, affiliateId, issue, seen = new Set()) {
  if (seen.has(affiliateId)) return null;
  seen.add(affiliateId);
  const d = db.delegations.filter(x => x.from === affiliateId && !x.revokedAt);
  const byIssue  = d.find(x => x.scope === 'issue'  && x.targetId === issue.id);
  const byCelula = d.find(x => x.scope === 'celula' && x.targetId === issue.celulaId);
  const byGlobal = d.find(x => x.scope === 'global');
  const chosen = byIssue || byCelula || byGlobal;
  if (!chosen) return affiliateId;
  return resolveDelegate(db, chosen.to, issue, seen);
}

// ========== PHASE TIMING ==========
function phaseDurationDays(policy, phase) {
  return {
    admission:    policy.admissionDays,
    discussion:   policy.discussionDays,
    verification: policy.verificationDays,
    voting:       policy.votingDays,
    finished:     0,
  }[phase] || 0;
}

function phaseInfo(db, issue) {
  const policy = db.policies.find(p => p.id === issue.policyId);
  const durDays = phaseDurationDays(policy, issue.phase);
  const start = new Date(issue.phaseStartAt).getTime();
  const end = start + durDays * 86400000;
  const now = Date.now();
  const remainingMs = end - now;
  const progress = durDays ? Math.min(1, Math.max(0, (now - start) / (durDays * 86400000))) : 1;
  return {
    policy,
    phaseStartAt: issue.phaseStartAt,
    phaseEndAt: new Date(end).toISOString(),
    remainingMs,
    progress,
    durDays,
  };
}

// ========== SUPPORTERS WITH DELEGATIONS ==========
// Para contar apoyo, resolvemos la cadena: un afiliado X que delegó en Y sobre
// esta issue/celula/global, contribuye su peso al apoyo que Y declare.
function supportersFor(db, initiative) {
  const issue = db.issues.find(i => i.id === initiative.issueId);
  const directSupporters = db.supports.filter(s => s.initiativeId === initiative.id);
  const directMap = new Map(directSupporters.map(s => [s.affiliateId, s]));
  let weight = 0;
  let direct = 0;
  let delegated = 0;
  let potential = 0;
  const weightedBy = {};

  for (const a of db.affiliates) {
    if (directMap.has(a.id)) {
      const s = directMap.get(a.id);
      weight += 1;
      if (s.potential) potential += 1;
      direct += 1;
      weightedBy[a.id] = { self: true, via: [] };
    } else {
      const final = resolveDelegate(db, a.id, issue);
      if (final && final !== a.id && directMap.has(final)) {
        weight += 1;
        delegated += 1;
        if (!weightedBy[final]) weightedBy[final] = { self: directMap.has(final), via: [] };
        weightedBy[final].via.push(a.id);
      }
    }
  }
  return { weight, direct, delegated, potential, weightedBy };
}

// ========== PREFERENTIAL TALLY (Condorcet-simplified) ==========
// Para cada ballot, rank más bajo = más preferido. Status quo implícito a rank 99.
function issueTally(db, issue) {
  const initiatives = db.initiatives.filter(i => i.issueId === issue.id);
  const ballots = db.ballots.filter(b => b.issueId === issue.id);

  // Resolver ballots efectivos incluyendo delegaciones
  const ballotMap = new Map(ballots.map(b => [b.affiliateId, b]));
  const effective = [];
  for (const a of db.affiliates) {
    if (ballotMap.has(a.id)) {
      effective.push({ ...ballotMap.get(a.id), weight: 1, voter: a.id });
    } else {
      const final = resolveDelegate(db, a.id, issue);
      if (final && final !== a.id && ballotMap.has(final)) {
        effective.push({ ...ballotMap.get(final), weight: 1, voter: a.id, via: final });
      }
    }
  }

  // Contar pairwise
  const ids = initiatives.map(i => i.id);
  const pairwise = {};   // pairwise[A][B] = # que prefieren A sobre B
  const firstPlace = {};
  const approvalCount = {}; // # aprobados (rank <= 98)
  const rejectedCount = {}; // # desaprobados (rank > status quo = 99)
  for (const id of ids) {
    pairwise[id] = {};
    firstPlace[id] = 0;
    approvalCount[id] = 0;
    rejectedCount[id] = 0;
    for (const other of ids) pairwise[id][other] = 0;
  }

  for (const b of effective) {
    // Completar rank faltante con 100 (menos preferido que SQ)
    const ranks = {};
    for (const id of ids) ranks[id] = b.rankings[id] ?? 100;
    // Primer lugar
    const best = ids.slice().sort((a, c) => ranks[a] - ranks[c])[0];
    if (ranks[best] <= 99) firstPlace[best] += b.weight;
    // Approval
    for (const id of ids) {
      if (ranks[id] <= 99) approvalCount[id] += b.weight;
      else rejectedCount[id] += b.weight;
    }
    // Pairwise
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (i === j) continue;
        const A = ids[i], B = ids[j];
        if (ranks[A] < ranks[B]) pairwise[A][B] += b.weight;
      }
    }
  }

  // Determinar ganador: Condorcet (una iniciativa que gana todos los pairwise)
  // Si no, fallback a más approvals.
  let winner = null;
  for (const A of ids) {
    let wins = true;
    for (const B of ids) {
      if (A === B) continue;
      if (pairwise[A][B] <= pairwise[B][A]) { wins = false; break; }
    }
    if (wins) { winner = A; break; }
  }
  if (!winner && ids.length) {
    winner = ids.slice().sort((a, b) => approvalCount[b] - approvalCount[a])[0] || null;
  }

  return {
    ids,
    pairwise,
    firstPlace,
    approvalCount,
    rejectedCount,
    ballotsCast: effective.length,
    ballotsDirect: ballots.length,
    winner,
  };
}

// ========== SUGGESTION RATING ==========
function suggestionStats(s, totalAffiliates) {
  const plus = s.plusRaters?.length || 0;
  const minus = s.minusRaters?.length || 0;
  return { plus, minus, net: plus - minus, total: plus + minus, pct: plus + minus ? plus / (plus + minus) : 0 };
}

// ========== HTTP UTILITIES ==========
// CORS abierto: la PoC sirve la SPA tanto desde el propio backend como desde
// GitHub Pages en otro dominio. No hay cookies ni auth basada en sesión, así
// que `*` es seguro. Cuando se restrinja origen, fijar al dominio de Pages.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

function sendJSON(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return {}; }
}

async function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  // Todas las rutas cliente que no son assets → index.html
  const ext = extname(pathname);
  if (!ext) pathname = '/index.html';
  const filePath = join(PUBLIC, pathname);
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    await access(filePath);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}

// ========== SERVER ==========
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;

  if (!path.startsWith('/api/')) return serveStatic(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  const db = await loadDB();

  try {
    if (req.method === 'GET' && path === '/api/state') {
      const totalAff = db.affiliates.length;
      // Expandir issues con datos computados
      const issues = db.issues.map(issue => {
        const inits = db.initiatives.filter(i => i.issueId === issue.id);
        const enrichedInits = inits.map(ini => {
          const s = supportersFor(db, ini);
          const sugs = db.suggestions.filter(x => x.initiativeId === ini.id);
          return {
            ...ini,
            support: s,
            suggestionCount: sugs.length,
            draftsCount: db.drafts.filter(d => d.initiativeId === ini.id).length,
          };
        });
        const pinfo = phaseInfo(db, issue);
        const tally = (issue.phase === 'voting' || issue.phase === 'finished')
          ? issueTally(db, issue)
          : null;
        return {
          ...issue,
          ...pinfo,
          initiatives: enrichedInits,
          tally,
        };
      });

      return sendJSON(res, 200, {
        meta: db.meta,
        unit: db.unit,
        policies: db.policies,
        celulas: db.celulas,
        affiliates: db.affiliates,
        issues,
        initiatives: db.initiatives,
        drafts: db.drafts,
        suggestions: db.suggestions.map(s => ({ ...s, stats: suggestionStats(s, totalAff) })),
        supports: db.supports,
        ballots: db.ballots,
        delegations: db.delegations.filter(d => !d.revokedAt),
        audit: db.audit.slice(0, 60),
      });
    }

    // ---- Apoyar (support) ----
    if (req.method === 'POST' && path === '/api/support') {
      const { affiliateId, initiativeId, potential } = await readBody(req);
      if (!affiliateId || !initiativeId) return sendJSON(res, 400, { error: 'faltan campos' });
      const aff = db.affiliates.find(a => a.id === affiliateId);
      const ini = db.initiatives.find(i => i.id === initiativeId);
      if (!aff || !ini) return sendJSON(res, 404, { error: 'no encontrado' });
      const issue = db.issues.find(x => x.id === ini.issueId);
      if (!['admission', 'discussion', 'verification'].includes(issue.phase))
        return sendJSON(res, 409, { error: 'fase no permite apoyo directo' });
      db.supports = db.supports.filter(s => !(s.affiliateId === affiliateId && s.initiativeId === initiativeId));
      db.supports.push({ affiliateId, initiativeId, at: new Date().toISOString(), potential: !!potential });
      log(db, { kind: 'apoyo', actor: affiliateId, target: initiativeId, meta: { potential: !!potential } });
      await saveDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/api/unsupport') {
      const { affiliateId, initiativeId } = await readBody(req);
      if (!affiliateId || !initiativeId) return sendJSON(res, 400, { error: 'faltan campos' });
      db.supports = db.supports.filter(s => !(s.affiliateId === affiliateId && s.initiativeId === initiativeId));
      log(db, { kind: 'retirar_apoyo', actor: affiliateId, target: initiativeId, meta: {} });
      await saveDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Votar preferencialmente ----
    if (req.method === 'POST' && path === '/api/vote') {
      const { affiliateId, issueId, rankings } = await readBody(req);
      if (!affiliateId || !issueId || typeof rankings !== 'object')
        return sendJSON(res, 400, { error: 'payload inválido' });
      const issue = db.issues.find(i => i.id === issueId);
      if (!issue) return sendJSON(res, 404, { error: 'issue no encontrada' });
      if (issue.phase !== 'voting')
        return sendJSON(res, 409, { error: 'la issue no está en fase de votación' });
      // Validar que las iniciativas referenciadas existan en la issue
      const validIds = db.initiatives.filter(i => i.issueId === issueId).map(i => i.id);
      const filteredRanks = {};
      for (const [k, v] of Object.entries(rankings)) {
        if (validIds.includes(k) && Number.isFinite(Number(v))) filteredRanks[k] = Number(v);
      }
      db.ballots = db.ballots.filter(b => !(b.affiliateId === affiliateId && b.issueId === issueId));
      db.ballots.push({ affiliateId, issueId, rankings: filteredRanks, at: new Date().toISOString() });
      log(db, { kind: 'voto', actor: affiliateId, target: issueId, meta: {} });
      await saveDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Suggestion ----
    if (req.method === 'POST' && path === '/api/suggestion') {
      const { initiativeId, authorId, directive, content } = await readBody(req);
      if (!initiativeId || !authorId || !directive || !content)
        return sendJSON(res, 400, { error: 'faltan campos' });
      if (!['must', 'should', 'must_not', 'should_not'].includes(directive))
        return sendJSON(res, 400, { error: 'directiva inválida' });
      const id = 'sug_' + randomUUID().slice(0, 8);
      db.suggestions.push({ id, initiativeId, authorId, directive, content, createdAt: new Date().toISOString(), plusRaters: [], minusRaters: [] });
      log(db, { kind: 'sugerencia', actor: authorId, target: initiativeId, meta: { directive } });
      await saveDB(db);
      return sendJSON(res, 200, { ok: true, id });
    }

    if (req.method === 'POST' && path === '/api/suggestion/rate') {
      const { suggestionId, affiliateId, rating } = await readBody(req);
      if (!['plus', 'minus', 'clear'].includes(rating))
        return sendJSON(res, 400, { error: 'rating inválido' });
      const s = db.suggestions.find(x => x.id === suggestionId);
      if (!s) return sendJSON(res, 404, { error: 'no encontrada' });
      s.plusRaters = (s.plusRaters || []).filter(x => x !== affiliateId);
      s.minusRaters = (s.minusRaters || []).filter(x => x !== affiliateId);
      if (rating === 'plus') s.plusRaters.push(affiliateId);
      if (rating === 'minus') s.minusRaters.push(affiliateId);
      await saveDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Delegation ----
    if (req.method === 'POST' && path === '/api/delegate') {
      const { from, to, scope, targetId } = await readBody(req);
      if (!from || !to || from === to) return sendJSON(res, 400, { error: 'delegación inválida' });
      if (!['global', 'celula', 'issue'].includes(scope)) return sendJSON(res, 400, { error: 'scope inválido' });
      for (const d of db.delegations) {
        if (d.from === from && d.scope === scope && d.targetId === (targetId || null) && !d.revokedAt)
          d.revokedAt = new Date().toISOString();
      }
      db.delegations.push({
        id: randomUUID(), from, to, scope, targetId: targetId || null,
        createdAt: new Date().toISOString(), revokedAt: null,
      });
      log(db, { kind: 'delegacion', actor: from, target: to, meta: { scope, targetId } });
      await saveDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/api/revoke') {
      const { delegationId, from } = await readBody(req);
      const d = db.delegations.find(x => x.id === delegationId && x.from === from && !x.revokedAt);
      if (!d) return sendJSON(res, 404, { error: 'no encontrada' });
      d.revokedAt = new Date().toISOString();
      log(db, { kind: 'revocacion', actor: from, target: d.to, meta: { scope: d.scope, targetId: d.targetId } });
      await saveDB(db);
      return sendJSON(res, 200, { ok: true });
    }

    // ---- New issue ----
    if (req.method === 'POST' && path === '/api/issue') {
      const { title, celulaId, policyId, article, description, authorId, initiativeTitle, initiativeSummary } = await readBody(req);
      if (!title || !celulaId || !policyId || !authorId || !initiativeTitle)
        return sendJSON(res, 400, { error: 'faltan campos' });
      const issueId = 'iss_' + randomUUID().slice(0, 8);
      const initId  = 'ini_' + randomUUID().slice(0, 8);
      const now = new Date().toISOString();
      db.issues.push({
        id: issueId, title, celulaId, policyId, article: article || null,
        phase: 'admission', phaseStartAt: now, createdAt: now,
        description: description || '',
      });
      db.initiatives.push({
        id: initId, issueId, authorId, title: initiativeTitle,
        summary: initiativeSummary || '', createdAt: now,
      });
      db.drafts.push({ id: randomUUID(), initiativeId: initId, version: 1, authorId, createdAt: now, content: initiativeSummary || '' });
      db.supports.push({ affiliateId: authorId, initiativeId: initId, at: now, potential: false });
      log(db, { kind: 'issue_nueva', actor: authorId, target: issueId, meta: { title } });
      await saveDB(db);
      return sendJSON(res, 200, { ok: true, issueId, initiativeId: initId });
    }

    // ---- New initiative on existing issue ----
    if (req.method === 'POST' && path === '/api/initiative') {
      const { issueId, authorId, title, summary } = await readBody(req);
      if (!issueId || !authorId || !title) return sendJSON(res, 400, { error: 'faltan campos' });
      const issue = db.issues.find(i => i.id === issueId);
      if (!issue) return sendJSON(res, 404, { error: 'issue no encontrada' });
      if (!['admission', 'discussion'].includes(issue.phase))
        return sendJSON(res, 409, { error: 'fase no permite nuevas iniciativas' });
      const id = 'ini_' + randomUUID().slice(0, 8);
      const now = new Date().toISOString();
      db.initiatives.push({ id, issueId, authorId, title, summary: summary || '', createdAt: now });
      db.drafts.push({ id: randomUUID(), initiativeId: id, version: 1, authorId, createdAt: now, content: summary || '' });
      db.supports.push({ affiliateId: authorId, initiativeId: id, at: now, potential: false });
      log(db, { kind: 'iniciativa_nueva', actor: authorId, target: id, meta: { title, issueId } });
      await saveDB(db);
      return sendJSON(res, 200, { ok: true, id });
    }

    if (req.method === 'POST' && path === '/api/reset') {
      const fresh = seed();
      await writeFile(DB_PATH, JSON.stringify(fresh, null, 2));
      return sendJSON(res, 200, { ok: true });
    }

    return sendJSON(res, 404, { error: 'ruta desconocida' });
  } catch (err) {
    console.error(err);
    return sendJSON(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`\n  PLC · Ágora Digital`);
  console.log(`  http://localhost:${PORT}\n`);
});
