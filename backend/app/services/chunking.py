"""Port of createDocumentChunks() from lib/rag.ts."""
from datetime import datetime, timezone
from typing import Any

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.services.embeddings import normalize_text
from app.services.rag_service import CHUNK_OVERLAP, CHUNK_SIZE, build_source_title

_SEPARATORS = ["\n\n", "\n", ".", "!", "?", ";", ",", " ", ""]


def create_document_chunks(
    text: str, filename: str, document_id: str, source_type: str
) -> list[dict[str, Any]]:
    sanitized = normalize_text(text)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=_SEPARATORS,
    )

    pieces = splitter.split_text(sanitized)
    now = datetime.now(timezone.utc).isoformat()
    chunk_count = len(pieces)

    return [
        {
            "content": normalize_text(piece),
            "metadata": {
                "source": filename,
                "sourceTitle": build_source_title(filename),
                "sourceType": source_type,
                "documentId": document_id,
                "chunkIndex": index,
                "chunkCount": chunk_count,
                "chunkLength": len(piece),
                "chunkTokensEstimate": max(1, -(-len(piece) // 4)),
                "createdAt": now,
            },
        }
        for index, piece in enumerate(pieces)
    ]
