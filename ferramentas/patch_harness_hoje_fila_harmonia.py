from pathlib import Path

p = Path(__file__).resolve().parent / "harness.py"
src = p.read_text(encoding="utf-8")

antigo = '''  // ---- Fatia 2: botao Enviar na linha da Fila (texto sugerido, LGPD-gated) ----
  var envs = document.querySelectorAll('#lista .fila-lin a.fila-wa');
  ok('Fila tem botao Enviar (wa.me) nas linhas com consentimento', envs.length > 0, 'n=' + envs.length);
  ok('Enviar aponta pra wa.me com o texto sugerido (variante 1)',
     envs.length > 0
       && envs[0].getAttribute('href').indexOf('wa.me/') >= 0
       && envs[0].getAttribute('href').indexOf('Texto%20sugerido') >= 0,
     envs.length ? envs[0].getAttribute('href') : '(nenhum)');'''

novo = '''  // ---- Hoje: contato sob demanda. WhatsApp so aparece depois de preparar a mensagem. ----
  var prepararHoje = document.querySelector('#lista .fila-lin [data-acao="hoje-sugerir"]');
  var envs = document.querySelectorAll('#lista .fila-lin a.fila-wa');
  ok('Fila oferece Preparar mensagem como CTA principal', !!prepararHoje);
  ok('WhatsApp nao fica exposto antes de preparar a mensagem', envs.length === 0, 'n=' + envs.length);'''

if antigo not in src:
    raise RuntimeError("bloco antigo de Enviar da Hoje nao encontrado no harness")
src = src.replace(antigo, novo, 1)
p.write_text(src, encoding="utf-8")
print("PATCH_HARNESS_HOJE_OK")
