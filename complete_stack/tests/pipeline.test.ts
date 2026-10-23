import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { dividirEnLotes, ejecutarLotes, verificarClaves, type Lote } from "../lib/etl/carga"
import { validarConfiguracion } from "../lib/etl/extraccion"
import {
  conjuntoDeCarga,
  filtrar,
  FILTROS_INICIALES,
  ordenar,
  paginar,
} from "../lib/etl/filtros"
import { limpiar } from "../lib/etl/limpieza"
import { claveRegistro, type Registro, type RegistroValido } from "../lib/etl/tipos"
import { fechaUTC, transformarCiudad } from "../lib/etl/transformacion"
import { validarLote } from "../lib/etl/validacion-servidor"
import {
  RESPUESTA_CON_PROBLEMAS,
  RESPUESTA_CORRECTA_24H,
  RESPUESTA_LONGITUDES_INCOHERENTES,
} from "./fixtures"

function registros(n: number, ciudad = "Madrid"): RegistroValido[] {
  return Array.from({ length: n }, (_, i) => {
    const fecha_hora = new Date(Date.UTC(2026, 8, 1, i)).toISOString()
    return {
      clave: claveRegistro(ciudad, fecha_hora),
      ciudad,
      fecha_hora,
      temperatura_c: 10 + (i % 17),
      humedad_pct: (i * 7) % 101,
      precipitacion_mm: i % 5 === 0 ? 0.4 : 0,
    }
  })
}

describe("configuración", () => {
  it("limita a 31 días, exige ciudades y rechaza fechas futuras", () => {
    assert.deepEqual(validarConfiguracion(["madrid"], "2026-09-01", "2026-09-30", "2026-10-23"), [])
    assert.match(validarConfiguracion(["madrid"], "2026-08-01", "2026-09-01", "2026-10-23")[0], /32 días/)
    assert.match(validarConfiguracion([], "2026-09-01", "2026-09-01", "2026-10-23")[0], /ciudad/)
    assert.match(validarConfiguracion(["madrid"], "2026-09-01", "2026-11-01", "2026-10-23").join(), /posterior a hoy/)
    assert.match(validarConfiguracion(["madrid"], "2026-09-05", "2026-09-01", "2026-10-23").join(), /posterior a la inicial/)
    assert.match(validarConfiguracion(["madrid"], "2026-02-30", "2026-03-01", "2026-10-23").join(), /inicial no es válida/)
  })
})

describe("transformación", () => {
  it("convierte arrays paralelos en 24 registros horarios en UTC", () => {
    const { filas, avisos } = transformarCiudad("Barcelona", RESPUESTA_CORRECTA_24H)
    assert.equal(avisos.length, 0)
    assert.equal(filas.length, 24)
    assert.equal(filas[0].fecha_hora, "2026-09-01T00:00:00.000Z")
    assert.equal(filas[23].fecha_hora, "2026-09-01T23:00:00.000Z")
    assert.equal(filas[5].temperatura_c, 22.5)
    assert.equal(filas[5].humedad_pct, 55)
    assert.equal(filas[5].precipitacion_mm, 1.2)
  })

  it("interpreta las horas como UTC aunque no lleven zona", () => {
    assert.equal(fechaUTC("2026-09-01T13:00"), "2026-09-01T13:00:00.000Z")
    assert.equal(fechaUTC("2026-09-01T13:00Z"), "2026-09-01T13:00:00.000Z")
    assert.equal(fechaUTC("2026-02-30T00:00"), null)
    assert.equal(fechaUTC(""), null)
    assert.equal(fechaUTC(null), null)
  })

  it("avisa de longitudes incoherentes y marca el valor como ausente", () => {
    const { filas, avisos } = transformarCiudad("Bilbao", RESPUESTA_LONGITUDES_INCOHERENTES)
    assert.equal(filas.length, 3)
    assert.match(avisos[0], /longitudes incoherentes/)
    assert.equal(filas[2].humedad_pct, undefined)
    const { validos, rechazados } = limpiar(filas)
    assert.equal(validos.length, 2)
    assert.deepEqual(rechazados[0].motivos, ["humedad ausente"])
  })
})

