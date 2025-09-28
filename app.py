import json
import requests
from flask import Flask, request, jsonify
from groq import Groq

app = Flask(__name__)

# ======================
#   GUARDRAILS
# ======================
def guardrails(state):
    question = state["question"].lower().strip()

    if not question:
        return {**state, "blocked": True, "answer": "No hay ninguna pregunta de entrada."}

    palabras_prohibidas = [
        "odio","odiar","violencia","insulto","insultar","matar","robar","pegar","agredir","golpear",
        "lastimar","amenazar","dañar","abusar","secuestrar","secuestro","torturar","herir","discriminar",
        "humillar","intimidar","vengar","sabotear","maltratar","violar","corromper","estafar","traicionar",
        "despreciar","destruir","oprimir","castigar","maldecir","provocar","burlar","manipular","saquear",
        "extorsionar","asesinar"
    ]
    if any(p in question for p in palabras_prohibidas):
        return {**state, "blocked": True, "answer": "Contenido inapropiado detectado."}

    if len(question.split()) < 2:
        return {**state, "blocked": True, "answer": "Pregunta demasiado corta para recomendar algo."}

    return {**state, "blocked": False}

# ======================
#   CLASIFICADOR
# ======================


def clasificador_llm(pregunta: str, groq_api_key: str) -> list[str]:
    prompt = """
    Clasifica la pregunta del usuario en una o varias de estas categorías:
    - clima
    - costos
    - itinerario
    - lugares

    Si no aplica a ninguna, responde con "ninguna".
    Devuelve la respuesta estrictamente en formato JSON como lista de strings.
    Ejemplo: ["clima", "costos"]
    """

    groq_client = Groq(api_key=groq_api_key)
    response = groq_client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": pregunta}
        ],
        temperature=0
    )

    raw = response.choices[0].message.content.strip()

    try:
        categorias = json.loads(raw)
        if isinstance(categorias, list):
            return categorias
        else:
            return ["ninguna"]
    except Exception:
        return ["ninguna"]

# ======================
#   CONSULTAS A APIS
# ======================
def consultar_serpapi(query: str, tipo: str, serp_api_key: str) -> str:
    url = "https://serpapi.com/search"
    params = {
        "q": query,
        "hl": "es",
        "gl": "co",
        "api_key": serp_api_key,
    }
    try:
        res = requests.get(url, params=params, timeout=10)
        data = res.json()
        if "error" in data:
            return "No encontré resultados confiables."
        if tipo == "clima":
            return data.get("answer_box", {}).get("weather", "No encontré información del clima.")
        elif tipo == "costos":
            items = data.get("shopping_results", [])
            if not items:
                return "No encontré precios relacionados."
            return f"Precio aproximado: {items[0].get('price', 'No disponible')}"
        elif tipo == "lugares":
            maps = data.get("local_results", {}).get("places", [])
            if not maps:
                return "No encontré lugares relacionados."
            return f"Lugar sugerido: {maps[0].get('title', 'No disponible')}"
        return "No encontré información."
    except Exception as e:
        return f"Error al consultar SerpAPI: {e}"

def generar_itinerario_groq(prompt: str, groq_api_key: str) -> str:
    try:
        groq_client = Groq(api_key=groq_api_key)
        response = groq_client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": "Eres un asistente de viajes que organiza itinerarios claros y útiles."},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error al generar itinerario: {e}"

# ======================
#   GRAPH
# ======================
def run_graph(question: str, groq_api_key: str, serp_api_key: str):
    st = {"question": question}
    st = guardrails(st)

    if st["blocked"]:
        return st

    categorias = clasificador_llm(st["question"], groq_api_key)
    respuestas = []

    for cat in categorias:
        if cat == "clima":
            respuestas.append(consultar_serpapi(st["question"], "clima", serp_api_key))
        elif cat == "costos":
            respuestas.append(consultar_serpapi(st["question"], "costos", serp_api_key))
        elif cat == "itinerario":
            respuestas.append(generar_itinerario_groq(st["question"], groq_api_key))
        elif cat == "lugares":
            respuestas.append(consultar_serpapi(st["question"], "lugares", serp_api_key))

    if not respuestas:
        return {**st, "answer": "Lo siento, no encontré información para esa consulta."}

    return {**st, "answer": "\n\n".join(respuestas)}

# ======================
#   API ENDPOINT
# ======================
@app.route("/api/ask", methods=["POST"])
def ask():
    data = request.get_json()
    pregunta = data.get("question", "")
    groq_api_key = data.get("groq_api_key", "")
    serp_api_key = data.get("serp_api_key", "")

    if not groq_api_key or not serp_api_key:
        return jsonify({"error": "Faltan claves API"}), 400

    result = run_graph(pregunta, groq_api_key, serp_api_key)
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)
