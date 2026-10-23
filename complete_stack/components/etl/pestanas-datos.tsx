"use client"

import * as React from "react"
import { ArrowClockwiseIcon, DownloadSimpleIcon } from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ciudadPorId } from "@/lib/etl/ciudades"
import { construirUrl } from "@/lib/etl/extraccion"
import type { FilaRechazada, FilaTransformada } from "@/lib/etl/tipos"
import { cn } from "@/lib/utils"
import { EtiquetaEstado } from "./estado"
import { descargarJson, fmtCrudo, fmtDuracion, fmtEntero, fmtFechaUTC } from "./formato"
import { TablaPaginada, type Columna } from "./tabla-paginada"
import type { Extraccion } from "./tipos-ui"

const MUESTRA_ARRAY = 24

// Recorta los arrays largos para mostrarlos; el JSON completo se descarga.
function recortar(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.length > MUESTRA_ARRAY
      ? [...valor.slice(0, MUESTRA_ARRAY), `… ${valor.length - MUESTRA_ARRAY} elementos más`]
      : valor
  }
  if (typeof valor === "object" && valor !== null) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, recortar(v)]))
  }
  return valor
}

// Arrays en una sola línea para que se aprecie la estructura de arrays paralelos.
function jsonCompacto(valor: unknown) {
  return JSON.stringify(recortar(valor), null, 2).replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, dentro: string) =>
    `[${dentro.replace(/\s*\n\s*/g, " ")}]`
  )
}

export function PestanaJson({
  extraccion,
  alReintentar,
}: {
  extraccion: Extraccion | null
  alReintentar: (id: string) => void
}) {
  const [elegida, setElegida] = React.useState<string | null>(null)
  if (!extraccion) return <Vacio texto="Todavía no se ha extraído nada." />
  const id = elegida && extraccion.ciudades.includes(elegida) ? elegida : extraccion.ciudades[0]
  const estado = extraccion.porCiudad[id]
  const ciudad = ciudadPorId(id)!
  const completas = extraccion.ciudades.filter((c) => extraccion.porCiudad[c].respuesta !== undefined)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Ciudad" className="flex flex-wrap gap-1">
          {extraccion.ciudades.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={c === id ? "secondary" : "ghost"}
              aria-pressed={c === id}
              onClick={() => setElegida(c)}
            >
              {ciudadPorId(c)!.nombre}
              {extraccion.porCiudad[c].estado === "error" && <span className="text-destructive">(error)</span>}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={completas.length === 0}
          onClick={() =>
            descargarJson(
              `open-meteo_${extraccion.inicio}_${extraccion.fin}.json`,
              Object.fromEntries(
                completas.map((c) => [ciudadPorId(c)!.nombre, extraccion.porCiudad[c].respuesta])
              )
            )
          }
        >
          <DownloadSimpleIcon aria-hidden /> Descargar todas ({completas.length})
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/50 p-2 text-[0.6875rem]">
        <EtiquetaEstado estado={estado.estado} />
        <span>Duración: {fmtDuracion(estado.duracionMs)}</span>
        {estado.recibidoEn && <span>Recibido: {estado.recibidoEn}</span>}
        <a
          className="min-w-0 truncate font-mono text-muted-foreground underline-offset-2 hover:underline"
          href={construirUrl(ciudad, extraccion.inicio, extraccion.fin)}
          target="_blank"
          rel="noreferrer"
        >
          {construirUrl(ciudad, extraccion.inicio, extraccion.fin)}
        </a>
      </div>

      {estado.estado === "error" && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo descargar {ciudad.nombre}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {estado.error}
            <Button size="sm" variant="outline" onClick={() => alReintentar(id)}>
              <ArrowClockwiseIcon aria-hidden /> Reintentar {ciudad.nombre}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {estado.respuesta !== undefined && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.6875rem] text-muted-foreground">
              Respuesta original sin modificar. Los arrays se muestran recortados a {MUESTRA_ARRAY} elementos;
              la descarga contiene el JSON completo.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                descargarJson(`open-meteo_${id}_${extraccion.inicio}_${extraccion.fin}.json`, estado.respuesta)
              }
            >
              <DownloadSimpleIcon aria-hidden /> {ciudad.nombre}.json
            </Button>
          </div>
          <pre className="max-h-[28rem] overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[0.6875rem] leading-relaxed">
            {jsonCompacto(estado.respuesta)}
          </pre>
        </>
      )}
    </div>
  )
}

function Crudo({ valor }: { valor: unknown }) {
  const problema = typeof valor !== "number" || !Number.isFinite(valor)
  return (
    <span className={cn(problema && "rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-950 dark:text-amber-200")}>
      {fmtCrudo(valor)}
    </span>
  )
}

