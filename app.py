
from __future__ import annotations

from flask import Flask, jsonify, render_template, request

from optimizer import solve

app = Flask(__name__)

# Parametros esperados do problema (com a faixa de validacao basica).
PARAM_KEYS = ("P0", "g", "d", "e1", "e2", "e3", "k")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/optimize", methods=["POST"])
def optimize():
    payload = request.get_json(silent=True) or {}

    params = {}
    for key in PARAM_KEYS:
        if key not in payload:
            return jsonify({"detail": f"Parametro ausente: {key}"}), 422
        try:
            params[key] = float(payload[key])
        except (TypeError, ValueError):
            return jsonify({"detail": f"Parametro invalido: {key}"}), 422

    if params["e1"] <= 0 or params["e3"] <= 0 or params["k"] <= 0:
        return jsonify({"detail": "e1, e3 e k devem ser positivos."}), 422

    try:
        result = solve(params)
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 422

    return jsonify(result)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
