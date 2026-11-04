import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPrivateHost, cleanHtmlToMarkdown, fetchWebContent, performWebSearch} from '../src/web-tools.ts';

test('isPrivateHost identifies loopback and private networks', () => {
  assert.equal(isPrivateHost('localhost'), true);
  assert.equal(isPrivateHost('127.0.0.1'), true);
  assert.equal(isPrivateHost('10.0.0.1'), true);
  assert.equal(isPrivateHost('192.168.1.1'), true);
  assert.equal(isPrivateHost('172.16.0.1'), true);
  assert.equal(isPrivateHost('service.internal'), true);
  assert.equal(isPrivateHost('example.com'), false);
  assert.equal(isPrivateHost('github.com'), false);
});

test('cleanHtmlToMarkdown cleans tags and formats text properly', () => {
  const html = `
    <html>
      <head><script>alert(1)</script><style>body{color:red}</style></head>
      <body>
        <header>Header nav</header>
        <h1>Title Header</h1>
        <p>This is a paragraph with <a href="https://example.com">a link</a>.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
        <footer>Footer info</footer>
      </body>
    </html>
  `;
  const md = cleanHtmlToMarkdown(html);
  assert.ok(!md.includes('alert(1)'));
  assert.ok(!md.includes('color:red'));
  assert.ok(!md.includes('Header nav'));
  assert.ok(!md.includes('Footer info'));
  assert.ok(md.includes('# Title Header'));
  assert.ok(md.includes('[a link](https://example.com)'));
  assert.ok(md.includes('- Item 1'));
});

test('fetchWebContent rejects private hosts and invalid protocols', async () => {
  await assert.rejects(() => fetchWebContent('ftp://example.com'), /Only HTTP and HTTPS/);
  await assert.rejects(() => fetchWebContent('http://127.0.0.1:8080'), /Access to private\/local/);
  await assert.rejects(() => fetchWebContent('http://localhost/admin'), /Access to private\/local/);
});

test('performWebSearch handles empty query gracefully', async () => {
  const empty = await performWebSearch('');
  assert.deepEqual(empty, []);
});
