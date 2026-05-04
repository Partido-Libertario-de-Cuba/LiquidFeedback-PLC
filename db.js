// LiquidFeedback-PLC — capa SQLite. Frontera entre snake_case (SQL) y
// camelCase (API/JSON). Las funciones devuelven exactamente las formas
// que server.js compone en /api/state, sin que server.js sepa de SQL.
//
// Requiere Node 22+ (node:sqlite es estable en 22.5/23+; en 22.x emite
// ExperimentalWarning inocua). Suprimida con --no-warnings en npm start.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || resolve(__dirname, 'db.sqlite');
const SCHEMA  = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');
db.exec(SCHEMA);

// ========== HELPERS ==========
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const cam = (row) => {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
};
const cams = (rows) => rows.map(cam);
const parseJSON = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

export function transaction(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

export function isEmpty() {
  return db.prepare('SELECT COUNT(*) AS n FROM affiliates').get().n === 0;
}

const nowIso = () => new Date().toISOString();

// ========== READS ==========
export function getMeta() {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM meta').all()) {
    out[r.key] = parseJSON(r.value);
  }
  return out;
}

export function getUnit() {
  return cam(db.prepare('SELECT * FROM unit LIMIT 1').get());
}

export function getPolicies() {
  return cams(db.prepare('SELECT * FROM policies ORDER BY rowid').all());
}

export function getCelulas() {
  return cams(db.prepare('SELECT * FROM celulas ORDER BY rowid').all());
}

export function getAffiliates() {
  return cams(db.prepare('SELECT * FROM affiliates ORDER BY joined').all());
}

export function getIssues() {
  return cams(db.prepare('SELECT * FROM issues ORDER BY created_at DESC').all());
}

export function getInitiatives() {
  return cams(db.prepare('SELECT * FROM initiatives ORDER BY created_at').all());
}

export function getDrafts() {
  return cams(db.prepare('SELECT * FROM drafts ORDER BY created_at').all());
}

export function getSuggestions() {
  // plus_raters/minus_raters como arrays vía JSON aggregation
  const rows = db.prepare(`
    SELECT s.*,
      (SELECT json_group_array(affiliate_id) FROM suggestion_ratings WHERE suggestion_id = s.id AND sign = 'plus')  AS plus_raters,
      (SELECT json_group_array(affiliate_id) FROM suggestion_ratings WHERE suggestion_id = s.id AND sign = 'minus') AS minus_raters
    FROM suggestions s
    ORDER BY s.created_at
  `).all();
  return rows.map(r => ({
    id: r.id, initiativeId: r.initiative_id, authorId: r.author_id,
    directive: r.directive, content: r.content, createdAt: r.created_at,
    plusRaters:  parseJSON(r.plus_raters)  || [],
    minusRaters: parseJSON(r.minus_raters) || [],
  }));
}

export function getSupports() {
  return db.prepare('SELECT * FROM supports').all().map(r => ({
    affiliateId: r.affiliate_id, initiativeId: r.initiative_id,
    at: r.at, potential: !!r.potential,
  }));
}

export function getBallots() {
  const ballots = db.prepare('SELECT affiliate_id, issue_id, at FROM ballots').all();
  const ranks   = db.prepare('SELECT affiliate_id, issue_id, initiative_id, rank FROM ballot_rankings').all();
  const map = new Map();
  for (const b of ballots) {
    map.set(b.affiliate_id + '|' + b.issue_id, {
      affiliateId: b.affiliate_id, issueId: b.issue_id, at: b.at, rankings: {},
    });
  }
  for (const r of ranks) {
    const e = map.get(r.affiliate_id + '|' + r.issue_id);
    if (e) e.rankings[r.initiative_id] = r.rank;
  }
  return [...map.values()];
}

