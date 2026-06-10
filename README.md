# Otimizador de Produção e Marketing (Flask)

Aplicação web que calcula, para um pequeno fabricante, a **quantidade de produção (Q)** e o **esforço de marketing (M)** que **maximizam o lucro mensal**. O usuário insere os parâmetros do negócio em linguagem simples, o servidor resolve o problema de otimização (gradiente, ponto crítico e teste da Hessiana) e a página exibe a recomendação com a justificativa matemática.

Tudo roda em **um único servidor Flask**: a mesma aplicação serve a página e a API. Não há Node, não há build de frontend, não há CORS.

Projeto da disciplina **Resolução de Problemas Multivariáveis** (Ciência da Computação · CESUPA · Prof. Pedro Girotto). Baseado em um recorte do artigo de Sadjadi et al. (2015) sobre decisão conjunta de preço e produção com função de custo cúbica.

---

## O modelo matemático

Lucro como função de duas variáveis de decisão:

```
π(Q, M) = (P0 − g·Q + d·M)·Q − (e1·Q³ + e2·Q² + e3·Q) − k·M²
```

- **Q** = unidades produzidas/vendidas no mês
- **M** = intensidade do esforço de marketing (orçamento gasto = `k·M²`)
- **preço** `p = P0 − g·Q + d·M` (cai com volume, sobe com marketing)
- **custo de produção** cúbico (assinatura do artigo, com `e1, e3 > 0` e `e2 < 0`)
- **custo de marketing** convexo `k·M²` (retorno decrescente)

O servidor calcula o gradiente ∇π, resolve ∇π = 0, classifica o ponto crítico pela Hessiana e devolve Q\*, M\*, preço\*, lucro\* e a análise de sensibilidade. A modelagem completa está no relatório em PDF.

## Estrutura

```
.
├── app.py             # servidor Flask: serve a página (/) e a API (/api/optimize)
├── optimizer.py       # motor SymPy: gradiente, Hessiana, sensibilidade
├── requirements.txt
├── templates/
│   └── index.html     # a página
└── static/
    ├── style.css      # estilos
    └── app.js         # lógica da interface (JavaScript puro)
```

## Requisitos

- **Python 3.10+** (testado em 3.12). Só isso. Não precisa de Node.

## Como rodar (terminal)

```bash
# (opcional, recomendado) ambiente virtual
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt
python app.py
```

Abra `http://localhost:5000`. A página já vem com os valores de exemplo preenchidos: basta clicar em **Calcular ponto ótimo**.

## Como rodar no PyCharm (1 clique)

1. `File > Open` e selecione esta pasta.
2. `Settings > Project > Python Interpreter > Add Interpreter > Virtualenv` para criar o `.venv`. O PyCharm detecta o `requirements.txt` e oferece instalar as dependências; aceite (ou rode `pip install -r requirements.txt` no terminal).
3. Abra o arquivo `app.py` e clique no **triângulo verde** ao lado de `if __name__ == "__main__":`. Pronto, o servidor sobe.
4. Abra `http://localhost:5000` no navegador.

Não há segundo servidor para subir: a página e a API vivem no mesmo processo.

## Exemplo de uso

Parâmetros de exemplo (a persona Helena, ver relatório):

| Campo | Símbolo | Valor |
|---|---|---|
| Preço-base de mercado | P0 | 80 |
| Queda de preço por unidade | g | 0,05 |
| Ganho de preço por marketing | d | 0,40 |
| Coef. cúbico de custo | e1 | 0,0003 |
| Coef. quadrático de custo | e2 | −0,12 |
| Custo marginal base | e3 | 18 |
| Custo de escalar marketing | k | 1,2 |

Resultado:

- **Q\* ≈ 401 unidades/mês**, **M\* ≈ 66,9** (orçamento de marketing ≈ R$ 5.368)
- **Preço recomendado ≈ R$ 86,69**
- **Lucro máximo ≈ R$ 22.133,77/mês**
- Classificação do ponto: **máximo local** (f_QQ < 0 e det(H) > 0)

Chamada direta à API:

```bash
curl -X POST http://localhost:5000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{"P0":80,"g":0.05,"d":0.40,"e1":0.0003,"e2":-0.12,"e3":18,"k":1.2}'
```

## Como a solução foi obtida

1. Montamos o lucro `π(Q, M)` = receita − custo de produção (cúbico) − custo de marketing (convexo).
2. Calculamos `∂π/∂Q` e `∂π/∂M` e resolvemos `∇π = 0` para achar o ponto crítico interior (Q, M > 0).
3. Montamos a Hessiana e aplicamos o teste da segunda derivada: como `det(H) > 0` e `f_QQ < 0`, o ponto é um **máximo**.
4. Convertendo Q\* e M\* em preço, receita, custos e lucro, mais a sensibilidade a cada parâmetro.

## Declaração de uso de IA

Declaramos o uso de ferramentas de IA generativa como apoio para: estruturar e revisar a derivação matemática, gerar e revisar o código, e auxiliar na redação do relatório e dos slides. A modelagem, as decisões de projeto, a verificação numérica dos resultados e a validação final foram conduzidas e revisadas pela equipe. Todos os números foram confirmados pela execução do código.

## Equipe

<!-- Preencher com os integrantes (máx. 3), conforme regra da disciplina. -->

| Nome | Matrícula |
|---|---|
| Ana Luiza Souto | 
| Caiky Morais | 

## Licença

Distribuído sob a licença MIT. Veja `LICENSE`.
