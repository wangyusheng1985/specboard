// PlantUML 64-bit character encoding helpers
function encode6bit(b) {
 if (b < 10) return String.fromCharCode(48 + b);
 b -= 10;
 if (b < 26) return String.fromCharCode(65 + b);
 b -= 26;
 if (b < 26) return String.fromCharCode(97 + b);
 b -= 26;
 if (b === 0) return '-';
 if (b === 1) return '_';
 return '?';
}

function append3bytes(b1, b2, b3) {
 const c1 = b1 >> 2;
 const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
 const c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
 const c4 = b3 & 0x3F;
 return encode6bit(c1 & 0x3F) + encode6bit(c2 & 0x3F) + encode6bit(c3 & 0x3F) + encode6bit(c4 & 0x3F);
}

function encode64(data) {
 let r = '';
 for (let i = 0; i < data.length; i += 3) {
  if (i + 2 === data.length) {
   r += append3bytes(data[i], data[i + 1], 0);
  } else if (i + 1 === data.length) {
   r += append3bytes(data[i], 0, 0);
  } else {
   r += append3bytes(data[i], data[i + 1], data[i + 2]);
  }
 }
 return r;
}

export async function encodePlantUML(text) {
 const cleanText = String(text || '').trim();
 const uml = cleanText.startsWith('@startuml') ? cleanText : `@startuml\n${cleanText}\n@enduml`;
 try {
  if (typeof CompressionStream !== 'undefined') {
   const stream = new Blob([uml]).stream().pipeThrough(new CompressionStream('deflate-raw'));
   const buffer = await new Response(stream).arrayBuffer();
   return '~1' + encode64(new Uint8Array(buffer));
  }
 } catch {
  /* CompressionStream fallback */
 }
 return null;
}

function parseTableAlignments(sepLine) {
 const parts = sepLine.split('|').map(s => s.trim()).filter((s, idx, arr) => {
  // If line starts/ends with |, first/last might be empty
  if ((idx === 0 || idx === arr.length - 1) && s === '') return false;
  return true;
 });
 return parts.map(part => {
  const left = part.startsWith(':'), right = part.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return '';
 });
}

