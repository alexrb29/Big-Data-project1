import { NOMBRES_CIUDADES } from "./ciudades"
import { TAMANO_LOTE } from "./carga"
import { claveRegistro, type Registro } from "./tipos"

// Un lote de 500 registros ocupa unos 60 KB; se deja margen sin aceptar
// cuerpos arbitrariamente grandes.
export const MAX_BYTES_PETICION = 200_000

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
const CAMPOS = ["ciudad", "fecha_hora", "temperatura_c", "humedad_pct", "precipitacion_mm"]

export type ResultadoValidacion =
  | { ok: true; registros: Registro[] }
  | { ok: false; errores: string[] }

function fechaIsoValida(v: unknown): v is string {
  if (typeof v !== "string" || !ISO_UTC.test(v)) return false
  const ms = Date.parse(v)
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 19) === v.slice(0, 19)
}

const finito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

// Revalida en servidor todo lo que llega del navegador: no se confía en la
// limpieza hecha en cliente.
export function validarLote(cuerpo: unknown): ResultadoValidacion {
  const registros =
    typeof cuerpo === "object" && cuerpo !== null
      ? (cuerpo as { registros?: unknown }).registros
      : undefined
  if (!Array.isArray(registros)) {
    return { ok: false, errores: ['Se esperaba un objeto con un array "registros".'] }
  }
  if (registros.length === 0) return { ok: false, errores: ["El lote está vacío."] }
  if (registros.length > TAMANO_LOTE) {
    return { ok: false, errores: [`El lote tiene ${registros.length} registros; el máximo es ${TAMANO_LOTE}.`] }
  }

  const errores: string[] = []
  const claves = new Set<string>()
  registros.forEach((r: unknown, i) => {
    const pos = `Registro ${i + 1}`
    if (typeof r !== "object" || r === null || Array.isArray(r)) {
      errores.push(`${pos}: no es un objeto.`)
      return
    }
    const o = r as Record<string, unknown>
    const extra = Object.keys(o).filter((k) => !CAMPOS.includes(k))
    if (extra.length) errores.push(`${pos}: campos no permitidos (${extra.join(", ")}).`)
    if (typeof o.ciudad !== "string" || !NOMBRES_CIUDADES.includes(o.ciudad)) {
      errores.push(`${pos}: ciudad no reconocida.`)
    }
    if (!fechaIsoValida(o.fecha_hora)) errores.push(`${pos}: fecha_hora debe ser ISO 8601 en UTC.`)
    if (!finito(o.temperatura_c)) errores.push(`${pos}: temperatura_c debe ser un número finito.`)
    if (!finito(o.humedad_pct) || o.humedad_pct < 0 || o.humedad_pct > 100) {
      errores.push(`${pos}: humedad_pct debe estar entre 0 y 100.`)
    }
    if (!finito(o.precipitacion_mm) || o.precipitacion_mm < 0) {
      errores.push(`${pos}: precipitacion_mm debe ser ≥ 0.`)
    }
    if (typeof o.ciudad === "string" && typeof o.fecha_hora === "string") {
      // Postgres no admite que un mismo upsert afecte dos veces a la misma fila.
      const clave = claveRegistro(o.ciudad, new Date(o.fecha_hora).toISOString())
      if (claves.has(clave)) errores.push(`${pos}: clave duplicada en el lote (${clave}).`)
      claves.add(clave)
    }
  })

  if (errores.length > 0) {
    const max = 20
    return {
      ok: false,
      errores: errores.length > max ? [...errores.slice(0, max), `… y ${errores.length - max} errores más.`] : errores,
    }
  }
  return {
    ok: true,
    registros: (registros as Registro[]).map((r) => ({
      ciudad: r.ciudad,
      fecha_hora: r.fecha_hora,
      temperatura_c: r.temperatura_c,
      humedad_pct: r.humedad_pct,
      precipitacion_mm: r.precipitacion_mm,
    })),
  }
}

export function validarClaves(
  cuerpo: unknown
): { ok: true; claves: { ciudad: string; fecha_hora: string }[] } | { ok: false; error: string } {
  const claves =
    typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { claves?: unknown }).claves : undefined
  if (!Array.isArray(claves) || claves.length === 0 || claves.length > TAMANO_LOTE) {
    return { ok: false, error: `Se esperaban entre 1 y ${TAMANO_LOTE} claves.` }
  }
  for (const c of claves) {
    if (
      typeof c !== "object" ||
      c === null ||
      typeof c.ciudad !== "string" ||
      !NOMBRES_CIUDADES.includes(c.ciudad) ||
      !fechaIsoValida(c.fecha_hora)
    ) {
      return { ok: false, error: "Alguna clave no tiene ciudad o fecha_hora válidas." }
    }
  }
  return { ok: true, claves }
}

// Lee el cuerpo comprobando el tamaño antes y después de recibirlo (la
// cabecera Content-Length puede faltar o no ser fiable).
export async function leerJsonLimitado(
  request: Request
): Promise<{ ok: true; cuerpo: unknown } | { ok: false; estado: number; error: string }> {
  const declarado = Number(request.headers.get("content-length") ?? "0")
  if (declarado > MAX_BYTES_PETICION) {
    return { ok: false, estado: 413, error: `La petición supera ${MAX_BYTES_PETICION} bytes.` }
  }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).length > MAX_BYTES_PETICION) {
    return { ok: false, estado: 413, error: `La petición supera ${MAX_BYTES_PETICION} bytes.` }
  }
  try {
    return { ok: true, cuerpo: JSON.parse(texto) }
  } catch {
    return { ok: false, estado: 400, error: "El cuerpo no es JSON válido." }
  }
}
