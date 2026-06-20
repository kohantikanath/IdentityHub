from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers.user import router as user_router

settings = get_settings()

app = FastAPI(
    title="IdentityHub API",
    description="User Management System — encrypted PII, soft deletes, paginated responses",
    version="1.0.0",
)

# CORS — restrict to the configured frontend origin only, never open wildcard in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Pydantic validation error handler
# Without this, FastAPI leaks internal field paths and raw error objects to the client
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": [
                {
                    "field": " -> ".join(str(loc) for loc in e["loc"]),
                    "message": e["msg"],
                }
                for e in exc.errors()
            ]
        },
    )


# Versioned API prefix keeps future v2 changes non-breaking for existing clients
app.include_router(user_router, prefix="/api/v1/users", tags=["Users"])


@app.get("/health", tags=["Health"])
def health_check() -> dict:
    return {"status": "ok", "version": "1.0.0"}
