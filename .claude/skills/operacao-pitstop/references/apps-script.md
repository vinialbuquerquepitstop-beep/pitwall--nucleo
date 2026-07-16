# Automação com Apps Script

Padrões prontos de automação para o CRM. Limites a respeitar: execução de até 6 minutos por rodada; envio de e-mail de 100 destinatários/dia (conta comum) ou 1.500/dia (Workspace).

## Gatilhos
- **Simples** (onEdit, onOpen): sem autenticação, não enviam e-mail nem chamam serviços externos.
- **Instaláveis** (onEdit, onChange, onFormSubmit, por tempo): rodam como o criador, podem enviar e-mail e chamar APIs. Configure pelo menu Acionadores do editor de Apps Script.

## Timestamp automático na troca de estágio (onEdit)
```javascript
function onEdit(e){
  const r = e.range, sh = r.getSheet();
  // coluna 6 = Estágio na aba Pipeline; grava a hora na coluna 12
  if (sh.getName()==="Pipeline" && r.getColumn()===6 && r.getRow()>1){
    sh.getRange(r.getRow(), 12).setValue(new Date());
  }
}
```

## Lembrete diário de follow-up (gatilho por tempo, ex.: 8h)
```javascript
function lembreteFollowUp(){
  const sh = SpreadsheetApp.getActive().getSheetByName("Leads");
  const dados = sh.getDataRange().getValues();
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  let linhas = [];
  for (let i=1; i<dados.length; i++){
    const dataAcao = dados[i][9];   // coluna Data próxima ação
    const status   = dados[i][5];   // coluna Status
    if (dataAcao instanceof Date && dataAcao.setHours(0,0,0,0)===hoje.getTime() && status!=="Concluído"){
      linhas.push(`${dados[i][1]} (${dados[i][2]}): ${dados[i][8]}`);
    }
  }
  if (linhas.length){
    MailApp.sendEmail("seu-email@exemplo.com", "Follow-ups de hoje", linhas.join("\n"));
  }
}
```
Crie o acionador: Apps Script > Acionadores > adicionar > função `lembreteFollowUp` > orientado por tempo > diário.

## Entrada de lead via formulário (onFormSubmit)
```javascript
function aoEnviarFormulario(e){
  const sh = SpreadsheetApp.getActive().getSheetByName("Leads");
  const v = e.namedValues;
  const id = "LEAD-" + Utilities.formatString("%04d", sh.getLastRow());
  sh.appendRow([id, v["Nome"][0], v["WhatsApp"][0], v["E-mail"][0], v["Origem"][0],
                "Contato Inicial", "", new Date(), "Primeiro contato", new Date()]);
}
```

## WhatsApp (essencial no Brasil)
**Grátis, semi-automático (recomendado para começar):** link clique-para-conversar, sem custo de API.
```
=HYPERLINK("https://wa.me/"&B2&"?text="&CODIFICAÇÃOURL("Oi "&A2&", aqui é da Pitstop Imports!"); "WhatsApp")
```
Funciona em conta pessoal e Business. Telefone no formato internacional (55 + DDD + número), sem símbolos.

**Totalmente automático:** WhatsApp Business Cloud API via `UrlFetchApp.fetch()` para `graph.facebook.com/.../messages`, com token Bearer e template pré-aprovado. Exige Facebook Business verificado, opt-in do cliente e aprovação de template. Só vale a pena quando o volume manual de links não dá conta. Disparo não solicitado arrisca banimento; respeite opt-in.

Sempre envolva código de gatilho em try/catch e ative notificação de falha imediata nos Acionadores.
