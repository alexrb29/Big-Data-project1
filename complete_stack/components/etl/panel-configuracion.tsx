"use client"

import { DownloadSimpleIcon } from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CIUDADES } from "@/lib/etl/ciudades"
import { diasEntre, FECHA_MINIMA, MAX_DIAS, validarConfiguracion } from "@/lib/etl/extraccion"
import { fmtEntero } from "./formato"

export function PanelConfiguracion({
  ciudades,
  inicio,
  fin,
  hoy,
  alCambiarCiudades,
  alCambiarInicio,
  alCambiarFin,
  alExtraer,
  bloqueado,
  motivoBloqueo,
}: {
  ciudades: string[]
  inicio: string
  fin: string
  hoy: string
  alCambiarCiudades: (ids: string[]) => void
  alCambiarInicio: (v: string) => void
  alCambiarFin: (v: string) => void
  alExtraer: () => void
  bloqueado: boolean
  motivoBloqueo?: string
}) {
  const errores = validarConfiguracion(ciudades, inicio, fin, hoy)
  const dias = diasEntre(inicio, fin)
  const diasValidos = dias !== null && dias > 0 && dias <= MAX_DIAS
  const registros = diasValidos ? ciudades.length * dias * 24 : 0
  const todas = ciudades.length === CIUDADES.length

  const alternar = (id: string, marcada: boolean) => {
    // Se conserva el orden de la lista para que el procesamiento sea reproducible.
    const nuevas = new Set(ciudades)
    if (marcada) nuevas.add(id)
    else nuevas.delete(id)
    alCambiarCiudades(CIUDADES.filter((c) => nuevas.has(c.id)).map((c) => c.id))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[0.625rem] text-background">
            1
          </span>
          Configuración de extracción
        </CardTitle>
        <CardDescription>
          Datos horarios del archivo histórico de Open-Meteo en UTC: temperatura a 2 m (°C), humedad
          relativa (%) y precipitación (mm).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-[1.4fr_1fr_1fr]">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 flex w-full items-center justify-between text-xs font-medium">
            Ciudades
            <Button
              variant="link"
              size="xs"
              className="h-auto px-0 text-foreground underline"
              onClick={() => alCambiarCiudades(todas ? [] : CIUDADES.map((c) => c.id))}
            >
              {todas ? "Quitar todas" : "Marcar todas"}
            </Button>
          </legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-2">
            {CIUDADES.map((c) => (
              <Label key={c.id} className="flex cursor-pointer items-center gap-2 text-xs font-normal">
                <Checkbox
                  checked={ciudades.includes(c.id)}
                  onCheckedChange={(v) => alternar(c.id, v)}
                />
                <span>
                  {c.nombre}
                  <span className="ms-1 font-mono text-[0.625rem] text-muted-foreground">
                    {c.latitud}, {c.longitud}
                  </span>
                </span>
              </Label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inicio">Fecha inicial (UTC)</Label>
            <Input
              id="inicio"
              type="date"
              min={FECHA_MINIMA}
              max={hoy}
              value={inicio}
              onChange={(e) => alCambiarInicio(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fin">Fecha final (UTC, incluida)</Label>
            <Input
              id="fin"
              type="date"
              min={FECHA_MINIMA}
              max={hoy}
              value={fin}
              onChange={(e) => alCambiarFin(e.target.value)}
            />
          </div>
          <p className="text-[0.6875rem] text-muted-foreground">
            Máximo {MAX_DIAS} días por extracción. Los últimos días pueden llegar incompletos
            (null) porque el archivo se actualiza con retraso.
          </p>
        </div>

        <div className="flex flex-col justify-between gap-3">
          <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3 text-xs">
            <dt className="text-muted-foreground">Ciudades</dt>
            <dd className="text-end font-mono tabular-nums">{ciudades.length}</dd>
            <dt className="text-muted-foreground">Días</dt>
            <dd className="text-end font-mono tabular-nums">{dias !== null && dias > 0 ? dias : "—"}</dd>
            <dt className="text-muted-foreground">Peticiones</dt>
            <dd className="text-end font-mono tabular-nums">{ciudades.length}</dd>
            <dt className="font-medium">Registros previstos</dt>
            <dd className="text-end font-mono font-medium tabular-nums">
              {diasValidos ? fmtEntero(registros) : "—"}
            </dd>
            <dd className="col-span-2 text-[0.625rem] text-muted-foreground">
              ciudades × días × 24 horas
            </dd>
          </dl>
          <Button
            size="lg"
            onClick={alExtraer}
            disabled={errores.length > 0 || bloqueado}
            title={motivoBloqueo}
          >
            <DownloadSimpleIcon aria-hidden /> Extraer datos
          </Button>
        </div>

        {(errores.length > 0 || motivoBloqueo) && (
          <Alert variant="destructive" className="md:col-span-3" role="alert">
            <AlertTitle>No se puede extraer todavía</AlertTitle>
            <AlertDescription>
              <ul className="list-disc ps-4">
                {errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {motivoBloqueo && <li>{motivoBloqueo}</li>}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
