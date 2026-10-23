const numero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 })
const entero = new Intl.NumberFormat("es-ES")

export function fmtNumero(v: number) {
  return numero.format(v)
}

export function fmtEntero(v: number) {
  return entero.format(v)
}

// "2026-09-01T13:00:00.000Z" → "2026-09-01 13:00". Las cabeceras indican UTC.
export function fmtFechaUTC(iso: string) {
  return iso.slice(0, 16).replace("T", " ")
}

export function fmtDuracion(ms: number | undefined) {
  if (ms === undefined) return "—"
  if (ms < 1) return "< 1 ms"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} s`
}

// Muestra un valor crudo sin disfrazarlo: null, ausente y "" se ven como tales.
export function fmtCrudo(v: unknown): string {
  if (v === undefined) return "(ausente)"
  if (v === null) return "null"
  if (typeof v === "string") return JSON.stringify(v)
  if (typeof v === "number") return String(v)
  return JSON.stringify(v)
}

export function descargarJson(nombre: string, datos: unknown) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
