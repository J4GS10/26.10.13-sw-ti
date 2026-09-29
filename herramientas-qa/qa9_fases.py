"""
QA de las fases 3 a 6 contra el stack de revisión (inv_ui, https://localhost:8443).

Recorre por la API, como sa, los flujos nuevos sobre datos reales:
  1. Compra con líneas de equipo y de servicio: recepción parcial, precio
     distinto (exige justificación), sobrante rechazado, conformidad del
     servicio, bandeja «Requiere su atención» y cierre con faltante.
  2. Kardex y hoja de vida del equipo recibido; baja formal con motivo.
  3. Consumible: entrada con costo, salida que deja el stock bajo el mínimo
     (el servidor lo señala) y ajuste por conteo.
  4. Reportes: licencias.csv, custodia, entradas y salidas.
  5. El frontend publicado incluye las pantallas nuevas.

Uso:  python herramientas-qa/qa9_fases.py      (resultado en salidas/qa9_fases.json)
"""
import json
import pathlib
import re
import time

import httpx

from qa_login import cliente_autenticado

BASE = "https://localhost:8443"
API = f"{BASE}/api/v1"
SALIDA = pathlib.Path(__file__).parent / "salidas" / "qa9_fases.json"
resultados: list[dict] = []


def caso(nombre: str, ok: bool, detalle: str = "") -> None:
    resultados.append({"caso": nombre, "ok": bool(ok), "detalle": detalle})
    print(("OK   " if ok else "FALLA"), nombre, ("· " + detalle) if detalle and not ok else "")


