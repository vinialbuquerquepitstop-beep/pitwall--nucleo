def lin(c):
    c/=255
    return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
def L(hexs):
    h=hexs.lstrip('#')
    r,g,b=(int(h[i:i+2],16) for i in (0,2,4))
    return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def ratio(a,b):
    l1,l2=L(a),L(b); hi,lo=max(l1,l2),min(l1,l2)
    return (hi+0.05)/(lo+0.05)
def flag(r):
    return 'OK texto' if r>=4.5 else ('so nao-texto' if r>=3 else 'REPROVA')

print('=== HOJE (calibrado p/ fundo escuro #10151c) medido contra BRANCO ===')
atuais={'quente':'#ff5d45','morno':'#f2a71b','frio':'#6db8e8','ok':'#43c98a','erro':'#ff6b5e','accent':'#0025cc'}
for k,v in atuais.items():
    rW=ratio(v,'#FFFFFF'); rD=ratio(v,'#10151c')
    print(f"{k:<7} {v}  vs branco {rW:5.2f}  [{flag(rW):<12}]   (vs escuro de hoje {rD:5.2f})")

print('\n=== COLISOES hoje (1.00 = indistinguivel) ===')
print(f"quente x erro  : {ratio(atuais['quente'],atuais['erro']):5.2f}")
print(f"frio  x accent : {ratio(atuais['frio'],atuais['accent']):5.2f}")

print('\n=== PROPOSTA recalibrada p/ fundo branco ===')
novos={'quente':'#C2410C','morno':'#9A6A00','frio':'#5B6B84','ok':'#0F7A52','erro':'#B01235',
       'accent':'#0025CC','text':'#0F1523','dim':'#5C6675','line':'#E4E7EE','surface':'#F6F7FA'}
for k,v in novos.items():
    rW=ratio(v,'#FFFFFF'); rS=ratio(v,novos['surface'])
    print(f"{k:<7} {v}  vs branco {rW:5.2f}  [{flag(rW):<12}]   vs surface {rS:5.2f}")
print('\n=== COLISOES na proposta ===')
print(f"quente x erro   : {ratio(novos['quente'],novos['erro']):5.2f}")
print(f"frio   x accent : {ratio(novos['frio'],novos['accent']):5.2f}")
print(f"morno  x quente : {ratio(novos['morno'],novos['quente']):5.2f}")