describe("limpieza", () => {
  const { filas } = transformarCiudad("Sevilla", RESPUESTA_CON_PROBLEMAS)
  const { validos, rechazados } = limpiar(filas)
  const motivo = (indice: number) => rechazados.find((r) => r.fila.indice === indice)?.motivos.join("; ")

  it("no convierte null ni cadenas vacías en cero", () => {
    assert.equal(motivo(1), "temperatura nula (null)")
    assert.equal(motivo(2), 'humedad vacía ("")')
    assert.equal(motivo(8), "precipitación nula (null)")
    assert.ok(validos.every((v) => v.fecha_hora !== "2026-09-01T01:00:00.000Z"))
  })

  it("valida rangos de humedad y precipitación y la fecha", () => {
    assert.match(motivo(3)!, /humedad fuera de rango/)
    assert.match(motivo(4)!, /precipitación negativa/)
    assert.match(motivo(6)!, /fecha_hora no válida/)
  })

  it("conserva temperaturas extremas", () => {
    assert.ok(validos.some((v) => v.temperatura_c === -45.5))
  })

  it("elimina duplicados conservando la primera aparición", () => {
    const dup = rechazados.filter((r) => r.tipo === "duplicado")
    assert.equal(dup.length, 1)
    assert.equal(dup[0].fila.indice, 5)
    assert.match(dup[0].motivos[0], /posición 0/)
    const original = validos.find((v) => v.fecha_hora === "2026-09-01T00:00:00.000Z")
    assert.equal(original?.temperatura_c, 21)
  })

  it("cuadra los contadores: total = válidos + rechazados", () => {
    assert.equal(validos.length, 2)
    assert.equal(rechazados.length, 7)
    assert.equal(validos.length + rechazados.length, filas.length)
  })
})

describe("filtros, orden, paginación y selección", () => {
  const datos = [...registros(60, "Madrid"), ...registros(60, "Bilbao")]

  it("filtra y ordena antes de paginar", () => {
    const { registros: filtrados, errores } = filtrar(datos, {
      ...FILTROS_INICIALES,
      ciudades: ["Bilbao"],
      tempMin: "20",
    })
    assert.deepEqual(errores, [])
    assert.ok(filtrados.every((r) => r.ciudad === "Bilbao" && r.temperatura_c >= 20))
    const ordenados = ordenar(filtrados, { campo: "temperatura_c", direccion: "desc" })
    // La primera página contiene los máximos globales, no los de la página.
    const pagina1 = paginar(ordenados, 0, 5)
    const maximo = Math.max(...filtrados.map((r) => r.temperatura_c))
    assert.equal(pagina1[0].temperatura_c, maximo)
    assert.ok(paginar(ordenados, 1, 5)[0].temperatura_c <= pagina1[4].temperatura_c)
  })

  it("solo lluvia significa precipitación > 0", () => {
    const { registros: r } = filtrar(datos, { ...FILTROS_INICIALES, soloLluvia: true })
    assert.ok(r.length > 0 && r.every((x) => x.precipitacion_mm > 0))
  })

  it("detecta límites incoherentes y números no válidos", () => {
    const { errores } = filtrar(datos, { ...FILTROS_INICIALES, humMin: "80", humMax: "10", tempMin: "abc" })
    assert.equal(errores.length, 2)
  })

  it("las fechas de los filtros se interpretan en UTC", () => {
    const { registros: r } = filtrar(datos, {
      ...FILTROS_INICIALES,
      desde: "2026-09-01T10:00",
      hasta: "2026-09-01T11:00",
    })
    assert.equal(r.length, 4)
  })

  it("selección entre páginas y exclusión de filas fuera de filtros", () => {
    const ordenados = ordenar(datos, { campo: "fecha_hora", direccion: "asc" })
    const seleccion = new Set([
      paginar(ordenados, 0, 25)[3].clave,
      paginar(ordenados, 2, 25)[10].clave,
      paginar(ordenados, 4, 25)[0].clave,
    ])
    assert.equal(conjuntoDeCarga(ordenados, seleccion).length, 3)

    // Tras filtrar solo Madrid, las seleccionadas de Bilbao no se suben.
    const soloMadrid = ordenar(filtrar(datos, { ...FILTROS_INICIALES, ciudades: ["Madrid"] }).registros, {
      campo: "fecha_hora",
      direccion: "asc",
    })
    const aSubir = conjuntoDeCarga(soloMadrid, seleccion)
    assert.ok(aSubir.every((r) => r.ciudad === "Madrid"))
    const fuera = [...seleccion].filter((c) => !soloMadrid.some((r) => r.clave === c)).length
    assert.equal(aSubir.length + fuera, seleccion.size)
  })
})

