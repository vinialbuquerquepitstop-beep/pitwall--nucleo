# -*- coding: utf-8 -*-
"""
Foto da aba Pitscare POPULADA.

Por que existe alem do ferramentas/foto.py: o stub do harness nao tem nenhum
lead com perfil `comprou`, entao `python ferramentas/foto.py pitscare 1280`
fotografa o estado VAZIO. A aba so mostra do que e feita com clientes dentro,
e os tres grupos (Vencidos / Em dia / Fora da cadencia) sao justamente o que
precisa ser olhado. Este script reusa o mesmo motor, mas injeta clientes no
array LEADS do stub antes de clicar na aba.

Nomes GENERICOS de proposito: `docs/design/foto_*.png` e saida descartavel, mas
o script e versionado, e nome de cliente real nao entra em arquivo commitado.
A FORMA imita a base real medida em 18/08/2026: 6 vencidos, 1 em dia, 3 fora.

Uso:
    python ferramentas/harness.py          # monta a pagina, obrigatorio antes
    python ferramentas/foto_pitscare.py            # 1280x1500
    python ferramentas/foto_pitscare.py 390 1600   # celular
    python ferramentas/foto_pitscare.py 1280 1500 curto   # so 1 vencido, para
                                                          # os grupos de BAIXO
                                                          # caberem na foto

NAO LEIA ESTA FOTO COMO MEDIDA DE CELULAR. Em largura de celular a imagem sai
CORTADA na direita, e isso e artefato do screenshot, nao estouro de layout: o
headless do Chrome no Windows tem piso de ~500px de largura, entao a pagina
renderiza a 500 e a foto e recortada em 390. Quem MEDE celular e o
`ferramentas/diag_mobile.py`, que roda a pagina dentro de um iframe justamente
para escapar desse piso. Esta foto serve para ver forma e hierarquia, nunca
para concluir que algo vazou.
"""
import os, sys, pathlib, tempfile, subprocess

