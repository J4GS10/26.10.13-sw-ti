"""
Herramientas para trabajar más rápido sin perder control:

- Entrega de puesto y devolución en lote: varias operaciones en UNA transacción
  (si un equipo no se puede entregar, no se entrega ninguno). Reutilizan los
  servicios de trazabilidad, así cada equipo deja su movimiento, su evento de
  kardex y su auditoría igual que si se hiciera de a uno.
- Búsqueda global: activos, personas y órdenes de compra en una sola consulta.
- Kit sugerido: tipos de equipo que suelen tener las personas del mismo
  departamento, con la disponibilidad actual en bodega.
- Calidad de datos: verificaciones que señalan registros por completar.

Todas las consultas pasan por el alcance por sede (RLS) automáticamente.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.transactional import transactional
from app.models.catalogs import EstadoOperativo, Marca, Modelo, TipoActivo
from app.models.core import Activo
from app.models.enums import EstadoOperativoEnum, TipoMovimientoEnum
from app.models.organization import Departamento, Persona
from app.models.procurement import OrdenCompra, Proveedor
from app.models.traceability import Movimiento, TipoMovimiento
from app.repositories.governance import GovernanceRepository
from app.schemas.productividad import DevolucionLoteCreate, EntregaLoteCreate
from app.schemas.traceability import DevolucionCreate, MovimientoCreate, TransferenciaCreate

ROLES_COMPRAS = {"SUPER_ADMIN", "JEFE_TI", "ADMIN_TI", "AUDITOR"}
ESTADOS_LIBRES = (EstadoOperativoEnum.DISPONIBLE.value, EstadoOperativoEnum.BODEGA.value)
DEPARTAMENTOS_PROVISIONALES = ("por clasificar", "sin departamento", "sin asignar")
DOMINIOS_PROVISIONALES = ("%example.com", "%.example", "%.local", "%.test", "%.invalid")
MAX_ITEMS_VERIFICACION = 50


def _codigo_error(detail: Any) -> str:
    """Código de un HTTPException, venga como texto o como objeto."""
    if isinstance(detail, dict):
        return str(detail.get("error") or detail.get("code") or "TRANSACTION_FAILED")
    return str(detail or "TRANSACTION_FAILED")


def _nombre(p: Persona) -> str:
    return " ".join(x for x in (p.PER_Primer_Nombre, p.PER_Segundo_Nombre, p.PER_Primer_Apellido,
                                p.PER_Segundo_Apellido) if x)


def _tokens(q: str) -> list[str]:
    return [t for t in q.strip().split() if t][:5]


class ProductividadService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.gov_repo = GovernanceRepository(db)

    # ------------------------------------------------------------------
    # Operaciones en lote
    # ------------------------------------------------------------------
    async def _tipo_movimiento(self, tipo: TipoMovimientoEnum) -> int:
        tmo = (await self.db.execute(
            select(TipoMovimiento.TMO_Tipo_Movimiento).where(TipoMovimiento.TMO_Nombre == tipo.value)
        )).scalar_one_or_none()
        if tmo is None:
            raise HTTPException(500, detail="SYSTEM_CONFIG_ERROR_MISSING_MOVEMENT_TYPE")
        return tmo

    async def _codigos(self, ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
        filas = (await self.db.execute(
            select(Activo.ACT_Activo, Activo.ACT_Codigo_Interno).where(Activo.ACT_Activo.in_(ids))
        )).all()
        codigos = {f[0]: f[1] for f in filas}
        if len(codigos) != len(ids):
            raise HTTPException(404, detail="ASSET_NOT_FOUND")
        return codigos

    async def _custodios(self, ids: list[uuid.UUID]) -> dict[uuid.UUID, uuid.UUID]:
        filas = (await self.db.execute(
            select(Movimiento.ACT_Activo, Movimiento.PER_Persona)
            .where(Movimiento.ACT_Activo.in_(ids), Movimiento.MOV_Fecha_Devolucion.is_(None))
        )).all()
        return {f[0]: f[1] for f in filas}

    @transactional
    async def entrega_lote(self, schema: EntregaLoteCreate, usuario_id=None, ip=None) -> dict:
        from app.services.traceability import TraceabilityService

        trazabilidad = TraceabilityService(self.db)
        codigos = await self._codigos(schema.activos)
        custodios = await self._custodios(schema.activos)
        tipo_asignacion = await self._tipo_movimiento(TipoMovimientoEnum.ASIGNACION)
        observacion = " · ".join(x for x in (
            f"Ticket {schema.ticket}" if schema.ticket else None, schema.MOV_Observacion,
        ) if x) or None

        items: list[dict] = []
        for activo_id in schema.activos:
            codigo = codigos[activo_id]
            custodio = custodios.get(activo_id)
            try:
                if custodio == schema.PER_Persona:
                    raise HTTPException(400, detail="ASSET_ALREADY_WITH_PERSON")
                if custodio is not None:
                    mov = await trazabilidad.registrar_transferencia(
                        TransferenciaCreate(
                            ACT_Activo=activo_id, PER_Persona_Destino=schema.PER_Persona,
                            ARE_Area_Destino=schema.ARE_Area, MOV_Observacion=observacion,
                            MOV_Motivo=schema.MOV_Motivo,
                        ),
                        usuario_id=usuario_id, ip=ip,
                    )
                else:
                    mov = await trazabilidad.registrar_movimiento(
                        MovimientoCreate(
                            ACT_Activo=activo_id, PER_Persona=schema.PER_Persona, ARE_Area=schema.ARE_Area,
                            TMO_Tipo_Movimiento=tipo_asignacion, MOV_Observacion=observacion,
                            MOV_Motivo=schema.MOV_Motivo,
                        ),
                        usuario_id=usuario_id, ip=ip,
                    )
            except HTTPException as exc:
                # Toda la entrega se revierte: se informa qué equipo la detuvo.
                raise HTTPException(
                    exc.status_code, detail=f"BATCH_ITEM_FAILED:{codigo}:{_codigo_error(exc.detail)}",
                ) from exc
            items.append({
                "ACT_Activo": str(activo_id), "codigo": codigo,
                "MOV_Movimiento": str(mov.MOV_Movimiento),
                "operacion": "TRANSFERENCIA" if custodio is not None else "ASIGNACION",
            })

        await self.gov_repo.create_audit_log(
            "ASSIGN_BATCH", "INV_MOVIMIENTO",
            {"persona": str(schema.PER_Persona), "area": schema.ARE_Area, "ticket": schema.ticket,
             "activos": [i["codigo"] for i in items]},
            usuario_id=usuario_id, ip_origen=ip,
        )
        return {"total": len(items), "movimientos": [i["MOV_Movimiento"] for i in items], "items": items}

    @transactional
    async def devolucion_lote(self, schema: DevolucionLoteCreate, usuario_id=None, ip=None) -> dict:
        from app.services.traceability import TraceabilityService

        trazabilidad = TraceabilityService(self.db)
        codigos = await self._codigos(schema.activos)
        items: list[dict] = []
        for activo_id in schema.activos:
            codigo = codigos[activo_id]
            try:
                res = await trazabilidad.registrar_devolucion(
                    DevolucionCreate(
                        ACT_Activo=activo_id, MOV_Motivo=schema.MOV_Motivo,
                        ARE_Area_Destino=schema.ARE_Area_Destino, condicion=schema.condicion,
                    ),
                    usuario_id=usuario_id, ip=ip,
                )
            except HTTPException as exc:
                raise HTTPException(
                    exc.status_code, detail=f"BATCH_ITEM_FAILED:{codigo}:{_codigo_error(exc.detail)}",
                ) from exc
            items.append({"ACT_Activo": str(activo_id), "codigo": codigo,
                          "MOV_Movimiento": res["MOV_Movimiento"], "estado": res["estado"]})

        await self.gov_repo.create_audit_log(
            "RETURN_BATCH", "INV_MOVIMIENTO",
            {"activos": [i["codigo"] for i in items], "motivo": schema.MOV_Motivo},
            usuario_id=usuario_id, ip_origen=ip,
        )
        return {"total": len(items), "movimientos": [i["MOV_Movimiento"] for i in items], "items": items}

    # ------------------------------------------------------------------
    # Búsqueda global
    # ------------------------------------------------------------------
    async def buscar(self, q: str, rol: str | None, limite: int = 8) -> dict:
        tokens = _tokens(q)
        if not tokens or len(q.strip()) < 2:
            return {"q": q, "resultados": []}
        resultados: list[dict] = []

        # Activos: código, serie, hostname, tipo, marca o modelo.
        custodio = (
            select(Movimiento.ACT_Activo, Movimiento.PER_Persona)
            .where(Movimiento.MOV_Fecha_Devolucion.is_(None)).subquery()
        )
        cond_activo = [or_(
            Activo.ACT_Codigo_Interno.ilike(f"%{t}%"), Activo.ACT_Serie_Fabricante.ilike(f"%{t}%"),
            Activo.ACT_Hostname.ilike(f"%{t}%"), Modelo.MOD_Nombre.ilike(f"%{t}%"),
            Marca.MAR_Nombre.ilike(f"%{t}%"), TipoActivo.TAC_Nombre.ilike(f"%{t}%"),
        ) for t in tokens]
        exacto = func.lower(Activo.ACT_Codigo_Interno) == q.strip().lower()
        filas = (await self.db.execute(
            select(Activo, TipoActivo.TAC_Nombre, Marca.MAR_Nombre, Modelo.MOD_Nombre,
                   EstadoOperativo.EOP_Nombre, Persona)
            .join(Modelo, Modelo.MOD_Modelo == Activo.MOD_Modelo)
            .join(Marca, Marca.MAR_Marca == Modelo.MAR_Marca)
            .join(TipoActivo, TipoActivo.TAC_Tipo_Activo == Activo.TAC_Tipo_Activo)
            .join(EstadoOperativo, EstadoOperativo.EOP_Estado_Operativo == Activo.EOP_Estado_Operativo)
            .outerjoin(custodio, custodio.c.ACT_Activo == Activo.ACT_Activo)
            .outerjoin(Persona, Persona.PER_Persona == custodio.c.PER_Persona)
            .where(and_(*cond_activo))
            .order_by(exacto.desc(), Activo.ACT_Codigo_Interno)
            .limit(limite)
        )).all()
        for act, tipo, marca, modelo, estado, persona in filas:
            resultados.append({
                "tipo": "activo", "id": str(act.ACT_Activo), "codigo": act.ACT_Codigo_Interno,
                "titulo": f"{act.ACT_Codigo_Interno} · {tipo}",
                "subtitulo": " · ".join(x for x in (f"{marca} {modelo}", act.ACT_Serie_Fabricante,
                                                    act.ACT_Hostname) if x),
                "estado": estado, "custodio": _nombre(persona) if persona else None,
            })

        # Personas: todas las palabras deben aparecer en el nombre o el correo.
        nombre_completo = func.concat_ws(
            " ", Persona.PER_Primer_Nombre, Persona.PER_Segundo_Nombre,
            Persona.PER_Primer_Apellido, Persona.PER_Segundo_Apellido,
        )
        cond_persona = [or_(nombre_completo.ilike(f"%{t}%"), Persona.PER_Email_Corporativo.ilike(f"%{t}%"))
                        for t in tokens]
        personas = (await self.db.execute(
            select(Persona, Departamento.DEP_Nombre)
            .join(Departamento, Departamento.DEP_Departamento == Persona.DEP_Departamento)
            .where(and_(*cond_persona))
            .order_by(Persona.PER_Estado.desc(), Persona.PER_Primer_Nombre)
            .limit(6)
        )).all()
        for p, dep in personas:
            resultados.append({
                "tipo": "persona", "id": str(p.PER_Persona), "titulo": _nombre(p),
                "subtitulo": " · ".join(x for x in (dep, p.PER_Email_Corporativo) if x),
                "activo": bool(p.PER_Estado),
            })

        # Órdenes de compra (solo quien ve compras).
        if rol in ROLES_COMPRAS:
            cond_orden = [or_(OrdenCompra.OCO_Numero.ilike(f"%{t}%"), Proveedor.PRV_Nombre.ilike(f"%{t}%"))
                          for t in tokens]
            ordenes = (await self.db.execute(
                select(OrdenCompra, Proveedor.PRV_Nombre)
                .join(Proveedor, Proveedor.PRV_Proveedor == OrdenCompra.PRV_Proveedor)
                .where(and_(*cond_orden)).order_by(OrdenCompra.OCO_Fecha.desc()).limit(4)
            )).all()
            for o, proveedor in ordenes:
                resultados.append({
                    "tipo": "orden", "id": str(o.OCO_Orden), "titulo": o.OCO_Numero,
                    "subtitulo": " · ".join(x for x in (proveedor, o.OCO_Estado, str(o.OCO_Fecha)) if x),
                })
        return {"q": q, "resultados": resultados}

    # ------------------------------------------------------------------
    # Kit sugerido para una entrega de puesto
    # ------------------------------------------------------------------
    async def kit_sugerido(self, persona_id: uuid.UUID) -> dict:
        persona = (await self.db.execute(
            select(Persona, Departamento.DEP_Nombre)
            .join(Departamento, Departamento.DEP_Departamento == Persona.DEP_Departamento)
            .where(Persona.PER_Persona == persona_id)
        )).first()
        if persona is None:
            raise HTTPException(404, detail="PERSON_NOT_FOUND")
        per, dep_nombre = persona

        async def frecuencias(filtro_dep: bool) -> tuple[int, list[tuple[int, int]]]:
            base = (
                select(Activo.TAC_Tipo_Activo, Movimiento.PER_Persona)
                .join(Movimiento, Movimiento.ACT_Activo == Activo.ACT_Activo)
                .join(Persona, Persona.PER_Persona == Movimiento.PER_Persona)
                .where(Movimiento.MOV_Fecha_Devolucion.is_(None), Persona.PER_Persona != persona_id)
            )
            if filtro_dep:
                base = base.where(Persona.DEP_Departamento == per.DEP_Departamento)
            sub = base.subquery()
            total = (await self.db.execute(select(func.count(distinct(sub.c.PER_Persona))))).scalar_one()
            filas = (await self.db.execute(
                select(sub.c.TAC_Tipo_Activo, func.count(distinct(sub.c.PER_Persona)))
                .group_by(sub.c.TAC_Tipo_Activo)
            )).all()
            return int(total), [(f[0], int(f[1])) for f in filas]

        origen = "departamento"
        # Un departamento provisional («Por clasificar») no describe un puesto.
        provisional = (dep_nombre or "").strip().lower() in DEPARTAMENTOS_PROVISIONALES
        total, filas = (0, []) if provisional else await frecuencias(True)
        if total < 2:
            origen = "general"
            total, filas = await frecuencias(False)

        ya_tiene = set((await self.db.execute(
            select(Activo.TAC_Tipo_Activo)
            .join(Movimiento, Movimiento.ACT_Activo == Activo.ACT_Activo)
            .where(Movimiento.PER_Persona == persona_id, Movimiento.MOV_Fecha_Devolucion.is_(None))
        )).scalars().all())
        disponibles = dict((await self.db.execute(
            select(Activo.TAC_Tipo_Activo, func.count())
            .join(EstadoOperativo, EstadoOperativo.EOP_Estado_Operativo == Activo.EOP_Estado_Operativo)
            .where(EstadoOperativo.EOP_Nombre.in_(ESTADOS_LIBRES), Activo.ACT_Activo_Padre.is_(None))
            .group_by(Activo.TAC_Tipo_Activo)
        )).all())
        nombres = dict((await self.db.execute(select(TipoActivo.TAC_Tipo_Activo, TipoActivo.TAC_Nombre))).all())

        umbral = 0.4 if total >= 3 else 0.0
        tipos = sorted(
            ({"TAC_Tipo_Activo": tipo, "nombre": nombres.get(tipo, "?"),
              "frecuencia": round(n / total, 2) if total else 0.0,
              "disponibles": int(disponibles.get(tipo, 0)), "ya_tiene": tipo in ya_tiene}
             for tipo, n in filas if total and n / total >= umbral),
            key=lambda x: (-x["frecuencia"], x["nombre"]),
        )[:10]
        return {"origen": origen, "departamento": dep_nombre, "personas_referencia": total, "tipos": tipos}

    # ------------------------------------------------------------------
    # Calidad de datos
    # ------------------------------------------------------------------
    async def calidad_datos(self) -> dict:
        verificaciones: list[dict] = []

        async def agregar(clave: str, severidad: str, consulta, a_item) -> None:
            total = (await self.db.execute(select(func.count()).select_from(consulta.subquery()))).scalar_one()
            filas = (await self.db.execute(consulta.limit(MAX_ITEMS_VERIFICACION))).all() if total else []
            verificaciones.append({"clave": clave, "severidad": severidad, "total": int(total),
                                   "items": [a_item(f) for f in filas]})

        def item_activo(f) -> dict:
            a = f[0]
            return {"tipo": "activo", "id": str(a.ACT_Activo), "codigo": a.ACT_Codigo_Interno,
                    "titulo": a.ACT_Codigo_Interno, "detalle": a.ACT_Serie_Fabricante}

        def item_persona(f) -> dict:
            p = f[0]
            return {"tipo": "persona", "id": str(p.PER_Persona), "titulo": _nombre(p),
                    "detalle": p.PER_Email_Corporativo}

        no_baja = EstadoOperativo.EOP_Nombre != EstadoOperativoEnum.BAJA.value
        activos = (
            select(Activo).join(EstadoOperativo, EstadoOperativo.EOP_Estado_Operativo == Activo.EOP_Estado_Operativo)
        )
        abiertos = select(Movimiento.ACT_Activo).where(Movimiento.MOV_Fecha_Devolucion.is_(None))

        # Integridad (alta): custodias de personas inactivas y estados que no cuadran.
        await agregar(
            "custodia_persona_inactiva", "alta",
            select(Activo, Persona)
            .join(Movimiento, and_(Movimiento.ACT_Activo == Activo.ACT_Activo, Movimiento.MOV_Fecha_Devolucion.is_(None)))
            .join(Persona, Persona.PER_Persona == Movimiento.PER_Persona)
            .where(Persona.PER_Estado.is_(False)).order_by(Activo.ACT_Codigo_Interno),
            lambda f: {**item_activo(f), "detalle": _nombre(f[1])},
        )
        await agregar(
            "estado_inconsistente", "alta",
            activos.where(or_(
                and_(EstadoOperativo.EOP_Nombre == EstadoOperativoEnum.ASIGNADO.value,
                     Activo.ACT_Activo.not_in(abiertos)),
                and_(EstadoOperativo.EOP_Nombre.in_(ESTADOS_LIBRES), Activo.ACT_Activo.in_(abiertos)),
            )).order_by(Activo.ACT_Codigo_Interno),
            item_activo,
        )
        # Datos por completar (media).
        await agregar(
            "personas_por_clasificar", "media",
            select(Persona).join(Departamento, Departamento.DEP_Departamento == Persona.DEP_Departamento)
            .where(func.lower(Departamento.DEP_Nombre).in_(DEPARTAMENTOS_PROVISIONALES), Persona.PER_Estado.is_(True))
            .order_by(Persona.PER_Primer_Nombre),
            item_persona,
        )
        await agregar(
            "correos_provisionales", "media",
            select(Persona).where(or_(*[func.lower(Persona.PER_Email_Corporativo).like(d)
                                        for d in DOMINIOS_PROVISIONALES]), Persona.PER_Estado.is_(True))
            .order_by(Persona.PER_Primer_Nombre),
            item_persona,
        )
        await agregar(
            "activos_sin_serie", "media",
            activos.where(no_baja, or_(
                Activo.ACT_Serie_Fabricante == Activo.ACT_Codigo_Interno,
                Activo.ACT_Serie_Fabricante.like(func.concat("%(", Activo.ACT_Codigo_Interno, ")")),
            )).order_by(Activo.ACT_Codigo_Interno),
            item_activo,
        )
        # Información para valorar el inventario (baja).
        await agregar(
            "activos_sin_costo", "baja",
            activos.where(no_baja, Activo.ACT_Costo.is_(None)).order_by(Activo.ACT_Codigo_Interno),
            item_activo,
        )
        await agregar(
            "modelos_sin_tipo", "baja",
            select(Modelo, Marca.MAR_Nombre).join(Marca, Marca.MAR_Marca == Modelo.MAR_Marca)
            .where(Modelo.TAC_Tipo_Activo.is_(None)).order_by(Modelo.MOD_Nombre),
            lambda f: {"tipo": "modelo", "id": str(f[0].MOD_Modelo), "titulo": f[0].MOD_Nombre, "detalle": f[1]},
        )
        pendientes = sum(v["total"] for v in verificaciones if v["severidad"] != "baja")
        return {"pendientes": pendientes, "verificaciones": verificaciones}
