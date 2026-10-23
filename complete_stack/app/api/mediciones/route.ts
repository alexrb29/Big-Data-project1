import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { COLUMNAS_ORDEN, type CampoOrden } from "@/lib/etl/tipos"
import { clienteServidor, respuestaError, TABLA } from "@/lib/supabase/servidor"

const MAX_TAMANO = 100

// Lectura paginada de lo que ya está persistido en Supabase.
export async function GET(request: Request) {
  const supabase = clienteServidor()
  if (!supabase.ok) return respuestaError(supabase.estado, supabase.error)

  const p = new URL(request.url).searchParams
  const ciudad = p.get("ciudad") ?? ""
  const desde = p.get("desde") ?? ""
  const hasta = p.get("hasta") ?? ""
  const campo = (p.get("orden") ?? "fecha_hora") as CampoOrden
  const ascendente = p.get("direccion") !== "desc"
  const pagina = Math.max(0, Math.floor(Number(p.get("pagina") ?? "0")) || 0)
  const tamano = Math.min(MAX_TAMANO, Math.max(1, Math.floor(Number(p.get("tamano") ?? "25")) || 25))

  if (ciudad && !NOMBRES_CIUDADES.includes(ciudad)) return respuestaError(400, "Ciudad no reconocida.")
  if (!COLUMNAS_ORDEN.includes(campo)) return respuestaError(400, "Campo de ordenación no válido.")
  for (const [nombre, v] of [["desde", desde], ["hasta", hasta]]) {
    if (v && Number.isNaN(Date.parse(v))) return respuestaError(400, `Fecha «${nombre}» no válida.`)
  }

  let consulta = supabase.cliente
    .from(TABLA)
    .select("id, ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm, importado_en", {
      count: "exact",
    })
  if (ciudad) consulta = consulta.eq("ciudad", ciudad)
  if (desde) consulta = consulta.gte("fecha_hora", new Date(desde).toISOString())
  if (hasta) consulta = consulta.lte("fecha_hora", new Date(hasta).toISOString())

  // Sin ORDER BY la base de datos no garantiza ningún orden: se ordena siempre,
  // con desempate por id para que la paginación sea estable.
  const { data, count, error } = await consulta
    .order(campo, { ascending: ascendente })
    .order("id", { ascending: true })
    .range(pagina * tamano, pagina * tamano + tamano - 1)

  if (error) {
    return respuestaError(502, `Error al leer Supabase: ${error.message}`, { codigo: error.code })
  }
  return Response.json({ filas: data ?? [], total: count ?? 0, pagina, tamano })
}