CHROME = next((p for p in [r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                           r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe']
               if os.path.exists(p)), None)
if not CHROME:
    print('ABORTA: Chrome nao encontrado.'); sys.exit(2)

larg = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
alt  = int(sys.argv[2]) if len(sys.argv) > 2 else 1500
curto = len(sys.argv) > 3 and sys.argv[3] == 'curto'

montado = pathlib.Path(tempfile.gettempdir()) / 'pitwall_harness.html'
raiz = pathlib.Path(__file__).resolve()
repo = pathlib.Path(r'C:\Users\Vinicius\Desktop\Pitwall Claude Code')
velhas = [f.name for f in [repo/'public'/'app.js', repo/'public'/'app.css', repo/'public'/'index.html']
          if f.stat().st_mtime > montado.stat().st_mtime]
if velhas:
    print('ABORTA: %s mudou depois da montagem. Rode o harness.py antes.' % ', '.join(velhas)); sys.exit(2)

pagina = montado.read_text(encoding='utf-8')
corte = pagina.rfind('<script>')
pagina = pagina[:corte]

# ARMADILHA MEDIDA EM 19/08/2026: o rfind('<script>') acima NAO acha a tag de
# abertura do bloco de teste. Acha o texto literal "<script>" que existe DENTRO
# do primeiro comentario dele (`// telaTxt() inclui o texto das tags <script>`).
# Resultado: o corte cai no meio de um comentario // ainda aberto, e a primeira
# linha que a gente cola e ENGOLIDA pelo comentario. O ferramentas/foto.py so
# escapa disso por acidente, porque o codigo dele comeca na linha SEGUINTE.
# Por isso a flag entra em linha propria dentro do bloco, e nunca numa tag
# separada colada logo apos o corte.
pagina += """<script>
var CURTO = __CURTO__;
window.addEventListener('load', function () {
  window.PitWall.init();
  setTimeout(function () {
    var hj = window.PitWall.hojeLocalISO();
    function dia(n){ return window.PitWall.diaMaisISO(hj, n); }
    function cli(nome, code, mut) {
      var b = JSON.parse(JSON.stringify(LEADS[0]));
      b.id = 'pc-' + code; b.lead_code = code; b.nome = nome;
      b.status = 'convertido'; b.perfil = 'comprou';
      b.cadencia_passo = 1; b.cadencia_rotulo = 'P1 \u00b7 D1 pos-venda';
      b.cadencia_encerrada = false; b.proximo_contato = hj;
      b.ultimo_toque_em = null; b.respondido_em = null; b.arquivado_em = null;
      b.consentimento = true; b.observacoes = null;
      if (mut) mut(b);
      return b;
    }
    var novos = [
      cli('Cliente A', 'LEAD-9001', function(b){ b.proximo_contato = dia(-32); b.produto = 'iPhone 15 Pro'; }),
      cli('Cliente B', 'LEAD-9002', function(b){ b.proximo_contato = dia(-26); b.produto = 'iPhone 14'; }),
      cli('Cliente C', 'LEAD-9003', function(b){ b.proximo_contato = dia(-9);  b.produto = 'iPhone 15'; }),
      cli('Cliente D', 'LEAD-9004', function(b){ b.proximo_contato = dia(-9);  b.produto = 'AirPods Pro'; }),
      cli('Cliente E', 'LEAD-9005', function(b){ b.proximo_contato = dia(-4);  b.produto = 'iPhone 13'; }),
      cli('Cliente F', 'LEAD-9006', function(b){ b.proximo_contato = dia(-1);  b.produto = 'Apple Watch'; }),
      cli('Cliente G', 'LEAD-9007', function(b){
        b.proximo_contato = dia(2); b.cadencia_passo = 2;
        b.cadencia_rotulo = 'P2 \u00b7 D7 tudo certo?';
        b.ultimo_toque_em = new Date(Date.now() - 864e5).toISOString();
        b.produto = 'iPhone 15 Pro Max'; }),
      cli('Cliente H', 'LEAD-9008', function(b){ b.cadencia_encerrada = true; b.proximo_contato = null; b.produto = 'iPhone 12'; }),
      cli('Cliente I', 'LEAD-9009', function(b){ b.cadencia_encerrada = true; b.proximo_contato = null; b.produto = 'iPad Air'; }),
      cli('Cliente J', 'LEAD-9010', function(b){ b.cadencia_encerrada = true; b.proximo_contato = null; b.produto = 'MacBook Air'; })
    ];
    // Modo curto: guarda so o primeiro vencido, para os grupos de BAIXO
    // (Em dia e Fora da cadencia) caberem na mesma foto.
    if (CURTO) novos = novos.filter(function (a, k) { return k === 0 || k >= 6; });
    novos.forEach(function (a) { LEADS.push(a); });
    window.PitWall._setLeads(LEADS);
    document.getElementById('abaPitscare').click();
  }, 400);
});
window.addEventListener('error', function (ev) {
  var av = document.createElement('div');
  av.textContent = 'FOTO INVALIDA: ' + (ev.message || ev.error);
  av.setAttribute('style', 'position:fixed;top:0;left:0;right:0;z-index:99999;'
    + 'background:#B01235;color:#fff;font:600 14px sans-serif;padding:10px 14px');
  document.body.appendChild(av);
});
// FIM
</script></body></html>"""

tmp = pathlib.Path(tempfile.gettempdir()) / ('pitwall_foto_pitscare_%s%d.html' % ('curto_' if curto else 'cheia_', larg))
pagina = pagina.replace('__CURTO__', 'true' if curto else 'false')
tmp.write_text(pagina, encoding='utf-8')
saida = repo / 'docs' / 'design' / ('foto_pitscare_%s%d.png' % ('curto_' if curto else 'cheia_', larg))
perfil = tempfile.mkdtemp()
subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
                '--user-data-dir=%s' % perfil, '--virtual-time-budget=20000',
                '--hide-scrollbars', '--window-size=%d,%d' % (larg, alt),
                '--screenshot=%s' % saida, tmp.as_uri()],
               capture_output=True, text=True, timeout=120)
if not saida.exists():
    print('ABORTA: Chrome nao gravou.'); sys.exit(1)
print('ok: %s (%d bytes, %dx%d)' % (saida, saida.stat().st_size, larg, alt))