export function getDelegations({ activeOnly = false } = {}) {
  const sql = activeOnly
    ? 'SELECT * FROM delegations WHERE revoked_at IS NULL'
    : 'SELECT * FROM delegations';
  return db.prepare(sql).all().map(d => ({
    id: d.id, from: d.from_id, to: d.to_id, scope: d.scope,
    targetId: d.target_id, createdAt: d.created_at, revokedAt: d.revoked_at,
  }));
}

export function getAudit(limit = 60) {
  return db.prepare('SELECT * FROM audit ORDER BY at DESC LIMIT ?').all(limit).map(r => ({
    id: r.id, at: r.at, kind: r.kind, actor: r.actor, target: r.target,
    meta: parseJSON(r.meta) || {},
  }));
}

// ========== WRITES ==========
export function logEvent({ kind, actor, target, meta }) {
  db.prepare('INSERT INTO audit (id, at, kind, actor, target, meta) VALUES (?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), nowIso(), kind, actor || null, target || null, JSON.stringify(meta || {}));
}

export function setSupport({ affiliateId, initiativeId, potential }) {
  db.prepare(`
    INSERT INTO supports (affiliate_id, initiative_id, at, potential) VALUES (?, ?, ?, ?)
    ON CONFLICT (affiliate_id, initiative_id) DO UPDATE SET at = excluded.at, potential = excluded.potential
  `).run(affiliateId, initiativeId, nowIso(), potential ? 1 : 0);
}

export function removeSupport({ affiliateId, initiativeId }) {
  db.prepare('DELETE FROM supports WHERE affiliate_id = ? AND initiative_id = ?')
    .run(affiliateId, initiativeId);
}

export function setBallot({ affiliateId, issueId, rankings }) {
  return transaction(() => {
    db.prepare(`
      INSERT INTO ballots (affiliate_id, issue_id, at) VALUES (?, ?, ?)
      ON CONFLICT (affiliate_id, issue_id) DO UPDATE SET at = excluded.at
    `).run(affiliateId, issueId, nowIso());
    db.prepare('DELETE FROM ballot_rankings WHERE affiliate_id = ? AND issue_id = ?')
      .run(affiliateId, issueId);
    const ins = db.prepare('INSERT INTO ballot_rankings (affiliate_id, issue_id, initiative_id, rank) VALUES (?, ?, ?, ?)');
    for (const [iniId, rank] of Object.entries(rankings)) {
      const n = Number(rank);
      if (Number.isFinite(n)) ins.run(affiliateId, issueId, iniId, n);
    }
  });
}

export function addSuggestion({ initiativeId, authorId, directive, content }) {
  const id = 'sug_' + randomUUID().slice(0, 8);
  db.prepare('INSERT INTO suggestions (id, initiative_id, author_id, directive, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, initiativeId, authorId, directive, content, nowIso());
  return id;
}

export function rateSuggestion({ suggestionId, affiliateId, rating }) {
  return transaction(() => {
    db.prepare('DELETE FROM suggestion_ratings WHERE suggestion_id = ? AND affiliate_id = ?')
      .run(suggestionId, affiliateId);
    if (rating === 'plus' || rating === 'minus') {
      db.prepare('INSERT INTO suggestion_ratings (suggestion_id, affiliate_id, sign) VALUES (?, ?, ?)')
        .run(suggestionId, affiliateId, rating);
    }
  });
}

export function suggestionExists(id) {
  return !!db.prepare('SELECT 1 FROM suggestions WHERE id = ?').get(id);
}

export function addDelegation({ from, to, scope, targetId }) {
  const id = randomUUID();
  const now = nowIso();
  return transaction(() => {
    // Revocar activas en mismo (from, scope, targetId).
    db.prepare(`
      UPDATE delegations SET revoked_at = ?
      WHERE from_id = ? AND scope = ?
        AND ((target_id IS NULL AND ? IS NULL) OR target_id = ?)
        AND revoked_at IS NULL
    `).run(now, from, scope, targetId, targetId);
    db.prepare('INSERT INTO delegations (id, from_id, to_id, scope, target_id, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)')
      .run(id, from, to, scope, targetId, now);
    return id;
  });
}

export function revokeDelegation({ delegationId, from }) {
  const r = db.prepare('UPDATE delegations SET revoked_at = ? WHERE id = ? AND from_id = ? AND revoked_at IS NULL')
    .run(nowIso(), delegationId, from);
  return r.changes > 0;
}

export function createIssue({ title, celulaId, policyId, article, description, authorId, initiativeTitle, initiativeSummary }) {
  const issueId = 'iss_' + randomUUID().slice(0, 8);
  const initId  = 'ini_' + randomUUID().slice(0, 8);
  const now = nowIso();
  return transaction(() => {
    db.prepare(`INSERT INTO issues (id, title, celula_id, policy_id, article, phase, phase_start_at, created_at, description)
                VALUES (?, ?, ?, ?, ?, 'admission', ?, ?, ?)`)
      .run(issueId, title, celulaId, policyId, article || null, now, now, description || '');
    db.prepare('INSERT INTO initiatives (id, issue_id, author_id, title, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(initId, issueId, authorId, initiativeTitle, initiativeSummary || '', now);
    db.prepare('INSERT INTO drafts (id, initiative_id, version, author_id, created_at, content) VALUES (?, ?, 1, ?, ?, ?)')
      .run(randomUUID(), initId, authorId, now, initiativeSummary || '');
    db.prepare('INSERT INTO supports (affiliate_id, initiative_id, at, potential) VALUES (?, ?, ?, 0)')
      .run(authorId, initId, now);
    return { issueId, initiativeId: initId };
  });
}

export function addInitiative({ issueId, authorId, title, summary }) {
  const id  = 'ini_' + randomUUID().slice(0, 8);
  const now = nowIso();
  return transaction(() => {
    db.prepare('INSERT INTO initiatives (id, issue_id, author_id, title, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, issueId, authorId, title, summary || '', now);
    db.prepare('INSERT INTO drafts (id, initiative_id, version, author_id, created_at, content) VALUES (?, ?, 1, ?, ?, ?)')
      .run(randomUUID(), id, authorId, now, summary || '');
    db.prepare('INSERT INTO supports (affiliate_id, initiative_id, at, potential) VALUES (?, ?, ?, 0)')
      .run(authorId, id, now);
    return id;
  });
}

export function reset() {
  // Purgar y dejar la base lista para reseed.
  const tables = [
    'ballot_rankings', 'ballots', 'supports', 'suggestion_ratings', 'suggestions',
    'drafts', 'initiatives', 'issues', 'delegations', 'audit',
    'affiliates', 'celulas', 'policies', 'unit', 'meta',
  ];
  return transaction(() => {
    for (const t of tables) db.exec(`DELETE FROM ${t}`);
  });
}

export function loadSeed(seed) {
  if (!isEmpty()) return false;
  return transaction(() => {
    const insMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(seed.meta)) insMeta.run(k, JSON.stringify(v));

    db.prepare('INSERT INTO unit (id, name, acronym, founded_at) VALUES (?, ?, ?, ?)')
      .run(seed.unit.id, seed.unit.name, seed.unit.acronym, seed.unit.foundedAt);

    const insPol = db.prepare(`INSERT INTO policies (id, name, description, admission_days, discussion_days, verification_days, voting_days, issue_quorum, initiative_quorum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const p of seed.policies) {
      insPol.run(p.id, p.name, p.description, p.admissionDays, p.discussionDays, p.verificationDays, p.votingDays, p.issueQuorum, p.initiativeQuorum);
    }

    const insCel = db.prepare('INSERT INTO celulas (id, slug, code, name, article, purpose) VALUES (?, ?, ?, ?, ?, ?)');
    for (const c of seed.celulas) {
      insCel.run(c.id, c.slug, c.code, c.name, c.article ?? null, c.purpose);
    }

    const insAff = db.prepare('INSERT INTO affiliates (id, handle, name, joined, city, bio) VALUES (?, ?, ?, ?, ?, ?)');
    for (const a of seed.affiliates) {
      insAff.run(a.id, a.handle, a.name, a.joined, a.city, a.bio);
    }

    const insIss = db.prepare(`INSERT INTO issues (id, title, celula_id, policy_id, article, phase, phase_start_at, created_at, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const i of seed.issues) {
      insIss.run(i.id, i.title, i.celulaId, i.policyId, i.article ?? null, i.phase, i.phaseStartAt, i.createdAt, i.description);
    }

    const insIni = db.prepare('INSERT INTO initiatives (id, issue_id, author_id, title, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const i of seed.initiatives) {
      insIni.run(i.id, i.issueId, i.authorId, i.title, i.summary, i.createdAt);
    }

    const insDraft = db.prepare('INSERT INTO drafts (id, initiative_id, version, author_id, created_at, content) VALUES (?, ?, ?, ?, ?, ?)');
    for (const d of seed.drafts) {
      insDraft.run(d.id, d.initiativeId, d.version, d.authorId, d.createdAt, d.content);
    }

    const insSug  = db.prepare('INSERT INTO suggestions (id, initiative_id, author_id, directive, content, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const insRate = db.prepare('INSERT INTO suggestion_ratings (suggestion_id, affiliate_id, sign) VALUES (?, ?, ?)');
    for (const s of seed.suggestions) {
      insSug.run(s.id, s.initiativeId, s.authorId, s.directive, s.content, s.createdAt);
      for (const af of (s.plusRaters  || [])) insRate.run(s.id, af, 'plus');
      for (const af of (s.minusRaters || [])) insRate.run(s.id, af, 'minus');
    }

    const insSup = db.prepare('INSERT INTO supports (affiliate_id, initiative_id, at, potential) VALUES (?, ?, ?, ?)');
    for (const s of seed.supports) {
      insSup.run(s.affiliateId, s.initiativeId, s.at, s.potential ? 1 : 0);
    }

    const insBal  = db.prepare('INSERT INTO ballots (affiliate_id, issue_id, at) VALUES (?, ?, ?)');
    const insRank = db.prepare('INSERT INTO ballot_rankings (affiliate_id, issue_id, initiative_id, rank) VALUES (?, ?, ?, ?)');
    for (const b of seed.ballots) {
      insBal.run(b.affiliateId, b.issueId, b.at);
      for (const [iniId, rank] of Object.entries(b.rankings)) {
        insRank.run(b.affiliateId, b.issueId, iniId, Number(rank));
      }
    }

    const insDel = db.prepare('INSERT INTO delegations (id, from_id, to_id, scope, target_id, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const d of seed.delegations) {
      insDel.run(d.id, d.from, d.to, d.scope, d.targetId, d.createdAt, d.revokedAt);
    }

    const insAud = db.prepare('INSERT INTO audit (id, at, kind, actor, target, meta) VALUES (?, ?, ?, ?, ?, ?)');
    for (const a of seed.audit) {
      insAud.run(a.id, a.at, a.kind, a.actor, a.target, JSON.stringify(a.meta || {}));
    }
    return true;
  });
}

// ========== EXISTENCIA / CHEQUEOS ==========
export function getAffiliateById(id) { return cam(db.prepare('SELECT * FROM affiliates WHERE id = ?').get(id)); }
export function getInitiativeById(id) { return cam(db.prepare('SELECT * FROM initiatives WHERE id = ?').get(id)); }
export function getIssueById(id) { return cam(db.prepare('SELECT * FROM issues WHERE id = ?').get(id)); }
export function getInitiativeIdsByIssue(issueId) {
  return db.prepare('SELECT id FROM initiatives WHERE issue_id = ?').all(issueId).map(r => r.id);
}
