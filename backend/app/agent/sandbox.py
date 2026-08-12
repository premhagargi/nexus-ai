"""Sandboxed code execution for the run_code_sandbox tool.

The original Next.js tool ran arbitrary JavaScript via `new Function()`.
The backend is now Python, so this executes Python expressions instead —
same tool contract (math/data-transform/stat calculations), same
sandboxing intent, adapted to the new runtime. Restricted to a safe
builtins allowlist: no imports, no file/network/process access.
"""
import io
import math
import statistics
from contextlib import redirect_stdout

_SAFE_BUILTINS = {
    "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict,
    "enumerate": enumerate, "filter": filter, "float": float, "int": int,
    "len": len, "list": list, "map": map, "max": max, "min": min,
    "pow": pow, "range": range, "reversed": reversed, "round": round,
    "set": set, "sorted": sorted, "str": str, "sum": sum, "tuple": tuple,
    "zip": zip, "print": print,
}
_SAFE_GLOBALS = {"__builtins__": _SAFE_BUILTINS, "math": math, "statistics": statistics}


def run_sandboxed(code: str) -> tuple[object, bool]:
    """Executes `code` in a restricted namespace. Returns (result, is_error).

    If the code contains a `return`-style final expression it's evaluated
    directly; otherwise it's executed as a statement block and the sandbox
    looks for a `result` variable, falling back to captured stdout.
    """
    local_vars: dict = {}
    stdout = io.StringIO()
    try:
        with redirect_stdout(stdout):
            try:
                value = eval(compile(code, "<sandbox>", "eval"), _SAFE_GLOBALS, local_vars)
                return value, False
            except SyntaxError:
                exec(compile(code, "<sandbox>", "exec"), _SAFE_GLOBALS, local_vars)
                if "result" in local_vars:
                    return local_vars["result"], False
                captured = stdout.getvalue().strip()
                return (captured if captured else None), False
    except Exception as error:  # noqa: BLE001 - sandbox deliberately reports any failure back to the caller
        return f"Execution error: {error}", True
