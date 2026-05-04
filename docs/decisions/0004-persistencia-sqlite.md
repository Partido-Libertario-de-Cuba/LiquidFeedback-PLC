# ADR-004 · Persistencia SQLite (Stack B · Fase 1)

| Estado | Fecha |
|---|---|
| Vigente | 2026-05-04 |

## Contexto

La implementación inicial usaba un único archivo `db.json` cargado y reescrito en cada mutación:

```js
async function loadDB()  { return JSON.parse(await readFile(DB_PATH, 'utf8')); }
async function saveDB(db) { await writeFile(DB_PATH, JSON.stringify(db, null, 2)); }
```

Limitaciones conocidas:

- **Sin transacciones reales.** Una mutación con varios pasos (`addDelegation` revoca la activa previa y luego inserta la nueva) es secuencial dentro del proceso Node, pero si el proceso muere entre los dos pasos, queda inconsistente.
- **Sin constraints.** Nada impide insertar un soporte duplicado, una iniciativa con `issueId` que no existe, o un ranking con `initiativeId` huérfano.
- **Read-modify-write completo.** Cualquier mutación carga y reescribe ~30 KB de JSON. Trivialmente lento bajo cualquier carga real.
- **Sin queries.** Filtrar es siempre `Array.filter`. Imposible añadir índices o vistas.
- **Sin durabilidad operacional.** `writeFile` no es atómico contra fallo de proceso (crash entre `open` y `close` deja archivo truncado).

Fase 1 de [ADR-003 (Stack B)](0003-stack-b-camino-soberano.md) era resolver la persistencia. La motivación es habilitar Litestream replication en Fase 4 — Litestream replica WAL de SQLite, no archivos JSON arbitrarios.

## Decisión

Migrar a **SQLite via `node:sqlite`** (módulo nativo de Node, sin dependencias npm). Schema relacional con WAL, foreign keys habilitadas, índices selectivos. La capa SQL (`db.js`) traduce snake_case ↔ camelCase y devuelve **exactamente** las mismas formas JSON que devolvía `db.json`, para que el frontend no requiera cambios.

Bootstrap idempotente: en cada arranque, si la DB está vacía, se carga el seed; si tiene datos, no se toca.

Mutaciones multi-tabla envueltas en transacciones explícitas (`BEGIN`/`COMMIT`/`ROLLBACK`).

## Alternativas consideradas

### Postgres en VPS

La opción "boring tech" estándar. Mejor concurrencia, mejor SQL, mejor tooling.

**Por qué no:**
- Requiere proceso DB separado, agrega ops (instalación, autenticación, backup separado).
- Para nuestra escala (~50 afiliados) la concurrencia de Postgres es irrelevante; SQLite con WAL maneja lecturas concurrentes y un escritor sin contención.
- Postgres está en el horizonte para beta vinculante si la concurrencia lo justifica. La separación `server.js` ↔ `db.js` está pensada para esa rotación futura.

### Postgres gestionado (Neon, Supabase Cloud)

Ver [ADR-003](0003-stack-b-camino-soberano.md). Descartado por razones de soberanía (jurisdicción US, riesgo de pause/deplatform en free tiers).

### `better-sqlite3` (npm)

El driver SQLite más maduro y rápido para Node. API similar a `node:sqlite`.

**Por qué no:**
- Rompería la restricción "cero dependencias npm" que el proyecto mantiene desde el inicio.
- Native bindings requieren compilación al instalar, lo cual añade fricción a `npm start` en hosts limitados (Pi, Oracle ARM).
- `node:sqlite` es estable a partir de Node 24 y experimental con warning en Node 22.5+. La diferencia funcional con `better-sqlite3` es marginal para nuestro uso.

Trade-off conocido: `node:sqlite` emite `ExperimentalWarning` al iniciar en Node 22. Suprimida con `--no-warnings=ExperimentalWarning` en `npm start`. Cuando Node 24+ sea el deploy default, suprimir deja de ser necesario.

### Mantener `db.json`

**Por qué no:** Ninguna de las limitaciones del JSON file se resuelve esperando. SQLite resuelve transacciones, constraints, queries, y atomicidad-on-crash con cero costo recurrente.

### Bases de datos exóticas (CouchDB, OrbitDB, GunDB)

CouchDB (replicación multi-master) y OrbitDB/GunDB (P2P) tienen propiedades interesantes para infraestructura distribuida. Descartadas por:

