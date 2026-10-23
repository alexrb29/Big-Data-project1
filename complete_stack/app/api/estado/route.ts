import { estadoConfiguracion } from "@/lib/supabase/servidor"

// Se evalúa en cada petición: las variables pueden cambiar sin recompilar.
export const dynamic = "force-dynamic"

// Indica qué falta configurar, sin devolver nunca el valor de las claves.
export async function GET() {
  return Response.json(estadoConfiguracion())
}
