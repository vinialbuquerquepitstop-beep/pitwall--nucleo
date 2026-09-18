(() => {
  const data = window.EXTERNAL_CALC_MOCK;
  const navItems = [...document.querySelectorAll('[data-view]')];
  const panels = [...document.querySelectorAll('[data-view-panel]')];
  const titles = { analysis: 'Analisar lista', calculator: 'Calcular oferta', market: 'Mercado' };
  let selected = data.interpretation.records[0];

  function money(value){
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
  }

  function setView(view){
    navItems.forEach(item => item.classList.toggle('is-active', item.dataset.view === view));
    panels.forEach(panel => panel.classList.toggle('is-visible', panel.dataset.viewPanel === view));
    document.getElementById('page-title').textContent = titles[view] || 'External Calc';
  }

  function renderOffers(){
    const body = document.getElementById('offers-body');
    body.innerHTML = data.interpretation.records.map(record => {
      const badge = record.state === 'interpreted' ? 'good' : 'neutral';
      const status = record.state === 'interpreted' ? 'Interpretado' : 'Inferido';
      return '<tr class="row-select" data-record="'+record.record_id+'">'+
        '<td><span class="status '+badge+'">'+status+'</span></td>'+
        '<td><strong>'+record.fields.model.label+'</strong></td>'+
        '<td>'+record.fields.condition+'</td>'+
        '<td>'+record.fields.color+'</td>'+
        '<td>'+record.fields.supplier+'</td>'+
        '<td><strong>'+money(record.fields.price)+'</strong></td>'+
      '</tr>';
    }).join('');

    body.querySelectorAll('[data-record]').forEach(row => {
      row.addEventListener('click', () => {
        selected = data.interpretation.records.find(r => r.record_id === row.dataset.record) || selected;
        renderTrace();
      });
    });
  }

  function renderTrace(){
    const target = document.getElementById('trace-list');
    target.innerHTML = selected.trace.map(item =>
      '<div class="trace-item"><strong>'+item.field+'</strong><span>'+item.rule+' · linha '+item.source_line+'</span></div>'
    ).join('');
  }

  function renderSources(){
    const target = document.getElementById('sources-list');
    target.innerHTML = data.research.observations.map(item =>
      '<div class="source-item"><strong>'+item.label+' · '+money(item.price)+'</strong><span>'+item.captured_at+'</span></div>'
    ).join('');
  }

  navItems.forEach(item => item.addEventListener('click', () => {
    if (!item.disabled) setView(item.dataset.view);
  }));

  document.getElementById('open-calculator').addEventListener('click', () => setView('calculator'));

  renderOffers();
  renderTrace();
  renderSources();
})();
