from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: esperava 1 ocorrencia, encontrei {n}")
    return text.replace(old, new, 1)


# 1. Frontend: nota percentual nao pode usar BRL.
p = Path("public/app.js")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    '''function finNotaDif(x){
var v=Number(x)||0;
return(v<0?"−":"+")+brlV(Math.abs(v))}''',
    '''function finNotaV(n,x){
var v=Number(x)||0;
return n&&"pct"===n.unidade?v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"%":brlV(v)}
function finNotaDif(n,x){
var v=Number(x)||0;
return(v<0?"−":"+")+finNotaV(n,Math.abs(v))}''',
    "app.js finNotaDif",
)
s = replace_once(
    s,
    'pt.push("de <b>"+brlV(n.valor_antes)+"</b> para <b>"+brlV(n.valor_depois)+"</b>");',
    'pt.push("de <b>"+finNotaV(n,n.valor_antes)+"</b> para <b>"+finNotaV(n,n.valor_depois)+"</b>");',
    "app.js valores da nota",
)
s = replace_once(
    s,
    'pt.push("<b>"+finNotaDif(n.diferenca)+"</b>");',
    'pt.push("<b>"+finNotaDif(n,n.diferenca)+"</b>");',
    "app.js diferenca da nota",
)
p.write_text(s, encoding="utf-8")


# 2. Contrato: toda recusa criada pela E2 entra no vocabulario fechado.
p = Path("docs/financeiro/CONTRATO.md")
s = p.read_text(encoding="utf-8")
if "Dominio exige contraparte especifica:" not in s:
    s = replace_once(
        s,
        "Dominio invalido: use empresa ou pessoal.\n",
        "Dominio invalido: use empresa ou pessoal.\n"
        "Dominio invalido: use empresa, pessoal ou tudo.\n"
        "Dominio exige contraparte especifica: use nome ou identificador da contraparte, nao um tipo de transacao.\n",
        "CONTRATO recusas de dominio",
    )
p.write_text(s, encoding="utf-8")


# 3. fin_painel: reaproveita a funcao de E1 e muda SOMENTE o JSON de notas.
src = Path("supabase/migrations/20260904_fin_painel_notas.sql").read_text(encoding="utf-8")
marker = "create or replace function public.fin_painel"
if src.count(marker) != 1:
    raise SystemExit("migration E1: fin_painel nao localizado de forma unica")
fn = src[src.index(marker):]
fn = replace_once(
    fn,
    "           'mudou_em',     n.mudou_em)",
    "           'mudou_em',     n.mudou_em,\n           'unidade',       n.unidade)",
    "fin_painel unidade",
)
Path("supabase/migrations/20260915_fin_e2_painel_unidade.sql").write_text(
    "-- E2: fin_painel devolve a unidade da nota de numero.\n"
    "-- O calculo permanece identico ao E1; apenas `notas` ganha `unidade`.\n\n" + fn,
    encoding="utf-8",
)


# 4. Prova estatica propria da E2. As provas de banco rodam depois da migration.
proof = '''from pathlib import Path

app = Path("public/app.js").read_text(encoding="utf-8")
contract = Path("docs/financeiro/CONTRATO.md").read_text(encoding="utf-8")
e2 = Path("supabase/migrations/20260915_fin_e2_sem_dominio_silencioso.sql").read_text(encoding="utf-8")
painel = Path("supabase/migrations/20260915_fin_e2_painel_unidade.sql").read_text(encoding="utf-8")
checks = {
    "fin6: nota pct tem formatador proprio": '\"pct\"===n.unidade' in app and 'finNotaV(n,n.valor_antes)' in app,
    "fin6: diferenca pct usa mesma unidade": 'finNotaDif(n,n.diferenca)' in app,
    "fin6: painel devolve unidade": "'unidade',       n.unidade" in painel,
    "fin6: regra generica nao escreve dominio": 'v_contrapartes > 3' in e2 and 'Dominio exige contraparte especifica:' in e2,
    "fin6: prioridade 9000 preservada": 'prioridade = 9000' in e2 and 'ativo = false' in e2,
    "fin6: conjunto medido falha fechado": 'v_n <> 214 or v_val <> 8207.31' in e2,
    "fin6: nota declara retorno a fila": '214 lançamentos, somando R$ 8.207,31' in e2,
    "fin6: contrato conhece recusa E2": 'Dominio exige contraparte especifica:' in contract,
    "fin6: contrato conhece dominio tudo": 'Dominio invalido: use empresa, pessoal ou tudo.' in contract,
}
bad=[]
for name,ok in checks.items():
    print(f"{name}: {'OK' if ok else 'FALHA'}")
    if not ok: bad.append(name)
if bad: raise SystemExit("E2 reprovada: "+", ".join(bad))
print(f"fin6: {len(checks)}/{len(checks)}")
'''
Path("ferramentas/prova_financeiro_e2.py").write_text(proof, encoding="utf-8")

print("E2 Fase 2: patch de codigo aplicado. Ainda NAO aplicar no banco antes dos portoes.")