- CouchDB: añade un proceso server, runtime Erlang, y la replicación multi-master no aporta para una sola instancia.
- OrbitDB/GunDB: P2P es estado del arte para descentralización pero el modelo de consistencia eventual no encaja con auditoría votal donde cada cambio debe ser totalmente ordenado y resoluble.

## Schema

Decisión separada en [ADR-005](0005-schema-mixto.md): mixto entre normalizado (votos, ratings) y JSON libre (audit.meta).

Resumen:
- 14 tablas en `schema.sql`.
- IDs como `TEXT` con prefijos (`iss_`, `ini_`, `sug_`, etc.) para preservar URLs existentes.
- snake_case en SQL; traducción a camelCase en `db.js` vía helper `cam()`.
- `ON DELETE CASCADE` en relaciones donde la entidad hija no tiene sentido sin la padre (drafts/suggestions/supports/ballots cuelgan de initiative o issue).
- Índices selectivos sobre los campos que el código de tally y delegation realmente filtra.

## Consecuencias

### A favor

- **Persistencia sobrevive restart.** Verificado: 6 mutaciones se mantuvieron tras matar y relanzar el proceso. (Esto **no** resuelve el disco efímero de Render — eso lo hace Litestream en Fase 4. Pero ya queda preparado.)
- **Transacciones reales.** `addDelegation` es atómica: o se revoca la previa Y se inserta la nueva, o no pasa ni una.
- **Constraints SQL.** UNIQUE en (suggestion_id, affiliate_id) previene doble rating; FK ON DELETE CASCADE asegura que borrar una iniciativa borra sus drafts/sugerencias/supports/ballot_rankings.
- **Cero dependencias npm.** Mantenido el principio. `node:sqlite` es stdlib.
- **Archivo único portable.** `db.sqlite` se copia, se versiona como dump, se replica. Litestream solo necesita conocer este archivo.
- **Migración a Postgres futura es viable.** Las tablas son SQL estándar; los queries usan `?` placeholders portables; las funciones de `db.js` son la única superficie a reescribir.
- **API estable.** El frontend no requirió cambios. Las formas JSON devueltas por `/api/state` son byte-idénticas a las anteriores (verificado).

### En contra

- **`ExperimentalWarning` en Node 22.** Cosmético; suprimido con flag.
- **SQLite single-writer.** Concurrencia de escritura serializa contra el mismo archivo. A nuestra escala no importa; con cientos de votantes simultáneos sí (rotar a Postgres en ese punto).
- **WAL/SHM files extra.** `db.sqlite-wal` y `db.sqlite-shm` aparecen junto al archivo principal; están en `.gitignore` pero hay que recordar copiarlos al hacer backup manual (Litestream se encarga en Fase 4).
- **Duplicación menor de mapeo.** `getDelegations()` y `getSuggestions()` traducen manualmente porque sus formas API (`from`/`to`, `plusRaters[]`/`minusRaters[]`) no son trivialmente camelCase de las columnas.
- **`audit` crece sin podar.** El JSON file truncaba a 500 entradas; el SQL crece indefinidamente. A la escala del PoC esto es trivial; cuando importe, añadir cron de poda o usar índice + DELETE.

## Verificación

Smoke test ejecutado tras la migración:

| Endpoint | Resultado |
|---|---|
| `GET /api/state` (200) | 13 keys top-level, counts del seed correctos |
| `POST /api/support` en fase admission | OK |
| `POST /api/support` en fase voting | 409 ("fase no permite apoyo directo") — constraint de fase preservado |
| `POST /api/vote` con rankings | OK |
| `POST /api/delegate` | OK |
| `POST /api/revoke` | OK |
| `POST /api/suggestion` + `POST /api/suggestion/rate` | OK |
| `POST /api/issue` (nuevo issue + initiative + draft + author auto-support) | OK transaccional |
| Restart del proceso | Estado preservado |

## Referencias

- `schema.sql` — definición completa del schema
- `db.js` — capa de persistencia, ~280 líneas
- `server.js` — refactorizado para usar `db.js`, snapshot read único en `/api/state`, mutaciones puntuales
- Commit 3c9bf67
- [ADR-005](0005-schema-mixto.md) — decisiones de diseño del schema
- [ADR-003](0003-stack-b-camino-soberano.md) Fase 1 — esta ADR es la implementación
