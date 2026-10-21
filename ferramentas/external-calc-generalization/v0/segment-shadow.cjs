'use strict';
// VS1 experimental structural segmenter. READ-ONLY. Not a C01 parser, scorer
// or source of authoritative offers. No supplier identities, brands or SKUs.
// Accepts CanonicalDocument V1; evidence is always a source_ref from that document.
const { validateCanonicalDocument } = require('../../external-calc-universal-input/v1/canonical-document');

const VERSION = 'external-calc-structural-segment-shadow/v0';
const NOTE_RE = /\b(?:atacado|distribuidora|distribuição|revenda|revendedor(?:es)?|boletim|tabela|catálogo|fict[ií]cia|teste|estoque|prazo|retirada|pedido m[ií]nimo|disponibilidade|consult(?:a|e|ar)|uso exclusivo|pre[cç]os inventados|todos os pre[cç]os|fim da lista|fim da tabela|condi[cç][oõ]es comerciais|somente lojistas)\b/iu;
const CONTACT_RE = /\b(?:atendimento|telefone|contato|whatsapp|whats(?:app)?|fale com)\b/iu;
const CONDITION_RE = /\b(?:lacrad[oa]s?|cpo|caixa aberta|open box|seminov[oa]s?|recondicionad[oa]s?|usad[oa]s?|n[aã]o ativad[oa])\b/iu;
const PRICE_CUE_RE = /(?:R\$\s*\d|US\$\s*\d|[💰💵]|(?:valor(?:\s+unit[aá]rio)?|pre[cç]o|cada cor)\s*:?\s*(?:R\$)?\s*\d)/iu;
const VARIANT_CUE_RE = /(?:[🎨]|(?:\bcor(?:es)?\s+(?:desta|dispon[ií]ve(?:l|is))?\s*(?:oferta)?\s*:))/iu;
// Positive product-role marker, not a supplier or product/brand lexicon.
const PRODUCT_LEAD_RE = /^(?:📱|💻|⌚|🎧|▫️?|✅|▹|•|\*)\s*/u;
const SECTION_LEAD_RE = /^(?:📚|📂|🏷️|🗂️|📋|🧾)\s*/u;
const SEPARATOR_RE = /^[^\p{L}\p{N}]*[━─—=_~]{5,}[^\p{L}\p{N}]*$/u;

