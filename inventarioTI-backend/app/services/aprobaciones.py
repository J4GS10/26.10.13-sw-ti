"""
Aprobaciones del Jefe de TI (separación de funciones).

Flujo:
  solicitar → PENDIENTE → aprobar (ejecuta la operación tal como se pidió,
  revalidando las reglas) → APROBADA
                        → rechazar (con motivo) → RECHAZADA
                        → anular (solo quien la pidió) → ANULADA

Reglas:
- Aprueban JEFE_TI o SUPER_ADMIN (lo exige el endpoint).
- Nadie aprueba su propia solicitud (aquí y con un CHECK en la base).
- Si al aprobar la operación ya no es válida (el equipo se asignó, la orden
  cambió…), no se ejecuta nada y la solicitud sigue pendiente para rechazarla.
- Cada paso queda en la bitácora de auditoría; la operación ejecutada queda en
  el kardex con quién la solicitó y quién la aprobó.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.transactional import transactional
from app.models.aprobacion import Aprobacion
from app.models.organization import Persona, Usuario
from app.repositories.governance import GovernanceRepository


def _ahora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AprobacionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.gov_repo = GovernanceRepository(db)

    # ------------------------------------------------------------------
    # Solicitudes
    # ------------------------------------------------------------------
    async def crear(self, tipo: str, *, payload: dict, solicitante: uuid.UUID | None, resumen: str,
                    motivo: str | None = None, activo_id: uuid.UUID | None = None,
                    orden_id: int | None = None, sede: int | None = None, ip=None) -> Aprobacion:
        if solicitante is None:
            raise HTTPException(400, "APPROVAL_REQUIRES_REQUESTER")
        solicitud = Aprobacion(
            APR_Tipo=tipo, APR_Estado="PENDIENTE", APR_Payload=payload, APR_Resumen=resumen,
            APR_Motivo=motivo or None, ACT_Activo=activo_id, OCO_Orden=orden_id, SED_Sede=sede,
            APR_Solicitante=solicitante,
        )
        self.db.add(solicitud)
        await self.db.flush()
        await self.gov_repo.create_audit_log(
            "APPROVAL_REQUEST", "INV_APROBACION",
            {"id": solicitud.APR_Aprobacion, "tipo": tipo, "resumen": resumen},
            usuario_id=solicitante, ip_origen=ip, sede_id=sede,
        )
        return solicitud

    @transactional
    async def solicitar_baja(self, activo_id: uuid.UUID, schema, usuario_id=None, ip=None) -> dict:
        """La baja se valida ahora y se ejecuta cuando el Jefe de TI la aprueba."""
        from app.services.core import CoreService
        activo, _, _ = await CoreService(self.db).validar_baja(activo_id, schema)
        pendiente = (await self.db.execute(select(Aprobacion.APR_Aprobacion).where(
            Aprobacion.ACT_Activo == activo_id, Aprobacion.APR_Tipo == "BAJA",
            Aprobacion.APR_Estado == "PENDIENTE"))).first()
        if pendiente:
            raise HTTPException(409, f"DECOMMISSION_ALREADY_REQUESTED:{pendiente[0]}")
        solicitud = await self.crear(
            "BAJA", payload=schema.model_dump(mode="json"), solicitante=usuario_id,
            resumen=f"Baja de {activo.ACT_Codigo_Interno} ({activo.ACT_Serie_Fabricante}): "
                    f"{schema.motivo} → {schema.destino}",
            motivo=schema.observacion, activo_id=activo_id, sede=activo.SED_Sede, ip=ip,
        )
        return await self._a_dict(solicitud)

    # ------------------------------------------------------------------
    # Consulta
    # ------------------------------------------------------------------
    async def _nombres(self, ids: set) -> dict:
        ids = {i for i in ids if i}
        if not ids:
            return {}
        filas = (await self.db.execute(
            select(Usuario.USU_Usuario, Usuario.USU_Username, Persona.PER_Primer_Nombre, Persona.PER_Primer_Apellido)
            .join(Persona, Persona.PER_Persona == Usuario.PER_Persona, isouter=True)
            .where(Usuario.USU_Usuario.in_(ids))
        )).all()
        return {u: (f"{n} {a}" if n else user) for u, user, n, a in filas}

    async def _a_dict(self, a: Aprobacion, nombres: dict | None = None) -> dict:
        if nombres is None:
            nombres = await self._nombres({a.APR_Solicitante, a.APR_Aprobador})
        return {
            "APR_Aprobacion": a.APR_Aprobacion, "APR_Tipo": a.APR_Tipo, "APR_Estado": a.APR_Estado,
            "APR_Resumen": a.APR_Resumen, "APR_Motivo": a.APR_Motivo, "APR_Payload": a.APR_Payload,
            "ACT_Activo": a.ACT_Activo, "OCO_Orden": a.OCO_Orden, "SED_Sede": a.SED_Sede,
            "APR_Solicitante": a.APR_Solicitante, "solicitante_nombre": nombres.get(a.APR_Solicitante),
            "APR_Fecha_Solicitud": a.APR_Fecha_Solicitud,
            "APR_Aprobador": a.APR_Aprobador, "aprobador_nombre": nombres.get(a.APR_Aprobador),
            "APR_Fecha_Resolucion": a.APR_Fecha_Resolucion, "APR_Comentario": a.APR_Comentario,
        }

    async def listar(self, estado: str | None = None, activo_id: uuid.UUID | None = None,
                     limite: int = 200) -> list[dict]:
        q = select(Aprobacion).order_by(Aprobacion.APR_Fecha_Solicitud.desc()).limit(limite)
        if estado:
            q = q.where(Aprobacion.APR_Estado == estado)
        if activo_id:
            q = q.where(Aprobacion.ACT_Activo == activo_id)
        filas = list((await self.db.execute(q)).scalars().all())
        nombres = await self._nombres({x.APR_Solicitante for x in filas} | {x.APR_Aprobador for x in filas})
        return [await self._a_dict(x, nombres) for x in filas]

    async def pendientes(self) -> int:
        from sqlalchemy import func
        return (await self.db.execute(select(func.count()).select_from(Aprobacion).where(
            Aprobacion.APR_Estado == "PENDIENTE"))).scalar_one()

    # ------------------------------------------------------------------
    # Resolución
    # ------------------------------------------------------------------
    async def _pendiente(self, aprobacion_id: int) -> Aprobacion:
        a = (await self.db.execute(
            select(Aprobacion).where(Aprobacion.APR_Aprobacion == aprobacion_id).with_for_update()
        )).scalar_one_or_none()
        if not a:
            raise HTTPException(404, "APPROVAL_NOT_FOUND")
        if a.APR_Estado != "PENDIENTE":
            raise HTTPException(409, f"APPROVAL_ALREADY_RESOLVED:{a.APR_Estado}")
        return a

    @transactional
    async def aprobar(self, aprobacion_id: int, aprobador_id: uuid.UUID, comentario: str | None = None,
                      ip=None) -> dict:
        a = await self._pendiente(aprobacion_id)
        if a.APR_Solicitante == aprobador_id:
            raise HTTPException(403, "CANNOT_APPROVE_OWN_REQUEST")
        traza = {"aprobacion": a.APR_Aprobacion, "solicitado_por": a.APR_Solicitante, "aprobado_por": aprobador_id}
        if a.APR_Tipo == "BAJA":
            from app.schemas.core import BajaActivo
            from app.services.core import CoreService
            await CoreService(self.db).dar_de_baja(
                a.ACT_Activo, BajaActivo(**a.APR_Payload), usuario_id=a.APR_Solicitante, aprobacion=traza,
            )
        elif a.APR_Tipo == "RECEPCION_SOBRANTE":
            from app.schemas.procurement import RecepcionOrden
            from app.services.procurement import ProcurementService
            resultado = await ProcurementService(self.db).recibir_orden(
                a.OCO_Orden, RecepcionOrden(**a.APR_Payload), usuario_id=a.APR_Solicitante, ip=ip, aprobacion=traza,
            )
            traza["recepcion"] = resultado.get("REC_Recepcion")
        a.APR_Estado = "APROBADA"
        a.APR_Aprobador = aprobador_id
        a.APR_Fecha_Resolucion = _ahora()
        a.APR_Comentario = comentario or None
        await self.gov_repo.create_audit_log(
            "APPROVAL_APPROVE", "INV_APROBACION",
            {"id": a.APR_Aprobacion, "tipo": a.APR_Tipo, "resumen": a.APR_Resumen,
             "solicitante": str(a.APR_Solicitante), "comentario": comentario},
            usuario_id=aprobador_id, ip_origen=ip, sede_id=a.SED_Sede,
        )
        await self.db.flush()
        return await self._a_dict(a)

    @transactional
    async def rechazar(self, aprobacion_id: int, aprobador_id: uuid.UUID, comentario: str, ip=None) -> dict:
        a = await self._pendiente(aprobacion_id)
        if a.APR_Solicitante == aprobador_id:
            raise HTTPException(403, "CANNOT_APPROVE_OWN_REQUEST")
        a.APR_Estado = "RECHAZADA"
        a.APR_Aprobador = aprobador_id
        a.APR_Fecha_Resolucion = _ahora()
        a.APR_Comentario = comentario
        await self.gov_repo.create_audit_log(
            "APPROVAL_REJECT", "INV_APROBACION",
            {"id": a.APR_Aprobacion, "tipo": a.APR_Tipo, "resumen": a.APR_Resumen, "comentario": comentario},
            usuario_id=aprobador_id, ip_origen=ip, sede_id=a.SED_Sede,
        )
        await self.db.flush()
        return await self._a_dict(a)

    @transactional
    async def anular(self, aprobacion_id: int, usuario_id: uuid.UUID, ip=None) -> dict:
        a = await self._pendiente(aprobacion_id)
        if a.APR_Solicitante != usuario_id:
            raise HTTPException(403, "ONLY_REQUESTER_CAN_CANCEL")
        a.APR_Estado = "ANULADA"
        a.APR_Fecha_Resolucion = _ahora()
        await self.gov_repo.create_audit_log(
            "APPROVAL_CANCEL", "INV_APROBACION", {"id": a.APR_Aprobacion, "tipo": a.APR_Tipo},
            usuario_id=usuario_id, ip_origen=ip, sede_id=a.SED_Sede,
        )
        await self.db.flush()
        return await self._a_dict(a)
