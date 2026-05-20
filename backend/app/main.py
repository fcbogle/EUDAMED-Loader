from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import normalization, profiling, schemas

app = FastAPI(
    title="EUDAMED Profiling API",
    version="0.1.0",
    description="Read-only profiling and normalization review APIs for EUDAMED source data.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiling.router, prefix="/api")
app.include_router(normalization.router, prefix="/api")
app.include_router(schemas.router, prefix="/api")


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
