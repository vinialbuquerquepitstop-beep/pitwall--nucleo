#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
publicar_calc.py - alimenta a calculadora de UM lugar so.

O problema que resolve: o mesmo preco vivia em tres lugares (dados.js da
interna, dados.js do parceiro, tabela calc_dados). Agora ha uma fonte unica:
a tabela public.calc_dados no Supabase. Este comando pega o DADOS mestre e
grava nela. A partir dai:
  - a calc interna (Netlify) le calc_dados apos login;
  - a /calc/ do Pit Wall le calc_dados apos login;
  - a vitrine do parceiro le a funcao calc_dados_parceiro(), DERIVADA de
    calc_dados (sem custo, sem fornecedor). Nao precisa republicar nada pro
    parceiro: ele acompanha sozinho.

USO:
    # valida sem gravar:
    python ferramentas/publicar_calc.py caminho/para/dados.js --check

    # grava na fonte unica:
    SUPABASE_SERVICE_KEY=<service_role> python ferramentas/publicar_calc.py caminho/para/dados.js

A chave de servico (service_role) vem do ambiente, NUNCA do codigo:
    export SUPABASE_SERVICE_KEY=...     # no Windows PowerShell: $env:SUPABASE_SERVICE_KEY=...
Pegue em Supabase > Project Settings > API > service_role (secreta).

O arquivo mestre pode ser:
  - dados.js  no formato  const DADOS = { ... };
  - ou um .json puro com o mesmo objeto { config, bateria, tela, produtos }.
"""
import sys, os, json, re, urllib.request, urllib.error

PROJECT_REF = "unjzpyexgtbcmjfgcqrx"
SUPABASE_URL = os.environ.get("SUPABASE_URL", f"https://{PROJECT_REF}.supabase.co")
TENANT_ID = "00000000-0000-0000-0000-000000000001"


def extrair_dados(texto):
    """Aceita 'const DADOS = {...};' ou JSON puro; devolve o dict."""
    t = texto.strip()
    if t.startswith("{"):
        return json.loads(t)
    m = re.search(r"DADOS\s*=\s*", t)
    if not m:
        raise ValueError("nao achei 'DADOS =' nem um objeto JSON no arquivo.")
    corpo = t[m.end():].strip()
    # remove ';' final se houver
    corpo = corpo.rstrip()
    if corpo.endswith(";"):
        corpo = corpo[:-1]
    return json.loads(corpo)


def validar(d):
    """Falhas duras antes de gravar. Devolve lista de erros (vazia = ok)."""
    erros = []
    if not isinstance(d, dict):
        return ["DADOS nao e um objeto."]
    cfg = d.get("config")
    if not isinstance(cfg, dict):
        erros.append("config ausente ou nao e objeto.")
    else:
        for k in ("iav", "ipc", "mav", "mpc"):
            if not isinstance(cfg.get(k), (int, float)):
                erros.append(f"config.{k} ausente ou nao numerico (margem usada na venda do parceiro).")
    prod = d.get("produtos")
    if not isinstance(prod, list) or not prod:
        erros.append("produtos ausente ou vazio.")
    else:
        for i, p in enumerate(prod):
            if not isinstance(p, dict):
                erros.append(f"produtos[{i}] nao e objeto."); continue
            if not p.get("n"):
                erros.append(f"produtos[{i}] sem nome (n).")
            if not p.get("c"):
                erros.append(f"produtos[{i}] ({p.get('n','?')}) sem categoria (c).")
            tem_v = isinstance(p.get("v"), (int, float))
            cs = p.get("cs")
            tem_cor = isinstance(cs, list) and any(isinstance(c, dict) and isinstance(c.get("v"), (int, float)) for c in cs)
            if not tem_v and not tem_cor:
                erros.append(f"produtos[{i}] ({p.get('n','?')}) sem custo: nem v nem cor com v.")
    return erros


def upsert(dados, service_key):
    url = f"{SUPABASE_URL}/rest/v1/calc_dados?on_conflict=tenant_id"
    payload = json.dumps([{"tenant_id": TENANT_ID, "dados": dados}]).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("apikey", service_key)
    req.add_header("Authorization", f"Bearer {service_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "resolution=merge-duplicates,return=representation")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if not args:
        print(__doc__)
        sys.exit(2)
    caminho = args[0]
    if not os.path.exists(caminho):
        print(f"REPROVOU: arquivo nao encontrado: {caminho}")
        sys.exit(1)

    texto = open(caminho, encoding="utf-8").read()
    try:
        dados = extrair_dados(texto)
    except Exception as e:
        print(f"REPROVOU: nao consegui ler o DADOS: {e}")
        sys.exit(1)

    erros = validar(dados)
    n_prod = len(dados.get("produtos", []))
    if erros:
        print(f"REPROVOU: {len(erros)} problema(s) no DADOS ({n_prod} produtos lidos):")
        for e in erros[:30]:
            print("  - " + e)
        sys.exit(1)
    print(f"OK: DADOS valido. {n_prod} produtos, config com margens {dados['config'].get('iav')}/{dados['config'].get('ipc')} (iPhone) e {dados['config'].get('mav')}/{dados['config'].get('mpc')} (Mac).")

    if "--check" in flags:
        print("Modo --check: nada gravado.")
        return

    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("REPROVOU: defina SUPABASE_SERVICE_KEY no ambiente para gravar (ou use --check para so validar).")
        sys.exit(1)

    status, corpo = upsert(dados, key)
    if status not in (200, 201):
        print(f"REPROVOU: Supabase devolveu HTTP {status}:\n{corpo}")
        sys.exit(1)
    print(f"GRAVADO: calc_dados atualizado (HTTP {status}). {n_prod} produtos na fonte unica.")
    print("A vitrine do parceiro (calc_dados_parceiro) acompanha automaticamente.")


if __name__ == "__main__":
    main()
