import type { CampoOrden, DireccionOrden, RegistroValido } from "./tipos"

// Los campos numéricos y de fecha son cadenas tal como las escribe el usuario;
// "" significa "sin límite".
export type Filtros = {
  ciudades: string[] // vacío = todas
  desde: string // datetime-local interpretado como UTC
  hasta: string
  tempMin: string
  tempMax: string
  humMin: string
  humMax: string
  precMin: string
  precMax: string
  soloLluvia: boolean
}

export type Orden = { campo: CampoOrden; direccion: DireccionOrden }

export const FILTROS_INICIALES: Filtros = {
  ciudades: [],
  desde: "",
  hasta: "",
  tempMin: "",
  tempMax: "",
  humMin: "",
  humMax: "",
  precMin: "",
  precMax: "",
  soloLluvia: false,
}

export const ORDEN_INICIAL: Orden = { campo: "fecha_hora", direccion: "asc" }

type Limite = { valor: number | null; error?: string }

function numero(texto: string, etiqueta: string): Limite {
  if (texto.trim() === "") return { valor: null }
  const v = Number(texto.replace(",", "."))
  return Number.isFinite(v) ? { valor: v } : { valor: null, error: `${etiqueta}: "${texto}" no es un número.` }
}

function instante(texto: string, etiqueta: string): Limite {
  if (texto.trim() === "") return { valor: null }
  // datetime-local no lleva zona: se añade Z para tratarlo como UTC.
  const base = texto.length === 16 ? `${texto}:00` : texto
  const ms = Date.parse(`${base}Z`)
  return Number.isNaN(ms) ? { valor: null, error: `${etiqueta}: fecha no válida.` } : { valor: ms }
}

export type ResultadoFiltrado = { registros: RegistroValido[]; errores: string[] }

export function filtrar(validos: RegistroValido[], f: Filtros): ResultadoFiltrado {
  const lim = {
    desde: instante(f.desde, "Desde"),
    hasta: instante(f.hasta, "Hasta"),
    tempMin: numero(f.tempMin, "Temperatura mínima"),
    tempMax: numero(f.tempMax, "Temperatura máxima"),
    humMin: numero(f.humMin, "Humedad mínima"),
    humMax: numero(f.humMax, "Humedad máxima"),
    precMin: numero(f.precMin, "Precipitación mínima"),
    precMax: numero(f.precMax, "Precipitación máxima"),
  }
  const errores = Object.values(lim).flatMap((l) => (l.error ? [l.error] : []))
  const pares: [Limite, Limite, string][] = [
    [lim.desde, lim.hasta, "La fecha «desde» es posterior a «hasta»."],
    [lim.tempMin, lim.tempMax, "La temperatura mínima supera la máxima."],
    [lim.humMin, lim.humMax, "La humedad mínima supera la máxima."],
    [lim.precMin, lim.precMax, "La precipitación mínima supera la máxima."],
  ]
  for (const [a, b, msg] of pares) {
    if (a.valor !== null && b.valor !== null && a.valor > b.valor) errores.push(msg)
  }

  const ciudades = new Set(f.ciudades)
  const dentro = (v: number, min: Limite, max: Limite) =>
    (min.valor === null || v >= min.valor) && (max.valor === null || v <= max.valor)

  const registros = validos.filter((r) => {
    if (ciudades.size > 0 && !ciudades.has(r.ciudad)) return false
    if (!dentro(Date.parse(r.fecha_hora), lim.desde, lim.hasta)) return false
    if (!dentro(r.temperatura_c, lim.tempMin, lim.tempMax)) return false
    if (!dentro(r.humedad_pct, lim.humMin, lim.humMax)) return false
    if (!dentro(r.precipitacion_mm, lim.precMin, lim.precMax)) return false
    if (f.soloLluvia && !(r.precipitacion_mm > 0)) return false
    return true
  })
  return { registros, errores }
}

function comparar(a: RegistroValido, b: RegistroValido, campo: CampoOrden): number {
  const x = a[campo]
  const y = b[campo]
  if (typeof x === "number" && typeof y === "number") return x - y
  return String(x).localeCompare(String(y), "es")
}

// Ordenación estable con desempate por ciudad y fecha, para que el orden de
// la vista previa sea siempre reproducible.
export function ordenar(registros: RegistroValido[], orden: Orden): RegistroValido[] {
  const signo = orden.direccion === "asc" ? 1 : -1
  return [...registros].sort(
    (a, b) =>
      signo * comparar(a, b, orden.campo) ||
      comparar(a, b, "ciudad") ||
      comparar(a, b, "fecha_hora")
  )
}

// Conjunto exacto que se subiría: filas seleccionadas que siguen cumpliendo
// los filtros actuales, en el orden elegido.
export function conjuntoDeCarga(ordenados: RegistroValido[], seleccion: ReadonlySet<string>) {
  return ordenados.filter((r) => seleccion.has(r.clave))
}

// Orden de operaciones: válidos → filtros → ordenación. La duración medida es
// solo informativa (se muestra en la fase «Filtrado y selección»).
export function filtrarYOrdenar(validos: RegistroValido[], f: Filtros, orden: Orden) {
  const t0 = performance.now()
  const { registros, errores } = filtrar(validos, f)
  const ordenados = ordenar(registros, orden)
  return { ordenados, errores, duracionMs: performance.now() - t0 }
}

export function paginar<T>(filas: T[], pagina: number, tamano: number): T[] {
  return filas.slice(pagina * tamano, (pagina + 1) * tamano)
}
