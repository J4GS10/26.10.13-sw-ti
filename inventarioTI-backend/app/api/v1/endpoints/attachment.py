"""Adjuntos por activo: factura, foto, acta firmada escaneada, etc."""
import uuid
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_client_ip, require_admin, require_operativo
from app.core.limiter import limiter
from app.db.session import get_db
from app.schemas.attachment import AdjuntoResponse
from app.services.attachments import AttachmentService

router = APIRouter()


def get_service(db: AsyncSession = Depends(get_db)) -> AttachmentService:
    return AttachmentService(db)


@router.get("/activos/{activo_id}", response_model=List[AdjuntoResponse])
async def list_adjuntos(activo_id: uuid.UUID, service: AttachmentService = Depends(get_service)):
    return await service.list(activo_id)


@router.post(
    "/activos/{activo_id}", response_model=AdjuntoResponse, status_code=201,
    dependencies=[Depends(require_operativo)],
)
@limiter.limit("30/minute")
async def upload_adjunto(
    activo_id: uuid.UUID,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    categoria: str = Form("otro"),
    descripcion: Optional[str] = Form(None),
    service: AttachmentService = Depends(get_service),
):
    """Sube un archivo asociado al activo. categoria ∈ {factura, foto, acta, otro}."""
    return await service.upload(
        activo_id, file, categoria=categoria, descripcion=descripcion,
        usuario_id=current_user.USU_Usuario, ip=get_client_ip(request),
    )


# ---- Adjuntos de órdenes de compra (factura, etc.) ----
@router.get("/ordenes/{orden_id}", response_model=List[AdjuntoResponse])
async def list_adjuntos_orden(orden_id: int, service: AttachmentService = Depends(get_service)):
    return await service.list_orden(orden_id)


@router.post(
    "/ordenes/{orden_id}", response_model=AdjuntoResponse, status_code=201,
    dependencies=[Depends(require_admin)],
)
@limiter.limit("30/minute")
async def upload_adjunto_orden(
    orden_id: int,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    categoria: str = Form("factura"),
    descripcion: Optional[str] = Form(None),
    service: AttachmentService = Depends(get_service),
):
    """Adjunta un archivo (típicamente la factura) a una orden de compra."""
    return await service.upload_orden(
        orden_id, file, categoria=categoria, descripcion=descripcion,
        usuario_id=current_user.USU_Usuario, ip=get_client_ip(request),
    )


@router.get("/{id}/download")
async def download_adjunto(id: uuid.UUID, service: AttachmentService = Depends(get_service)):
    import os
    from app.core.file_types import mime_de, sanear_nombre
    adjunto, content = await service.get_for_download(id)
    nombre = sanear_nombre(adjunto.ADJ_Nombre_Original)
    # MIME derivado de la extensión (los adjuntos antiguos podían traer el MIME
    # que envió el navegador) y descarga forzada en un contexto aislado.
    ascii_nombre = nombre.encode("ascii", "ignore").decode() or "archivo"
    ascii_nombre = ascii_nombre.replace('"', "").replace("\\", "")
    return Response(
        content=content,
        media_type=mime_de(os.path.splitext(nombre)[1]),
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_nombre}"; '
                f"filename*=UTF-8''{quote(nombre, safe='')}"
            ),
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'",
        },
    )


@router.delete("/{id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_adjunto(
    id: uuid.UUID, request: Request, current_user: CurrentUser,
    service: AttachmentService = Depends(get_service),
):
    await service.delete(id, usuario_id=current_user.USU_Usuario, ip=get_client_ip(request))
