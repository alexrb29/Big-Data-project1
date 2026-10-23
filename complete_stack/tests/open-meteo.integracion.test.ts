import assert from "node:assert/strict"
import { it } from "node:test"

import { ciudadPorId } from "../lib/etl/ciudades"
import { descargarCiudad } from "../lib/etl/extraccion"
import { limpiar } from "../lib/etl/limpieza"
import { transformarCiudad } from "../lib/etl/transformacion"

// Prueba contra la API real (requiere red).
it("Open-Meteo: una ciudad durante un día devuelve 24 registros horarios en UTC", async () => {
  const barcelona = ciudadPorId("barcelona")!
  const respuesta = (await descargarCiudad(barcelona, "2026-09-01", "2026-09-01")) as {
    utc_offset_seconds: number
    hourly_units: Record<string, string>
  }
  assert.equal(respuesta.utc_offset_seconds, 0)
  assert.equal(respuesta.hourly_units.temperature_2m, "°C")
  assert.equal(respuesta.hourly_units.precipitation, "mm")

  const { filas, avisos } = transformarCiudad(barcelona.nombre, respuesta)
  assert.deepEqual(avisos, [])
  const { validos } = limpiar(filas)
  assert.equal(validos.length, 24)
  assert.equal(validos[0].fecha_hora, "2026-09-01T00:00:00.000Z")
  assert.equal(validos[23].fecha_hora, "2026-09-01T23:00:00.000Z")
})

it("Open-Meteo: un error de la API se comunica con su motivo", async () => {
  await assert.rejects(
    descargarCiudad(ciudadPorId("madrid")!, "2026-09-05", "2026-09-01"),
    /HTTP 400/
  )
})
