// Fila resultante de convertir los arrays paralelos de Open-Meteo.
// Los valores se conservan tal como llegaron (pueden ser null, cadenas o
// estar ausentes); la limpieza decide si son válidos.
export type FilaTransformada = {
  clave: string
  ciudad: string
  indice: number
  fecha_original: unknown
  fecha_hora: string | null
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
}

// Registro normalizado y validado: el que puede subirse a Supabase.
export type Registro = {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export type RegistroValido = Registro & {
  // ciudad|fecha_hora: identifica el registro en la selección y en destino.
  clave: string
}

export type TipoRechazo = "calidad" | "duplicado"

export type FilaRechazada = {
  fila: FilaTransformada
  tipo: TipoRechazo
  motivos: string[]
}

export const COLUMNAS_ORDEN = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
] as const

export type CampoOrden = (typeof COLUMNAS_ORDEN)[number]
export type DireccionOrden = "asc" | "desc"

export function claveRegistro(ciudad: string, fechaHora: string) {
  return `${ciudad}|${fechaHora}`
}
