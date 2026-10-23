// Fixtures controlados para probar casos que no suelen aparecer en los datos
// reales. Solo se usan en tests; la aplicación nunca los carga.

const horas = (dia: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${dia}T${String(i).padStart(2, "0")}:00`)

export const RESPUESTA_CORRECTA_24H = {
  latitude: 41.44,
  longitude: 2.2,
  timezone: "GMT",
  hourly_units: { time: "iso8601", temperature_2m: "°C", relative_humidity_2m: "%", precipitation: "mm" },
  hourly: {
    time: horas("2026-09-01", 24),
    temperature_2m: Array.from({ length: 24 }, (_, i) => 20 + i / 2),
    relative_humidity_2m: Array.from({ length: 24 }, (_, i) => 50 + i),
    precipitation: Array.from({ length: 24 }, (_, i) => (i === 5 ? 1.2 : 0)),
  },
}

// Nulos, cadenas vacías, valores fuera de rango, temperatura extrema y un duplicado.
export const RESPUESTA_CON_PROBLEMAS = {
  hourly: {
    time: [
      "2026-09-01T00:00", // 0 válido
      "2026-09-01T01:00", // 1 temperatura null
      "2026-09-01T02:00", // 2 humedad "" (cadena vacía)
      "2026-09-01T03:00", // 3 humedad 120
      "2026-09-01T04:00", // 4 precipitación negativa
      "2026-09-01T00:00", // 5 duplicado del 0 con otros valores
      "no-es-fecha", //      6 fecha inválida
      "2026-09-01T07:00", // 7 temperatura extrema pero válida
      "2026-09-01T08:00", // 8 precipitación null
    ],
    temperature_2m: [21, null, 22, 23, 24, 99, 25, -45.5, 26],
    relative_humidity_2m: [60, 61, "", 120, 63, 10, 64, 65, 66],
    precipitation: [0, 0, 0, 0, -0.1, 5, 0, 0, null],
  },
}

// Arrays de longitudes distintas: falta la última humedad.
export const RESPUESTA_LONGITUDES_INCOHERENTES = {
  hourly: {
    time: horas("2026-09-01", 3),
    temperature_2m: [10, 11, 12],
    relative_humidity_2m: [50, 51],
    precipitation: [0, 0, 0],
  },
}
