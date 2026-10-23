import { clienteServidor, respuestaError, TABLA } from "@/lib/supabase/servidor"
import { leerJsonLimitado, validarLote } from "@/lib/etl/validacion-servidor"

// Recibe un lote (≤ 500 registros), lo revalida y hace upsert por
// (ciudad, fecha_hora). Supabase no indica cuántas filas se insertaron y
// cuántas se actualizaron, así que solo se informa del total procesado.
export async function POST(request: Request) {
  const supabase = clienteServidor()
  if (!supabase.ok) return respuestaError(supabase.estado, supabase.error)

  const leido = await leerJsonLimitado(request)
  if (!leido.ok) return respuestaError(leido.estado, leido.error)

  const validacion = validarLote(leido.cuerpo)
  if (!validacion.ok) {
    return respuestaError(422, "El lote no supera la validación del servidor.", {
      detalles: validacion.errores,
    })
  }

  const { error } = await supabase.cliente
    .from(TABLA)
    .upsert(validacion.registros, { onConflict: "ciudad,fecha_hora", ignoreDuplicates: false })

  if (error) {
    return respuestaError(502, `Supabase rechazó el lote: ${error.message}`, { codigo: error.code })
  }
  return Response.json({ procesados: validacion.registros.length })
}
