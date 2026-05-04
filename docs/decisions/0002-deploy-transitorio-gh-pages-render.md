# ADR-002 · Deploy transitorio en GitHub Pages + Render

| Estado | Fecha |
|---|---|
| Vigente (transitorio) — convive con [ADR-003](0003-stack-b-camino-soberano.md) | 2026-05-04 |

## Contexto

El servidor original (`server.js` + `db.json` + SPA estática en `public/`) corría como un proceso único en localhost. Para enseñarle el proyecto a la directiva del partido y validar UX con afiliados de prueba, hacía falta una URL pública.

Restricciones:
- Costo $0 inicial.
- Tiempo de setup minutos, no horas (estamos en PoC, no en producción).
- Tener algo que enseñar a la directiva en la próxima reunión interna.
- Acceso desde múltiples geografías (Florida, Madrid, posiblemente Cuba con VPN).
- Pipeline reproducible (push → deploy automático).

Restricciones que **no** aplican aún:
- Persistencia durable (los datos demo se pueden regenerar desde seed).
- Auth real (la SPA tiene un switcher de afiliado en cliente; no hay sesiones).
- Soberanía operacional plena (eso lo aborda [ADR-003](0003-stack-b-camino-soberano.md)).

## Decisión

Deploy en dos partes, separadas por CORS:

- **Frontend** estático servido por **GitHub Pages** desde `public/`.
- **Backend** Node servido por **Render free tier** consumiendo `render.yaml`.
- El cliente (`app.js`) detecta el dominio en `location.hostname`: si termina en `.github.io`, hace fetch a la URL fija de Render (`https://liquidfeedback-plc.onrender.com`); si no, paths relativos al mismo origen (dev local).
- El servidor añade headers CORS abiertos (`*`) y maneja OPTIONS preflight.

**Esta configuración está marcada como transitoria.** No es la arquitectura objetivo; es el camino de menor fricción para validar el pipeline. La trayectoria documentada en [ADR-003](0003-stack-b-camino-soberano.md) la reemplaza.

## Alternativas consideradas

### Cloudflare Pages + Workers + KV

Considerada y **rechazada** explícitamente. Las contras analizadas:

| Contra | Detalle |
|---|---|
| **Bloqueo OFAC a IPs cubanas** | Cloudflare aplica sanciones US selectivamente. La constituencia primaria del partido puede no poder acceder al sitio sin VPN. |
| **Riesgo de deplatforming político** | CF ha terminado servicios bajo presión pública (Daily Stormer 2017, 8chan 2019, Kiwifarms 2022). Un partido opositor que hará declaraciones políticas fuertes está a una orden ejecutiva o campaña mediática de perder el sitio. |
| **TLS termination centralizada** | CF descifra todo el tráfico para inspeccionarlo, incluida metadata sensible (quién apoya qué, delegaciones). Un actor estatal con cooperación legal de CF ve todo. |
| **Reescritura de `server.js`** | Workers runtime no tiene `node:fs` ni `node:http`. Cualquier port a CF requiere reescribir la persistencia y el dispatcher HTTP. |

### Render — frontend y backend juntos

Configuración más simple pero el frontend queda atado a Render. Si el backend rota a otro proveedor, el frontend tendría que migrar también. Separar GH Pages permite que el frontend sobreviva cualquier rotación del backend.

### Fly.io / Railway / Koyeb

Fly.io eliminó su free tier real (requiere CC, $5 mínimo). Railway pasó a paid tras periodo de prueba. Koyeb tiene free tier (1 servicio) y está en UE; sería superior a Render por jurisdicción, pero menos conocido y la decisión se tomó con base en familiaridad del equipo. Considerable rotar a Koyeb si Render presenta problemas.

### VPS (Hetzner €4–5/mes)

Soberano pero introduce ops manual desde día uno. Apropiado para alpha/beta (ver ADR-003) pero exceso de fricción para el PoC inicial.

## Consecuencias

### A favor

- **$0 inicial.** Free tier de ambos cubre completamente nuestro tráfico esperado.
- **Pipeline automático.** `git push origin main` dispara workflow de GH Actions que despliega Pages; Render auto-deploya backend al detectar push.
- **Frontend portable.** GH Pages sirve archivos estáticos; el código frontend no depende de runtime de servidor. Migrar a Codeberg Pages, IPFS, o servirlo desde el VPS de alpha es trivial.
- **CORS abierto seguro de momento.** No hay cookies ni auth de sesión, así que `*` no expone nada.

### En contra

- **Render free es efímero.** Disco se borra en cada redeploy/sleep. `db.sqlite` (post-Fase 1) vuelve al seed cada noche. Acceptable para PoC, **inviable para alpha vinculante**.
- **Cold start ~30 s** tras 15 min idle. Primera petición del día es lenta.
- **Dos proveedores US distintos.** GitHub (Microsoft) + Render. Cualquiera puede deplatform. Mitigación: ADR-003 mueve todo fuera.
- **`API_BASE` hardcoded en `app.js`.** Rotar el backend de Render a otro host requiere editar el cliente y rehacer push. Aceptable mientras la URL no rote.
- **GH Pages SPA hack.** El path `/LiquidFeedback-PLC/` requiere `<base>` dinámico inyectado por JS y un `404.html` clonado de `index.html`. Funciona pero añade complejidad que un dominio raíz custom eliminaría.

## Plan de salida

Esta arquitectura **no es el destino**. Cuando [ADR-003](0003-stack-b-camino-soberano.md) Fase 3 (deploy artifacts) esté lista, el backend se mueve a Oracle Always Free o VPS, y este ADR pasa a "Superado por ADR-003 Fase 3".

El frontend en GH Pages puede sobrevivir indefinidamente o moverse a Codeberg Pages para salir de US.

## Referencias

- `render.yaml`
- `.github/workflows/deploy-pages.yml`
- `public/app.js` líneas 1–10 (BASE_PATH, API_BASE)
- `public/index.html` script de inyección de `<base>`
- `server.js` constante `CORS` y handler de OPTIONS
- Commits f23a9b4, ec02c9b
