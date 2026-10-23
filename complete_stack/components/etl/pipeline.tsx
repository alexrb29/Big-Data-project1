"use client"

import * as React from "react"
import { ArrowDownIcon, ArrowRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EtiquetaEstado, type Estado } from "./estado"
import { fmtDuracion, fmtEntero } from "./formato"

export type Fase = {
  id: string
  numero: number
  titulo: string
  explicacion: string
  estado: Estado
  entrada: { valor: number | null; unidad: string }
  salida: { valor: number | null; unidad: string }
  duracionMs?: number
  notaDuracion?: string
  detalle?: React.ReactNode
  pestana: string
}

function Contador({ etiqueta, valor, unidad }: { etiqueta: string; valor: number | null; unidad: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">{etiqueta}</dt>
      <dd className="font-mono text-sm font-medium tabular-nums">
        {valor === null ? "—" : fmtEntero(valor)}
        <span className="ms-1 font-sans text-[0.625rem] font-normal text-muted-foreground">{unidad}</span>
      </dd>
    </div>
  )
}

export function Pipeline({
  fases,
  alInspeccionar,
}: {
  fases: Fase[]
  alInspeccionar: (pestana: string) => void
}) {
  return (
    <section aria-labelledby="titulo-pipeline" className="flex flex-col gap-3">
      <h2 id="titulo-pipeline" className="flex items-center gap-2 font-heading text-base font-medium">
        <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[0.625rem] text-background">
          2
        </span>
        Pipeline ETL
      </h2>
      <ol className="grid grid-cols-1 gap-2 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
        {fases.map((f, i) => (
          <li key={f.id} className="relative flex flex-col">
            <article
              aria-label={`Fase ${f.numero}: ${f.titulo}`}
              className={cn(
                "flex h-full flex-col gap-3 rounded-lg border bg-card p-3",
                f.estado === "en_curso" && "border-sky-400 dark:border-sky-700",
                f.estado === "error" && "border-destructive/50"
              )}
            >
              <header className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-heading text-sm font-medium">
                  <span className="me-1 font-mono text-muted-foreground">{f.numero}.</span>
                  {f.titulo}
                </h3>
                <EtiquetaEstado estado={f.estado} />
              </header>
              <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">{f.explicacion}</p>
              <dl className="grid grid-cols-2 gap-2 border-t pt-2">
                <Contador etiqueta="Entrada" {...f.entrada} />
                <Contador etiqueta="Salida" {...f.salida} />
                <div className="col-span-2 flex flex-col">
                  <dt className="text-[0.625rem] tracking-wide text-muted-foreground uppercase">Duración</dt>
                  <dd className="font-mono text-xs tabular-nums">
                    {fmtDuracion(f.duracionMs)}
                    {f.notaDuracion && (
                      <span className="ms-1 font-sans text-[0.625rem] text-muted-foreground">{f.notaDuracion}</span>
                    )}
                  </dd>
                </div>
              </dl>
              {f.detalle}
              <Button
                variant="outline"
                size="sm"
                className="mt-auto"
                onClick={() => alInspeccionar(f.pestana)}
                disabled={f.estado === "pendiente"}
              >
                <MagnifyingGlassIcon aria-hidden /> Inspeccionar
              </Button>
            </article>
            {i < fases.length - 1 && (
              <span aria-hidden className="flex justify-center py-0.5 text-muted-foreground lg:hidden">
                <ArrowDownIcon className="size-3.5" />
              </span>
            )}
            {i < fases.length - 1 && (
              <span
                aria-hidden
                className="absolute top-1/2 -right-[11px] z-10 hidden -translate-y-1/2 rounded-full border bg-background p-0.5 text-muted-foreground lg:block"
              >
                <ArrowRightIcon className="size-2.5" />
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
