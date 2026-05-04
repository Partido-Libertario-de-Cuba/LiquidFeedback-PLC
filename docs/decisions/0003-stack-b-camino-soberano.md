# ADR-003 · Stack B — camino self-hosted soberano $0

| Estado | Fecha |
|---|---|
| Plan vigente, implementación por fases | 2026-05-04 |

## Contexto

El despliegue PoC en GitHub Pages + Render ([ADR-002](0002-deploy-transitorio-gh-pages-render.md)) sirve para validar pipeline y UX, pero no es viable como destino:

1. **Disco efímero en Render free.** `db.sqlite` se reseed en cada restart. Cualquier votación con consecuencia es destruida por un redeploy nocturno. Para un partido cuyo modelo descansa sobre la bitácora pública inmutable (Art. 12), un sistema de votación que pierde estado al despertar es defectuoso por diseño.
2. **Dependencia de proveedores US.** GitHub (Microsoft) + Render son ambos US-incorporated. Sujetos a CLOUD Act, OFAC, y discreción comercial sobre quién hospedar. Para un partido opositor cubano operando bajo presión estatal, dos proveedores US son dos vectores de deplatforming.
3. **Sin censura-resistencia.** Afiliados dentro de Cuba pueden enfrentar bloqueo selectivo por OFAC o por el régimen mismo. Sin servicio `.onion` paralelo no hay ruta robusta.

El objetivo de esta decisión es definir el **stack destino** que el PoC va a evolucionar a alcanzar antes de operación vinculante.

## Restricciones autoimpuestas

- **Costo: cercano a $0/mes**, idealmente $0. El partido no tiene flujo de recursos para infra recurrente significativa.
- **Soberanía: prioridad alta.** Datos de afiliados, votos y delegaciones no pueden estar bajo jurisdicción de un proveedor que pueda terminarnos discrecionalmente.
- **FOSS preferido en cada capa.** Que el stack sea reproducible por otra org sin licencias.
- **Operable por un sysadmin con ≤ 1h/semana.** Stack que requiera ingeniería de plataforma full-time es no-arrancable.
- **Migrable.** Cualquier capa debe poderse rotar (proveedor, jurisdicción, mecanismo) sin reescribir la app.

## Decisión

Adopción de **Stack B** como dirección, implementado por fases. Cada capa fue elegida tras enumerar alternativas (ver "Alternativas consideradas" abajo).

| Capa | Elección | Por qué |
|---|---|---|
| Compute | **Oracle Always Free** (4 ARM cores, 24 GB RAM) **o Pi/laptop en casa** (decisión deferida hasta Fase 3) | Únicas opciones $0 reales y persistentes en 2026. Oracle: estable, IP pública. Pi: máxima soberanía, requiere afiliado de confianza. |
| Persistencia | **SQLite + Litestream → Storj** (25 GB free, sharded) | Un archivo, replicación continua a almacenamiento descentralizado. SQLite ya implementado en Fase 1 ([ADR-004](0004-persistencia-sqlite.md)). |
| Frontend | **Caddy** sirviendo `public/` desde el mismo host | Single binary, auto-HTTPS, ~30 MB RAM. Elimina CORS y la separación frontend/backend de ADR-002. |
| Domain | `.eu.org` subdominio gratis (UE, desde 1996) **o solo `.onion`** | $0, jurisdicción no-US. Decisión deferida a Fase 5. |
| TLS | **Let's Encrypt vía Caddy** | Automático, $0, estándar. |
| Auth | **Hand-rolled** (magic links + WebAuthn opcional) | Phishing-resistente con WebAuthn. ~50 afiliados no justifica Keycloak/Authentik. Implementación en Fase 2. |
| Email | **Brevo free** (300/día, FR/UE) | Self-host de email es operacionalmente inviable (deliverability hell). Brevo es UE, free tier suficiente. |
| Backups | **restic → Storj** (cifrado client-side, 25 GB free) | Replicación más allá de Litestream. restic es FOSS estándar. |
| Observabilidad | **Uptime Kuma + Netdata** | ~200 MB RAM, 90% del valor. |
| Repo | **Codeberg** mirror (Forgejo, no-profit, DE) **+ GitHub** público | Soberanía + visibilidad. Si GitHub deplatforma, el código sigue en Codeberg. |
| Censura | **Tor hidden service paralelo** (mismo backend, dos endpoints) | Acceso desde Cuba sin DNS ni IP expuestas. |

## Implementación por fases

| Fase | Estado | Entregable |
|---|---|---|
| 1 — Persistencia SQLite | ✅ Completa (commit 3c9bf67) | `db.sqlite` portable con WAL, FK, índices. Ver [ADR-004](0004-persistencia-sqlite.md). |
| 2 — Auth | Pendiente | Magic links + opcional WebAuthn. Migración de switcher-en-cliente a sesiones reales. |
| 3 — Deploy artifacts | Pendiente | Caddyfile + systemd unit + script de instalación. **Bloqueado por decisión host (Oracle vs Pi).** |
| 4 — Backup duradero | Pendiente | Litestream config + Storj account + cron de restic offsite. |
| 5 — Censura | Pendiente | Servicio `.onion` + DNS soberano. |

## Alternativas consideradas (stacks completos)

Tres stacks coherentes fueron evaluados antes de elegir B.