const normalized = v => String(v ?? '').normalize('NFKC').replace(/\u00a0/g, ' ').trim();
function removeLead(value) {
  return normalized(value).replace(PRODUCT_LEAD_RE, '').replace(/^\s*\*([^*]+)\*\s*$/, '$1').trim();
}
function isPhone(value) {
  if (!CONTACT_RE.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 || /whatsapp|atendimento/iu.test(value);
}
function isMonetary(value) {
  if (PRICE_CUE_RE.test(value) && !NOTE_RE.test(value)) return true;
  // Bare amount only when a separator and a qualifying 3+ digit amount
  // are both visible. Never treat 13", 128 GB or a phone as a price.
  const match = /(?:^|[:=—–|])\s*(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})+(?:,[0-9]{2})?|[0-9]{3,6}(?:,[0-9]{2})?)\s*\*?\s*$/u.exec(value);
  return Boolean(match && !isPhone(value));
}
function classifyLine(value) {
  const t = normalized(value);
  if (!t) return {role:'blank', reason:'empty'};
  if (SEPARATOR_RE.test(t)) return {role:'separator', reason:'layout_divider'};
  if (isPhone(t)) return {role:'contact', reason:'commercial_contact'};
  if (SECTION_LEAD_RE.test(t) && !/\bcondi[cç][aã]o\s*:/iu.test(t)) {
    return {role:'section', reason:'explicit_section_marker'};
  }
  if (NOTE_RE.test(t) && !PRODUCT_LEAD_RE.test(t)) return {role:'notice', reason:'commercial_notice'};
  if (PRICE_CUE_RE.test(t) && !NOTE_RE.test(t)) return {role:'price', reason:'explicit_price_cue'};
  if (VARIANT_CUE_RE.test(t)) return {role:'variant', reason:'color_marker'};
  if (/^(?:📋\s*)?condi[cç][aã]o\s*:/iu.test(t) || CONDITION_RE.test(t) && !PRODUCT_LEAD_RE.test(t)) {
    return {role:'condition',reason:'condition_marker'};
  }
  if (isMonetary(t)) return {role:'price',reason:'separator_money'};
  const lead = PRODUCT_LEAD_RE.exec(t);
  const labelled = /^(?:produto|modelo|item|device)\s*:\s*(.+)$/iu.exec(t);
  const remainder = lead ? removeLead(t) : (labelled ? labelled[1].trim() : t);
  // A heading with no visible icon can still be a candidate when it carries
  // a typed specification (e.g. "QuantaX 512GB"). This is a SHADOW
  // hypothesis, never an authoritative product identity. Metadata excluded.
  const unmarkedTyped = !lead && !labelled && /\p{L}/u.test(t) &&
    /\b\d{2,4}\s*(?:GB|TB|MM)\b/iu.test(t) && t.length<140;
  if ((lead || labelled || unmarkedTyped) && /\p{L}/u.test(remainder) &&
      remainder.length >= 5 && !NOTE_RE.test(remainder) &&
      !CONTACT_RE.test(remainder) &&
      !/^(?:condi[cç][aã]o|cor(?:es)?|valor|pre[cç]o)\s*:/iu.test(remainder)) {
    return {role:'product_candidate',
      reason:lead?'marked_product_candidate':labelled?'labelled_product_candidate':'typed_unmarked_product_candidate',
      label:remainder};
  }
  return {role:'unknown',reason:'insufficient_structure'};
}
function segmentCanonical(document) {
  validateCanonicalDocument(document);
  const rows = document.blocks.map((block,index)=>{
    const role=classifyLine(block.text);
    return {
      index, text:block.text, role:role.role, reason:role.reason,
      source_ref:block.provenance.source_ref,
      line: block.provenance.row,
      label:role.label??null
    };
  });
  const confirmed = new Set();
  for (let i=0;i<rows.length;i++) {
    if (rows[i].role!=='product_candidate') continue;
    // Avoid promoting notes with emoji merely because they have digits.
    // Look only until a competing potential product or explicit section.
    let signal=false,looked=0;
    for(let j=i+1;j<rows.length && looked<7;j++){
      const r=rows[j].role;
      if(r==='product_candidate'||r==='section')break;
      if(r==='separator'||r==='blank')continue;
      looked++;
      if(['condition','variant','price'].includes(r))signal=true;
    }
    if(signal)confirmed.add(i);
  }
  const productBlocks=[],unassigned=[],sections=[];
  let current=null,sectionRef=null;
  function close(end,why) {
    if(!current)return;
    current.end_source_ref=end;
    current.closed_by=why;
    productBlocks.push(current);
    current=null;
  }
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(r.role==='section') {
      close(rows[i-1]?.source_ref??null,'new_section');
      sectionRef=r.source_ref;
      sections.push({source_ref:r.source_ref,heading:r.text});
      continue;
    }
    if(confirmed.has(i)){
      close(rows[i-1]?.source_ref??null,'new_product');
      current={
        block_id:'shadow-block-'+String(productBlocks.length+1).padStart(3,'0'),
        section_ref:sectionRef,model_span:{text:r.label,source_ref:r.source_ref,line:r.line},
        start_source_ref:r.source_ref,end_source_ref:null,closed_by:null,
        members:[{role:'product',source_ref:r.source_ref,line:r.line,text:r.text}]
      };
      continue;
    }
    if(current){
      // A separator is not proof of a price relationship; by itself it ends
      // an active block, preventing a price from leaking to a later section.
      if(r.role==='separator') {
        close(rows[i-1]?.source_ref??null,'layout_divider');
      }else if(r.role!=='blank'){
        current.members.push({role:r.role,source_ref:r.source_ref,line:r.line,text:r.text});
      }
    }else if(r.role!=='blank'&&r.role!=='separator'){
      unassigned.push({role:r.role,source_ref:r.source_ref,line:r.line,text:r.text,
        reason: r.role==='product_candidate'?'unconfirmed_product_anchor':r.reason});
    }
  }
  close(rows.at(-1)?.source_ref??null,'end_of_document');
  // A segmenter NEVER emits commercial offers; a future resolver must
  // associate source spans explicitly and may abstain.
  return {
    contract_version:VERSION,mode:'SHADOW_READ_ONLY',document_source_hash:document.source.content_hash,
    sections,product_blocks:productBlocks,unassigned,offers:[],
    summary:{
      model_anchors:productBlocks.length,unassigned_lines:unassigned.length,
      price_lines:rows.filter(x=>x.role==='price').length,
      candidate_anchors:rows.filter(x=>x.role==='product_candidate').length
    }
  };
}
module.exports={VERSION, classifyLine,segmentCanonical};
