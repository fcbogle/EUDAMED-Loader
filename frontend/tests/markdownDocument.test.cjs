const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/markdownDocument.tsx'), 'utf8'),
  {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
const moduleUnderTest = {exports: {}};
new Function('require', 'module', 'exports', output)(require, moduleUnderTest, moduleUnderTest.exports);
const {renderMarkdownDocument, resolveDocumentLink} = moduleUnderTest.exports;
function nodes(tree) {
  const result = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    result.push(node); visit(node.props?.children);
  }
  visit(tree); return result;
}
const documents = [...fs.readFileSync(path.join(root, 'frontend/src/App.tsx'), 'utf8').matchAll(
  /id: "([^"]+)",\s+title: "[^"]+",\s+sourcePath: "([^"]+)"/g)].map(match => ({id: match[1], sourcePath: match[2]}));
const context = {sourcePath: 'docs/production-import-workbook-design.md', documents, onNavigate() {}};
test('relative document links navigate to the matching UI document and retain heading anchors', () => {
  const calls = [];
  const rendered = nodes(renderMarkdownDocument('See [**Importer design**](production-importer-design.md#repeat-imports).',
    {...context, onNavigate: (...args) => calls.push(args)}));
  const link = rendered.find(node => node.type === 'a');
  assert.ok(link);
  let prevented = false;
  link.props.onClick({preventDefault() {prevented = true;}});
  assert.equal(prevented, true);
  assert.deepEqual(calls, [['productionImporterDesign', 'repeat-imports']]);
  assert.ok(rendered.some(node => node.type === 'strong'));
  assert.deepEqual(resolveDocumentLink('../session-handoff.md', {...context, sourcePath: 'docs/reports/device-subject-identity-policy.md'}),
    {id: 'sessionHandoff', anchor: ''});
  assert.deepEqual(resolveDocumentLink('#locations-and-output-lifecycle', context),
    {id: 'productionWorkbookContract', anchor: 'locations-and-output-lifecycle'});
});
test('the supplied workbook contract renders a real table and clickable cross references', () => {
  const content = fs.readFileSync(path.join(root, context.sourcePath), 'utf8');
  const rendered = nodes(renderMarkdownDocument(content, context));
  assert.ok(rendered.some(node => node.type === 'table'));
  assert.ok(rendered.some(node => node.type === 'th' && JSON.stringify(node.props.children).includes('Purpose')));
  assert.ok(rendered.some(node => node.type === 'code' && node.props.children === 'data/prod/template/'));
  assert.ok(rendered.some(node => node.type === 'a' && node.props.href.includes('productionPreparation')));
  assert.ok(rendered.some(node => node.type === 'a' && node.props.href.includes('productionImporterDesign')));
});
test('links work in lists and table cells, and table alignment and escaped pipes are retained', () => {
  const content = '- [Handoff](session-handoff.md)\n\n| Document | Notes |\n| :--- | ---: |\n| [Handoff](session-handoff.md) | `a|b` and escaped \\| pipe |';
  const rendered = nodes(renderMarkdownDocument(content, context));
  assert.equal(rendered.filter(node => node.type === 'a').length, 2);
  assert.equal(rendered.filter(node => node.type === 'td').length, 2);
  assert.ok(rendered.some(node => node.type === 'code' && node.props.children === 'a|b'));
  assert.equal(rendered.filter(node => node.type === 'th')[1].props.style.textAlign, 'right');
  assert.match(JSON.stringify(rendered), /escaped \| pipe/);
});
test('code blocks stay literal and unsafe links or raw HTML never execute', () => {
  const rendered = nodes(renderMarkdownDocument('```text\n[Example](session-handoff.md)\n```\n\n[Bad](javascript:alert) and [Website](https://example.com)\n\n<script>alert(1)</script>', context));
  const links = rendered.filter(node => node.type === 'a');
  assert.equal(links.length, 1);
  assert.equal(links[0].props.href, 'https://example.com');
  assert.equal(links[0].props.rel, 'noopener noreferrer');
  assert.equal(rendered.some(node => node.type === 'script'), false);
  assert.equal(rendered.some(node => node.props?.dangerouslySetInnerHTML), false);
  assert.equal(resolveDocumentLink('javascript:alert', context), null);
});

test('wrapped bullet and numbered-list lines stay within their item, including nested mixed lists', () => {
  const content = '- One codebase and the same workflows\n  in Dev and Prod.\n- Another item\n  1. Nested numbered item\n     continues here.\n  2. Another nested item\n  Parent continuation.\n\n- Blank-separated sibling.\n\nOutside paragraph.\n\n1. First step\n   continues on the next line.\n2. Second step';
  const rendered = renderMarkdownDocument(content, context);
  assert.deepEqual(rendered.map(node => node.type), ['ul', 'p', 'ol']);
  const list = nodes(rendered[0]);
  const items = list.filter(node => node.type === 'li');
  assert.match(JSON.stringify(items[0]), /One codebase and the same workflows in Dev and Prod/);
  assert.match(JSON.stringify(items[1]), /Another item Parent continuation/);
  assert.match(JSON.stringify(items[2]), /Nested numbered item continues here/);
  assert.equal(items.length, 5);
  assert.match(JSON.stringify(rendered[2]), /First step continues on the next line/);
});

test('the importer guide keeps the agreed behaviour continuations inside the six bullets', () => {
  const content = fs.readFileSync(path.join(root, 'docs/production-importer-design.md'), 'utf8');
  const section = content.split('## Agreed behaviour\n')[1].split('\nCurrent expected')[0];
  const rendered = renderMarkdownDocument(section, {...context, sourcePath: 'docs/production-importer-design.md'});
  assert.deepEqual(rendered.map(node => node.type), ['ul']);
  const items = nodes(rendered).filter(node => node.type === 'li');
  assert.equal(items.length, 6);
  assert.match(JSON.stringify(items[0]), /in Dev and Prod/);
  assert.match(JSON.stringify(items[2]), /Reject unexpected\/missing review values/);
});
test('every local Markdown cross reference in the available documentation resolves to a UI section', () => {
  assert.ok(documents.length >= 30);
  const broken = [];
  for (const document of documents) {
    const content = fs.readFileSync(path.join(root, document.sourcePath), 'utf8');
    for (const match of content.matchAll(/\[[^\]]+\]\(([^\s)]+\.md(?:#[^\s)]*)?)\)/g)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(match[1])) continue;
      if (!resolveDocumentLink(match[1], {...context, sourcePath: document.sourcePath})) broken.push(`${document.sourcePath}: ${match[1]}`);
    }
  }
  assert.deepEqual(broken, []);
});
