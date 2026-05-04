# ADR-001 · Licencia MIT + repositorio público

| Estado | Fecha |
|---|---|
| Vigente | 2026-05-04 |

## Contexto

El proyecto se inicializó como repositorio Git nuevo bajo la organización GitHub `Partido-Libertario-de-Cuba`. Antes del primer push había que decidir dos cosas que afectan a quién puede ver el código y bajo qué términos puede reusarlo:

1. **Licencia.** El proyecto es un puerto/derivado conceptual de [LiquidFeedback Core](https://www.public-software-group.org/mercurial/liquid_feedback_core/file), que está bajo MIT. El código nuestro es escritura nueva (Node + SPA vanilla), pero el modelo de datos y reglas son los suyos.
2. **Visibilidad.** La organización tiene actualmente 3 repos privados; un repo público sería el primero. El partido se autodeclara comprometido con la transparencia (Carta de Principios, Art. 12), pero un repo público también es visible para adversarios políticos.

## Decisión

- **Licencia: MIT.**
- **Visibilidad: público.**

## Alternativas consideradas

### Licencia

| Opción | Por qué se descartó |
|---|---|
| **AGPL-3.0** (copyleft fuerte) | Apropiado para infraestructura democrática (cualquier despliegue/fork debe liberar su código). Pero introduce fricción para que afiliados o instituciones aliadas puedan hospedar su instancia sin obligaciones legales que les exigirían liberar modificaciones internas. Para una herramienta cuya adopción depende de bajo costo de fricción, MIT facilita el fork "yo me llevo esto a mi org y lo opero". |
| **Sin licencia** ("All rights reserved") | Default. Hace al repo legalmente inutilizable para cualquiera que no sea el partido. Inconsistente con el propósito declarado de transparencia y reuso. |
| **GPL-3.0** | Copyleft pero sin la cláusula AGPL para SaaS. Restringe sin proteger la cláusula clave (despliegue como servicio sin liberar código). Lo peor de ambos mundos. |

### Visibilidad

| Opción | Por qué se descartó |
|---|---|
| **Privado** | Coherente con los 3 repos privados existentes en la org. Pero contradice el espíritu del proyecto: la transparencia radical está en la Carta y en la lógica de la bitácora pública. Un repo privado de la herramienta de transparencia es contradictorio. |

## Consecuencias

### A favor

- **Coherencia con upstream.** LiquidFeedback Core es MIT; mantenemos la licencia idéntica al origen del modelo.
- **Coherencia con el principio.** El partido declara que la soberanía reside en el individuo y que la operación interna debe ser inspeccionable. Repo público + licencia permisiva alinea infra con discurso.
- **Reduce fricción para auditoría externa.** Cualquiera puede clonar, ejecutar, verificar el cómputo de tally Condorcet, contrastar contra el seed.
- **Facilita réplicas.** Otra organización puede hospedar su instancia sin pedir permiso.

### En contra

- **Visibilidad para adversarios.** El régimen cubano y otros actores pueden auditar el código en busca de vulnerabilidades. Mitigación: el código no contiene secretos, los datos demo del seed son ficticios, y el modelo de amenazas asume adversarios sofisticados desde el inicio (ver ADR-003).
- **MIT no obliga a forks a publicar mejoras.** Un fork comercial podría tomar el código y nunca contribuir cambios upstream. Aceptable: el objetivo no es construir un producto comercial sino una herramienta que el partido use y que cualquiera pueda copiar tal cual.

## Referencias

- LICENSE
- Commit a6c0cfb (initial commit)
- README.md sección "Stack" (referencia LF upstream)
