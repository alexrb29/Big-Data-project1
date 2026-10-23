import type { FilaTransformada } from "./tipos"

export type ResultadoTransformacion = {
  filas: FilaTransformada[]
  avisos: string[]
}

// Open-Meteo devuelve horas sin zona ("2026-09-01T00:00") cuando se pide
// timezone=UTC. Se aceptan también con segundos o con "Z" explícita; nunca
// se deja que el navegador las interprete en hora local.
const FORMATO_HORA = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?Z?$/

export function fechaUTC(valor: unknown): string | null {
  if (typeof valor !== "string") return null
  const m = FORMATO_HORA.exec(valor.trim())
  if (!m) return null
  const iso = `${m[1]}${m[2] ?? ":00"}Z`
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  const normalizada = new Date(ms).toISOString()
  // Date normaliza fechas imposibles (2026-02-30 → 2026-03-02): se rechazan.
  if (normalizada.slice(0, 19) !== iso.slice(0, 19)) return null
  return normalizada
}

function longitud(valor: unknown): number | null {
  return Array.isArray(valor) ? valor.length : null
}

// Convierte los arrays paralelos de "hourly" en una fila por ciudad y hora.
export function transformarCiudad(
  ciudad: string,
  respuesta: unknown
): ResultadoTransformacion {
  const avisos: string[] = []
  const hourly =
    typeof respuesta === "object" && respuesta !== null
      ? (respuesta as { hourly?: unknown }).hourly
      : undefined
  if (typeof hourly !== "object" || hourly === null) {
    return { filas: [], avisos: [`${ciudad}: la respuesta no contiene "hourly".`] }
  }
  const h = hourly as Record<string, unknown>
  const arrays = {
    time: h.time,
    temperature_2m: h.temperature_2m,
    relative_humidity_2m: h.relative_humidity_2m,
    precipitation: h.precipitation,
  }
  if (!Array.isArray(arrays.time)) {
    return { filas: [], avisos: [`${ciudad}: "hourly.time" no es un array.`] }
  }

  const longitudes = Object.entries(arrays).map(([nombre, v]) => [nombre, longitud(v)] as const)
  const ausentes = longitudes.filter(([, l]) => l === null).map(([n]) => n)
  if (ausentes.length > 0) {
    avisos.push(`${ciudad}: faltan los arrays ${ausentes.join(", ")}.`)
  }
  const distintas = new Set(longitudes.map(([, l]) => l ?? 0))
  if (distintas.size > 1) {
    avisos.push(
      `${ciudad}: longitudes incoherentes (${longitudes
        .map(([n, l]) => `${n}=${l ?? "ausente"}`)
        .join(", ")}). Las posiciones sin valor se marcan como ausentes.`
    )
  }

  // Se recorre la longitud máxima para que ningún dato quede oculto: las
  // posiciones que falten en un array quedan como undefined (ausente).
  const total = Math.max(...longitudes.map(([, l]) => l ?? 0))
  const en = (v: unknown, i: number) => (Array.isArray(v) ? v[i] : undefined)
  const filas: FilaTransformada[] = []
  for (let i = 0; i < total; i++) {
    const original = en(arrays.time, i)
    filas.push({
      clave: `${ciudad}#${i}`,
      ciudad,
      indice: i,
      fecha_original: original,
      fecha_hora: fechaUTC(original),
      temperatura_c: en(arrays.temperature_2m, i),
      humedad_pct: en(arrays.relative_humidity_2m, i),
      precipitacion_mm: en(arrays.precipitation, i),
    })
  }
  return { filas, avisos }
}