def main() -> None:
    c = cliente_autenticado()
    sufijo = time.strftime("%H%M%S")

    # ---------- Datos base ----------
    sedes = c.get(f"{API}/org/sedes").json()
    sede = sedes[0]["SED_Sede"]
    tipos = c.get(f"{API}/cat/tipos-activo").json()
    tipo = next((t for t in tipos if t["TAC_Nombre"].lower().startswith("laptop")), tipos[0])
    modelos = c.get(f"{API}/cat/modelos-flat").json()
    modelo = next((m for m in modelos if m.get("TAC_Tipo_Activo") in (None, tipo["TAC_Tipo_Activo"])), modelos[0])
    prov = c.post(f"{API}/compras/proveedores", json={"PRV_Nombre": f"QA9 Proveedor {sufijo}"}).json()

    # ---------- 1. Compra con recepción controlada ----------
    orden = c.post(f"{API}/compras/ordenes", json={
        "OCO_Numero": f"QA9-{sufijo}", "OCO_Fecha": time.strftime("%Y-%m-%d"), "OCO_Moneda": "USD",
        "PRV_Proveedor": prov["PRV_Proveedor"], "SED_Sede": sede,
        "lineas": [
            {"OCL_Descripcion": "Laptop QA9", "OCL_Cantidad": 2, "OCL_Precio_Unitario": "1000", "OCL_Tipo": "ACTIVO"},
            {"OCL_Descripcion": "Flete QA9", "OCL_Cantidad": 1, "OCL_Precio_Unitario": "40", "OCL_Tipo": "OTRO"},
        ]})
    caso("Crear orden con tipo por línea", orden.status_code == 201, orden.text[:200])
    orden = orden.json()
    oid = orden["OCO_Orden"]
    l_act, l_otro = (ln["OCL_Linea"] for ln in orden["lineas"])

    def activo(serie: str, costo: str | None = None) -> dict:
        d = {"OCL_Linea": l_act, "ACT_Serie_Fabricante": serie, "MOD_Modelo": modelo["MOD_Modelo"],
             "TAC_Tipo_Activo": tipo["TAC_Tipo_Activo"], "ACT_Fecha_Compra": time.strftime("%Y-%m-%d")}
        if costo:
            d["ACT_Costo"] = costo
        return d

    r = c.post(f"{API}/compras/ordenes/{oid}/recibir", json={"activos": [activo(f"QA9A{sufijo}", "1100")]})
    caso("Precio fuera de tolerancia exige justificación",
         r.status_code == 400 and r.json().get("detail") == f"PRICE_DIFFERENCE_REQUIRES_JUSTIFICATION:{l_act}", r.text[:200])

    r = c.post(f"{API}/compras/ordenes/{oid}/recibir", json={"activos": [activo(f"QA9A{sufijo}{i}") for i in range(3)]})
    caso("Sobrante rechazado sin justificación",
         r.status_code == 400 and r.json().get("detail", "").startswith("RECEIPT_EXCEEDS_PENDING"), r.text[:200])

    r = c.post(f"{API}/compras/ordenes/{oid}/recibir", json={
        "documento": "Guía QA9-1", "activos": [activo(f"QA9A{sufijo}", "1100")],
        "diferencias": [{"OCL_Linea": l_act, "motivo": "Tipo de cambio de la factura"}]})
    ok = r.status_code == 200 and r.json()["OCO_Estado"] == "PARCIAL"
    caso("Recepción parcial con precio justificado", ok, r.text[:300])
    res = r.json() if ok else {}
    codigo = (res.get("activos_codigos") or [None])[0]
    caso("Resultado informa códigos, pendientes y diferencias",
         bool(codigo) and len(res.get("pendientes", [])) == 2 and res.get("diferencias", [{}])[0].get("tipo") == "PRECIO",
         json.dumps(res)[:300])

    atencion = c.get(f"{API}/inventario/atencion").json()
    parcial = next((i for i in atencion["items"] if i["clave"] == "ORDEN_PARCIAL"), None)
    caso("Bandeja de atención incluye la orden parcial",
         bool(parcial) and any(x["id"] == oid for x in parcial["items"]), json.dumps(atencion)[:200])

    r = c.post(f"{API}/compras/ordenes/{oid}/recibir", json={"otros": [{"OCL_Linea": l_otro, "cantidad": 1}]})
    caso("Conformidad del flete (línea OTRO)", r.status_code == 200 and r.json()["OCO_Estado"] == "PARCIAL", r.text[:200])

    r = c.patch(f"{API}/compras/ordenes/{oid}/estado", json={"OCO_Estado": "CANCELADA"})
    caso("No se cancela una orden con entregas", r.status_code in (400, 409), r.text[:200])

    r = c.post(f"{API}/compras/ordenes/{oid}/cerrar", json={"motivo": "El proveedor no tiene la segunda unidad"})
    caso("Cierre con faltante", r.status_code == 200 and r.json()["OCO_Estado"] == "CERRADA_CON_FALTANTE", r.text[:200])
    recs = c.get(f"{API}/compras/ordenes/{oid}/recepciones").json()
    caso("Entregas consultables con documento", len(recs) == 2 and recs[0]["REC_Documento"] == "Guía QA9-1", json.dumps(recs)[:200])

    # ---------- 2. Kardex, hoja de vida y baja ----------
    if codigo:
        a = c.get(f"{API}/core/activos/by-code/{codigo}").json()
        aid = a.get("ACT_Activo")
        k = c.get(f"{API}/inventario/kardex", params={"activo_id": aid}).json()
        tipos_ev = [e["KDX_Tipo"] for e in k.get("items", [])]
        caso("Kardex del equipo registra la recepción", "RECEPCION" in tipos_ev, str(tipos_ev))
        pdf = c.get(f"{API}/inventario/activos/{aid}/hoja-de-vida.pdf", params={"lang": "es"})
        caso("Hoja de vida en PDF", pdf.status_code == 200 and pdf.content[:4] == b"%PDF", str(pdf.status_code))
        r = c.post(f"{API}/core/activos/{aid}/baja", json={"motivo": "OTRO", "destino": "RESGUARDO"})
        caso("Baja con motivo «Otro» exige observación", r.status_code in (400, 422), r.text[:200])
        r = c.post(f"{API}/core/activos/{aid}/baja", json={
            "motivo": "DANO_IRREPARABLE", "destino": "RECICLAJE", "documento": "Informe QA9"})
        caso("Baja formal", r.status_code == 200, r.text[:200])
        k = c.get(f"{API}/inventario/kardex", params={"activo_id": aid}).json()
        caso("Kardex registra la baja", any(e["KDX_Tipo"] == "BAJA" for e in k.get("items", [])), "")
        r = c.post(f"{API}/trazabilidad/movimientos", json={"ACT_Activo": aid})
        caso("Un activo de baja no admite asignación", r.status_code in (400, 409, 422), r.text[:200])

    # ---------- 3. Consumible ----------
    con = c.post(f"{API}/consumibles", json={"CON_Nombre": f"Tóner QA9 {sufijo}", "CON_Unidad": "unidad",
                                              "CON_Stock_Actual": 0, "CON_Stock_Minimo": 3, "SED_Sede": sede}).json()
    cid = con["CON_Consumible"]
    r = c.post(f"{API}/consumibles/{cid}/entrada", json={"MOC_Cantidad": 5, "precio_unitario": "25.50", "moneda": "USD"})
    caso("Entrada de consumible con costo y moneda", r.status_code == 201, r.text[:200])
    det = c.get(f"{API}/consumibles/{cid}").json()
    caso("El consumible guarda el costo en su moneda",
         str(det.get("CON_Costo_Unitario")) in ("25.50", "25.5") and det.get("CON_Moneda") == "USD", json.dumps(det)[:200])
    r = c.post(f"{API}/consumibles/{cid}/salida", json={"MOC_Cantidad": 3})
    caso("Salida que deja el stock bajo el mínimo lo señala", r.status_code == 201 and r.json().get("bajo_minimo") is True, r.text[:200])
    r = c.post(f"{API}/consumibles/{cid}/ajuste", json={"CON_Stock_Real": 2, "MOC_Motivo": "corto"})
    caso("Ajuste con motivo corto se rechaza", r.status_code in (400, 422), r.text[:200])
    r = c.post(f"{API}/consumibles/{cid}/ajuste", json={"CON_Stock_Real": 1, "MOC_Motivo": "Conteo físico mensual"})
    caso("Ajuste por conteo", r.status_code == 201 and r.json()["MOC_Stock_Resultante"] == 1, r.text[:200])

    # ---------- 4. Reportes ----------
    for ruta in ["/inventario/licencias.csv?lang=es", "/inventario/custodia?lang=es", "/inventario/entradas-salidas",
                 "/inventario/kardex.csv?lang=en"]:
        r = c.get(f"{API}{ruta}")
        caso(f"Reporte {ruta.split('?')[0]}", r.status_code == 200, f"{r.status_code} {r.text[:120]}")

    # ---------- 5. Frontend publicado ----------
    index = httpx.get(f"{BASE}/", verify=False).text
    js = [m for m in re.findall(r'src="(/assets/[^"]+\.js)"', index)]
    bundle = "".join(httpx.get(f"{BASE}{p}", verify=False).text for p in js)
    caso("Frontend enruta /trazabilidad y /inventario/tomas", "/trazabilidad" in bundle and "/inventario/tomas" in bundle, str(js))

    SALIDA.parent.mkdir(exist_ok=True)
    SALIDA.write_text(json.dumps(resultados, ensure_ascii=False, indent=2), encoding="utf-8")
    fallas = [r for r in resultados if not r["ok"]]
    print(f"\n{len(resultados) - len(fallas)}/{len(resultados)} casos OK")


if __name__ == "__main__":
    main()
