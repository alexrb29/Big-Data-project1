import {
  claveRegistro,
  type FilaRechazada,
  type FilaTransformada,
  type RegistroValido,
} from "./tipos"

export type ResultadoLimpieza = {
  validos: RegistroValido[]
  rechazados: FilaRechazada[]
}

// Describe por qué un valor no es una medición utilizable. Nunca convierte
// null, cadenas vacías o ausencias en cero.
function problemaNumerico(nombre: string, valor: unknown): string | null {
  if (valor === undefined) return `${nombre} ausente`
  if (valor === null) return `${nombre} nula (null)`
  if (typeof valor === "string") {
    return valor.trim() === "" ? `${nombre} vacía ("")` : `${nombre} no numérica ("${valor}")`
  }
  if (typeof valor !== "number") return `${nombre} de tipo ${typeof valor}`
  if (!Number.isFinite(valor)) return `${nombre} no finita (${valor})`
  return null
}

export function motivosDeRechazo(fila: FilaTransformada): string[] {
  const motivos: string[] = []
  if (typeof fila.ciudad !== "string" || fila.ciudad.trim() === "") {
    motivos.push("sin ciudad")
  }
  if (fila.fecha_hora === null) {
    motivos.push(
      fila.fecha_original === undefined
        ? "fecha_hora ausente"
        : `fecha_hora no válida (${JSON.stringify(fila.fecha_original)})`
    )
  }
  const t = problemaNumerico("temperatura", fila.temperatura_c)
  if (t) motivos.push(t)
  const h = problemaNumerico("humedad", fila.humedad_pct)
  if (h) motivos.push(h)
  else if ((fila.humedad_pct as number) < 0 || (fila.humedad_pct as number) > 100) {
    motivos.push(`humedad fuera de rango 0–100 % (${fila.humedad_pct})`)
  }
  const p = problemaNumerico("precipitación", fila.precipitacion_mm)
  if (p) motivos.push(p)
  else if ((fila.precipitacion_mm as number) < 0) {
    motivos.push(`precipitación negativa (${fila.precipitacion_mm} mm)`)
  }
  // Las temperaturas no se filtran por umbrales: un valor extremo pero
  // numérico es un dato, no un error.
  return motivos
}

// Valida cada fila y elimina duplicados por (ciudad, fecha_hora).
// Política de duplicados: se conserva la PRIMERA aparición válida en el orden
// de procesamiento (orden de ciudades extraídas y, dentro de cada una, orden
// del array de la API). Las posteriores se rechazan indicando cuál se conservó.
export function limpiar(filas: FilaTransformada[]): ResultadoLimpieza {
  const validos: RegistroValido[] = []
  const rechazados: FilaRechazada[] = []
  const vistos = new Map<string, FilaTransformada>()

  for (const fila of filas) {
    const motivos = motivosDeRechazo(fila)
    if (motivos.length > 0) {
      rechazados.push({ fila, tipo: "calidad", motivos })
      continue
    }
    const fechaHora = fila.fecha_hora as string
    const clave = claveRegistro(fila.ciudad, fechaHora)
    const previa = vistos.get(clave)
    if (previa) {
      rechazados.push({
        fila,
        tipo: "duplicado",
        motivos: [
          `duplicado de ${fila.ciudad} ${fechaHora}: se conserva la primera aparición (posición ${previa.indice} del array)`,
        ],
      })
      continue
    }
    vistos.set(clave, fila)
    validos.push({
      clave,
      ciudad: fila.ciudad,
      fecha_hora: fechaHora,
      temperatura_c: fila.temperatura_c as number,
      humedad_pct: fila.humedad_pct as number,
      precipitacion_mm: fila.precipitacion_mm as number,
    })
  }
  return { validos, rechazados }
}
