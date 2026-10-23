"use client"

import * as React from "react"
import { ArrowClockwiseIcon, DatabaseIcon } from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { ORDEN_INICIAL, type Orden } from "@/lib/etl/filtros"
import { fmtEntero, fmtFechaUTC, fmtNumero } from "./formato"
import { claseSelect, SelectorOrden } from "./selector-orden"
import { Paginacion, TAMANO_PAGINA } from "./tabla-paginada"

type FilaPersistida = {
  id: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  importado_en: string
}

type Consulta = { ciudad: string; desde: string; hasta: string; orden: Orden; pagina: number }

const iso = (v: string) => new Date(v).toISOString()

export function PestanaSupabase({ disponible, motivo }: { disponible: boolean; motivo: string | null }) {
  const [consulta, setConsulta] = React.useState<Consulta>({
    ciudad: "",
    desde: "",
    hasta: "",
    orden: ORDEN_INICIAL,
    pagina: 0,
  })
  const [resultado, setResultado] = React.useState<{
    filas: FilaPersistida[]
    total: number
    leidoEn: string
  } | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const leer = React.useCallback(async (c: Consulta) => {
    setCargando(true)
    setError(null)
    const p = new URLSearchParams({
      orden: c.orden.campo,
      direccion: c.orden.direccion,
      pagina: String(c.pagina),
      tamano: String(TAMANO_PAGINA),
    })
    if (c.ciudad) p.set("ciudad", c.ciudad)
    // Las fechas del formulario son días UTC completos.
    if (c.desde) p.set("desde", iso(`${c.desde}T00:00:00Z`))
    if (c.hasta) p.set("hasta", iso(`${c.hasta}T23:59:59Z`))
    try {
      const r = await fetch(`/api/mediciones?${p}`, { cache: "no-store" })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setResultado({ filas: j.filas, total: j.total, leidoEn: new Date().toLocaleTimeString("es-ES") })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCargando(false)
    }
  }, [])

  const aplicar = (parcial: Partial<Consulta>) => {
    const nueva = { ...consulta, pagina: 0, ...parcial }
    setConsulta(nueva)
    if (disponible) void leer(nueva)
  }

  const totalPaginas = Math.max(1, Math.ceil((resultado?.total ?? 0) / TAMANO_PAGINA))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="flex items-center gap-2 font-heading text-sm font-medium">
            <DatabaseIcon aria-hidden /> Datos persistidos en Supabase
            <Badge variant="secondary">Leídos de la base de datos</Badge>
          </h3>
          <p className="text-[0.6875rem] text-muted-foreground">
            A diferencia de las demás pestañas (datos locales de esta sesión, aún no guardados), aquí se lee la tabla{" "}
            <code>mediciones_meteorologicas</code> a través del servidor. Cada consulta usa <code>ORDER BY</code>.
          </p>
        </div>
        <Button variant="outline" onClick={() => void leer(consulta)} disabled={!disponible || cargando}>
          <ArrowClockwiseIcon aria-hidden className={cargando ? "animate-spin" : undefined} />
          {resultado ? "Actualizar" : "Leer datos"}
        </Button>
      </div>

      {!disponible && (
        <Alert>
          <AlertTitle>No se puede leer Supabase</AlertTitle>
          <AlertDescription>{motivo}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sb-ciudad">Ciudad</Label>
          <select
            id="sb-ciudad"
            className={claseSelect}
            value={consulta.ciudad}
            onChange={(e) => aplicar({ ciudad: e.target.value })}
          >
            <option value="">Todas</option>
            {NOMBRES_CIUDADES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sb-desde">Desde (UTC)</Label>
          <Input id="sb-desde" type="date" value={consulta.desde} onChange={(e) => aplicar({ desde: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sb-hasta">Hasta (UTC, incluido)</Label>
          <Input id="sb-hasta" type="date" value={consulta.hasta} onChange={(e) => aplicar({ hasta: e.target.value })} />
        </div>
        <SelectorOrden orden={consulta.orden} alCambiar={(orden) => aplicar({ orden })} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error al leer Supabase</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {resultado && (
        <div className="flex flex-col gap-2" aria-busy={cargando}>
          <div className="overflow-hidden rounded-lg border">
            <Table aria-label="Registros persistidos en Supabase">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-end">id</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Fecha y hora (UTC)</TableHead>
                  <TableHead className="text-end">Temperatura (°C)</TableHead>
                  <TableHead className="text-end">Humedad (%)</TableHead>
                  <TableHead className="text-end">Precipitación (mm)</TableHead>
                  <TableHead>Importado en (UTC)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.filas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No hay registros persistidos con estos filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  resultado.filas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-end font-mono tabular-nums">{f.id}</TableCell>
                      <TableCell>{f.ciudad}</TableCell>
                      <TableCell className="font-mono tabular-nums">{fmtFechaUTC(iso(f.fecha_hora))}</TableCell>
                      <TableCell className="text-end font-mono tabular-nums">{fmtNumero(f.temperatura_c)}</TableCell>
                      <TableCell className="text-end font-mono tabular-nums">{fmtNumero(f.humedad_pct)}</TableCell>
                      <TableCell className="text-end font-mono tabular-nums">{fmtNumero(f.precipitacion_mm)}</TableCell>
                      <TableCell className="font-mono text-muted-foreground tabular-nums">
                        {iso(f.importado_en).slice(0, 19).replace("T", " ")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Paginacion
            pagina={consulta.pagina}
            totalPaginas={totalPaginas}
            alCambiar={(pagina) => {
              const nueva = { ...consulta, pagina }
              setConsulta(nueva)
              void leer(nueva)
            }}
            resumen={`${fmtEntero(resultado.total)} registros en Supabase · leído a las ${resultado.leidoEn}`}
          />
        </div>
      )}
    </div>
  )
}
