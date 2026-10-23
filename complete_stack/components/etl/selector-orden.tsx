"use client"

import { SortAscendingIcon, SortDescendingIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { Orden } from "@/lib/etl/filtros"
import { COLUMNAS_ORDEN, type CampoOrden } from "@/lib/etl/tipos"

export const ETIQUETAS_CAMPO: Record<CampoOrden, string> = {
  ciudad: "Ciudad",
  fecha_hora: "Fecha y hora",
  temperatura_c: "Temperatura",
  humedad_pct: "Humedad",
  precipitacion_mm: "Precipitación",
}

export const claseSelect =
  "h-7 rounded-md border border-input bg-input/20 px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"

export function SelectorOrden({ orden, alCambiar }: { orden: Orden; alCambiar: (o: Orden) => void }) {
  const asc = orden.direccion === "asc"
  return (
    <div className="flex items-end gap-1.5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="orden-campo">Ordenar por</Label>
        <select
          id="orden-campo"
          className={claseSelect}
          value={orden.campo}
          onChange={(e) => alCambiar({ ...orden, campo: e.target.value as CampoOrden })}
        >
          {COLUMNAS_ORDEN.map((c) => (
            <option key={c} value={c}>
              {ETIQUETAS_CAMPO[c]}
            </option>
          ))}
        </select>
      </div>
      <Button
        variant="outline"
        onClick={() => alCambiar({ ...orden, direccion: asc ? "desc" : "asc" })}
        aria-label={`Dirección: ${asc ? "ascendente" : "descendente"}. Pulsa para cambiar.`}
      >
        {asc ? <SortAscendingIcon aria-hidden /> : <SortDescendingIcon aria-hidden />}
        {asc ? "Ascendente" : "Descendente"}
      </Button>
    </div>
  )
}