// Simula el destino con la semántica de upsert por (ciudad, fecha_hora).
function destinoEnMemoria(falla?: (llamada: number) => boolean) {
  const tabla = new Map<string, Registro>()
  const enviados: Registro[] = []
  let llamadas = 0
  return {
    tabla,
    enviados,
    async enviar(lote: Registro[]) {
      llamadas++
      if (falla?.(llamadas)) throw new Error("HTTP 502: fallo simulado")
      enviados.push(...lote)
      for (const r of lote) tabla.set(claveRegistro(r.ciudad, r.fecha_hora), r)
    },
    async consultar(claves: { ciudad: string; fecha_hora: string }[]) {
      return claves.map((c) => claveRegistro(c.ciudad, c.fecha_hora)).filter((k) => tabla.has(k))
    },
  }
}

describe("carga", () => {
  const datos = ordenar(registros(1234), { campo: "temperatura_c", direccion: "desc" })

  it("divide en lotes de 500 como máximo", () => {
    assert.deepEqual(dividirEnLotes(datos).map((l) => l.registros.length), [500, 500, 234])
  })

  it("lo enviado coincide exactamente con la vista previa, en orden", async () => {
    const destino = destinoEnMemoria()
    const vistaPrevia = conjuntoDeCarga(datos, new Set(datos.map((d) => d.clave)))
    await ejecutarLotes(dividirEnLotes(vistaPrevia), destino.enviar, () => {})
    assert.deepEqual(
      destino.enviados.map((r) => claveRegistro(r.ciudad, r.fecha_hora)),
      vistaPrevia.map((r) => r.clave)
    )
  })

  it("una segunda carga no duplica registros (upsert)", async () => {
    const destino = destinoEnMemoria()
    await ejecutarLotes(dividirEnLotes(datos), destino.enviar, () => {})
    await ejecutarLotes(dividirEnLotes(datos), destino.enviar, () => {})
    assert.equal(destino.tabla.size, datos.length)
  })

  it("un fallo parcial conserva los lotes completados y permite reintentar solo los fallidos", async () => {
    const destino = destinoEnMemoria((n) => n === 2)
    const estados: Lote[][] = []
    let lotes = await ejecutarLotes(dividirEnLotes(datos), destino.enviar, (l) => estados.push(l))
    assert.deepEqual(lotes.map((l) => l.estado), ["completado", "error", "completado"])
    assert.match(lotes[1].error!, /502/)
    assert.equal(destino.tabla.size, 734)

    let verificacion = await verificarClaves(datos, destino.consultar)
    assert.equal(verificacion.encontrados, 734)
    assert.equal(verificacion.ausentes.length, 500)

    const fallidos = lotes.filter((l) => l.estado === "error").map((l) => l.numero)
    lotes = await ejecutarLotes(lotes, destino.enviar, () => {}, fallidos)
    assert.deepEqual(lotes.map((l) => l.estado), ["completado", "completado", "completado"])
    assert.deepEqual(lotes.map((l) => l.intentos), [1, 2, 1])
    verificacion = await verificarClaves(datos, destino.consultar)
    assert.equal(verificacion.encontrados, datos.length)
    assert.equal(destino.tabla.size, datos.length)
  })
})

describe("validación en servidor", () => {
  const valido = { ciudad: "Madrid", fecha_hora: "2026-09-01T00:00:00.000Z", temperatura_c: 20, humedad_pct: 50, precipitacion_mm: 0 }

  it("acepta un lote correcto", () => {
    assert.equal(validarLote({ registros: [valido] }).ok, true)
  })

  it("rechaza nulos, rangos, ciudades desconocidas, campos extra y duplicados", () => {
    const r = validarLote({
      registros: [
        { ...valido, temperatura_c: null },
        { ...valido, fecha_hora: "2026-09-01T01:00:00.000Z", humedad_pct: 101 },
        { ...valido, fecha_hora: "2026-09-01T02:00:00.000Z", ciudad: "Lisboa" },
        { ...valido, fecha_hora: "2026-09-01T03:00:00.000Z", id: 1 },
        valido,
      ],
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      const texto = r.errores.join("\n")
      assert.match(texto, /temperatura_c/)
      assert.match(texto, /humedad_pct/)
      assert.match(texto, /ciudad no reconocida/)
      assert.match(texto, /campos no permitidos/)
      assert.match(texto, /duplicada/)
    }
  })

  it("rechaza lotes de más de 500 registros", () => {
    const r = validarLote({ registros: Array.from({ length: 501 }, () => valido) })
    assert.equal(r.ok, false)
  })
})
