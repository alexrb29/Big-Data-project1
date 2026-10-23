"use client"

import * as React from "react"
import { ArrowClockwiseIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  dividirEnLotes,
  ejecutarLotes,
  verificarClaves,
  type ConsultarClaves,
  type EnviarLote,
} from "@/lib/etl/carga"
import { CIUDADES, ciudadPorId } from "@/lib/etl/ciudades"
import { descargarCiudad, validarConfiguracion } from "@/lib/etl/extraccion"
import {
  conjuntoDeCarga,
  filtrarYOrdenar,
  FILTROS_INICIALES,
  ORDEN_INICIAL,
  type Filtros,
  type Orden,
} from "@/lib/etl/filtros"
import { limpiar } from "@/lib/etl/limpieza"
import type { FilaTransformada } from "@/lib/etl/tipos"
import { transformarCiudad } from "@/lib/etl/transformacion"
import { cn } from "@/lib/utils"
import { EtiquetaEstado, type Estado } from "./estado"
import { fmtDuracion, fmtEntero } from "./formato"
import { PanelConfiguracion } from "./panel-configuracion"
import { motivoSinCarga, PestanaCarga } from "./pestana-carga"
import { PestanaSupabase } from "./pestana-supabase"
import { PestanaValidos } from "./pestana-validos"
import { PestanaJson, PestanaRechazados, PestanaTransformados, Vacio } from "./pestanas-datos"
import { Pipeline, type Fase } from "./pipeline"
import type { Carga, EstadoCiudad, EstadoServidor, Extraccion, Procesado } from "./tipos-ui"

function horasRecibidas(respuesta: unknown): number {
  const time = (respuesta as { hourly?: { time?: unknown } } | undefined)?.hourly?.time
  return Array.isArray(time) ? time.length : 0
}

function procesar(ext: Extraccion): Procesado {
  const t0 = performance.now()
  const filas: FilaTransformada[] = []
  const avisos: string[] = []
  let horas = 0
  for (const id of ext.ciudades) {
    const { respuesta } = ext.porCiudad[id]
    if (respuesta === undefined) continue
    horas += horasRecibidas(respuesta)
    const r = transformarCiudad(ciudadPorId(id)!.nombre, respuesta)
    filas.push(...r.filas)
    avisos.push(...r.avisos)
  }
  const t1 = performance.now()
  const { validos, rechazados } = limpiar(filas)
  const t2 = performance.now()
  return {
    horasRecibidas: horas,
    filas,
    avisos,
    validos,
    rechazados,
    duracionTransformacionMs: t1 - t0,
    duracionLimpiezaMs: t2 - t1,
  }
}

async function descargar(id: string, inicio: string, fin: string): Promise<EstadoCiudad> {
  const t0 = performance.now()
  try {
    const respuesta = await descargarCiudad(ciudadPorId(id)!, inicio, fin)
    return {
      estado: "completada",
      respuesta,
      duracionMs: performance.now() - t0,
      recibidoEn: new Date().toLocaleTimeString("es-ES"),
    }
  } catch (e) {
    return {
      estado: "error",
      error: e instanceof Error ? e.message : String(e),
      duracionMs: performance.now() - t0,
    }
  }
}

const enviarLote: EnviarLote = async (registros) => {
  const r = await fetch("/api/carga", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registros }),
  })
  const j = await r.json().catch(() => null)
  if (!r.ok) {
    const detalles = Array.isArray(j?.detalles) ? ` ${j.detalles.slice(0, 3).join(" ")}` : ""
    throw new Error(`HTTP ${r.status}: ${j?.error ?? r.statusText}${detalles}`)
  }
}