### Stack A — "Maximalista soberano" (€5/mes Hetzner)

VPS €4.5 + Postgres + Caddy + Authentik o hand-rolled + Brevo + restic Storj + Uptime Kuma + Codeberg + .onion.

**Por qué no:** El costo de €54/año es bajo pero no $0. Para un partido sin presupuesto recurrente confirmado, $0 es preferible incluso a costa de aceptar el riesgo de Oracle-reclama-instancia.

### Stack C — "Maximalista paranoico" (€10–12/mes)

2× VPS con replicación + Authentik + Postal MTA + observabilidad full Prometheus/Grafana/Loki + Forgejo self-hosted + redundancia geográfica.

**Por qué no:** Apropiado para beta vinculante eventualmente. Overkill para alpha-test. ~16h setup inicial y ~3h/mes mantenimiento exceden el presupuesto operacional.

### Cloudflare Pages + Workers + KV

Misma arquitectura que ADR-002 pero todo en CF.

**Por qué no:** Contras políticos detallados en ADR-002 (OFAC, deplatforming, TLS termination). Para infraestructura de un partido cubano opositor, CF es una mala apuesta estratégica aunque sea técnicamente capaz.

### Supabase Cloud (con migración eventual a self-hosted)

Considerada por su capacidad **única** entre los DBaaS: el código que escribes contra el cloud corre idéntico contra `supabase/docker` self-hosted. La migración cloud→VPS preserva no solo datos sino auth, realtime y storage.

**Por qué no:** El free tier pausa el proyecto tras 7 días de inactividad — exactamente el patrón de uso de un alpha-test intermitente. Pasar a Pro ($25/mo) elimina la pausa pero rompe la restricción $0. Se descartó pero **se considera la mejor opción si el partido autoriza presupuesto en alpha** (ver "Plan de revisión" abajo).

### Neon Cloud

Mejor idle behavior que Supabase (no se pausa, scale-to-zero con resume ~500ms). Pero recientemente adquirido por Databricks (US, public company) y self-hostability menos práctica que Supabase. Free tier permite alpha pero no resuelve el camino a beta soberana.

**Por qué no:** Sumar otra capa de proveedor US sin ganancia estratégica clara contra Postgres en VPS propio.

### VPS único ya desde PoC (Stack A reducido)

La opción "saltarse el cloud free tier desde día uno" es atractiva: si vas a terminar en VPS de todos modos, ¿por qué pagar la complejidad de migrar más adelante? Un Hetzner CX22 corre todo (Caddy + Node + SQLite + Litestream + Tor) en una sola caja.

**Por qué no se elige todavía:** El bloqueo es la decisión host (Oracle vs Pi vs VPS de pago) que se difiere a Fase 3. Si en Fase 3 la decisión se vuelve "VPS Hetzner €5/mes", el resultado efectivo es Stack A reducido y este ADR se actualizará.

## Consecuencias

### A favor

- **$0/mes operacional confirmado** (asumiendo Oracle Always Free o Pi en casa).
- **Soberanía operacional alta.** Sin TLS-termination de tercero. Sin discrecionalidad de plataforma. Logs bajo control propio.
- **Cero migración entre alpha y beta** si el host de Fase 3 se mantiene.
- **Resistente a deplatforming.** Pérdida del repo público en GitHub no afecta operación (mirror Codeberg + repo del backend en el host).
- **Censura-resistente.** Servicio `.onion` paralelo da ruta a afiliados en Cuba sin depender de OFAC ni del régimen.

### En contra

- **Sysadmin requerido.** Cualquier capa self-hosted requiere alguien que responda al beeper. Si nadie lo hace, el sistema se degrada silenciosamente.
- **Oracle puede reclamar la instancia.** Always Free tiene historial de reclamaciones cuando hay capacidad limitada en la región. Mitigación: si pasa, Pi en casa o VPS €5 son fallback en horas.
- **Pi/laptop en casa requiere ISP cómplice.** ToS residenciales pueden prohibir servidores; hay que verificar antes de comprometer. IP dinámica solucionable con DDNS.
- **Free tiers cambian.** Cualquiera de Oracle/Storj/Brevo/Codeberg/Hetzner puede cambiar términos. Mitigación: el stack es portable; cualquier capa rota en horas.
- **WebAuthn requiere dispositivos.** Algunos afiliados no tendrán hardware key. Magic links email solos son la línea base, WebAuthn opcional para los que puedan.

## Plan de revisión

Este ADR debe revisarse en los siguientes momentos:

1. **Antes de pasar a alpha** — confirmar que Fases 2–4 cumplen con el caso de uso real de afiliados.
2. **Si la directiva del partido autoriza presupuesto operacional** — reconsiderar Supabase Pro ($25/mo) o VPS gestionado para reducir carga sysadmin.
3. **Antes de operación vinculante** — reconsiderar redundancia (Stack C) y auditoría externa.
4. **Si Oracle reclama la instancia** — rotar a Pi o VPS, actualizar este ADR con el aprendizaje.

## Referencias

- Discusión completa de stacks A/B/C en historial de conversación.
- ADR-002 (deploy transitorio GH+Render) — superado parcialmente por Fases 3–5.
- ADR-004 (persistencia SQLite) — implementación concreta de Fase 1.
- LiquidFeedback Core upstream (Lua + PostgreSQL) — referencia de modelo, no de stack.
