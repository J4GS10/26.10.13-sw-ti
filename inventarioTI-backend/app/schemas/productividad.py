"""Esquemas de las operaciones en lote y de las herramientas de productividad."""
from __future__ import annotations

import uuid
from typing import List, Optional

from pydantic import Field, field_validator

from app.schemas.common import Esquema


def _sin_repetidos(valores: list[uuid.UUID]) -> list[uuid.UUID]:
    if len(set(valores)) != len(valores):
        raise ValueError("DUPLICATED_ASSETS")
    return valores


class EntregaLoteCreate(Esquema):
    """Entrega de puesto: varios equipos a una persona en una sola operación."""
    PER_Persona: uuid.UUID
    ARE_Area: int
    activos: List[uuid.UUID] = Field(..., min_length=1, max_length=50)
    MOV_Motivo: Optional[str] = Field(None, max_length=255)
    MOV_Observacion: Optional[str] = Field(None, max_length=900)
    ticket: Optional[str] = Field(None, max_length=50)

    _unicos = field_validator("activos")(_sin_repetidos)


class DevolucionLoteCreate(Esquema):
    """Devolución de varios equipos a bodega en una sola operación."""
    activos: List[uuid.UUID] = Field(..., min_length=1, max_length=100)
    MOV_Motivo: Optional[str] = Field(None, max_length=255)
    ARE_Area_Destino: Optional[int] = None
    condicion: Optional[str] = Field(None, pattern="^(BUENO|CON_DANO)$")

    _unicos = field_validator("activos")(_sin_repetidos)
