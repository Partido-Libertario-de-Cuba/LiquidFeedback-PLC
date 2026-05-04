# Arquitectura — visión general

Este documento describe el estado actual del sistema, los principios que lo guían, y la trayectoria planeada hasta operación vinculante. Para el **por qué** de cada decisión específica, ver [`decisions/`](decisions/).

---

## Capas

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTE                                                         │
│ SPA vanilla en public/                                          │
│  · index.html con <base> dinámico (subpath GH Pages vs raíz)    │
│  · app.js: BASE_PATH + API_BASE detectados por hostname         │
│  · routing con History API; render por dispatcher de paths      │
│  · sin framework, sin build, sin npm                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ fetch(API_BASE + /api/*)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ SERVIDOR                                                        │
│ Node ≥ 22 (HTTP nativo, sin framework)                          │
│  · server.js  — dispatcher HTTP + lógica LF (delegate, tally)   │
│  · db.js      — capa SQLite con queries camelCase + tx          │
│  · schema.sql — 14 tablas normalizadas, FK, CHECKs, índices     │
│  · seed.js    — estado inicial; loadSeed() idempotente          │
│  · CORS abierto (sin auth de sesión por ahora)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PERSISTENCIA                                                    │
│ db.sqlite (WAL mode, FK on, synchronous=NORMAL)                 │
│  · 14 tablas, snake_case en SQL ↔ camelCase en API              │
│  · ballot_rankings y suggestion_ratings normalizados            │
│  · audit.meta como JSON TEXT (libre)                            │
│  · ON DELETE CASCADE en relaciones débiles                      │
└─────────────────────────────────────────────────────────────────┘
```

## Principios de diseño

1. **Inspeccionable.** El sistema completo cabe en la cabeza de un afiliado: `server.js` (≤500 líneas), `db.js` (≤300 líneas), `schema.sql` (≤140 líneas). No hay magic.
2. **Cero dependencias npm.** El runtime se ejecuta con lo que trae Node 22+. Esto facilita auditoría, reduce supply-chain risk, y elimina `node_modules` del modelo mental.
3. **Modelo LF fiel, stack distinto.** Replicamos las reglas (policies, fases, quórums, Condorcet, delegación issue>célula>global) sobre un stack mínimo. La referencia LF original usa Lua + Moonbridge + PostgreSQL + PL/pgSQL.
4. **API JSON estable.** El frontend depende de las formas que devuelve `/api/state`. Cualquier rotación de backend (db.json → SQLite → Postgres futuro) preserva esos shapes. Ver [ADR-004](decisions/0004-persistencia-sqlite.md).
5. **Soberanía como objetivo, no como precondición.** El despliegue actual (GH Pages + Render) es **transitorio**. La trayectoria está documentada en [ADR-003](decisions/0003-stack-b-camino-soberano.md).
6. **Bitácora pública como principio.** El log de auditoría existe desde el seed. Cuando la persistencia sea durable (Fase 4), la bitácora es el contrato de transparencia con los afiliados.

## Flujos críticos

### Cálculo de tally Condorcet (`/api/state`)

1. `snapshot()` lee de SQLite todas las tablas relevantes en memoria.
2. Para cada issue en fase `voting` o `finished`:
   - `issueTally(snap, issue)` resuelve ballots efectivos (delegaciones aplicadas).
   - Calcula matriz pairwise sobre ranks (`<99` aprueba; `99` = status quo; ausente = `100`).
   - Determina ganador Condorcet o, si no existe, fallback por mayor approval.
3. La respuesta lleva `tally` embebido en cada issue.

**Implicación:** todo el cómputo es server-side y fresh-on-read. No hay caché ni pre-cálculo persistente. Suficiente hasta cientos de afiliados; arriba de eso, considerar materialización.

### Resolución de cadena de delegación

`resolveDelegate(snap, affiliateId, issue)` busca en este orden por afiliado:
1. Delegación `scope=issue, target_id=issue.id` activa
2. Delegación `scope=celula, target_id=issue.celulaId` activa
3. Delegación `scope=global` activa

Si encuentra, recurre con `seen` para detectar ciclos. Voto/apoyo directo del afiliado anula su cadena para esa issue específica.

### Mutaciones transaccionales

Operaciones que tocan múltiples tablas se envuelven en `transaction(() => { ... })` (BEGIN/COMMIT/ROLLBACK):
- `setBallot` — borra rankings previos, inserta los nuevos
- `addDelegation` — revoca activa previa en mismo (from, scope, targetId), inserta nueva
- `createIssue` — issue + initiative + draft + author auto-support
- `addInitiative` — initiative + draft + author auto-support
- `rateSuggestion` — borra rating previo del mismo afiliado, inserta nuevo

## Trayectoria

Tres etapas, cada una con criterio explícito de paso a la siguiente.

### PoC actual

- Validación de UX y pipeline.
- Backend GH Pages + Render free (efímero, sleep 15 min).
- Persistencia SQLite local (no replicada).
- Sin auth real — switcher de afiliado en cliente.
- Datos demo del seed.

**Criterio de paso a alpha:** la directiva del partido valida la propuesta y autoriza alpha-test interno.

### Alpha (Stack B en construcción)

- Hosting: Oracle Always Free o Pi/laptop en casa de afiliado de confianza (decisión pendiente).
- Persistencia: SQLite + Litestream → Storj 25 GB free (replicación continua).
- Auth: magic links email + WebAuthn opcional para afiliados con hardware key.
- Datos: afiliados reales del partido, decisiones aún no vinculantes.
- Censura: servicio `.onion` paralelo accesible desde Cuba sin DNS expuesto.

**Criterio de paso a beta:** estabilidad operacional ≥ 30 días, ≥ 10 afiliados activos en al menos 1 issue completa de admisión a votación.

### Beta / vinculante

- Mismo stack B endurecido: 2× hosts (primario + réplica), backups verificados (`restic` cross-region), runbook publicado.
- Auditoría externa del código de tally Condorcet.
- Bitácora pública firmada (Merkle log u otro mecanismo de inmutabilidad verificable).
- Posible migración del schema mixto a Postgres si la concurrencia lo justifica — la separación `server.js` ↔ `db.js` está pensada para esa rotación.

## Apéndices

- [Decisiones arquitectónicas (ADRs)](decisions/)
- [Schema SQLite anotado](../schema.sql)
- [Carta de Principios y Estatutos del PLC](../public/carta-data.js) (datos del módulo `/carta` de la SPA)
