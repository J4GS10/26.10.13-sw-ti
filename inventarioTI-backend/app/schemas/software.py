from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.schemas.common import Esquema
from decimal import Decimal
from app.core.currency import CurrencyCode
from datetime import date, datetime
import uuid

# --- TIPO LICENCIA ---
class TipoLicenciaBase(Esquema):
    TLI_Nombre: str = Field(..., min_length=2, max_length=50)
    TLI_Descripcion: Optional[str] = Field(None, max_length=200)

class TipoLicenciaCreate(TipoLicenciaBase):
    pass

class TipoLicenciaUpdate(Esquema):
    TLI_Nombre: Optional[str] = Field(None, min_length=2, max_length=50)
    TLI_Descripcion: Optional[str] = Field(None, max_length=200)

class TipoLicenciaResponse(TipoLicenciaBase):
    TLI_Tipo_Licencia: int
    model_config = ConfigDict(from_attributes=True)

# --- SOFTWARE ---
class SoftwareBase(Esquema):
    SOF_Nombre: str = Field(..., min_length=2, max_length=100)
    SOF_Version: Optional[str] = Field(None, max_length=50)
    SOF_Fabricante: str = Field(..., min_length=2, max_length=100)

class SoftwareCreate(SoftwareBase):
    pass

class SoftwareUpdate(Esquema):
    SOF_Nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    SOF_Version: Optional[str] = Field(None, max_length=50)
    SOF_Fabricante: Optional[str] = Field(None, min_length=2, max_length=100)

class SoftwareResponse(SoftwareBase):
    SOF_Software: int
    model_config = ConfigDict(from_attributes=True)

# --- LICENCIA (Inventario) ---
class LicenciaClaveCreate(Esquema):
    LCL_Clave_Activacion: str = Field(..., min_length=1, max_length=255)
    LCL_Referencia: Optional[str] = Field(None, max_length=120)


class LicenciaClaveResponse(Esquema):
    LCL_Licencia_Clave: int
    LIC_Licencia: int
    LCL_Clave_Activacion: str
    LCL_Referencia: Optional[str] = None
    LCL_Estado: str
    LCL_Creado_En: Optional[datetime] = None
    LCL_Asignada_En: Optional[date] = None
    LCL_Destino_Tipo: Optional[str] = None
    LCL_Destino_Id: Optional[str] = None
    LCL_Destino_Nombre: Optional[str] = None
    LCL_Destino_Detalle: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class LicenciaBase(Esquema):
    LIC_Clave_Activacion: Optional[str] = Field(None, description="Serial Key")
    LIC_Fecha_Vencimiento: Optional[date] = None
    LIC_Cantidad_Total: int = Field(..., gt=0, description="Total de asientos comprados")
    # Costo de la licencia (o de su renovación) en la moneda en que se paga.
    LIC_Costo: Optional[Decimal] = Field(None, ge=0, max_digits=14, decimal_places=2)
    LIC_Moneda: Optional[CurrencyCode] = None
    
    # FKs
    SOF_Software: int
    TLI_Tipo_Licencia: int

class LicenciaCreate(LicenciaBase):
    # Cota SOLO en la entrada: el texto plano cifrado debe caber en la columna
    # (500, ciphertext). La base/respuesta quedan laxas para no romper la
    # lectura de claves legadas descifradas más largas.
    LIC_Clave_Activacion: Optional[str] = Field(None, max_length=255, description="Serial Key")
    LIC_Claves: List[LicenciaClaveCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def _cantidad_coherente_con_claves(self):
        if self.LIC_Claves and self.LIC_Cantidad_Total != len(self.LIC_Claves):
            raise ValueError("LICENSE_KEY_COUNT_MISMATCH")
        return self

class LicenciaUpdate(Esquema):
    LIC_Clave_Activacion: Optional[str] = Field(None, max_length=255)
    LIC_Fecha_Vencimiento: Optional[date] = None
    LIC_Cantidad_Total: Optional[int] = Field(None, gt=0)
    LIC_Costo: Optional[Decimal] = Field(None, ge=0, max_digits=14, decimal_places=2)
    LIC_Moneda: Optional[CurrencyCode] = None

class LicenciaResponse(LicenciaBase):
    LIC_Licencia: int
    LIC_Cantidad_Usada: int # Campo calculado/gestionado por el sistema
    LIC_Claves_Total: int = 0
    LIC_Claves_Disponibles: int = 0
    LIC_Claves_Asignadas: int = 0
    model_config = ConfigDict(from_attributes=True)

# --- INSTALACIÓN (Asignación) ---
class InstalacionBase(Esquema):
    ACT_Activo: Optional[uuid.UUID] = None
    PER_Persona: Optional[uuid.UUID] = None
    LIC_Licencia: int
    LCL_Licencia_Clave: Optional[int] = None
    INS_Fecha_Instalacion: date = Field(default_factory=date.today)

    @model_validator(mode="after")
    def _destino_xor(self):
        if (self.ACT_Activo is None) == (self.PER_Persona is None):
            raise ValueError("INSTALLATION_TARGET_XOR_REQUIRED")
        return self

class InstalacionCreate(InstalacionBase):
    # Solo al desinstalar: por qué se retira (queda en el historial).
    motivo: Optional[str] = Field(None, max_length=255)

class InstalacionResponse(InstalacionBase):
    INS_Instalacion: int
    INS_Estado: bool
    INS_Fecha_Retiro: Optional[datetime] = None
    INS_Motivo_Retiro: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class _SoftwareSummary(Esquema):
    SOF_Software: int
    SOF_Nombre: str
    SOF_Version: Optional[str] = None
    SOF_Fabricante: str
    model_config = ConfigDict(from_attributes=True)


class _TipoLicenciaSummary(Esquema):
    TLI_Tipo_Licencia: int
    TLI_Nombre: str
    model_config = ConfigDict(from_attributes=True)


class _LicenciaWithSoftware(Esquema):
    LIC_Licencia: int
    LIC_Fecha_Vencimiento: Optional[date] = None
    LIC_Cantidad_Total: int
    LIC_Cantidad_Usada: int
    software: Optional[_SoftwareSummary] = None
    tipo_licencia: Optional[_TipoLicenciaSummary] = None
    model_config = ConfigDict(from_attributes=True)


class InstalacionDetalleResponse(InstalacionResponse):
    """Instalación con la licencia y software anidados (para mostrar en UI)."""
    licencia: Optional[_LicenciaWithSoftware] = None
    model_config = ConfigDict(from_attributes=True)
