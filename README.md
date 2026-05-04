# PLC · Ágora Digital

Puerto local de [**LiquidFeedback**](https://www.public-software-group.org/mercurial/liquid_feedback_core/file) adaptado a la *Carta de Principios y Estatutos Orgánicos del Partido Libertario de Cuba*. Identidad gráfica alineada a [partidolibertariodecuba.org](https://partidolibertariodecuba.org/) (tinta `#0d141a` · fondo blanco · acento amarillo `#f1cd14`).

## Arranque

```bash
node server.js
# → http://localhost:4711
```

Sin dependencias externas. Node ≥ 18.

## Modelo (LF-fiel)

| Entidad | Definición |
|---|---|
| **Unidad** | El PLC como cuerpo político único. |
| **Células** | Áreas temáticas (Título V · Art. 13–18). Seis. |
| **Policies** | Reglas de tiempo y quórum por fase. Tres: *estándar · constitucional · urgente*. |
| **Issues** | Asuntos que requieren decisión. Contienen iniciativas competidoras. |
| **Initiatives** | Propuestas concretas. Varias por issue. Compiten en votación preferencial. |
| **Drafts** | Historial de versiones del texto de cada iniciativa. |
| **Suggestions** | Directivas estructuradas (*debe · debería · no debe · no debería*) con voto ± de cada afiliado. |
| **Supports** | Apoyo pre-voto. Puede ser *firme* o *condicional*. |
| **Ballots** | Voto preferencial (rank 1–5 + *status quo*). Se resuelve por Condorcet simplificado. |
| **Delegations** | Transferencia revocable de voto. Tres ámbitos: global · célula · issue. |

### Fases de una issue

1. **Admisión** — recoge apoyos hasta el *issue quorum* (10% / 20% / 33% según policy).
2. **Discusión** — texto móvil; se añaden iniciativas, borradores, sugerencias.
3. **Verificación** — texto congelado; iniciativas deben superar *initiative quorum*.
4. **Votación** — ballot preferencial abierto; delegaciones activas.
5. **Cerrada** — decisión vinculante archivada en la bitácora.

### Voto preferencial (Condorcet simplificado)

- Cada votante rankea las iniciativas `1..N` donde `1 = más preferida`.
- `99 = status quo` (marca el umbral de aprobación).
- Las no rankeadas valen `100` (por debajo del status quo).
- Ganadora: la iniciativa que gana todos los pairwise. Si no existe ganador Condorcet, fallback a mayor approval.

### Delegación

Prioridad al resolver cadena:
```
issue-específica > célula > global
```
El voto/apoyo directo siempre anula la delegación para esa issue (Art. 12.2). Las cadenas son transitivas, con detección de ciclos.

## Rutas

| URL | Contenido |
|---|---|
| `/` | Ágora: hero, fases, en votación, en debate, busca apoyo, cómo funciona, bitácora |
| `/carta` | Estatutos completos con notas laterales vivas |
| `/celulas` · `/celula/:slug` | Células + asuntos por célula + formulario de nuevo asunto |
| `/issues` · `/issues?phase=X` | Todos los asuntos + filtro por fase |
| `/issue/:id` | Asunto con iniciativas competidoras, apoyos, sugerencias, ballot preferencial |
| `/iniciativa/:id` | Detalle de una iniciativa: borradores, sugerencias, acciones |
| `/delegaciones` | Gestión personal (emitidas / recibidas / nueva) |
| `/afiliado/:id` | Historial público de un afiliado |
| `/auditoria` | Bitácora pública completa |

## API

```
GET  /api/state                        snapshot enriquecido (issues con tally)
POST /api/support                      { affiliateId, initiativeId, potential? }
POST /api/unsupport                    { affiliateId, initiativeId }
POST /api/vote                         { affiliateId, issueId, rankings }
POST /api/suggestion                   { initiativeId, authorId, directive, content }
POST /api/suggestion/rate              { suggestionId, affiliateId, rating: plus|minus|clear }
POST /api/delegate                     { from, to, scope: global|celula|issue, targetId? }
POST /api/revoke                       { delegationId, from }
POST /api/issue                        abrir asunto nuevo con su primera iniciativa
POST /api/initiative                   añadir iniciativa competidora a un asunto
POST /api/reset                        rehace db.json desde seed
```

## Stack

- **Node.js** (runtime, cero dependencias npm)
- **HTTP nativo** (`node:http`, `node:fs`)
- **JSON** como persistencia (LF usa PostgreSQL; aquí JSON por localhost portátil)
- **SPA vanilla** (sin framework, routing con History API)
- **Instrument Serif · Inter · IBM Plex Mono** (tipografía editorial + institucional)

LiquidFeedback de referencia está construido sobre Lua + Moonbridge + PostgreSQL con lógica extensa en PL/pgSQL. Este puerto replica el **modelo de datos y las reglas**, no el stack operativo — diseñado para ser inspeccionable y extensible con un solo `node server.js`.

## Reiniciar

```bash
rm db.json && node server.js
# o: curl -X POST http://localhost:4711/api/reset
```

---

*Todos los afiliados están a cargo.*
