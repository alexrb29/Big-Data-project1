"use client"

import * as React from "react"
import { ArrowClockwiseIcon, CloudArrowUpIcon, InfoIcon } from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Orden } from "@/lib/etl/filtros"
import type { RegistroValido } from "@/lib/etl/tipos"
import { EtiquetaEstado, type Estado } from "./estado"
import { fmtDuracion, fmtEntero } from "./formato"
import { ETIQUETAS_CAMPO } from "./selector-orden"
import { columnasRegistro, TablaPaginada, type Columna } from "./tabla-paginada"
import type { Carga, EstadoServidor } from "./tipos-ui"

const ESTADO_LOTE: Record<string, Estado> = {
  pendiente: "pendiente",
  enviando: "en_curso",
  completado: "completada",
  error: "error",
}

export function motivoSinCarga(servidor: EstadoServidor | null): string | null {
  if (!servidor) return "Comprobando la configuración del servidor…"
  if (!servidor.apiHabilitada) return "La API de carga está deshabilitada en producción (ver README)."
  const falta = [
    !servidor.urlConfigurada && "SUPABASE_URL",
    !servidor.claveSecretaConfigurada && "SUPABASE_SECRET_KEY",
  ].filter(Boolean)
  return falta.length ? `Falta configurar en el servidor: ${falta.join(" y ")}.` : null
}

