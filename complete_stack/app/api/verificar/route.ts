import { clienteServidor, respuestaError, TABLA } from "@/lib/supabase/servidor"
import { leerJsonLimitado, validarClaves } from "@/lib/etl/validacion-servidor"
import { claveRegistro } from "@/lib/etl/tipos"

// Devuelve cuáles de las claves (ciudad, fecha_hora) recibidas existen en destino.
export async function POST(request: Request) {
  const supabase = clienteServidor()
  if (!supabase.ok) return respuestaError(supabase.estado, supabase.error)

  const leido = await leerJsonLimitado(request)
  if (!leido.ok) return respuestaError(leido.estado, leido.error)

  const validacion = validarClaves(leido.cuerpo)
  if (!validacion.ok) return respuestaError(422, validacion.error)

  const porCiudad = new Map<string, string[]>()
  for (const { ciudad, fecha_hora } of validacion.claves) {
    porCiudad.set(ciudad, [...(porCiudad.get(ciudad) ?? []), fecha_hora])
  }

  const encontradas: string[] = []
  for (const [ciudad, fechas] of porCiudad) {
    const { data, error } = await supabase.cliente
      .from(TABLA)
      .select("ciudad, fecha_hora")
      .eq("ciudad", ciudad)
      .in("fecha_hora", fechas)
    if (error) return respuestaError(502, `Error al consultar Supabase: ${error.message}`)
    for (const fila of data ?? []) {
      // Postgres devuelve "2026-09-01T00:00:00+00:00": se normaliza a ISO con Z.
      encontradas.push(claveRegistro(fila.ciudad, new Date(fila.fecha_hora).toISOString()))
    }
  }
  return Response.json({ encontradas })
}
