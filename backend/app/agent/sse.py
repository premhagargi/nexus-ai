"""ai-sdk v7 "UI message stream" SSE protocol encoders.

Wire format: `data: {JSON}\\n\\n`, terminated by `data: [DONE]\\n\\n`.
Header `x-vercel-ai-ui-message-stream: v1` tells the frontend's useChat()
hook to parse frames as text-start/text-delta/text-end parts. This must
match exactly for the existing chat UI to keep working unmodified.
"""
import itertools
import json

UI_STREAM_HEADERS = {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "x-vercel-ai-ui-message-stream": "v1",
    "x-accel-buffering": "no",
}

_part_id_counter = itertools.count(1)


def new_part_id() -> str:
    import time

    return f"part-{int(time.time() * 1000)}-{next(_part_id_counter)}"


def sse_chunk(obj: dict) -> bytes:
    return f"data: {json.dumps(obj)}\n\n".encode("utf-8")


def sse_done() -> bytes:
    return b"data: [DONE]\n\n"