function parseTableRowCells(line) {
 const cells = [];
 let current = '', inCode = false;
 for (let i = 0; i < line.length; i++) {
  const ch = line[i];
  if (ch === '`') inCode = !inCode;
  if (ch === '|' && !inCode) {
   cells.push(current.trim());
   current = '';
  } else {
   current += ch;
  }
 }
 cells.push(current.trim());
 if (line.trim().startsWith('|') && cells.length > 0 && cells[0] === '') cells.shift();
 if (line.trim().endsWith('|') && cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
 return cells;
}

function isTableDelimiter(line) {
 const trimmed = line.trim();
 if (!trimmed.includes('|')) return false;
 return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(trimmed);
}

// Render a robust Markdown subset including tables and PlantUML diagrams using DOM text nodes only.
export function markdown(text) {
 const root = document.createElement('div');
 root.className = 'markdown';
 let code = null, codeLang = '', list = null;

 const inline = (node, value) => {
  for (const part of String(value || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
   const tag = part.startsWith('**') ? 'strong' : part.startsWith('`') ? 'code' : null;
   if (tag) {
    const child = document.createElement(tag);
    child.textContent = part.slice(tag === 'strong' ? 2 : 1, tag === 'strong' ? -2 : -1);
    node.append(child);
   } else {
    node.append(document.createTextNode(part));
   }
  }
 };

 const lines = String(text || '').split('\n');
 let i = 0;

 while (i < lines.length) {
  const line = lines[i];

  // 1. Code blocks (```lang ... ```)
  if (line.startsWith('```')) {
   if (code) {
    // End of code block
    const lang = codeLang.toLowerCase();
    const rawContent = code.textContent || '';
    if (lang === 'plantuml' || (lang === '' && rawContent.includes('@startuml'))) {
     const diagramCard = document.createElement('div');
     diagramCard.className = 'diagram-card';

     const header = document.createElement('div');
     header.className = 'diagram-header';
     const title = document.createElement('span');
     title.className = 'diagram-title';
     title.textContent = 'PlantUML 架构图';
     header.append(title);

     const btnToggle = document.createElement('button');
     btnToggle.type = 'button';
     btnToggle.className = 'diagram-toggle-btn';
     btnToggle.textContent = '查看源码';
     header.append(btnToggle);
     diagramCard.append(header);

     const previewBox = document.createElement('div');
     previewBox.className = 'diagram-preview';

     const loadingEl = document.createElement('div');
     loadingEl.className = 'diagram-loading';
     loadingEl.textContent = '正在渲染架构图…';
     previewBox.append(loadingEl);

     const preEl = document.createElement('pre');
     preEl.className = 'diagram-source';
     preEl.style.display = 'none';
     const codeEl = document.createElement('code');
     codeEl.textContent = rawContent;
     preEl.append(codeEl);

     diagramCard.append(previewBox, preEl);
     root.append(diagramCard);

     btnToggle.onclick = () => {
      const showSource = preEl.style.display === 'none';
      preEl.style.display = showSource ? 'block' : 'none';
      previewBox.style.display = showSource ? 'none' : 'block';
      btnToggle.textContent = showSource ? '查看图表' : '查看源码';
     };

     // Asynchronously encode and load PlantUML SVG
     encodePlantUML(rawContent).then(encoded => {
      if (!encoded) {
       loadingEl.textContent = '图表预览未就绪（支持点击查看源码）';
       return;
      }
      const img = document.createElement('img');
      img.alt = 'PlantUML Diagram';
      img.className = 'diagram-img';
      img.onload = () => {
       previewBox.replaceChildren(img);
      };
      img.onerror = () => {
       loadingEl.textContent = '图表渲染服务暂不可达（可切换查看源码）';
      };
      img.src = `https://www.plantuml.com/plantuml/svg/${encoded}`;
     }).catch(() => {
      loadingEl.textContent = '图表解析失败';
     });
    } else {
     const pre = document.createElement('pre');
     pre.append(code);
     root.append(pre);
    }
    code = null;
    codeLang = '';
   } else {
    // Start of code block
    codeLang = line.slice(3).trim();
    code = document.createElement('code');
   }
   list = null;
   i++;
   continue;
  }

  if (code) {
   code.append(document.createTextNode(line + '\n'));
   i++;
   continue;
  }

  // 2. Check for Table beginning (current line has |, next line is delimiter)
  if (line.includes('|') && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
   list = null;
   const headerLine = line;
   const delimLine = lines[i + 1];
   const alignments = parseTableAlignments(delimLine);
   const headerCells = parseTableRowCells(headerLine);

   const tableWrapper = document.createElement('div');
   tableWrapper.className = 'table-wrapper';
   const table = document.createElement('table');
   table.className = 'markdown-table';

   const thead = document.createElement('thead');
   const headerTr = document.createElement('tr');
   headerCells.forEach((cellText, colIdx) => {
    const th = document.createElement('th');
    if (alignments[colIdx]) th.style.textAlign = alignments[colIdx];
    inline(th, cellText);
    headerTr.append(th);
   });
   thead.append(headerTr);
   table.append(thead);

   const tbody = document.createElement('tbody');
   i += 2; // Skip header and delimiter

   while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
    const rowCells = parseTableRowCells(lines[i]);
    const tr = document.createElement('tr');
    rowCells.forEach((cellText, colIdx) => {
     const td = document.createElement('td');
     if (alignments[colIdx]) td.style.textAlign = alignments[colIdx];
     inline(td, cellText);
     tr.append(td);
    });
    tbody.append(tr);
    i++;
   }
   table.append(tbody);
   tableWrapper.append(table);
   root.append(tableWrapper);
   continue;
  }

  // 3. Lists (- item, * item, 1. item)
  const item = line.match(/^\s*([-*]|\d+\.)\s+(.+)/);
  if (item) {
   const tag = /\d/.test(item[1]) ? 'ol' : 'ul';
   if (!list || list.tagName.toLowerCase() !== tag) {
    list = document.createElement(tag);
    root.append(list);
   }
   const li = document.createElement('li');
   inline(li, item[2]);
   list.append(li);
   i++;
   continue;
  }
  list = null;

  // 4. Empty lines
  if (!line.trim()) {
   i++;
   continue;
  }

  // 5. Headings, blockquotes, paragraphs
  const heading = line.match(/^(#{1,6})\s+(.+)/);
  const quote = line.match(/^>\s?(.*)/);
  const node = document.createElement(
   heading ? 'h' + Math.min(6, heading[1].length + 1) : quote ? 'blockquote' : 'p'
  );
  inline(node, heading ? heading[2] : quote ? quote[1] : line);
  root.append(node);
  i++;
 }

 // An unclosed code fence must not swallow the rest of the message. Render
 // the remaining lines as markdown instead of dropping them from the DOM.
 if (code) {
  const fallback = markdown(code.textContent || '');
  const nodes = fallback.childNodes ? Array.from(fallback.childNodes) : (fallback.children || []);
  root.append(...nodes);
 }

 return root;
}
