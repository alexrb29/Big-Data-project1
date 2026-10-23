"use client"

import * as React from "react"
import { ArrowCounterClockwiseIcon, CheckSquareIcon, XSquareIcon } from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FILTROS_INICIALES, paginar, type Filtros, type Orden } from "@/lib/etl/filtros"
import type { RegistroValido } from "@/lib/etl/tipos"
import { fmtEntero } from "./formato"
import { SelectorOrden } from "./selector-orden"
import { columnasRegistro, TablaPaginada, TAMANO_PAGINA, type Columna } from "./tabla-paginada"

function Rango({
  id,
  etiqueta,
  min,
  max,
  alCambiar,
  tipo = "number",
  paso,
}: {
  id: string
  etiqueta: string
  min: string
  max: string
  alCambiar: (min: string, max: string) => void
  tipo?: "number" | "datetime-local"
  paso?: string
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-medium">{etiqueta}</legend>
      <div className="grid grid-cols-2 gap-1.5">
        <Input
          id={`${id}-min`}
          aria-label={`${etiqueta}: ${tipo === "number" ? "mínimo" : "desde"}`}
          placeholder={tipo === "number" ? "mín." : undefined}
          type={tipo}
          step={paso}
          value={min}
          onChange={(e) => alCambiar(e.target.value, max)}
        />
        <Input
          id={`${id}-max`}
          aria-label={`${etiqueta}: ${tipo === "number" ? "máximo" : "hasta"}`}
          placeholder={tipo === "number" ? "máx." : undefined}
          type={tipo}
          step={paso}
          value={max}
          onChange={(e) => alCambiar(min, e.target.value)}
        />
      </div>
    </fieldset>
  )
}

