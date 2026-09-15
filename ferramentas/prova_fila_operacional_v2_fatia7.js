const fs=require('fs'),path=require('path'),vm=require('vm');
const app=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','public','app.css'),'utf8');
let f=0,t=0;function ok(n,c,d){t++;if(c)console.log('OK  '+n);else{f++;console.error('FALHA  '+n+(d?' | '+d:''))}}
console.log('\nFatia 7: Alertas e degradacao');
ok('alertas usam limiares explicitos de primeiro toque, prioridade e regua',app.includes('dias>1')&&app.includes('dias>=24')&&app.includes('Number(regua.horas)>=26'));
ok('pos-venda vencido usa somente passo anterior a hoje',app.includes('vPos(ativos,hj).filter(function(x){return p(x.proximo_contato,hj)>0})'));
ok('sem canal reutiliza metrica da Fatia 6',app.includes('metricas&&metricas.sem_canal'));
ok('historico de backlog vem de regua_execucao e e leitura opcional',app.includes('t.from("regua_execucao")')&&app.includes('bh&&bh.ok?bh.historico:[]'));
ok('crescimento continuo exige tres dias estritamente crescentes',app.includes('s.length>=3&&s[0].n>s[1].n&&s[1].n>s[2].n'));
ok('alertas entram na Hoje antes de Pendencias',app.includes('hojeLeitura(dinheiro)+filaAlertasHTML(alertas)+hojePendencias(d)'));
ok('bloco some quando nao ha alerta',app.includes('if(!alertas||!alertas.length)return""'));
ok('nao cria notificacao externa nem escrita',!app.includes('Notification(')&&!app.includes('pushManager')&&!app.includes('insert({tipo:"alerta"'));
ok('CSS define estado de atencao e critico sem novo card promocional',css.includes('.fila-alertas{')&&css.includes('.fila-alerta.crit{border-color:var(--erro-linha)'));
ok('mobile empilha os alertas',css.includes('@media(max-width:700px)')&&css.includes('.fila-alertas-grade{grid-template-columns:1fr}'));
console.log('\n=== '+(t-f)+' OK, '+f+' falhas ===');process.exit(f?1:0);