const COLUMNAS_TRANSFORMADAS: Columna<FilaTransformada>[] = [
  { id: "ciudad", cabecera: "Ciudad", celda: (f) => f.ciudad },
  { id: "indice", cabecera: "Posición en array", numerica: true, celda: (f) => f.indice },
  { id: "original", cabecera: "time (texto API)", celda: (f) => <span className="font-mono">{fmtCrudo(f.fecha_original)}</span> },
  {
    id: "fecha",
    cabecera: "fecha_hora (UTC)",
    celda: (f) => (f.fecha_hora ? <span className="font-mono">{fmtFechaUTC(f.fecha_hora)}</span> : <Crudo valor={null} />),
  },
  { id: "t", cabecera: "Temperatura (°C)", numerica: true, celda: (f) => <Crudo valor={f.temperatura_c} /> },
  { id: "h", cabecera: "Humedad (%)", numerica: true, celda: (f) => <Crudo valor={f.humedad_pct} /> },
  { id: "p", cabecera: "Precipitación (mm)", numerica: true, celda: (f) => <Crudo valor={f.precipitacion_mm} /> },
]

export function PestanaTransformados({ filas, avisos }: { filas: FilaTransformada[]; avisos: string[] }) {
  const [pagina, setPagina] = React.useState(0)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.6875rem] text-muted-foreground">
        Cada posición <code>i</code> de los arrays <code>time</code>, <code>temperature_2m</code>,{" "}
        <code>relative_humidity_2m</code> y <code>precipitation</code> se convierte en una fila. Los valores se
        muestran tal como llegaron; los resaltados (null, ausentes, texto) se evaluarán en la limpieza.
      </p>
      {avisos.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Avisos de la transformación</AlertTitle>
          <AlertDescription>
            <ul className="list-disc ps-4">
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <TablaPaginada
        etiqueta="Datos transformados"
        filas={filas}
        columnas={COLUMNAS_TRANSFORMADAS}
        claveFila={(f) => f.clave}
        pagina={pagina}
        alCambiarPagina={setPagina}
        vacio="No hay datos transformados."
      />
    </div>
  )
}

const COLUMNAS_RECHAZADAS: Columna<FilaRechazada>[] = [
  {
    id: "tipo",
    cabecera: "Tipo",
    celda: (r) => (
      <Badge variant={r.tipo === "duplicado" ? "secondary" : "destructive"}>
        {r.tipo === "duplicado" ? "Duplicado" : "Calidad"}
      </Badge>
    ),
  },
  { id: "ciudad", cabecera: "Ciudad", celda: (r) => r.fila.ciudad || "(sin ciudad)" },
  { id: "pos", cabecera: "Posición", numerica: true, celda: (r) => r.fila.indice },
  { id: "time", cabecera: "time (texto API)", celda: (r) => <span className="font-mono">{fmtCrudo(r.fila.fecha_original)}</span> },
  { id: "t", cabecera: "Temp. (°C)", numerica: true, celda: (r) => <Crudo valor={r.fila.temperatura_c} /> },
  { id: "h", cabecera: "Humedad (%)", numerica: true, celda: (r) => <Crudo valor={r.fila.humedad_pct} /> },
  { id: "p", cabecera: "Precip. (mm)", numerica: true, celda: (r) => <Crudo valor={r.fila.precipitacion_mm} /> },
  { id: "motivo", cabecera: "Motivo del rechazo", className: "whitespace-normal min-w-56", celda: (r) => r.motivos.join("; ") },
]

export function PestanaRechazados({ rechazados }: { rechazados: FilaRechazada[] }) {
  const [pagina, setPagina] = React.useState(0)
  const [tipo, setTipo] = React.useState<"todos" | "calidad" | "duplicado">("todos")
  const filas = tipo === "todos" ? rechazados : rechazados.filter((r) => r.tipo === tipo)
  const cuenta = (t: string) => rechazados.filter((r) => r.tipo === t).length
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.6875rem] text-muted-foreground">
        Descartes por <strong>calidad</strong> del dato: falta de ciudad o fecha, mediciones null, vacías o no
        numéricas, humedad fuera de 0–100 % o precipitación negativa, y <strong>duplicados</strong> por ciudad y
        fecha_hora (se conserva la primera aparición). Los registros que solo quedan fuera por tus filtros no están
        aquí: siguen siendo válidos.
      </p>
      <div role="group" aria-label="Tipo de rechazo" className="flex flex-wrap gap-1">
        {(
          [
            ["todos", `Todos (${fmtEntero(rechazados.length)})`],
            ["calidad", `Calidad (${fmtEntero(cuenta("calidad"))})`],
            ["duplicado", `Duplicados (${fmtEntero(cuenta("duplicado"))})`],
          ] as const
        ).map(([valor, texto]) => (
          <Button
            key={valor}
            size="sm"
            variant={tipo === valor ? "secondary" : "ghost"}
            aria-pressed={tipo === valor}
            onClick={() => {
              setTipo(valor)
              setPagina(0)
            }}
          >
            {texto}
          </Button>
        ))}
      </div>
      <TablaPaginada
        etiqueta="Registros rechazados"
        filas={filas}
        columnas={COLUMNAS_RECHAZADAS}
        claveFila={(r) => r.fila.clave}
        pagina={pagina}
        alCambiarPagina={setPagina}
        vacio="Ningún registro rechazado."
      />
    </div>
  )
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">{texto}</p>
}
