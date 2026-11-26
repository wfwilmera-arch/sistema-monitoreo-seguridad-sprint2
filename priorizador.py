import sys
import json

def calcular_prioridad(datos):
    tipo = datos.get("tipo_evento", "").lower()
    zona = datos.get("zona", "").lower()
    fuera_horario = datos.get("fuera_horario", False)

    # Reglas inteligentes de priorización
    if "intrusión" in tipo or "no autorizado" in tipo or "servidores" in zona:
        return "Critica"
    elif fuera_horario or "sabotaje" in tipo or "forzado" in tipo:
        return "Alta"
    elif "pérdida de señal" in tipo or "fallo" in tipo:
        return "Media"
    else:
        return "Baja"

if __name__ == "__main__":
    try:
        # Recibe el JSON desde Node.js como argumento
        entrada = sys.argv[1]
        datos_evento = json.loads(entrada)
        prioridad = calcular_prioridad(datos_evento)
        print(json.dumps({"prioridad": prioridad}))
    except Exception as e:
        print(json.dumps({"prioridad": "Media", "error": str(e)}))