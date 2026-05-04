# Architecture Decision Records (ADRs)

Cada decisión arquitectónica significativa se registra como un ADR breve. Formato: contexto → decisión → alternativas → consecuencias.

| # | Título | Estado |
|---|---|---|
| [001](0001-licencia-y-visibilidad.md) | Licencia MIT + repositorio público | Vigente |
| [002](0002-deploy-transitorio-gh-pages-render.md) | Deploy transitorio en GitHub Pages + Render | Vigente (transitorio) |
| [003](0003-stack-b-camino-soberano.md) | Stack B — camino self-hosted soberano $0 | Plan vigente, implementación por fases |
| [004](0004-persistencia-sqlite.md) | Persistencia SQLite (Stack B · Fase 1) | Vigente |
| [005](0005-schema-mixto.md) | Schema mixto: normalizado + JSON | Vigente |

## Por qué ADRs

Las decisiones arquitectónicas son la parte del código que **no se ve**: por qué se eligió X y no Y, qué se descartó, qué hipótesis sostienen la elección. Sin ADRs, el por qué se pierde en commits y conversaciones; el equipo futuro hereda el código pero no el razonamiento, y termina rehaciendo análisis ya hecho o rotando piezas que tenían razón de ser.

Para un proyecto de infraestructura democrática como este, la trazabilidad del razonamiento **es** parte del contrato de transparencia. Quien herede el repo (otro afiliado, una auditoría externa, un fork) debe poder reconstruir el porqué.

## Cómo añadir un ADR

1. Copiar el último ADR como plantilla.
2. Numerar secuencialmente (`000N-titulo-corto.md`).
3. Estado: `Propuesto`, `Vigente`, `Vigente (transitorio)`, `Superado por ADR-NNN`, `Rechazado`.
4. Mantener cada ADR a una sola decisión. Si emerge una secundaria, es otro ADR.
5. Añadir entrada al índice arriba.
6. **No editar ADRs vigentes para revertir decisiones**: marcarlos como `Superado por ADR-NNN` y crear el nuevo. Los ADRs son historia, no documentación viva.
