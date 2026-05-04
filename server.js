// LiquidFeedback-PLC — servidor
// Persistencia: SQLite (db.js). Lógica LF (delegation, tally Condorcet, fases)
// opera sobre snapshots in-memory; las mutaciones van directo a SQL transaccional.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './db.js';
import { seed } from './seed.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
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

// Bootstrap: si la DB está vacía, sembrar.
store.loadSeed(seed());

// CORS abierto: la PoC sirve la SPA tanto desde el propio backend como desde
// GitHub Pages en otro dominio. No hay cookies ni auth basada en sesión, así
// que `*` es seguro. Cuando se restrinja origen, fijar al dominio de Pages.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

// ========== DELEGATION ==========
// Prioridad: issue > celula > global.
function resolveDelegate(snap, affiliateId, issue, seen = new Set()) {
  if (seen.has(affiliateId)) return null;
  seen.add(affiliateId);
  const d = snap.delegations.filter(x => x.from === affiliateId && !x.revokedAt);
  const byIssue  = d.find(x => x.scope === 'issue'  && x.targetId === issue.id);
  const byCelula = d.find(x => x.scope === 'celula' && x.targetId === issue.celulaId);
  const byGlobal = d.find(x => x.scope === 'global');
  const chosen = byIssue || byCelula || byGlobal;
  if (!chosen) return affiliateId;
  return resolveDelegate(snap, chosen.to, issue, seen);
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

function phaseInfo(snap, issue) {
  const policy = snap.policies.find(p => p.id === issue.policyId);
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
function supportersFor(snap, initiative) {
  const issue = snap.issues.find(i => i.id === initiative.issueId);
  const directSupporters = snap.supports.filter(s => s.initiativeId === initiative.id);
  const directMap = new Map(directSupporters.map(s => [s.affiliateId, s]));
  let weight = 0, direct = 0, delegated = 0, potential = 0;
  const weightedBy = {};

  for (const a of snap.affiliates) {
    if (directMap.has(a.id)) {
      const s = directMap.get(a.id);
      weight += 1;
      if (s.potential) potential += 1;
      direct += 1;
      weightedBy[a.id] = { self: true, via: [] };
    } else {
      const final = resolveDelegate(snap, a.id, issue);
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
function issueTally(snap, issue) {
  const initiatives = snap.initiatives.filter(i => i.issueId === issue.id);
  const ballots = snap.ballots.filter(b => b.issueId === issue.id);

  const ballotMap = new Map(ballots.map(b => [b.affiliateId, b]));
  const effective = [];
  for (const a of snap.affiliates) {
    if (ballotMap.has(a.id)) {
      effective.push({ ...ballotMap.get(a.id), weight: 1, voter: a.id });
    } else {
      const final = resolveDelegate(snap, a.id, issue);
      if (final && final !== a.id && ballotMap.has(final)) {
        effective.push({ ...ballotMap.get(final), weight: 1, voter: a.id, via: final });
      }
    }
  }

  const ids = initiatives.map(i => i.id);
  const pairwise = {};
  const firstPlace = {};
  const approvalCount = {};
  const rejectedCount = {};
  for (const id of ids) {
    pairwise[id] = {};
    firstPlace[id] = 0;
    approvalCount[id] = 0;
    rejectedCount[id] = 0;
    for (const other of ids) pairwise[id][other] = 0;
  }

  for (const b of effective) {
    const ranks = {};
    for (const id of ids) ranks[id] = b.rankings[id] ?? 100;
    const best = ids.slice().sort((a, c) => ranks[a] - ranks[c])[0];
    if (best != null && ranks[best] <= 99) firstPlace[best] += b.weight;
    for (const id of ids) {
      if (ranks[id] <= 99) approvalCount[id] += b.weight;
      else rejectedCount[id] += b.weight;
    }
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (i === j) continue;
        const A = ids[i], B = ids[j];
        if (ranks[A] < ranks[B]) pairwise[A][B] += b.weight;
      }
    }
  }

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
    ids, pairwise, firstPlace, approvalCount, rejectedCount,
    ballotsCast: effective.length, ballotsDirect: ballots.length, winner,
  };
}

// ========== SUGGESTION RATING ==========
function suggestionStats(s) {
  const plus = s.plusRaters?.length || 0;
  const minus = s.minusRaters?.length || 0;
  return { plus, minus, net: plus - minus, total: plus + minus, pct: plus + minus ? plus / (plus + minus) : 0 };
}

// ========== SNAPSHOT ==========
// Lectura única para componer /api/state. Las mutaciones NO la usan: hacen
// queries puntuales y van directo a SQL.
function snapshot() {
  return {
    affiliates:  store.getAffiliates(),
    policies:    store.getPolicies(),
    celulas:     store.getCelulas(),
    issues:      store.getIssues(),
    initiatives: store.getInitiatives(),
    drafts:      store.getDrafts(),
    suggestions: store.getSuggestions(),
    supports:    store.getSupports(),
    ballots:     store.getBallots(),
    delegations: store.getDelegations(),
  };
}

// ========== HTTP UTILITIES ==========
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

  try {
    if (req.method === 'GET' && path === '/api/state') {
      const snap = snapshot();
      const issues = snap.issues.map(issue => {
        const inits = snap.initiatives.filter(i => i.issueId === issue.id);
        const enrichedInits = inits.map(ini => {
          const s = supportersFor(snap, ini);
          const sugs = snap.suggestions.filter(x => x.initiativeId === ini.id);
          return {
            ...ini,
            support: s,
            suggestionCount: sugs.length,
            draftsCount: snap.drafts.filter(d => d.initiativeId === ini.id).length,
          };
        });
        const pinfo = phaseInfo(snap, issue);
        const tally = (issue.phase === 'voting' || issue.phase === 'finished')
          ? issueTally(snap, issue) : null;
        return { ...issue, ...pinfo, initiatives: enrichedInits, tally };
      });

      return sendJSON(res, 200, {
        meta:        store.getMeta(),
        unit:        store.getUnit(),
        policies:    snap.policies,
        celulas:     snap.celulas,
        affiliates:  snap.affiliates,
        issues,
        initiatives: snap.initiatives,
        drafts:      snap.drafts,
        suggestions: snap.suggestions.map(s => ({ ...s, stats: suggestionStats(s) })),
        supports:    snap.supports,
        ballots:     snap.ballots,
        delegations: snap.delegations.filter(d => !d.revokedAt),
        audit:       store.getAudit(60),
      });
    }

    // ---- Apoyar (support) ----
    if (req.method === 'POST' && path === '/api/support') {
      const { affiliateId, initiativeId, potential } = await readBody(req);
      if (!affiliateId || !initiativeId) return sendJSON(res, 400, { error: 'faltan campos' });
      const aff = store.getAffiliateById(affiliateId);
      const ini = store.getInitiativeById(initiativeId);
      if (!aff || !ini) return sendJSON(res, 404, { error: 'no encontrado' });
      const issue = store.getIssueById(ini.issueId);
      if (!['admission', 'discussion', 'verification'].includes(issue.phase))
        return sendJSON(res, 409, { error: 'fase no permite apoyo directo' });
      store.setSupport({ affiliateId, initiativeId, potential: !!potential });
      store.logEvent({ kind: 'apoyo', actor: affiliateId, target: initiativeId, meta: { potential: !!potential } });
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/api/unsupport') {
      const { affiliateId, initiativeId } = await readBody(req);
      if (!affiliateId || !initiativeId) return sendJSON(res, 400, { error: 'faltan campos' });
      store.removeSupport({ affiliateId, initiativeId });
      store.logEvent({ kind: 'retirar_apoyo', actor: affiliateId, target: initiativeId, meta: {} });
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Votar preferencialmente ----
    if (req.method === 'POST' && path === '/api/vote') {
      const { affiliateId, issueId, rankings } = await readBody(req);
      if (!affiliateId || !issueId || typeof rankings !== 'object')
        return sendJSON(res, 400, { error: 'payload inválido' });
      const issue = store.getIssueById(issueId);
      if (!issue) return sendJSON(res, 404, { error: 'issue no encontrada' });
      if (issue.phase !== 'voting')
        return sendJSON(res, 409, { error: 'la issue no está en fase de votación' });
      const validIds = new Set(store.getInitiativeIdsByIssue(issueId));
      const filteredRanks = {};
      for (const [k, v] of Object.entries(rankings)) {
        if (validIds.has(k) && Number.isFinite(Number(v))) filteredRanks[k] = Number(v);
      }
      store.setBallot({ affiliateId, issueId, rankings: filteredRanks });
      store.logEvent({ kind: 'voto', actor: affiliateId, target: issueId, meta: {} });
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Suggestion ----
    if (req.method === 'POST' && path === '/api/suggestion') {
      const { initiativeId, authorId, directive, content } = await readBody(req);
      if (!initiativeId || !authorId || !directive || !content)
        return sendJSON(res, 400, { error: 'faltan campos' });
      if (!['must', 'should', 'must_not', 'should_not'].includes(directive))
        return sendJSON(res, 400, { error: 'directiva inválida' });
      const id = store.addSuggestion({ initiativeId, authorId, directive, content });
      store.logEvent({ kind: 'sugerencia', actor: authorId, target: initiativeId, meta: { directive } });
      return sendJSON(res, 200, { ok: true, id });
    }

    if (req.method === 'POST' && path === '/api/suggestion/rate') {
      const { suggestionId, affiliateId, rating } = await readBody(req);
      if (!['plus', 'minus', 'clear'].includes(rating))
        return sendJSON(res, 400, { error: 'rating inválido' });
      if (!store.suggestionExists(suggestionId))
        return sendJSON(res, 404, { error: 'no encontrada' });
      store.rateSuggestion({ suggestionId, affiliateId, rating });
      return sendJSON(res, 200, { ok: true });
    }

    // ---- Delegation ----
    if (req.method === 'POST' && path === '/api/delegate') {
      const { from, to, scope, targetId } = await readBody(req);
      if (!from || !to || from === to) return sendJSON(res, 400, { error: 'delegación inválida' });
      if (!['global', 'celula', 'issue'].includes(scope)) return sendJSON(res, 400, { error: 'scope inválido' });
      store.addDelegation({ from, to, scope, targetId: targetId || null });
      store.logEvent({ kind: 'delegacion', actor: from, target: to, meta: { scope, targetId } });
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/api/revoke') {
      const { delegationId, from } = await readBody(req);
      const ok = store.revokeDelegation({ delegationId, from });
      if (!ok) return sendJSON(res, 404, { error: 'no encontrada' });
      store.logEvent({ kind: 'revocacion', actor: from, target: delegationId, meta: {} });
      return sendJSON(res, 200, { ok: true });
    }

    // ---- New issue ----
    if (req.method === 'POST' && path === '/api/issue') {
      const { title, celulaId, policyId, article, description, authorId, initiativeTitle, initiativeSummary } = await readBody(req);
      if (!title || !celulaId || !policyId || !authorId || !initiativeTitle)
        return sendJSON(res, 400, { error: 'faltan campos' });
      const { issueId, initiativeId } = store.createIssue({
        title, celulaId, policyId, article, description, authorId, initiativeTitle, initiativeSummary,
      });
      store.logEvent({ kind: 'issue_nueva', actor: authorId, target: issueId, meta: { title } });
      return sendJSON(res, 200, { ok: true, issueId, initiativeId });
    }

    // ---- New initiative on existing issue ----
    if (req.method === 'POST' && path === '/api/initiative') {
      const { issueId, authorId, title, summary } = await readBody(req);
      if (!issueId || !authorId || !title) return sendJSON(res, 400, { error: 'faltan campos' });
      const issue = store.getIssueById(issueId);
      if (!issue) return sendJSON(res, 404, { error: 'issue no encontrada' });
      if (!['admission', 'discussion'].includes(issue.phase))
        return sendJSON(res, 409, { error: 'fase no permite nuevas iniciativas' });
      const id = store.addInitiative({ issueId, authorId, title, summary });
      store.logEvent({ kind: 'iniciativa_nueva', actor: authorId, target: id, meta: { title, issueId } });
      return sendJSON(res, 200, { ok: true, id });
    }

    if (req.method === 'POST' && path === '/api/reset') {
      store.reset();
      store.loadSeed(seed());
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
