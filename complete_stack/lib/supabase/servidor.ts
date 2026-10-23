import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const TABLA = "mediciones_meteorologicas"

type Configuracion =
  | { ok: true; cliente: SupabaseClient }
  | { ok: false; estado: number; error: string }

function url() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
}

export function estadoConfiguracion() {
  const destino = url()
  let host: string | null = null
  try {
    host = destino ? new URL(destino).host : null
  } catch {
    host = null
  }
  return {
    urlConfigurada: host !== null,
    host,
    claveSecretaConfigurada: Boolean(process.env.SUPABASE_SECRET_KEY),
    apiHabilitada: apiHabilitada(),
  }
}

// El proyecto no tiene autenticación. Las rutas que usan la clave secreta
// quedan abiertas en desarrollo y bloqueadas en producción salvo que se
// habiliten explícitamente (lo que exige protegerlas antes; ver README).
function apiHabilitada() {
  return process.env.NODE_ENV !== "production" || process.env.ETL_PERMITIR_EN_PRODUCCION === "true"
}

// Cliente con la clave secreta (rol service_role). Solo se crea en servidor;
// la clave nunca se envía al navegador ni se escribe en logs.
export function clienteServidor(): Configuracion {
  if (!apiHabilitada()) {
    return {
      ok: false,
      estado: 403,
      error:
        "La API de carga está deshabilitada en producción. Protégela con autenticación y define ETL_PERMITIR_EN_PRODUCCION=true.",
    }
  }
  const destino = url()
  const clave = process.env.SUPABASE_SECRET_KEY
  if (!destino || !clave) {
    return {
      ok: false,
      estado: 503,
      error: `Falta configuración en el servidor: ${[!destino && "SUPABASE_URL", !clave && "SUPABASE_SECRET_KEY"]
        .filter(Boolean)
        .join(" y ")}.`,
    }
  }
  return {
    ok: true,
    cliente: createClient(destino, clave, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  }
}

export function respuestaError(estado: number, error: string, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status: estado })
}
