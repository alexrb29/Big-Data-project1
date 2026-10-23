import {
  CheckCircleIcon,
  CircleDashedIcon,
  CircleNotchIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export type Estado = "pendiente" | "en_curso" | "completada" | "error"

const CONFIG: Record<Estado, { texto: string; icono: typeof CheckCircleIcon; clase: string }> = {
  pendiente: { texto: "Pendiente", icono: CircleDashedIcon, clase: "text-muted-foreground border-border" },
  en_curso: {
    texto: "En curso",
    icono: CircleNotchIcon,
    clase: "text-sky-700 border-sky-300 bg-sky-50 dark:text-sky-300 dark:border-sky-800 dark:bg-sky-950",
  },
  completada: {
    texto: "Completada",
    icono: CheckCircleIcon,
    clase:
      "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:bg-emerald-950",
  },
  error: {
    texto: "Con errores",
    icono: WarningCircleIcon,
    clase: "text-destructive border-destructive/40 bg-destructive/5",
  },
}

// El estado se comunica con icono y texto, no solo con color.
export function EtiquetaEstado({ estado, texto }: { estado: Estado; texto?: string }) {
  const { texto: base, icono: Icono, clase } = CONFIG[estado]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap",
        clase
      )}
    >
      <Icono
        aria-hidden
        weight="bold"
        className={cn("size-3.5", estado === "en_curso" && "animate-spin")}
      />
      {texto ?? base}
    </span>
  )
}
