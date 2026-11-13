import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markdown, encodePlantUML} from '../public/markdown.js';

// Setup minimal DOM environment for node test
class FakeNode {
 textContent = '';
 children: FakeNode[] = [];
 style: Record<string, string> = {};
 className = '';
 tagName = 'DIV';
 type = '';

 append(...nodes: (FakeNode | string)[]) {
  for (const n of nodes) {
   if (typeof n === 'string') {
    const textNode = new FakeNode();
    textNode.textContent = n;
    this.children.push(textNode);
    this.textContent += n;
   } else if (n instanceof FakeNode) {
    this.children.push(n);
    this.textContent += (n.children.length > 0 ? n.getText() : n.textContent);
   }
  }
 }

 replaceChildren(...nodes: (FakeNode | string)[]) {
  this.children = [];
  this.textContent = '';
  this.append(...nodes);
 }

 getText(): string {
  if (this.children.length === 0) return this.textContent;
  return this.children.map(c => c.getText()).join('');
 }
}

globalThis.document = {
 createElement(tag: string) {
  const node = new FakeNode();
  node.tagName = tag.toUpperCase();
  return node as any;
 },
 createTextNode(text: string) {
  const node = new FakeNode();
  node.textContent = String(text);
  return node as any;
 }
} as any;

test('markdown parses paragraphs, headings and lists', () => {
 const text = '# Title\nParagraph text with **bold** and `code`.\n- Item 1\n- Item 2';
 const root = markdown(text) as any;
 assert.equal(root.className, 'markdown');
 const fullText = root.getText();
 assert.ok(fullText.includes('Title'));
 assert.ok(fullText.includes('bold'));
 assert.ok(fullText.includes('Item 1'));
});

test('markdown parses GFM tables with header, alignment and rows', () => {
 const tableMd = [
  '| 产品 | 风格 | 评级 |',
  '| :--- | :---: | ---: |',
  '| **Termius** | 现代深色 | `A+` |',
  '| Warp | 极简终端 | A |'
 ].join('\n');

 const root = markdown(tableMd) as any;
 const tableWrapper = root.children.find((c: any) => c.className === 'table-wrapper');
 assert.ok(tableWrapper, 'table-wrapper should be generated');
 const table = tableWrapper.children.find((c: any) => c.tagName === 'TABLE');
 assert.ok(table, 'table element should exist');

 const thead = table.children.find((c: any) => c.tagName === 'THEAD');
 assert.ok(thead, 'thead should exist');
 const headerTr = thead.children[0];
 assert.equal(headerTr.children.length, 3);
 assert.equal(headerTr.children[0].textContent, '产品');
 assert.equal(headerTr.children[0].style.textAlign, 'left');
 assert.equal(headerTr.children[1].style.textAlign, 'center');
 assert.equal(headerTr.children[2].style.textAlign, 'right');

 const tbody = table.children.find((c: any) => c.tagName === 'TBODY');
 assert.ok(tbody, 'tbody should exist');
 assert.equal(tbody.children.length, 2, 'should have 2 data rows');
 assert.equal(tbody.children[0].children[0].textContent, 'Termius');
 assert.equal(tbody.children[0].children[2].textContent, 'A+');
});

test('markdown parses PlantUML code blocks into diagram card', () => {
 const plantUmlMd = [
  '```plantuml',
  '@startuml',
  'Alice -> Bob: Authentication Request',
  'Bob --> Alice: Authentication Response',
  '@enduml',
  '```'
 ].join('\n');

 const root = markdown(plantUmlMd) as any;
 const card = root.children.find((c: any) => c.className === 'diagram-card');
 assert.ok(card, 'diagram-card should be created for plantuml block');
 const header = card.children.find((c: any) => c.className === 'diagram-header');
 assert.ok(header, 'diagram-header should exist');
 const preview = card.children.find((c: any) => c.className === 'diagram-preview');
 assert.ok(preview, 'diagram-preview should exist');
 const source = card.children.find((c: any) => c.className === 'diagram-source');
 assert.ok(source, 'diagram-source pre block should exist');
 assert.ok(source.textContent.includes('Alice -> Bob'));
});

test('encodePlantUML compresses and encodes text correctly', async () => {
 const uml = '@startuml\nAlice -> Bob: Hello\n@enduml';
 const encoded = await encodePlantUML(uml);
 if (typeof CompressionStream !== 'undefined') {
  assert.ok(encoded?.startsWith('~1'), 'Should start with ~1');
 }
});

test('markdown preserves content after an unclosed code fence', () => {
 const source = '## 背景\n\n```html\n<span class="chip"><svg/></span>\n\n## 修改要求\n\n1. 修改 leavesByText\n2. 增加回归测试';
 const root = markdown(source) as any;
 const text = root.getText();
 assert.ok(text.includes('背景'));
 assert.ok(text.includes('修改要求'));
 assert.ok(text.includes('leavesByText'));
 assert.ok(text.includes('增加回归测试'));
});