export function PestanaValidos({
  validos,
  coinciden,
  errores,
  filtros,
  alCambiarFiltros,
  orden,
  alCambiarOrden,
  seleccion,
  alCambiarSeleccion,
  ciudades,
}: {
  validos: RegistroValido[]
  coinciden: RegistroValido[] // ya filtrados y ordenados
  errores: string[]
  filtros: Filtros
  alCambiarFiltros: (f: Filtros) => void
  orden: Orden
  alCambiarOrden: (o: Orden) => void
  seleccion: ReadonlySet<string>
  alCambiarSeleccion: (s: Set<string>) => void
  ciudades: string[]
}) {
  const [pagina, setPagina] = React.useState(0)
  const [vista, setVista] = React.useState<"coinciden" | "excluidos">("coinciden")

  const claves = React.useMemo(() => new Set(coinciden.map((r) => r.clave)), [coinciden])
  const excluidos = React.useMemo(() => validos.filter((r) => !claves.has(r.clave)), [validos, claves])
  const filas = vista === "coinciden" ? coinciden : excluidos
  const seleccionadasCoinciden = coinciden.filter((r) => seleccion.has(r.clave)).length

  const cambiar = (parcial: Partial<Filtros>) => {
    alCambiarFiltros({ ...filtros, ...parcial })
    setPagina(0)
  }

  const visibles = paginar(filas, Math.min(pagina, Math.max(0, Math.ceil(filas.length / TAMANO_PAGINA) - 1)), TAMANO_PAGINA)
  const marcadasPagina = visibles.filter((r) => seleccion.has(r.clave)).length

  const alternarFila = (clave: string, marcada: boolean) => {
    const s = new Set(seleccion)
    if (marcada) s.add(clave)
    else s.delete(clave)
    alCambiarSeleccion(s)
  }
  const alternarPagina = (marcar: boolean) => {
    const s = new Set(seleccion)
    for (const r of visibles) {
      if (marcar) s.add(r.clave)
      else s.delete(r.clave)
    }
    alCambiarSeleccion(s)
  }

  const columnas: Columna<RegistroValido>[] = [
    {
      id: "sel",
      className: "w-8",
      cabecera: (
        <Checkbox
          aria-label="Seleccionar las filas de esta página"
          checked={visibles.length > 0 && marcadasPagina === visibles.length}
          indeterminate={marcadasPagina > 0 && marcadasPagina < visibles.length}
          disabled={visibles.length === 0}
          onCheckedChange={(v) => alternarPagina(v)}
        />
      ),
      celda: (r) => (
        <Checkbox
          aria-label={`Seleccionar ${r.ciudad} ${r.fecha_hora}`}
          checked={seleccion.has(r.clave)}
          onCheckedChange={(v) => alternarFila(r.clave, v)}
        />
      ),
    },
    ...columnasRegistro,
  ]

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Filtros" className="flex flex-col gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-sm font-medium">Filtros sobre los registros válidos</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              alCambiarFiltros(FILTROS_INICIALES)
              setPagina(0)
            }}
          >
            <ArrowCounterClockwiseIcon aria-hidden /> Restablecer filtros
          </Button>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-medium">
            Ciudades <span className="font-normal text-muted-foreground">(ninguna marcada = todas)</span>
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {ciudades.map((c) => (
              <Label key={c} className="flex cursor-pointer items-center gap-2 text-xs font-normal">
                <Checkbox
                  checked={filtros.ciudades.includes(c)}
                  onCheckedChange={(v) =>
                    cambiar({ ciudades: v ? [...filtros.ciudades, c] : filtros.ciudades.filter((x) => x !== c) })
                  }
                />
                {c}
              </Label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Rango
            id="fecha"
            etiqueta="Fecha y hora (UTC)"
            tipo="datetime-local"
            min={filtros.desde}
            max={filtros.hasta}
            alCambiar={(desde, hasta) => cambiar({ desde, hasta })}
          />
          <Rango
            id="temp"
            etiqueta="Temperatura (°C)"
            paso="0.1"
            min={filtros.tempMin}
            max={filtros.tempMax}
            alCambiar={(tempMin, tempMax) => cambiar({ tempMin, tempMax })}
          />
          <Rango
            id="hum"
            etiqueta="Humedad (%)"
            paso="1"
            min={filtros.humMin}
            max={filtros.humMax}
            alCambiar={(humMin, humMax) => cambiar({ humMin, humMax })}
          />
          <Rango
            id="prec"
            etiqueta="Precipitación (mm)"
            paso="0.1"
            min={filtros.precMin}
            max={filtros.precMax}
            alCambiar={(precMin, precMax) => cambiar({ precMin, precMax })}
          />
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
            <Checkbox checked={filtros.soloLluvia} onCheckedChange={(v) => cambiar({ soloLluvia: v })} />
            Solo registros con lluvia (precipitación &gt; 0 mm)
          </Label>
          <SelectorOrden
            orden={orden}
            alCambiar={(o) => {
              alCambiarOrden(o)
              setPagina(0)
            }}
          />
        </div>
        {errores.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Revisa los filtros</AlertTitle>
            <AlertDescription>
              Los límites no válidos se ignoran:
              <ul className="list-disc ps-4">
                {errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </section>

      <section aria-label="Selección" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label="Vista" className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={vista === "coinciden" ? "secondary" : "ghost"}
              aria-pressed={vista === "coinciden"}
              onClick={() => {
                setVista("coinciden")
                setPagina(0)
              }}
            >
              Coinciden con los filtros ({fmtEntero(coinciden.length)})
            </Button>
            <Button
              size="sm"
              variant={vista === "excluidos" ? "secondary" : "ghost"}
              aria-pressed={vista === "excluidos"}
              onClick={() => {
                setVista("excluidos")
                setPagina(0)
              }}
            >
              Excluidos por filtros ({fmtEntero(excluidos.length)})
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={coinciden.length === 0 || seleccionadasCoinciden === coinciden.length}
              onClick={() => alCambiarSeleccion(new Set([...seleccion, ...claves]))}
            >
              <CheckSquareIcon aria-hidden /> Seleccionar las {fmtEntero(coinciden.length)} que cumplen los filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={seleccion.size === 0}
              onClick={() => alCambiarSeleccion(new Set())}
            >
              <XSquareIcon aria-hidden /> Vaciar selección
            </Button>
          </div>
        </div>
        <p className="text-[0.6875rem] text-muted-foreground">
          {vista === "coinciden"
            ? "La casilla de la cabecera marca solo la página visible. Cambiar los filtros nunca añade filas a la selección."
            : "Estos registros son válidos pero no cumplen los filtros actuales. Aunque estén seleccionados, no se subirán."}
        </p>
        <TablaPaginada
          etiqueta={vista === "coinciden" ? "Registros que coinciden con los filtros" : "Registros excluidos por filtros"}
          filas={filas}
          columnas={columnas}
          claveFila={(r) => r.clave}
          pagina={pagina}
          alCambiarPagina={setPagina}
          claseFila={(r) => (seleccion.has(r.clave) ? "bg-primary/10" : undefined)}
          vacio={vista === "coinciden" ? "Ningún registro cumple los filtros." : "Ningún registro queda excluido."}
        />
        {vista === "excluidos" && excluidos.some((r) => seleccion.has(r.clave)) && (
          <Badge variant="outline">
            {fmtEntero(excluidos.filter((r) => seleccion.has(r.clave)).length)} seleccionados fuera de filtros
          </Badge>
        )}
      </section>
    </div>
  )
}
