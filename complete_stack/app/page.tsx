import { EspacioTrabajo } from "@/components/etl/espacio-trabajo"
import { hoyUTC } from "@/lib/etl/extraccion"

// Se renderiza por petición para que «hoy» (límite de fechas) no quede fijado
// en el momento del build.
export const dynamic = "force-dynamic"

export default function Page() {
  return <EspacioTrabajo hoy={hoyUTC()} />
}