export function PestanaCarga({
  aSubir,
  orden,
  fueraDeFiltros,
  carga,
  confirmados,
  servidor,
  alSubir,
  alReintentarFallidos,
}: {
  aSubir: RegistroValido[]
  orden: Orden
  fueraDeFiltros: number
  carga: Carga | null
  confirmados: ReadonlySet<string>
  servidor: EstadoServidor | null
  alSubir: () => void
  alReintentarFallidos: () => void
}) {
  const [pagina, setPagina] = React.useState(0)
  const bloqueo = motivoSinCarga(servidor)
  const enCurso = Boolean(carga?.enCurso || carga?.verificacion?.enCurso)

  const columnas: Columna<RegistroValido>[] = [
    { id: "n", cabecera: "Nº", numerica: true, celda: (r) => fmtEntero(aSubir.indexOf(r) + 1) },
    ...columnasRegistro,
    {
      id: "destino",
      cabecera: "Estado",
      celda: (r) =>
        confirmados.has(r.clave) ? (
          <Badge variant="secondary">Verificado en Supabase</Badge>
        ) : (
          <Badge variant="outline">Local · pendiente</Badge>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h3 className="font-heading text-sm font-medium">Vista previa: conjunto exacto que se enviará</h3>
          <p className="text-[0.6875rem] text-muted-foreground">
            Filas seleccionadas que cumplen los filtros actuales, ordenadas por{" "}
            <strong>{ETIQUETAS_CAMPO[orden.campo].toLowerCase()}</strong> ({orden.direccion === "asc" ? "ascendente" : "descendente"}).
            Se enviarán en lotes de 500 como máximo, en este orden.
          </p>
        </div>
        <Button size="lg" onClick={alSubir} disabled={aSubir.length === 0 || enCurso || bloqueo !== null}>
          <CloudArrowUpIcon aria-hidden /> Subir {fmtEntero(aSubir.length)} registros a Supabase
        </Button>
      </div>

      {bloqueo && (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertTitle>La carga no está disponible</AlertTitle>
          <AlertDescription>{bloqueo} No se simula ninguna carga.</AlertDescription>
        </Alert>
      )}
      {fueraDeFiltros > 0 && (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertTitle>
            {fmtEntero(fueraDeFiltros)} filas seleccionadas quedan fuera de los filtros
          </AlertTitle>
          <AlertDescription>No se subirán mientras no vuelvan a cumplir los filtros.</AlertDescription>
        </Alert>
      )}

      <Alert>
        <InfoIcon aria-hidden />
        <AlertTitle>El orden no se guarda en la base de datos</AlertTitle>
        <AlertDescription>
          Una tabla relacional no conserva el orden de inserción. Para leer los datos en un orden concreto, cada
          consulta debe indicarlo con <code>ORDER BY</code> (por ejemplo,{" "}
          <code>order by fecha_hora, ciudad</code>).
        </AlertDescription>
      </Alert>

      <TablaPaginada
        etiqueta="Vista previa de la carga"
        filas={aSubir}
        columnas={columnas}
        claveFila={(r) => r.clave}
        pagina={pagina}
        alCambiarPagina={setPagina}
        vacio="No hay filas seleccionadas que cumplan los filtros."
      />

      {carga && <InformeCarga carga={carga} alReintentarFallidos={alReintentarFallidos} />}
    </div>
  )
}

function InformeCarga({ carga, alReintentarFallidos }: { carga: Carga; alReintentarFallidos: () => void }) {
  const ok = carga.lotes.filter((l) => l.estado === "completado")
  const fallidos = carga.lotes.filter((l) => l.estado === "error")
  const procesados = ok.reduce((s, l) => s + l.registros.length, 0)
  const noProcesados = fallidos.reduce((s, l) => s + l.registros.length, 0)
  const v = carga.verificacion

  return (
    <section aria-label="Informe de carga" className="flex flex-col gap-3 rounded-lg border p-3" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-medium">Carga en Supabase</h3>
        <span className="text-[0.6875rem] text-muted-foreground">
          Copia congelada de {fmtEntero(carga.congelado.length)} registros · {carga.congeladoEn}
          {carga.duracionMs !== undefined && ` · ${fmtDuracion(carga.duracionMs)}`}
        </span>
      </div>
      <p className="text-[0.6875rem] text-muted-foreground">
        Al pulsar «Subir» se copió el conjunto y su orden: cambiar filtros o selección ahora no altera esta carga.
      </p>

      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-md bg-muted/50 p-2">
          <dt className="text-muted-foreground">Procesados correctamente</dt>
          <dd className="font-mono text-base tabular-nums">{fmtEntero(procesados)}</dd>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <dt className="text-muted-foreground">Fallidos</dt>
          <dd className="font-mono text-base tabular-nums">{fmtEntero(noProcesados)}</dd>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <dt className="text-muted-foreground">Verificados en destino</dt>
          <dd className="font-mono text-base tabular-nums">
            {v ? (v.enCurso ? "…" : `${fmtEntero(v.encontrados)} / ${fmtEntero(v.comprobados)}`) : "—"}
          </dd>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <dt className="text-muted-foreground">Lotes</dt>
          <dd className="font-mono text-base tabular-nums">
            {ok.length} / {carga.lotes.length}
          </dd>
        </div>
      </dl>
      <p className="text-[0.6875rem] text-muted-foreground">
        «Procesados» incluye inserciones y actualizaciones: el upsert de Supabase no indica cuántas filas eran nuevas,
        así que no se inventa ese desglose.
      </p>

      <ol className="flex flex-col divide-y rounded-md border">
        {carga.lotes.map((l) => (
          <li key={l.numero} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-xs">
            <span className="w-14 font-medium">Lote {l.numero}</span>
            <EtiquetaEstado estado={ESTADO_LOTE[l.estado]} texto={l.estado === "enviando" ? "Enviando" : undefined} />
            <span className="font-mono text-muted-foreground tabular-nums">
              {fmtEntero(l.registros.length)} registros
            </span>
            {l.duracionMs !== undefined && (
              <span className="font-mono text-muted-foreground tabular-nums">{fmtDuracion(l.duracionMs)}</span>
            )}
            {l.intentos > 1 && <span className="text-muted-foreground">intento {l.intentos}</span>}
            {l.error && <span className="basis-full text-destructive">{l.error}</span>}
          </li>
        ))}
      </ol>

      {fallidos.length > 0 && !carga.enCurso && (
        <Button variant="outline" className="self-start" onClick={alReintentarFallidos}>
          <ArrowClockwiseIcon aria-hidden /> Reintentar {fallidos.length} lote{fallidos.length > 1 ? "s" : ""} fallido
          {fallidos.length > 1 ? "s" : ""}
        </Button>
      )}

      {v && !v.enCurso && (
        <Alert variant={v.ausentes.length || v.errores.length ? "destructive" : "default"}>
          <AlertTitle>Verificación en destino</AlertTitle>
          <AlertDescription>
            Se consultaron por lotes las claves (ciudad, fecha_hora) de los lotes completados:{" "}
            {fmtEntero(v.encontrados)} de {fmtEntero(v.comprobados)} existen en Supabase.
            {v.ausentes.length > 0 && ` Faltan ${fmtEntero(v.ausentes.length)}: ${v.ausentes.slice(0, 5).join(", ")}…`}
            {v.errores.map((e) => (
              <span key={e} className="block">
                {e}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}
