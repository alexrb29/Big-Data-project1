import type { Lote, ResultadoVerificacion } from "@/lib/etl/carga"
import type { FilaRechazada, FilaTransformada, RegistroValido } from "@/lib/etl/tipos"
import type { Estado } from "./estado"

export type EstadoCiudad = {
  estado: Estado
  respuesta?: unknown // JSON original, sin modificar
  error?: string
  duracionMs?: number
  recibidoEn?: string
}

export type Extraccion = {
  inicio: string
  fin: string
  ciudades: string[] // ids, en el orden de procesamiento
  porCiudad: Record<string, EstadoCiudad>
}

export type Procesado = {
  horasRecibidas: number
  filas: FilaTransformada[]
  avisos: string[]
  validos: RegistroValido[]
  rechazados: FilaRechazada[]
  duracionTransformacionMs: number
  duracionLimpiezaMs: number
}

export type Carga = {
  // Copia congelada del conjunto seleccionado y su orden al pulsar «Subir».
  congelado: RegistroValido[]
  congeladoEn: string
  lotes: Lote[]
  enCurso: boolean
  duracionMs?: number
  verificacion?: ResultadoVerificacion & { enCurso: boolean }
}

export type EstadoServidor = {
  urlConfigurada: boolean
  host: string | null
  claveSecretaConfigurada: boolean
  apiHabilitada: boolean
}
