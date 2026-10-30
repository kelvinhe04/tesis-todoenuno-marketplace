#!/usr/bin/env python
"""Hook Stop: recuerda actualizar el historial de sesiones.

Si desde la ultima modificacion de docs/historial-sesiones.md hubo trabajo
sustancial en la sesion (>= UMBRAL usos de herramientas), bloquea el cierre una
sola vez y le pide a Claude que anote la entrada. Una vez actualizado el
historial, deja de insistir. Si algo falla, nunca estorba (sale en silencio).
"""
import json
import os
import re
import sys
from datetime import datetime

UMBRAL = 8
HISTORIAL = os.path.join("proyecto-marketplace", "docs", "historial-sesiones.md")
TS = re.compile(r'"timestamp"\s*:\s*"([^"]+)"')


def main():
    try:
        datos = json.load(sys.stdin)
    except Exception:
        return
    if datos.get("stop_hook_active"):
        return  # evita bucles: ya se pidio una vez en este cierre

    raiz = os.environ.get("CLAUDE_PROJECT_DIR") or datos.get("cwd") or os.getcwd()
    historial = os.path.join(raiz, HISTORIAL)
    transcripcion = datos.get("transcript_path")
    if not os.path.isfile(historial) or not transcripcion or not os.path.isfile(transcripcion):
        return

    ultima_nota = os.path.getmtime(historial)
    usos = 0
    with open(transcripcion, encoding="utf-8", errors="ignore") as f:
        for linea in f:
            if '"type":"tool_use"' not in linea.replace('"type": "tool_use"', '"type":"tool_use"'):
                continue
            m = TS.search(linea)
            if not m:
                continue
            try:
                t = datetime.fromisoformat(m.group(1).replace("Z", "+00:00")).timestamp()
            except ValueError:
                continue
            if t > ultima_nota:
                usos += linea.count('"type":"tool_use"')

    if usos >= UMBRAL:
        print(json.dumps({
            "decision": "block",
            "reason": (
                "Hubo trabajo en esta sesion desde la ultima actualizacion de "
                "proyecto-marketplace/docs/historial-sesiones.md. Antes de terminar, agrega "
                "una entrada breve (fecha, que se hizo, decisiones, cambios que viven solo en "
                "Mongo, pendientes) y, si cambio algo de fondo, actualiza 'Estado y pendientes' "
                "en CLAUDE.md."
            ),
        }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