const consultarClaves: ConsultarClaves = async (claves) => {
  const r = await fetch("/api/verificar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claves }),
  })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${j?.error ?? r.statusText}`)
  return j.encontradas as string[]
}

function estadoExtraccion(ext: Extraccion | null): Estado {
  if (!ext) return "pendiente"
  const estados = ext.ciudades.map((c) => ext.porCiudad[c].estado)
  if (estados.some((e) => e === "en_curso" || e === "pendiente")) return "en_curso"
  return estados.includes("error") ? "error" : "completada"
}

export function EspacioTrabajo({ hoy }: { hoy: string }) {
  const [ciudadesSel, setCiudadesSel] = React.useState(CIUDADES.map((c) => c.id))
  const [inicio, setInicio] = React.useState("2026-09-01")
  const [fin, setFin] = React.useState("2026-09-30")

  const [extraccion, setExtraccion] = React.useState<Extraccion | null>(null)
  const [extrayendo, setExtrayendo] = React.useState(false)
  const [procesado, setProcesado] = React.useState<Procesado | null>(null)
  const [filtros, setFiltros] = React.useState<Filtros>(FILTROS_INICIALES)
  const [orden, setOrden] = React.useState<Orden>(ORDEN_INICIAL)
  const [seleccion, setSeleccion] = React.useState<Set<string>>(() => new Set())
  const [carga, setCarga] = React.useState<Carga | null>(null)
  const [confirmados, setConfirmados] = React.useState<Set<string>>(() => new Set())
  const [servidor, setServidor] = React.useState<EstadoServidor | null>(null)
  const [pestana, setPestana] = React.useState("json")

  // Las referencias evitan dobles envíos aunque se pulse dos veces antes de
  // que React vuelva a pintar.
  const extrayendoRef = React.useRef(false)
  const subiendoRef = React.useRef(false)
  const extraccionRef = React.useRef<Extraccion | null>(null)

  React.useEffect(() => {
    fetch("/api/estado", { cache: "no-store" })
      .then((r) => r.json())
      .then(setServidor)
      .catch(() =>
        setServidor({ urlConfigurada: false, host: null, claveSecretaConfigurada: false, apiHabilitada: false })
      )
  }, [])

  const fijarExtraccion = (ext: Extraccion) => {
    extraccionRef.current = ext
    setExtraccion(ext)
  }
  const conCiudad = (ext: Extraccion, id: string, estado: EstadoCiudad): Extraccion => ({
    ...ext,
    porCiudad: { ...ext.porCiudad, [id]: estado },
  })

  const aplicarProcesado = (ext: Extraccion) => {
    const p = procesar(ext)
    setProcesado(p)
    // La selección se conserva solo para claves que siguen siendo válidas;
    // los registros nuevos nunca se seleccionan solos.
    const validas = new Set(p.validos.map((v) => v.clave))
    setSeleccion((s) => new Set([...s].filter((k) => validas.has(k))))
  }

  async function extraer() {
    if (extrayendoRef.current || subiendoRef.current) return
    if (validarConfiguracion(ciudadesSel, inicio, fin, hoy).length > 0) return
    extrayendoRef.current = true
    setExtrayendo(true)

    let ext: Extraccion = {
      inicio,
      fin,
      ciudades: [...ciudadesSel],
      porCiudad: Object.fromEntries(ciudadesSel.map((id) => [id, { estado: "pendiente" as const }])),
    }
    fijarExtraccion(ext)
    setProcesado(null)
    setSeleccion(new Set())
    setFiltros(FILTROS_INICIALES)
    setCarga(null)
    setConfirmados(new Set())
    setPestana("json")

    // Peticiones secuenciales: se ve qué ciudad se procesa y cuáles quedan.
    for (const id of ext.ciudades) {
      ext = conCiudad(ext, id, { estado: "en_curso" })
      fijarExtraccion(ext)
      ext = conCiudad(ext, id, await descargar(id, ext.inicio, ext.fin))
      fijarExtraccion(ext)
    }
    aplicarProcesado(ext)
    extrayendoRef.current = false
    setExtrayendo(false)
  }

  // Reintenta una sola ciudad con las fechas de la extracción original. Su
  // respuesta sustituye a la anterior, así que no se duplican registros.
  async function reintentarCiudad(id: string) {
    const base = extraccionRef.current
    if (!base || extrayendoRef.current) return
    extrayendoRef.current = true
    setExtrayendo(true)
    fijarExtraccion(conCiudad(base, id, { estado: "en_curso" }))
    const resultado = await descargar(id, base.inicio, base.fin)
    const ext = conCiudad(extraccionRef.current!, id, resultado)
    fijarExtraccion(ext)
    aplicarProcesado(ext)
    extrayendoRef.current = false
    setExtrayendo(false)
  }

  const validos = React.useMemo(() => procesado?.validos ?? [], [procesado])
  // La paginación y la selección se aplican después de filtrar y ordenar.
  const filtrado = React.useMemo(() => filtrarYOrdenar(validos, filtros, orden), [validos, filtros, orden])
  const aSubir = React.useMemo(
    () => conjuntoDeCarga(filtrado.ordenados, seleccion),
    [filtrado.ordenados, seleccion]
  )
  const fueraDeFiltros = seleccion.size - aSubir.length

  async function ejecutarCarga(base: Carga, numeros?: number[]) {
    const t0 = performance.now()
    const lotes = await ejecutarLotes(
      base.lotes,
      enviarLote,
      (l) => setCarga((c) => (c ? { ...c, lotes: l } : c)),
      numeros
    )
    const duracionMs = (base.duracionMs ?? 0) + (performance.now() - t0)
    const enviados = lotes.filter((l) => l.estado === "completado").flatMap((l) => l.registros)
    if (enviados.length === 0) {
      // Nada llegó a destino: no hay claves que verificar.
      setCarga((c) => (c ? { ...c, lotes, enCurso: false, duracionMs } : c))
      subiendoRef.current = false
      return
    }
    setCarga((c) =>
      c
        ? {
            ...c,
            lotes,
            enCurso: false,
            duracionMs,
            verificacion: { comprobados: 0, encontrados: 0, confirmadas: [], ausentes: [], errores: [], enCurso: true },
          }
        : c
    )
    const v = await verificarClaves(enviados, consultarClaves)
    setCarga((c) => (c ? { ...c, verificacion: { ...v, enCurso: false } } : c))
    setConfirmados((s) => new Set([...s, ...v.confirmadas]))
    subiendoRef.current = false
  }

  async function subir() {
    if (subiendoRef.current || extrayendoRef.current || aSubir.length === 0) return
    subiendoRef.current = true
    // Copia congelada: los cambios posteriores de filtros no afectan a esta carga.
    const congelado = [...aSubir]
    const nueva: Carga = {
      congelado,
      congeladoEn: new Date().toLocaleTimeString("es-ES"),
      lotes: dividirEnLotes(congelado),
      enCurso: true,
    }
    setCarga(nueva)
    await ejecutarCarga(nueva)
  }

  async function reintentarFallidos() {
    if (subiendoRef.current || !carga) return
    subiendoRef.current = true
    const base = { ...carga, enCurso: true, verificacion: undefined }
    setCarga(base)
    await ejecutarCarga(
      base,
      carga.lotes.filter((l) => l.estado === "error").map((l) => l.numero)
    )
  }

  // ---------- Fases del pipeline ----------
  const estadoExt = estadoExtraccion(extraccion)
  const horasHastaAhora = extraccion
    ? extraccion.ciudades.reduce((s, c) => s + horasRecibidas(extraccion.porCiudad[c].respuesta), 0)
    : null
  const duracionExt = extraccion
    ? extraccion.ciudades.reduce((s, c) => s + (extraccion.porCiudad[c].duracionMs ?? 0), 0)
    : undefined
  const rechazadosCalidad = procesado?.rechazados.filter((r) => r.tipo === "calidad").length ?? 0
  const duplicados = (procesado?.rechazados.length ?? 0) - rechazadosCalidad
  const cargaOk = carga?.lotes.filter((l) => l.estado === "completado").reduce((s, l) => s + l.registros.length, 0)
  const cargaConError =
    carga &&
    (carga.lotes.some((l) => l.estado === "error") ||
      Boolean(carga.verificacion && !carga.verificacion.enCurso && (carga.verificacion.ausentes.length || carga.verificacion.errores.length)))
  const procesadas = extraccion?.ciudades.filter((c) => {
    const e = extraccion.porCiudad[c].estado
    return e === "completada" || e === "error"
  }).length

  const fases: Fase[] = [
    {
      id: "extraccion",
      numero: 1,
      titulo: "Extracción",
      explicacion: "Una petición GET por ciudad a la API histórica de Open-Meteo. Se guarda el JSON sin tocar.",
      estado: estadoExt,
      entrada: { valor: extraccion?.ciudades.length ?? null, unidad: "ciudades" },
      salida: { valor: horasHastaAhora, unidad: "horas recibidas" },
      duracionMs: duracionExt,
      notaDuracion: extraccion ? "suma de peticiones" : undefined,
      pestana: "json",
      detalle: extraccion && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[0.6875rem] text-muted-foreground" aria-live="polite">
            Procesadas {procesadas} de {extraccion.ciudades.length}
          </p>
          <ul className="flex flex-col gap-1">
            {extraccion.ciudades.map((c) => {
              const e = extraccion.porCiudad[c]
              return (
                <li key={c} className="flex items-center justify-between gap-1 text-[0.6875rem]">
                  <span>{ciudadPorId(c)!.nombre}</span>
                  {e.estado === "error" && !extrayendo ? (
                    <Button size="xs" variant="destructive" onClick={() => reintentarCiudad(c)}>
                      <ArrowClockwiseIcon aria-hidden /> Reintentar
                    </Button>
                  ) : (
                    <EtiquetaEstado estado={e.estado} />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ),
    },
    {
      id: "transformacion",
      numero: 2,
      titulo: "Transformación",
      explicacion: "Los arrays paralelos de «hourly» se convierten en una fila por ciudad y hora, con fecha en UTC explícito.",
      estado: procesado ? (procesado.avisos.length ? "error" : "completada") : "pendiente",
      entrada: { valor: procesado?.horasRecibidas ?? null, unidad: "horas" },
      salida: { valor: procesado?.filas.length ?? null, unidad: "filas" },
      duracionMs: procesado?.duracionTransformacionMs,
      pestana: "transformados",
      detalle: procesado && procesado.avisos.length > 0 && (
        <p className="text-[0.6875rem] text-destructive">{procesado.avisos.length} avisos de estructura</p>
      ),
    },
    {
      id: "limpieza",
      numero: 3,
      titulo: "Limpieza",
      explicacion: "Se validan tipos, nulos y rangos, y se eliminan duplicados por ciudad y fecha_hora.",
      estado: procesado ? "completada" : "pendiente",
      entrada: { valor: procesado?.filas.length ?? null, unidad: "filas" },
      salida: { valor: procesado?.validos.length ?? null, unidad: "válidos" },
      duracionMs: procesado?.duracionLimpiezaMs,
      pestana: "rechazados",
      detalle: procesado && (
        <p className="text-[0.6875rem] text-muted-foreground">
          Rechazados: {fmtEntero(rechazadosCalidad)} por calidad, {fmtEntero(duplicados)} duplicados
        </p>
      ),
    },
    {
      id: "filtrado",
      numero: 4,
      titulo: "Filtrado y selección",
      explicacion: "Tus filtros y orden se aplican a los válidos; después eliges qué filas subir.",
      estado: procesado ? (filtrado.errores.length ? "error" : "completada") : "pendiente",
      entrada: { valor: procesado ? validos.length : null, unidad: "válidos" },
      salida: { valor: procesado ? aSubir.length : null, unidad: "a subir" },
      duracionMs: procesado ? filtrado.duracionMs : undefined,
      notaDuracion: procesado ? "último cálculo" : undefined,
      pestana: "validos",
      detalle: procesado && (
        <p className="text-[0.6875rem] text-muted-foreground">
          Coinciden con los filtros: {fmtEntero(filtrado.ordenados.length)}
        </p>
      ),
    },
    {
      id: "carga",
      numero: 5,
      titulo: "Carga",
      explicacion: "Upsert en Supabase por lotes de 500 desde el servidor y verificación de las claves en destino.",
      estado: !carga
        ? "pendiente"
        : carga.enCurso || carga.verificacion?.enCurso
          ? "en_curso"
          : cargaConError
            ? "error"
            : "completada",
      entrada: { valor: carga?.congelado.length ?? null, unidad: "enviados" },
      salida: { valor: cargaOk ?? null, unidad: "procesados" },
      duracionMs: carga?.duracionMs,
      pestana: "carga",
    },
  ]

  const motivoCarga = motivoSinCarga(servidor)
  const ciudadesExtraidas = (extraccion?.ciudades ?? []).map((c) => ciudadPorId(c)!.nombre)

  const contadores = [
    { etiqueta: "Total extraído", valor: procesado?.filas.length, nota: "filas transformadas" },
    { etiqueta: "Válidos", valor: procesado?.validos.length, nota: "tras la limpieza" },
    { etiqueta: "Rechazados", valor: procesado?.rechazados.length, nota: "calidad + duplicados" },
    { etiqueta: "Coinciden con los filtros", valor: procesado ? filtrado.ordenados.length : undefined, nota: "de los válidos" },
    {
      etiqueta: "Seleccionados para cargar",
      valor: procesado ? aSubir.length : undefined,
      nota: fueraDeFiltros > 0 ? `${fmtEntero(fueraDeFiltros)} seleccionados fuera de filtros` : "seleccionados y dentro de filtros",
      destacado: true,
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
          Big Data · Práctica 1
        </p>
        <h1 className="font-heading text-2xl font-medium">Pipeline ETL: Open-Meteo → Supabase</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Extrae mediciones horarias, observa cómo se transforman y limpian, decide qué registros subir y comprueba qué
          ha quedado guardado en la base de datos.
        </p>
        {servidor && (
          <p className="text-[0.6875rem] text-muted-foreground">
            Destino: {servidor.host ?? "sin configurar"}
            {servidor.apiHabilitada && " · Endpoints sin autenticación: uso solo en desarrollo local."}
          </p>
        )}
      </header>

      <PanelConfiguracion
        ciudades={ciudadesSel}
        inicio={inicio}
        fin={fin}
        hoy={hoy}
        alCambiarCiudades={setCiudadesSel}
        alCambiarInicio={setInicio}
        alCambiarFin={setFin}
        alExtraer={extraer}
        bloqueado={extrayendo || Boolean(carga?.enCurso)}
        motivoBloqueo={
          extrayendo ? undefined : carga?.enCurso ? "Espera a que termine la carga en curso." : undefined
        }
      />

      <Pipeline fases={fases} alInspeccionar={setPestana} />

      <section aria-label="Contadores" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {contadores.map((c) => (
          <div
            key={c.etiqueta}
            className={cn(
              "flex flex-col gap-0.5 rounded-lg border bg-card p-3",
              c.destacado && "border-primary bg-primary/10"
            )}
          >
            <span className="text-[0.6875rem] text-muted-foreground">{c.etiqueta}</span>
            <span className="font-mono text-xl font-medium tabular-nums">
              {c.valor === undefined ? "—" : fmtEntero(c.valor)}
            </span>
            <span className="text-[0.625rem] text-muted-foreground">{c.nota}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="titulo-inspeccion" className="flex flex-col gap-3">
        <h2 id="titulo-inspeccion" className="flex items-center gap-2 font-heading text-base font-medium">
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[0.625rem] text-background">
            3
          </span>
          Inspección de datos
        </h2>
        <Tabs value={pestana} onValueChange={(v) => setPestana(String(v))}>
          <div className="overflow-x-auto pb-1">
            <TabsList>
              <TabsTrigger value="json">JSON original</TabsTrigger>
              <TabsTrigger value="transformados">Transformados</TabsTrigger>
              <TabsTrigger value="validos">Registros válidos</TabsTrigger>
              <TabsTrigger value="rechazados">Rechazados</TabsTrigger>
              <TabsTrigger value="carga">Vista previa de carga</TabsTrigger>
              <TabsTrigger value="supabase">Datos en Supabase</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="json" className="pt-2">
            <PestanaJson extraccion={extraccion} alReintentar={reintentarCiudad} />
          </TabsContent>
          <TabsContent value="transformados" className="pt-2">
            {procesado ? (
              <PestanaTransformados filas={procesado.filas} avisos={procesado.avisos} />
            ) : (
              <Vacio texto="La transformación se ejecuta al terminar la extracción." />
            )}
          </TabsContent>
          <TabsContent value="validos" className="pt-2">
            {procesado ? (
              <PestanaValidos
                validos={validos}
                coinciden={filtrado.ordenados}
                errores={filtrado.errores}
                filtros={filtros}
                alCambiarFiltros={setFiltros}
                orden={orden}
                alCambiarOrden={setOrden}
                seleccion={seleccion}
                alCambiarSeleccion={setSeleccion}
                ciudades={ciudadesExtraidas}
              />
            ) : (
              <Vacio texto="Todavía no hay registros válidos." />
            )}
          </TabsContent>
          <TabsContent value="rechazados" className="pt-2">
            {procesado ? (
              <PestanaRechazados rechazados={procesado.rechazados} />
            ) : (
              <Vacio texto="Todavía no se ha ejecutado la limpieza." />
            )}
          </TabsContent>
          <TabsContent value="carga" className="pt-2">
            <PestanaCarga
              aSubir={aSubir}
              orden={orden}
              fueraDeFiltros={fueraDeFiltros}
              carga={carga}
              confirmados={confirmados}
              servidor={servidor}
              alSubir={subir}
              alReintentarFallidos={reintentarFallidos}
            />
          </TabsContent>
          <TabsContent value="supabase" className="pt-2" keepMounted>
            <PestanaSupabase disponible={motivoCarga === null} motivo={motivoCarga} />
          </TabsContent>
        </Tabs>
      </section>

      <footer className="border-t pt-4 text-[0.6875rem] text-muted-foreground">
        Datos: Open-Meteo Historical Weather API (CC BY 4.0). Duración de cada fase medida en el navegador.{" "}
        Duración total de la extracción: {fmtDuracion(duracionExt)}.
      </footer>
    </div>
  )
}
