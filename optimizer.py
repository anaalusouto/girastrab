from __future__ import annotations

import sympy as sp


Q, M = sp.symbols("Q M", positive=True)


def _build_profit(p):
    return (
        (p["P0"] - p["g"] * Q + p["d"] * M) * Q
        - (p["e1"] * Q**3 + p["e2"] * Q**2 + p["e3"] * Q)
        - p["k"] * M**2
    )


def _classify(fqq: float, det: float) -> str:
    if det > 0 and fqq < 0:
        return "maximo_local"
    if det > 0 and fqq > 0:
        return "minimo_local"
    if det < 0:
        return "ponto_de_sela"
    return "inconclusivo"


def solve(params: dict, with_sensitivity: bool = True) -> dict:
    p = {key: float(params[key]) for key in ("P0", "g", "d", "e1", "e2", "e3", "k")}

    profit = _build_profit(p)

    dpi_dQ = sp.diff(profit, Q)
    dpi_dM = sp.diff(profit, M)

    solutions = sp.solve([dpi_dQ, dpi_dM], [Q, M], dict=True)

    hessian = sp.hessian(profit, (Q, M))

    interior = None
    for sol in solutions:
        try:
            q_val = float(sol[Q])
            m_val = float(sol[M])
        except (TypeError, KeyError):
            continue
        if q_val > 0 and m_val > 0:
            interior = (sol, q_val, m_val)
            break

    if interior is None:
        raise ValueError(
            "Nao existe ponto critico interior com Q>0 e M>0 para estes parametros."
        )

    sol, q_star, m_star = interior

    h_eval = hessian.subs(sol)
    fqq = float(h_eval[0, 0])
    fmm = float(h_eval[1, 1])
    fqm = float(h_eval[0, 1])
    det = fqq * fmm - fqm**2
    classification = _classify(fqq, det)

    price = p["P0"] - p["g"] * q_star + p["d"] * m_star
    revenue = price * q_star
    production_cost = p["e1"] * q_star**3 + p["e2"] * q_star**2 + p["e3"] * q_star
    marketing_cost = p["k"] * m_star**2
    profit_star = float(profit.subs(sol))

    q_inflection = -p["e2"] / (3 * p["e1"]) if p["e1"] != 0 else None

    sensitivity = _sensitivity(p, q_star, m_star, profit_star) if with_sensitivity else []

    return {
        "params": p,
        "symbolic": {
            "profit": sp.latex(sp.expand(profit)),
            "grad_Q": sp.latex(sp.expand(dpi_dQ)),
            "grad_M": sp.latex(sp.expand(dpi_dM)),
            "hessian": sp.latex(hessian),
            "foc_M": sp.latex(sp.Eq(M, sp.simplify(p["d"] * Q / (2 * p["k"])))),
        },
        "optimum": {
            "Q": q_star,
            "M": m_star,
            "price": price,
            "profit": profit_star,
            "revenue": revenue,
            "production_cost": production_cost,
            "marketing_cost": marketing_cost,
        },
        "hessian_eval": {"fQQ": fqq, "fMM": fmm, "fQM": fqm, "det": det},
        "classification": classification,
        "domain": {"q_inflection": q_inflection},
        "sensitivity": sensitivity,
        "explanation": _explain(
            p, q_star, m_star, price, profit_star, fqq, fmm, fqm, det, classification
        ),
    }


def _sensitivity(p: dict, q_star: float, m_star: float, profit_star: float) -> list:
    results = []
    labels = {
        "P0": "Preco-base de mercado",
        "g": "Sensibilidade do preco a quantidade",
        "d": "Forca do marketing sobre o preco",
        "e1": "Coeficiente cubico de custo",
        "e2": "Coeficiente quadratico de custo",
        "e3": "Custo marginal base",
        "k": "Custo de escalar marketing",
    }
    for key, label in labels.items():
        bumped = dict(p)
        delta = abs(p[key]) * 0.01 if p[key] != 0 else 0.01
        bumped[key] = p[key] + delta
        try:
            res = solve(bumped, with_sensitivity=False)
            new_profit = res["optimum"]["profit"]
            pct = ((new_profit - profit_star) / profit_star) * 100 if profit_star else 0.0
            results.append({"param": key, "label": label, "profit_pct_change": pct})
        except ValueError:
            results.append({"param": key, "label": label, "profit_pct_change": None})
    return results


def _explain(p, q_star, m_star, price, profit_star, fqq, fmm, fqm, det, classification):
    cls_txt = {
        "maximo_local": "um MAXIMO local (o lucro nao pode ser melhorado na vizinhanca)",
        "minimo_local": "um MINIMO local",
        "ponto_de_sela": "um ponto de sela",
        "inconclusivo": "inconclusivo pelo teste da Hessiana",
    }[classification]

    steps = [
        "Montamos a funcao de lucro como receita menos custo de producao (cubico) "
        "menos custo de marketing (convexo), em funcao de duas variaveis de decisao: "
        "Q (producao) e M (esforco de marketing).",
        "Calculamos as derivadas parciais e resolvemos o sistema do gradiente igual a zero "
        "para localizar o ponto critico.",
        f"O ponto critico encontrado foi Q* = {q_star:.2f} unidades e M* = {m_star:.2f} de intensidade de marketing.",
        "Montamos a matriz Hessiana e aplicamos o teste da segunda derivada: "
        f"f_QQ = {fqq:.4f} e det(H) = {det:.4f}.",
        f"Como det(H) > 0 e f_QQ < 0, o ponto e {cls_txt}.",
        f"No otimo, o preco recomendado e R$ {price:.2f} por unidade "
        f"e o lucro mensal projetado e R$ {profit_star:,.2f}.",
    ]
    return steps
