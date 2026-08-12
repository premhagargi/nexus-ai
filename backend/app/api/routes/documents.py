"""Port of app/api/documents/{upload,[documentId],[documentId]/content,
[documentId]/reprocess}/route.ts.

Simplification vs. the original: the Next.js frontend tried a presigned
direct-to-storage upload first (to dodge Vercel's ~4.5MB serverless request
body limit) and fell back to this multipart route. That limit is a Vercel/
Next.js API route constraint that doesn't apply to this standalone FastAPI
service, so the presigned/confirm-upload pair isn't ported — this single
multipart upload path is now the only one, and the frontend was updated to
match (see lib/api/documents.ts).
"""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.time import now_naive_utc
from app.db.pool import get_pool
from app.db.queries import get_membership
from app.services import document_service, storage_service

logger = get_logger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])

MAX_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "md", "csv"}


async def _require_membership(pool, workspace_id: str, user_id: str):
    membership = await get_membership(pool, workspace_id, user_id)
    if membership is None:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this workspace")
    return membership


@router.get("")
async def list_documents(workspaceId: str, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    await _require_membership(pool, workspaceId, user.id)
    rows = await pool.fetch(
        'SELECT id, filename, "storageUrl", status, "errorMessage", "chunkCount", "createdAt" '
        'FROM "Document" WHERE "workspaceId" = $1 ORDER BY "createdAt" DESC',
        workspaceId,
    )
    return [dict(r) | {"createdAt": r["createdAt"].isoformat()} for r in rows]


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    workspaceId: str = Form(...),
    user: CurrentUser = Depends(get_current_user),
):
    pool = get_pool()
    await _require_membership(pool, workspaceId, user.id)

    file_ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file format: .{file_ext}. Allowed formats are PDF, DOCX, TXT, MD, CSV.")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds maximum allowed limit of 20MB")

    storage_path = document_service.build_storage_path(workspaceId, file.filename)
    logger.info("document.upload.start", filename=file.filename, size=len(data), storage_path=storage_path)

    try:
        storage_service.upload_file(storage_path, data, file.content_type)
    except Exception as error:
        logger.error("document.upload.storage_failed", error=str(error))
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {error}")

    public_url = storage_service.get_public_url(storage_path)

    existing = await pool.fetch(
        'SELECT id FROM "Document" WHERE "workspaceId" = $1 AND filename = $2', workspaceId, file.filename
    )
    if existing:
        existing_ids = [r["id"] for r in existing]
        await pool.execute('DELETE FROM "DocumentChunk" WHERE "documentId" = ANY($1::text[])', existing_ids)
        await pool.execute('DELETE FROM "Document" WHERE id = ANY($1::text[])', existing_ids)

    document_id = str(uuid.uuid4())
    await pool.execute(
        'INSERT INTO "Document" (id, "workspaceId", filename, "storageUrl", "uploadedBy", status, "createdAt") '
        "VALUES ($1, $2, $3, $4, $5, $6, $7)",
        document_id, workspaceId, file.filename, public_url, user.id, "PROCESSING", now_naive_utc(),
    )

    settings = get_settings()
    background_tasks.add_task(
        document_service.process_document,
        pool, document_id, storage_path, workspaceId, file.filename, settings.google_generative_ai_api_key,
    )

    return {"success": True, "documentId": document_id, "status": "PROCESSING"}


@router.delete("/{document_id}")
async def delete_document(document_id: str, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    doc = await pool.fetchrow('SELECT id, "workspaceId", "storageUrl" FROM "Document" WHERE id = $1', document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    await _require_membership(pool, doc["workspaceId"], user.id)

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute('DELETE FROM "DocumentChunk" WHERE "documentId" = $1', document_id)
            await conn.execute('DELETE FROM "Document" WHERE id = $1', document_id)

    try:
        storage_path = storage_service.storage_path_from_url(doc["storageUrl"])
        if storage_path:
            storage_service.delete_file(storage_path)
    except Exception as error:
        logger.warning("document.delete.storage_cleanup_failed", document_id=document_id, error=str(error))

    return {"success": True, "deletedId": document_id}


@router.get("/{document_id}/content")
async def get_document_content(document_id: str, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    doc = await pool.fetchrow(
        'SELECT id, "workspaceId", filename, status, "storageUrl" FROM "Document" WHERE id = $1', document_id
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    await _require_membership(pool, doc["workspaceId"], user.id)

    chunks = await pool.fetch(
        'SELECT id, content, metadata, "createdAt" FROM "DocumentChunk" WHERE "documentId" = $1 ORDER BY "createdAt" ASC',
        document_id,
    )
    full_content = "\n\n---\n\n".join(c["content"] for c in chunks)

    return {
        "documentId": doc["id"],
        "filename": doc["filename"],
        "status": doc["status"],
        "storageUrl": doc["storageUrl"],
        "chunkCount": len(chunks),
        "fullContent": full_content,
        "chunks": [
            {"id": c["id"], "content": c["content"], "metadata": c["metadata"], "createdAt": c["createdAt"].isoformat()}
            for c in chunks
        ],
    }


@router.post("/{document_id}/reprocess")
async def reprocess_document(document_id: str, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    doc = await pool.fetchrow(
        'SELECT id, "workspaceId", filename, "storageUrl" FROM "Document" WHERE id = $1', document_id
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    await _require_membership(pool, doc["workspaceId"], user.id)

    await pool.execute(
        'UPDATE "Document" SET status = $2, "errorMessage" = NULL WHERE id = $1', document_id, "PROCESSING"
    )

    storage_path = storage_service.storage_path_from_url(doc["storageUrl"]) or f"{doc['workspaceId']}/{doc['filename']}"

    settings = get_settings()
    await document_service.process_document(
        pool, document_id, storage_path, doc["workspaceId"], doc["filename"], settings.google_generative_ai_api_key
    )

    final_doc = await pool.fetchrow('SELECT status FROM "Document" WHERE id = $1', document_id)
    return {"success": True, "documentId": document_id, "status": final_doc["status"] if final_doc else "COMPLETED"}
