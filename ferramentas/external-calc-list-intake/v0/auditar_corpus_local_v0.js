'use strict';
// Only runs against a user-supplied LOCAL folder. No API, database, upload or persistence.
// Do not commit the generated report or raw supplier lists.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {buildQueue}=require('./list-intake-api');
const {partitionCandidates}=require('./auto-promotion-authority');
const {linkedPriceHasExactAmount}=require('./source-price-evidence');
const INPUT_LIMIT=2*1024*1024;
const MAX_FILES=64;

function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function auditDirectory(directory){
  const stat=fs.statSync(directory);
  if(!stat.isDirectory())throw new Error('diretorio do corpus invalido');
  const names=fs.readdirSync(directory).filter(name=>/\.(txt|csv)$/i.test(name)).sort();
  if(names.length>MAX_FILES)throw new Error('limite local de '+MAX_FILES+' arquivos excedido');
  if(!names.length)throw new Error('nenhuma lista TXT/CSV encontrada no diretorio');
  const results=[];
  for(const name of names){
    const absolute=path.join(directory,name);
    const fileStat=fs.lstatSync(absolute);
    if(!fileStat.isFile()||fileStat.isSymbolicLink()){
      results.push({filename:name,status:'SKIPPED_NOT_REGULAR_FILE'});continue;
    }
    if(fileStat.size>INPUT_LIMIT){
      results.push({filename:name,status:'SKIPPED_TOO_LARGE',bytes:fileStat.size});continue;
    }
    const buffer=fs.readFileSync(absolute);
    const base={filename:name,bytes:buffer.length,sha256:sha256(buffer)};
    try{
      const content=buffer.toString('utf8').replace(/^\uFEFF/,'');
      const isCsv=/\.csv$/i.test(name);
      const built=buildQueue({
        filename:name,
        mime_type:isCsv?'text/csv':'text/plain',
        content
      });
      // Supplier is NOT verified in local audit. Eligibility below is diagnostic
      // simulation only; no supplier binding and NO automatic promotion.
      const simulated=partitionCandidates(built.queue,{supplierVerified:true});
      const assessments=new Map([
        ...simulated.auto.map(x=>[x.candidate.offer_id,x.assessment]),
        ...simulated.review.map(x=>[x.candidate.offer_id,x.assessment])
      ]);
      const candidates=built.queue.candidates.map(item=>{
        const refs=item.review_evidence?.field_sources?.price||[];
        const assessment=assessments.get(item.offer_id)||{eligible:false,reasons:['ASSESSMENT_MISSING']};
        return {
          offer_id:item.offer_id,
          model:item.interpreted_offer?.model?.label||null,
          capacity_gb:item.interpreted_offer?.capacity_gb??null,
          color:item.interpreted_offer?.color??null,
          amount_minor:item.interpreted_offer?.price?.amount_minor??null,
          currency:item.interpreted_offer?.price?.currency??null,
          price_source_lines:Array.isArray(refs)?refs:[],
          exact_price_present_on_source_line:linkedPriceHasExactAmount(item),
          hypothetical_auto_eligible_if_supplier_verified:assessment.eligible===true,
          review_reasons:assessment.reasons||[]
        };
      });
      results.push({
        ...base,status:'PARSED',source_id:built.source_id,analysis_id:built.analysis_id,
        candidates:candidates.length,
        source_price_exact_count:candidates.filter(x=>x.exact_price_present_on_source_line).length,
        hypothetical_auto_eligible_count:candidates.filter(x=>x.hypothetical_auto_eligible_if_supplier_verified).length,
        candidates_detail:candidates
      });
    }catch(err){
      results.push({...base,status:'ERROR',code:err?.code||'LOCAL_PARSE_ERROR',
        error:String(err?.message||err).slice(0,250)});
    }
  }
  return {
    report_version:'extcalc-gate1-private-corpus-local-audit/v0',
    disclaimer:'Offline diagnostic only. No supplier verified. No promotion/persistence/deploy. No truth adjudication without golden originals.',
    total_input_files:names.length,
    parsed_files:results.filter(x=>x.status==='PARSED').length,
    failed_files:results.filter(x=>x.status==='ERROR').length,
    total_candidates:results.reduce((s,x)=>s+(x.candidates||0),0),
    source_price_exact_count:results.reduce((s,x)=>s+(x.source_price_exact_count||0),0),
    hypothetical_auto_eligible_count:results.reduce((s,x)=>s+(x.hypothetical_auto_eligible_count||0),0),
    items:results
  };
}
if(require.main===module){
  const directory=process.argv[2],reportPath=process.argv[3];
  if(!directory||!reportPath)throw new Error('uso: node auditar_corpus_local_v0.js <diretorio-txt> <relatorio-local.json>');
  const report=auditDirectory(directory);
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'w',mode:0o600});
  console.log('EXTERNAL_CALC_GATE1_OFFLINE_CORPUS_REPORT=PASS');
  console.log(JSON.stringify({
    input_files:report.total_input_files,parsed_files:report.parsed_files,
    errors:report.failed_files,candidates:report.total_candidates,
    exact_source_price:report.source_price_exact_count,
    hypothetical_auto_eligible:report.hypothetical_auto_eligible_count
  }));
}
module.exports={auditDirectory};
