import type { Registro, RegistroValido } from "./tipos"

export const TAMANO_LOTE = 500

export type EstadoLote = "pendiente" | "enviando" | "completado" | "error"

export type Lote = {
  numero: number
  registros: RegistroValido[]
  estado: EstadoLote
  error?: string
  duracionMs?: number
  intentos: number
}

export function dividirEnLotes(registros: RegistroValido[], tamano = TAMANO_LOTE): Lote[] {
  const lotes: Lote[] = []
  for (let i = 0; i < registros.length; i += tamano) {
    lotes.push({
      numero: lotes.length + 1,
      registros: registros.slice(i, i + tamano),
      estado: "pendiente",
      intentos: 0,
    })
  }
  return lotes
}

export function aRegistro(r: RegistroValido): Registro {
  return {
    ciudad: r.ciudad,
    fecha_hora: r.fecha_hora,
    temperatura_c: r.temperatura_c,
    humedad_pct: r.humedad_pct,
    precipitacion_mm: r.precipitacion_mm,
  }
}

export type EnviarLote = (registros: Registro[]) => Promise<void>

// Envía secuencialmente los lotes indicados (por defecto, los no completados).
// Un fallo no detiene los demás ni altera el estado de los ya completados.
export async function ejecutarLotes(
  lotes: Lote[],
  enviar: EnviarLote,
  alCambiar: (lotes: Lote[]) => void,
  numeros?: number[]
): Promise<Lote[]> {
  let estado = lotes.map((l) => ({ ...l }))
  const objetivo = new Set(
    numeros ?? estado.filter((l) => l.estado !== "completado").map((l) => l.numero)
  )
  const actualizar = (numero: number, cambio: Partial<Lote>) => {
    estado = estado.map((l) => (l.numero === numero ? { ...l, ...cambio } : l))
    alCambiar(estado)
  }

  for (const lote of lotes) {
    if (!objetivo.has(lote.numero)) continue
    actualizar(lote.numero, { estado: "enviando", error: undefined, intentos: lote.intentos + 1 })
    const t0 = performance.now()
    try {
      await enviar(lote.registros.map(aRegistro))
      actualizar(lote.numero, { estado: "completado", duracionMs: performance.now() - t0 })
    } catch (e) {
      actualizar(lote.numero, {
        estado: "error",
        error: e instanceof Error ? e.message : String(e),
        duracionMs: performance.now() - t0,
      })
    }
  }
  return estado
}

export type ConsultarClaves = (
  claves: { ciudad: string; fecha_hora: string }[]
) => Promise<string[]>

export type ResultadoVerificacion = {
  comprobados: number
  encontrados: number
  confirmadas: string[]
  ausentes: string[]
  errores: string[]
}

// Comprueba por lotes que cada clave enviada existe en destino.
export async function verificarClaves(
  registros: RegistroValido[],
  consultar: ConsultarClaves,
  tamano = TAMANO_LOTE
): Promise<ResultadoVerificacion> {
  const resultado: ResultadoVerificacion = {
    comprobados: 0,
    encontrados: 0,
    confirmadas: [],
    ausentes: [],
    errores: [],
  }
  for (let i = 0; i < registros.length; i += tamano) {
    const trozo = registros.slice(i, i + tamano)
    try {
      const encontradas = new Set(
        await consultar(trozo.map((r) => ({ ciudad: r.ciudad, fecha_hora: r.fecha_hora })))
      )
      resultado.comprobados += trozo.length
      for (const r of trozo) {
        if (encontradas.has(r.clave)) {
          resultado.encontrados++
          resultado.confirmadas.push(r.clave)
        } else resultado.ausentes.push(r.clave)
      }
    } catch (e) {
      resultado.errores.push(
        `Registros ${i + 1}–${i + trozo.length}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }
  return resultado
}
