# ADR-005 · Schema mixto: normalizado + JSON

| Estado | Fecha |
|---|---|
| Vigente | 2026-05-04 |

## Contexto

Al diseñar el schema SQLite ([ADR-004](0004-persistencia-sqlite.md)), tres entidades del modelo LF tienen forma anidada en el JSON original:

1. **`ballots.rankings`** — objeto `{ initiativeId: rank }` donde `rank` es un entero (1–5 = preferencias, 99 = status quo, ausente = rechazo).
2. **`suggestions.plusRaters[]` y `minusRaters[]`** — arrays de `affiliateId` que han votado ± sobre la sugerencia.
3. **`audit.meta`** — objeto libre con metadata específica del evento (`{ scope, targetId }` para delegaciones, `{ from, to }` para cambios de fase, etc.).

Cada una se puede modelar como tabla normalizada (rows con FK) o como columna JSON (TEXT con `JSON1` extension de SQLite). La elección afecta integridad, queries futuras, y complejidad de reshape.

## Decisión

| Entidad | Modelo | Por qué |
|---|---|---|
| `ballot_rankings` | **Normalizado** — tabla `(affiliate_id, issue_id, initiative_id, rank)` con PK compuesta y FK a `ballots` y `initiatives` | Habilita tally Condorcet en SQL puro vía vistas/window functions cuando crezcamos. UNIQUE estructural previene rankings duplicados por accidente. |
| `suggestion_ratings` | **Normalizado** — tabla `(suggestion_id, affiliate_id, sign)` con PK compuesta y CHECK sobre sign | UNIQUE constraint previene doble voto del mismo afiliado sobre la misma sugerencia. La lógica anterior dependía de `Array.filter` en cliente del server. |
| `audit.meta` | **JSON TEXT** | El shape es genuinamente libre: depende del `kind` del evento. Normalizar requeriría tablas separadas por `kind` o un schema EAV (entity-attribute-value), ambas peores que JSON aquí. |

## Alternativas consideradas

### Todo JSON (campos `rankings` y `raters` como TEXT con JSON serializado)

**Por qué no:**
- Pierdes UNIQUE constraints. Un bug del cliente que postee la misma sugerencia dos veces como rating crea duplicados invisibles.
- Queries analíticas futuras ("¿cuántos rankings tiene la iniciativa X en total?") requieren parsear JSON en SQL — lento y no indexable.
- Litestream replica el archivo SQLite, no se beneficia de JSON vs filas; la decisión es puramente sobre integridad y queries.

### Todo normalizado (incluyendo `audit.meta`)

**Por qué no:**
- `audit.meta` no tiene un schema: cada `kind` de evento puede tener campos diferentes y futuros. Normalizar exige adivinar el conjunto de claves o un EAV inflexible.
- Filtrado complejo (audit por `kind=delegacion AND meta.scope=celula`) sigue siendo posible con SQL `json_extract(meta, '$.scope')`, sin perder potencial analítico.

### Híbrido distinto: `rankings` JSON pero `raters` normalizado

Inconsistente. Si la regla es "JSON cuando el shape es libre, normalizado cuando es relacional", `rankings` es relacional (votante × iniciativa → rank). Mezclar criterios complica el modelo mental para futuro mantenimiento.

## Consecuencias

### A favor

- **Integridad estructural en lo que importa.** Voto preferencial y ratings tienen UNIQUE y FK. La integridad del sistema electoral no depende del cliente.
- **Tally Condorcet escalable.** Si llegamos a una escala donde el cómputo en JS es lento (~miles de afiliados), `issueTally` se puede materializar como vista SQL sobre `ballot_rankings` con window functions o pairwise GROUP BY. La normalización es la pre-condición.
- **`audit.meta` flexible.** Añadir un nuevo `kind` de evento con metadata diferente no requiere migration: solo se inserta con su shape específico.
- **Backups consistentes.** Ningún campo "blob" gigante; tamaños de fila pequeños y predecibles.

### En contra

- **Reshape JSON ↔ SQL en `db.js`.** Funciones que componen formas no triviales:
  - `getBallots()` ensambla rankings desde dos tablas en `{ affiliateId, issueId, at, rankings: { iniId: rank } }`.
  - `getSuggestions()` agrega plusRaters/minusRaters via `json_group_array()` y los expone como arrays.
  - `getDelegations()` traduce columnas `from_id`/`to_id` a propiedades `from`/`to` (la API original no usa el sufijo `Id`).
- **Dos índices en `ballot_rankings`** (PK compuesta más uno por initiative_id). Negligible para nuestra escala pero documenta la elección.
- **CHECK constraints adicionales** que SQLite valida en cada INSERT (`sign IN ('plus','minus')`, `phase IN (...)`, etc.). Velocidad imperceptible; el costo es solo cognitivo (un nuevo desarrollador debe leer el schema).

## Notas de implementación

- **JSON1 está disponible en SQLite por defecto** desde 3.38 (Feb 2022). Node 22 ships SQLite ≥ 3.45. No hace falta extension loading.
- **`json_group_array()` + `json_extract()`** son las funciones que usamos para agregar/extraer en `getSuggestions()` y para queries futuras sobre `audit.meta`.
- **Naming snake_case ↔ camelCase** está aislado en helper `cam()` de `db.js`. No filtra a server.js ni al frontend.

## Referencias

- `schema.sql` — definición concreta de tablas, CHECKs, índices
- `db.js` — funciones de reshape (`getBallots`, `getSuggestions`, `getDelegations`)
- [ADR-004](0004-persistencia-sqlite.md) — decisión de migrar a SQLite, contexto general
