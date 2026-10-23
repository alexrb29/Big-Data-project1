import type { Ciudad } from "./ciudades"

export const URL_ARCHIVO = "https://archive-api.open-meteo.com/v1/archive"
export const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const
export const MAX_DIAS = 31
// Primer día disponible en el archivo histórico de Open-Meteo.
export const FECHA_MINIMA = "1940-01-01"

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/

export function hoyUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function fechaADia(fecha: string): number | null {
  if (!FORMATO_FECHA.test(fecha)) return null
  const ms = Date.parse(`${fecha}T00:00:00Z`)
  if (Number.isNaN(ms)) return null
  // Rechaza fechas imposibles como 2026-02-30, que Date normaliza.
  if (new Date(ms).toISOString().slice(0, 10) !== fecha) return null
  return ms / 86_400_000
}

export function diasEntre(inicio: string, fin: string): number | null {
  const a = fechaADia(inicio)
  const b = fechaADia(fin)
  if (a === null || b === null) return null
  return b - a + 1
}

export function validarConfiguracion(
  ciudades: string[],
  inicio: string,
  fin: string,
  hoy = hoyUTC()
): string[] {
  const errores: string[] = []
  if (ciudades.length === 0) errores.push("Selecciona al menos una ciudad.")
  const a = fechaADia(inicio)
  const b = fechaADia(fin)
  if (a === null) errores.push("La fecha inicial no es válida.")
  if (b === null) errores.push("La fecha final no es válida.")
  if (a !== null && b !== null) {
    if (b < a) {
      errores.push("La fecha final debe ser igual o posterior a la inicial.")
    } else if (b - a + 1 > MAX_DIAS) {
      errores.push(
        `El periodo tiene ${b - a + 1} días; el máximo por extracción es ${MAX_DIAS}.`
      )
    }
    if (inicio < FECHA_MINIMA) {
      errores.push(`El archivo histórico empieza el ${FECHA_MINIMA}.`)
    }
    if (fin > hoy) {
      errores.push(`La fecha final no puede ser posterior a hoy (${hoy}, UTC).`)
    }
  }
  return errores
}

export function construirUrl(ciudad: Ciudad, inicio: string, fin: string) {
  const params = new URLSearchParams({
    latitude: String(ciudad.latitud),
    longitude: String(ciudad.longitud),
    start_date: inicio,
    end_date: fin,
    hourly: VARIABLES_HORARIAS.join(","),
    timezone: "UTC",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
    timeformat: "iso8601",
  })
  return `${URL_ARCHIVO}?${params}`
}

export async function descargarCiudad(
  ciudad: Ciudad,
  inicio: string,
  fin: string,
  fetchFn: typeof fetch = fetch
): Promise<unknown> {
  let respuesta: Response
  try {
    respuesta = await fetchFn(construirUrl(ciudad, inicio, fin))
  } catch (e) {
    throw new Error(
      `No se pudo conectar con Open-Meteo (${e instanceof Error ? e.message : String(e)}).`
    )
  }
  const texto = await respuesta.text()
  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    throw new Error(`Respuesta no JSON (HTTP ${respuesta.status}).`)
  }
  if (!respuesta.ok) {
    const motivo =
      typeof cuerpo === "object" && cuerpo !== null && "reason" in cuerpo
        ? String((cuerpo as { reason: unknown }).reason)
        : respuesta.statusText
    throw new Error(`HTTP ${respuesta.status}: ${motivo}`)
  }
  return cuerpo
}
