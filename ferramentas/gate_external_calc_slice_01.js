const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.resolve(__dirname, "..");
const proto = path.join(root, "prototypes", "external-calc-frontend-v0");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error("SLICE_01_GATE=FAIL");
    console.error(message);
    process.exit(1);
  }
}

const index = read(path.join(proto, "index.html"));
const styles = read(path.join(proto, "styles.css"));
const app = read(path.join(proto, "app.js"));
const mockCode = read(path.join(proto, "mock-data.js"));
const mockJson = JSON.parse(read(path.join(root, "docs", "calculadora", "mocks", "external-calc-workspace-v0.json")));

const requiredIds = [
  "scenario-select",
  "source-text",
  "interpret-list",
  "processing-shell",
  "metrics",
  "offers-body",
  "ambiguity-list",
  "invalid-list",
  "evidence-drawer",
  "trace-list"
];

for (const id of requiredIds) {
  assert(index.includes('id="' + id + '"'), "DOM obrigatório ausente: " + id);
}

const requiredStateTokens = [
  "idle",
  "processing",
  "ready",
  "failed",
  "partial",
  "empty",
  "interpreted",
  "inferred"
];

for (const token of requiredStateTokens) {
  assert(mockCode.includes(token), "Estado de UI ausente do mock: " + token);
}

const forbidden = [
  { re: /\bsupabase\s*\.(?:from|rpc|auth|storage|functions)\b/i, label: "chamada Supabase" },
  { re: /createClient\s*\(/i, label: "cliente Supabase" },
  { re: /service_role/i, label: "service_role" },
  { re: /XMLHttpRequest/i, label: "XMLHttpRequest" },
  { re: /\bfetch\s*\(/i, label: "fetch de rede" },
  { re: /\baxios\b/i, label: "axios" }
];

const combined = index + "\n" + styles + "\n" + app + "\n" + mockCode;
for (const item of forbidden) {
  assert(!item.re.test(combined), "Isolamento violado: " + item.label);
}

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(mockCode, sandbox, { filename: "mock-data.js" });

const scenarios = sandbox.window.EXTERNAL_CALC_SCENARIOS;
assert(scenarios && typeof scenarios === "object", "EXTERNAL_CALC_SCENARIOS não foi exposto");

for (const name of ["ready", "idle", "processing", "partial", "empty", "failed"]) {
  assert(scenarios[name], "Cenário ausente: " + name);
}

const ready = scenarios.ready;
assert(ready.document.status === "ready", "ready.document.status inválido");
assert(Array.isArray(ready.interpretation.records), "records deve ser array");
assert(ready.interpretation.records.some(r => r.state === "interpreted"), "faltou registro interpreted");
assert(ready.interpretation.records.some(r => r.state === "inferred"), "faltou registro inferred");
assert(Array.isArray(ready.interpretation.ambiguities) && ready.interpretation.ambiguities.length > 0, "faltou ambiguity de prova");
assert(Array.isArray(ready.interpretation.invalid) && ready.interpretation.invalid.length > 0, "faltou invalid de prova");

for (const record of ready.interpretation.records) {
  assert(["interpreted", "inferred"].includes(record.state), "estado de record inválido: " + record.state);
  assert(Array.isArray(record.trace) && record.trace.length > 0, "record sem trace: " + record.record_id);
  for (const trace of record.trace) {
    assert(trace.field, "trace sem field");
    assert(Array.isArray(trace.sources), "trace sem sources[]");
    assert(Array.isArray(trace.rules), "trace sem rules[]");
    assert(trace.score == null || (typeof trace.score === "number" && trace.score >= 0 && trace.score <= 1), "score fora de 0..1");
  }
}

assert(scenarios.failed.document.status === "failed", "cenário failed não está failed");
assert(scenarios.processing.document.status === "interpreting", "cenário processing não está interpreting");
assert(scenarios.empty.interpretation.records.length === 0, "cenário empty deve ter zero records");
assert(scenarios.partial.interpretation.records.length > 0, "cenário partial deve preservar resultado parcial");
assert(
  scenarios.partial.interpretation.ambiguities.length + scenarios.partial.interpretation.invalid.length > 0,
  "cenário partial deve exigir revisão"
);

assert(mockJson.contract_version === "external-calc-workspace-mock/v0", "contract_version do mock JSON mudou");
assert(mockJson.interpretation.summary.invalid >= 1, "mock JSON precisa cobrir invalid");
assert(mockJson.interpretation.summary.ambiguous >= 1, "mock JSON precisa cobrir ambiguous");

assert(index.includes("Slice 02") && index.includes("Slice 03"), "fronteiras das próximas slices não estão explícitas");
assert(index.includes("sem banco") && index.includes("sem escrita"), "modo isolado não está explícito");
assert(app.includes("score ") && !app.includes("probabilidade"), "score não deve ser apresentado como probabilidade");

console.log("SLICE_01_GATE=PASS");
console.log("checks=dom,states,contract,trace,isolation,boundaries");
