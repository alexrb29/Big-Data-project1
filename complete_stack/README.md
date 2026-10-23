# Pipeline ETL: Open-Meteo → Supabase

Primera práctica de Big Data. La aplicación extrae mediciones horarias del archivo histórico de
[Open-Meteo](https://open-meteo.com/en/docs/historical-weather-api), las transforma, las limpia y deja
filtrarlas y seleccionarlas antes de cargarlas en Supabase. Cada fase muestra su estado, sus contadores y su
duración real.

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui (Base UI) y `@supabase/supabase-js`.

## Instalación

```bash
npm install
cp .env.example .env.local   # y rellena los valores
```

## Configuración

### 1. Variables de entorno (`.env.local`)

| Variable | Dónde se usa | Obligatoria |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_URL` | Servidor | Sí |
| `SUPABASE_SECRET_KEY` | Solo servidor (clave `sb_secret_…` o `service_role`) | Sí, para cargar y leer |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No se usa: todo pasa por el servidor | No |
| `ETL_PERMITIR_EN_PRODUCCION` | Habilita las rutas `/api` en producción | No (por defecto, `false`) |

La clave secreta está en Supabase, en **Project Settings → API Keys → Secret keys**. Nunca le pongas el prefijo
`NEXT_PUBLIC_`, porque Next.js la incluiría en el JavaScript del navegador.

Sin la clave secreta, la extracción, la transformación, la limpieza y la selección funcionan igual. El botón de
carga queda deshabilitado y la aplicación indica qué falta. Nunca se simula una carga.

### 2. Migración SQL

Ejecuta [`supabase/migrations/20261023000000_mediciones_meteorologicas.sql`](supabase/migrations/20261023000000_mediciones_meteorologicas.sql)
en el **SQL Editor** de Supabase o con `supabase db push`. La migración crea la tabla
`mediciones_meteorologicas` con:

- una restricción única `(ciudad, fecha_hora)`;
- restricciones `CHECK` para la humedad (entre 0 y 100) y la precipitación (≥ 0);
- RLS activado y sin políticas: `anon` y `authenticated` no pueden leer ni escribir.

## Ejecución

```bash
npm run dev                # http://localhost:3000
npm test                   # pruebas unitarias con fixtures controlados
npm run test:integracion   # prueba contra la API real de Open-Meteo (requiere red)
npm run typecheck && npm run lint && npm run build
```

## El pipeline

1. **Extracción.** Una petición por ciudad, en secuencia, a `archive-api.open-meteo.com/v1/archive` con
   `timezone=UTC`, `temperature_unit=celsius` y `precipitation_unit=mm`. Cada extracción abarca 31 días como
   máximo. El JSON original se guarda sin modificar durante la sesión (en memoria) y se puede descargar. Si una
   ciudad falla, se puede reintentar solo esa ciudad: su respuesta sustituye a la anterior, así que no se
   duplican datos.
2. **Transformación.** Los arrays paralelos de `hourly` se convierten en una fila por ciudad y hora. Se comprueba
   que todos los arrays tienen la misma longitud; si no la tienen, aparece un aviso y las posiciones que faltan
   quedan como *ausentes*. Las horas (`2026-09-01T00:00`, sin zona) se interpretan explícitamente como UTC.
3. **Limpieza.** Se rechaza cada fila sin ciudad, sin fecha válida o con alguna medición `null`, vacía, no
   numérica o no finita. Ningún valor así se convierte en 0. También se rechazan la humedad fuera de 0–100 y la
   precipitación negativa. Las temperaturas extremas **no** se descartan. Para los duplicados por
   `(ciudad, fecha_hora)` se conserva **la primera aparición** en el orden de procesamiento (orden de ciudades y,
   dentro de cada una, orden del array), y las siguientes se rechazan indicando cuál se conservó. Cada fila
   rechazada guarda su motivo.
4. **Filtrado y selección.** El orden de las operaciones es: válidos → filtros → ordenación → selección → carga.
   La paginación solo afecta a lo que se ve. «Seleccionar las N que cumplen los filtros» incluye todas las
   páginas. Cambiar los filtros nunca añade filas a la selección. Solo se suben las filas seleccionadas que
   siguen cumpliendo los filtros, y se indica cuántas quedan fuera. Los descartes por calidad (pestaña
   «Rechazados») se muestran separados de los registros excluidos por filtros (vista «Excluidos por filtros»).
5. **Carga.** Al pulsar «Subir» se congela una copia del conjunto y de su orden. Se envía en lotes de 500 como
   máximo a `/api/carga`, que vuelve a validar cada registro y el tamaño de la petición (200 KB como máximo) y
   hace un `upsert` con `onConflict: ciudad,fecha_hora`. Repetir la carga actualiza filas en lugar de
   duplicarlas. Cada lote tiene su propio estado. Si un lote falla, los anteriores se conservan y se pueden
   reintentar solo los fallidos. Supabase no distingue entre filas insertadas y actualizadas, así que se informa
   de «procesados», sin inventar ese desglose. Al terminar, `/api/verificar` comprueba por lotes que cada clave
   enviada existe en destino.

La pestaña **Datos en Supabase** lee la tabla real, con paginación, filtros y orden. Una base de datos no
conserva el orden de inserción: para leer en un orden concreto hace falta `ORDER BY`.

## Seguridad

- Toda escritura y lectura en Supabase se hace en el servidor (`lib/supabase/servidor.ts` importa
  `server-only`). La clave secreta nunca llega al navegador ni se escribe en los logs.
- RLS sigue activado y no hay políticas públicas.
- **El proyecto no tiene autenticación.** Las rutas `/api/carga`, `/api/verificar` y `/api/mediciones` están
  abiertas solo en desarrollo. En producción (`next start` o Vercel) responden 403 salvo que se defina
  `ETL_PERMITIR_EN_PRODUCCION=true`. **No lo actives en un despliegue público sin proteger antes esas rutas**
  (por ejemplo, con Supabase Auth o la protección por contraseña de Vercel): cualquiera podría escribir en tu
  tabla.

## Estructura

```
app/api/{carga,verificar,mediciones,estado}/route.ts   Rutas de servidor
lib/etl/        Lógica pura: extracción, transformación, limpieza, filtros, carga, validación
lib/supabase/   Cliente de servidor con la clave secreta
components/etl/ Interfaz: configuración, pipeline, pestañas de inspección
supabase/migrations/   Migración SQL
tests/          Pruebas y fixtures (no se usan nunca en la aplicación)
```
