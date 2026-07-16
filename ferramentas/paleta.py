import math, colorsys

def lin(c):
    c/=255
    return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
def hex2rgb(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def rgb2hex(r,g,b): return '#%02X%02X%02X'%(round(r),round(g),round(b))
def lum(h):
    r,g,b=hex2rgb(h); return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def ratio(a,b):
    l1,l2=lum(a),lum(b); hi,lo=max(l1,l2),min(l1,l2); return (hi+0.05)/(lo+0.05)

# --- CIELAB / CIEDE2000 ---
def rgb2lab(h):
    r,g,b=[lin(c) for c in hex2rgb(h)]
    X=r*0.4124+g*0.3576+b*0.1805; Y=r*0.2126+g*0.7152+b*0.0722; Z=r*0.0193+g*0.1192+b*0.9505
    X/=0.95047; Z/=1.08883
    f=lambda t: t**(1/3) if t>0.008856 else (7.787*t+16/116)
    fx,fy,fz=f(X),f(Y),f(Z)
    return (116*fy-16, 500*(fx-fy), 200*(fy-fz))
def ciede2000(h1,h2):
    L1,a1,b1=rgb2lab(h1); L2,a2,b2=rgb2lab(h2)
    C1=math.hypot(a1,b1); C2=math.hypot(a2,b2); Cb=(C1+C2)/2
    G=0.5*(1-math.sqrt(Cb**7/(Cb**7+25**7))) if Cb>0 else 0
    a1p,a2p=(1+G)*a1,(1+G)*a2
    C1p,C2p=math.hypot(a1p,b1),math.hypot(a2p,b2)
    h1p=math.degrees(math.atan2(b1,a1p))%360; h2p=math.degrees(math.atan2(b2,a2p))%360
    dLp=L2-L1; dCp=C2p-C1p
    dhp=0 if C1p*C2p==0 else ((h2p-h1p+180)%360)-180
    dHp=2*math.sqrt(C1p*C2p)*math.sin(math.radians(dhp)/2)
    Lbp=(L1+L2)/2; Cbp=(C1p+C2p)/2
    if C1p*C2p==0: hbp=h1p+h2p
    elif abs(h1p-h2p)<=180: hbp=(h1p+h2p)/2
    else: hbp=(h1p+h2p+360)/2 if h1p+h2p<360 else (h1p+h2p-360)/2
    T=1-0.17*math.cos(math.radians(hbp-30))+0.24*math.cos(math.radians(2*hbp))+0.32*math.cos(math.radians(3*hbp+6))-0.20*math.cos(math.radians(4*hbp-63))
    dTh=30*math.exp(-(((hbp-275)/25)**2))
    Rc=2*math.sqrt(Cbp**7/(Cbp**7+25**7)) if Cbp>0 else 0
    Sl=1+(0.015*(Lbp-50)**2)/math.sqrt(20+(Lbp-50)**2); Sc=1+0.045*Cbp; Sh=1+0.015*Cbp*T
    Rt=-Rc*math.sin(2*math.radians(dTh))
    return math.sqrt((dLp/Sl)**2+(dCp/Sc)**2+(dHp/Sh)**2+Rt*(dCp/Sc)*(dHp/Sh))

# --- simulacao de daltonismo (Brettel/Vienot aproximado) ---
def simulate(h, kind):
    r,g,b=[lin(c) for c in hex2rgb(h)]
    L=17.8824*r+43.5161*g+4.11935*b; M=3.45565*r+27.1554*g+3.86714*b; S=0.0299566*r+0.184309*g+1.46709*b
    if kind=='protan': L2,M2,S2 = 2.02344*M-2.52581*S, M, S
    elif kind=='deutan': L2,M2,S2 = L, 0.494207*L+1.24827*S, S
    else: L2,M2,S2 = L, M, -0.395913*L+0.801109*M
    r2=0.0809444479*L2-0.130504409*M2+0.116721066*S2
    g2=-0.0102485335*L2+0.0540193266*M2-0.113614708*S2
    b2=-0.000365296938*L2-0.00412161469*M2+0.693511405*S2
    def g_(c):
        c=max(0.0,min(1.0,c))
        c = 12.92*c if c<=0.0031308 else 1.055*(c**(1/2.4))-0.055
        return max(0,min(255,c*255))
    return rgb2hex(g_(r2),g_(g2),g_(b2))

def busca(hue, sat, alvo, base='#FFFFFF'):
    """acha a maior luminosidade (cor mais viva) que ainda bate o contraste alvo contra o fundo"""
    melhor=None
    for l in range(5,95):
        r,g,b=colorsys.hls_to_rgb(hue/360, l/100, sat/100)
        h=rgb2hex(r*255,g*255,b*255)
        if ratio(h,base)>=alvo: melhor=h
        else: break
    return melhor

print('### FAIXA do card (nao-texto, alvo WCAG >= 3.0 contra branco)')
faixa={}
for nome,(hue,sat) in {'quente':(18,88),'morno':(41,92),'frio':(215,22)}.items():
    h=busca(hue,sat,3.0); faixa[nome]=h
    print(f'  {nome:<7} {h}  contraste vs branco {ratio(h,"#FFFFFF"):.2f}')

print('\n### TEXTO do chip (alvo >= 4.5 contra o tint claro do proprio chip)')
for nome,(hue,sat,tint) in {'quente':(18,80,'#FDF0E9'),'morno':(41,100,'#FBF3E0'),'frio':(215,20,'#F0F3F8')}.items():
    h=busca(hue,sat,4.5,tint)
    print(f'  {nome:<7} {h}  vs tint {tint}: {ratio(h,tint):.2f}   vs branco: {ratio(h,"#FFFFFF"):.2f}')

print('\n### DISTINGUIVEIS entre si? (CIEDE2000; <10 = risco de confundir)')
pares=[('quente','morno'),('quente','frio'),('morno','frio')]
for a,b in pares:
    print(f'  {a} x {b}: dE {ciede2000(faixa[a],faixa[b]):5.1f}')

print('\n### O MESMO TESTE HOJE, no tema escuro (a referencia que ja funciona)')
hoje={'quente':'#ff5d45','morno':'#f2a71b','frio':'#6db8e8'}
for a,b in pares:
    print(f'  {a} x {b}: dE {ciede2000(hoje[a],hoje[b]):5.1f}')

print('\n### DALTONISMO na paleta proposta (dE apos simular)')
for kind in ('protan','deutan'):
    sim={k:simulate(v,kind) for k,v in faixa.items()}
    linha=' | '.join(f'{a} x {b}: {ciede2000(sim[a],sim[b]):4.1f}' for a,b in pares)
    print(f'  {kind:<7} {linha}')
print('  (hoje, escuro:)')
for kind in ('protan','deutan'):
    sim={k:simulate(v,kind) for k,v in hoje.items()}
    linha=' | '.join(f'{a} x {b}: {ciede2000(sim[a],sim[b]):4.1f}' for a,b in pares)
    print(f'  {kind:<7} {linha}')
