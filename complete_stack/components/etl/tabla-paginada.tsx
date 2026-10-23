"use client"

import * as React from "react"
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { paginar } from "@/lib/etl/filtros"
import type { RegistroValido } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"
import { fmtEntero, fmtFechaUTC, fmtNumero } from "./formato"

export type Columna<T> = {
  id: string
  cabecera: React.ReactNode
  celda: (fila: T) => React.ReactNode
  numerica?: boolean
  className?: string
}

export const TAMANO_PAGINA = 25

export const columnasRegistro: Columna<RegistroValido>[] = [
  { id: "ciudad", cabecera: "Ciudad", celda: (r) => r.ciudad },
  {
    id: "fecha",
    cabecera: "Fecha y hora (UTC)",
    celda: (r) => <span className="font-mono tabular-nums">{fmtFechaUTC(r.fecha_hora)}</span>,
  },
  { id: "t", cabecera: "Temperatura (°C)", numerica: true, celda: (r) => fmtNumero(r.temperatura_c) },
  { id: "h", cabecera: "Humedad (%)", numerica: true, celda: (r) => fmtNumero(r.humedad_pct) },
  { id: "p", cabecera: "Precipitación (mm)", numerica: true, celda: (r) => fmtNumero(r.precipitacion_mm) },
]

// La paginación es solo de visualización: recibe las filas ya filtradas y
// ordenadas y muestra un trozo.
export function TablaPaginada<T>({
  filas,
  columnas,
  claveFila,
  pagina,
  alCambiarPagina,
  vacio = "No hay registros.",
  claseFila,
  etiqueta,
}: {
  filas: T[]
  columnas: Columna<T>[]
  claveFila: (fila: T) => string
  pagina: number
  alCambiarPagina: (pagina: number) => void
  vacio?: string
  claseFila?: (fila: T) => string | undefined
  etiqueta: string
}) {
  const totalPaginas = Math.max(1, Math.ceil(filas.length / TAMANO_PAGINA))
  const actual = Math.min(pagina, totalPaginas - 1)
  const visibles = paginar(filas, actual, TAMANO_PAGINA)
  const desde = filas.length === 0 ? 0 : actual * TAMANO_PAGINA + 1
  const hasta = actual * TAMANO_PAGINA + visibles.length

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border">
        <Table aria-label={etiqueta}>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {columnas.map((c) => (
                <TableHead key={c.id} className={cn(c.numerica && "text-end", c.className)}>
                  {c.cabecera}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnas.length} className="py-8 text-center text-muted-foreground">
                  {vacio}
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((fila) => (
                <TableRow key={claveFila(fila)} className={claseFila?.(fila)}>
                  {columnas.map((c) => (
                    <TableCell
                      key={c.id}
                      className={cn(c.numerica && "text-end font-mono tabular-nums", c.className)}
                    >
                      {c.celda(fila)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Paginacion
        pagina={actual}
        totalPaginas={totalPaginas}
        alCambiar={alCambiarPagina}
        resumen={`Mostrando ${fmtEntero(desde)}–${fmtEntero(hasta)} de ${fmtEntero(filas.length)}`}
      />
    </div>
  )
}

export function Paginacion({
  pagina,
  totalPaginas,
  alCambiar,
  resumen,
}: {
  pagina: number
  totalPaginas: number
  alCambiar: (pagina: number) => void
  resumen: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{resumen}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => alCambiar(pagina - 1)}
          disabled={pagina <= 0}
        >
          <CaretLeftIcon aria-hidden /> Anterior
        </Button>
        <span className="px-2 tabular-nums">
          Página {fmtEntero(pagina + 1)} de {fmtEntero(totalPaginas)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => alCambiar(pagina + 1)}
          disabled={pagina >= totalPaginas - 1}
        >
          Siguiente <CaretRightIcon aria-hidden />
        </Button>
      </div>
    </div>
  )
}
