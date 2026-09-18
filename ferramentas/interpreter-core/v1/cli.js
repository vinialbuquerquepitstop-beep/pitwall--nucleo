'use strict';

const fs = require('fs');
const path = require('path');
const { interpretResolved, ENGINE_VERSION } = require('./core');

function usage() {
  return [
    'Uso:',
    '  node cli.js --input <arquivo|-> --schema <schema.json> [--knowledge <knowledge.json>] [--out <arquivo|->]',
    '',
    'Opcoes:',
    '  --document-id <id>   Identificador auditavel do documento',
    '  --compact            JSON em uma linha',
    '  --help               Mostra esta ajuda',
    '',
    'Seguranca:',
    '  - somente leitura da entrada/schema/knowledge',
    '  - nenhuma chamada de rede ou banco',
    '  - nenhuma persistencia operacional',
    '  - nenhum segredo necessario'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--compact') {
      args.compact = true;
      continue;
    }
    if (!token.startsWith('--')) {
      throw new Error(`argumento inesperado: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) {
      throw new Error(`valor ausente para --${key}`);
    }
    args[key.replace(/-/g, '_')] = value;
    i += 1;
  }
  return args;
}

function readUtf8(file) {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file, label) {
  try {
    return JSON.parse(readUtf8(file));
  } catch (err) {
    throw new Error(`${label} invalido em ${file}: ${err.message}`);
  }
}

function emptyKnowledge() {
  return {
    contract_version: 'knowledge-snapshot/v1',
    snapshot_id: 'cli-empty',
    version: '0',
    entities: [],
    aliases: [],
    semantic_rules: [],
    supplier_profiles: []
  };
}

function readInput(input) {
  if (input === '-') return fs.readFileSync(0, 'utf8');
  return readUtf8(input);
}

function writeOutput(out, text) {
  if (!out || out === '-') {
    process.stdout.write(text);
    return;
  }
  fs.writeFileSync(out, text, { encoding: 'utf8', flag: 'w' });
}

function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage() + '\n');
    return 0;
  }

  if (!args.input) throw new Error('--input e obrigatorio');
  if (!args.schema) throw new Error('--schema e obrigatorio');

  const content = readInput(args.input);
  if (!content.trim()) throw new Error('documento de entrada vazio');

  const schemaPath = path.resolve(args.schema);
  const schema = readJson(schemaPath, 'DomainSchema');
  const knowledge = args.knowledge
    ? readJson(path.resolve(args.knowledge), 'KnowledgeSnapshot')
    : emptyKnowledge();

  const documentId = args.document_id
    || (args.input === '-' ? 'stdin' : path.basename(args.input));

  const bundle = interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: documentId,
      content,
      source: {
        kind: args.input === '-' ? 'stdin' : 'plain_text',
        filename: args.input === '-' ? undefined : path.basename(args.input)
      }
    },
    schema,
    knowledge
  });

  bundle.run = {
    ...(bundle.run || {}),
    invoked_via: 'interpreter-cli/v1',
    engine_version: bundle.run?.engine_version || ENGINE_VERSION
  };

  const json = JSON.stringify(bundle, null, args.compact ? 0 : 2) + '\n';
  writeOutput(args.out, json);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = run();
  } catch (err) {
    console.error(`FALHOU: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, run, usage, emptyKnowledge };
