import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {runMRStage} from '../src/mr-service.ts';

test('runMRStage creates MR and completes when pipeline is green', async () => {
 const calls: string[] = [];
 const mrApiCalls: any[] = [];
 let pipelineQueried = 0;

 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname.endsWith('/merge_requests') && req.method === 'GET') {
   return res.end(JSON.stringify([]));
  }
  if (url.pathname.endsWith('/merge_requests') && req.method === 'POST') {
   return res.end(JSON.stringify({
    id: 10,
    iid: 3,
    title: 'feat: Test task',
    web_url: 'https://gitlab.example.test/group/project/-/merge_requests/3',
    source_branch: 'specboard/t1',
    target_branch: 'main',
    state: 'opened'
   }));
  }
  if (url.pathname.endsWith('/pipelines')) {
   pipelineQueried++;
   return res.end(JSON.stringify([{
    id: 88,
    iid: 5,
    status: 'success',
    ref: 'specboard/t1',
    sha: '11223344',
    web_url: 'https://gitlab.example.test/pipelines/88'
   }]));
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't1',
   description: 'Test task',
   repositoryUrl: `http://127.0.0.1:${port}/group/project.git`,
   defaultBranch: 'main',
   token: 'secret',
   git: async (args: string[]) => {
    calls.push(args.join(' '));
    if (args.includes('status')) return '';
    return {stdout: ''};
   },
   call: async (path: string, body?: any) => {
    mrApiCalls.push({path, body});
    return {saved: true};
   },
   pollIntervalMs: 50
  });

  assert.equal(result.mr.iid, 3);
  assert.equal(result.pipeline?.status, 'success');
  assert.equal(result.validation[0].exitCode, 0);
  assert.ok(calls.some(c => c.includes('push')));
  assert.ok(mrApiCalls.some(c => c.path === 'mr' && c.body.mrIid === 3));
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('runMRStage diagnoses failed CI job, prompts session for fix, pushes and reaches green', async () => {
 let pipelineRound = 1;
 const gitCalls: string[] = [];
 let sessionPrompted = false;
 let mockWorkingTreeDirty = false;

 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname.endsWith('/merge_requests')) {
   if (req.method === 'GET') {
    return res.end(JSON.stringify([{
     id: 20,
     iid: 7,
     title: 'feat: Fix CI',
     web_url: 'https://gitlab.example.test/group/project/-/merge_requests/7',
     source_branch: 'specboard/t2',
     target_branch: 'main',
     state: 'opened'
    }]));
   }
   return res.end(JSON.stringify({
    id: 20,
    iid: 7,
    title: 'feat: Fix CI',
    web_url: 'https://gitlab.example.test/group/project/-/merge_requests/7',
    source_branch: 'specboard/t2',
    target_branch: 'main',
    state: 'opened'
   }));
  }

  if (url.pathname.endsWith('/pipelines')) {
   return res.end(JSON.stringify([{
    id: pipelineRound === 1 ? 91 : 92,
    iid: pipelineRound,
    status: pipelineRound === 1 ? 'failed' : 'success',
    ref: 'specboard/t2',
    sha: '55667788',
    web_url: `https://gitlab.example.test/pipelines/${pipelineRound}`
   }]));
  }

  if (url.pathname.includes('/pipelines/') && url.pathname.endsWith('/jobs')) {
   return res.end(JSON.stringify([
    {id: 501, name: 'pytest', stage: 'test', status: 'failed'}
   ]));
  }

  if (url.pathname.endsWith('/trace')) {
   res.setHeader('content-type', 'text/plain');
   return res.end('FAILED tests/test_example.py::test_fail - AssertionError: 1 != 2');
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const session = {
   prompt: async (text: string) => {
    sessionPrompted = true;
    assert.match(text, /AssertionError: 1 != 2/);
    // Simulate agent fixing code
    mockWorkingTreeDirty = true;
   }
  };

  let pushCount = 0;
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't2',
   description: 'Fix CI',
   repositoryUrl: `http://127.0.0.1:${port}/group/project.git`,
   defaultBranch: 'main',
   token: 'secret',
   session: {
    prompt: async (text: string) => {
     sessionPrompted = true;
     assert.match(text, /AssertionError: 1 != 2/);
     mockWorkingTreeDirty = true;
    }
   },
   git: async (args: string[]) => {
    gitCalls.push(args.join(' '));
    if (args.includes('diff') && args.includes('--cached')) {
     if (mockWorkingTreeDirty) {
      mockWorkingTreeDirty = false;
      return 'test_example.py\n';
     }
     return '';
    }
    if (args.includes('push')) {
     pushCount++;
     if (pushCount > 1) pipelineRound = 2;
    }
    return {stdout: ''};
   },
   call: async () => ({saved: true}),
   pollIntervalMs: 50
  });
  assert.equal(sessionPrompted, true);
  assert.equal(result.pipeline?.status, 'success');
  assert.ok(gitCalls.some(c => c.includes('commit')));
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('runMRStage recognizes fixes committed directly by agent session and pushes to remote', async () => {
 let pipelineRound = 1;
 const gitCalls: string[] = [];

 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname.endsWith('/merge_requests')) {
   return res.end(JSON.stringify([{
    id: 30,
    iid: 12,
    title: 'feat: Agent direct commit',
    web_url: 'https://gitlab.example.test/group/project/-/merge_requests/12',
    source_branch: 'specboard/t-direct-commit',
    target_branch: 'main',
    state: 'opened'
   }]));
  }

  if (url.pathname.endsWith('/pipelines')) {
   return res.end(JSON.stringify([{
    id: pipelineRound === 1 ? 101 : 102,
    iid: pipelineRound,
    status: pipelineRound === 1 ? 'failed' : 'success',
    ref: 'specboard/t-direct-commit',
    sha: 'abcdef',
    web_url: `https://gitlab.example.test/pipelines/${pipelineRound}`
   }]));
  }

  if (url.pathname.endsWith('/jobs')) {
   return res.end(JSON.stringify([
    {id: 501, name: 'test_job', status: 'failed'}
   ]));
  }

  if (url.pathname.includes('/jobs/501/trace')) {
   return res.end('AssertionError: expected true');
  }

  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  let simulatedAgentCommitted = false;
  let pushCount = 0;
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't-direct-commit',
   description: 'Agent direct commit test',
   repositoryUrl: `http://127.0.0.1:${port}/group/project.git`,
   defaultBranch: 'main',
   token: 'secret',
   git: async (args: string[]) => {
    gitCalls.push(args.join(' '));
    // When session prompts, agent executes git commit directly
    if (args.includes('rev-list') && args.some(a => a.includes('t-direct-commit..HEAD'))) {
     return simulatedAgentCommitted ? '1\n' : '0\n';
    }
    // git diff --cached returns empty because agent already committed
    if (args.includes('diff') && args.includes('--cached')) {
     return '';
    }
    if (args.includes('push')) {
     pushCount++;
     if (pushCount > 1) pipelineRound = 2;
    }
    return {stdout: ''};
   },
   call: async () => ({saved: true}),
   session: {
    prompt: async () => {
     simulatedAgentCommitted = true;
    }
   },
   pollIntervalMs: 10,
   discoveryTimeoutMs: 100,
   discoveryPollIntervalMs: 10
  });

  assert.equal(result.mr.iid, 12);
  assert.equal(result.pipeline?.status, 'success');
  // Verified that push was triggered after agent direct commit
  assert.ok(gitCalls.filter(c => c.includes('push')).length >= 2);
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('runMRStage amends existing commit when branch has prior commits (squash commit)', async () => {
 const gitCalls: string[] = [];
 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname.endsWith('/merge_requests') && req.method === 'GET') {
   return res.end(JSON.stringify([{
    id: 30,
    iid: 9,
    title: 'feat: Clean pyc',
    web_url: 'https://gitlab.example.test/group/project/-/merge_requests/9',
    source_branch: 'specboard/t3',
    target_branch: 'main',
    state: 'opened'
   }]));
  }
  if (url.pathname.endsWith('/pipelines')) {
   return res.end(JSON.stringify([{
    id: 99,
    iid: 6,
    status: 'success',
    ref: 'specboard/t3',
    sha: '55667788',
    web_url: 'https://gitlab.example.test/pipelines/99'
   }]));
  }
  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't3',
   description: 'Clean pyc and update .gitignore',
   repositoryUrl: `http://127.0.0.1:${port}/group/project.git`,
   defaultBranch: 'main',
   token: 'secret',
   git: async (args: string[]) => {
    gitCalls.push(args.join(' '));
    if (args.includes('diff') && args.includes('--cached')) {
     return '.gitignore\n';
    }
    if (args.includes('rev-list')) {
     return '1\n'; // Branch already has 1 commit
    }
    return {stdout: ''};
   },
   call: async () => ({saved: true}),
   pollIntervalMs: 50
  });

  assert.equal(result.mr.iid, 9);
  assert.equal(result.pipeline?.status, 'success');
  assert.ok(gitCalls.some(c => c.includes('commit --amend --no-edit')), 'should amend to maintain single commit per MR');
  assert.ok(gitCalls.some(c => c.includes('push -f')), 'should force push amended branch');
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('runMRStage strips openspec directory from commit when origin does not track it', async () => {
 const gitCalls: string[] = [];
 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname.endsWith('/merge_requests')) {
   return res.end(JSON.stringify([{
    id: 40,
    iid: 12,
    title: 'feat: Strip openspec',
    web_url: 'https://gitlab.example.test/group/project/-/merge_requests/12',
    source_branch: 'specboard/t4',
    target_branch: 'main',
    state: 'opened'
   }]));
  }
  if (url.pathname.endsWith('/pipelines')) {
   return res.end(JSON.stringify([{
    id: 101,
    iid: 8,
    status: 'success',
    ref: 'specboard/t4',
    sha: 'aabbccdd',
    web_url: 'https://gitlab.example.test/pipelines/101'
   }]));
  }
  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't4',
   description: 'Strip openspec asset',
   repositoryUrl: `http://127.0.0.1:${port}/group/project.git`,
   defaultBranch: 'main',
   token: 'secret',
   git: async (args: string[]) => {
    gitCalls.push(args.join(' '));
    if (args.includes('cat-file') && args.includes('origin/main:openspec')) {
     throw new Error('fatal: Not a valid object name origin/main:openspec');
    }
    if (args.includes('cat-file') && args.includes('HEAD:openspec')) {
     return {stdout: 'tree 12345'};
    }
    if (args.includes('diff') && args.includes('--cached')) {
     return 'src/feature.ts\n';
    }
    return {stdout: ''};
   },
   call: async () => ({saved: true}),
   pollIntervalMs: 50
  });

  assert.equal(result.mr.iid, 12);
  assert.equal(result.pipeline?.status, 'success');
  assert.ok(gitCalls.some(c => c.includes('reset openspec')), 'should reset staged openspec files');
  assert.ok(gitCalls.some(c => c.includes('rm -r --cached openspec')), 'should remove committed openspec from git index');
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('runMRStage retains openspec directory in commit when origin already tracks it', async () => {
 const gitCalls: string[] = [];
 const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  res.setHeader('content-type', 'application/json');

  if (url.pathname.endsWith('/merge_requests')) {
   return res.end(JSON.stringify([{
    id: 50,
    iid: 15,
    title: 'feat: Keep openspec',
    web_url: 'https://gitlab.example.test/group/project/-/merge_requests/15',
    source_branch: 'specboard/t5',
    target_branch: 'main',
    state: 'opened'
   }]));
  }
  if (url.pathname.endsWith('/pipelines')) {
   return res.end(JSON.stringify([{
    id: 102,
    iid: 9,
    status: 'success',
    ref: 'specboard/t5',
    sha: 'ccddeeff',
    web_url: 'https://gitlab.example.test/pipelines/102'
   }]));
  }
  res.statusCode = 404;
  res.end('{}');
 });

 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = (server.address() as any).port;
 try {
  const result = await runMRStage({
   cwd: '/tmp',
   taskId: 't5',
   description: 'Keep openspec asset',
   repositoryUrl: `http://127.0.0.1:${port}/group/project.git`,
   defaultBranch: 'main',
   token: 'secret',
   git: async (args: string[]) => {
    gitCalls.push(args.join(' '));
    // Upstream default branch DOES track openspec
    if (args.includes('cat-file') && args.includes('origin/main:openspec')) {
     return {stdout: 'tree 67890'};
    }
    if (args.includes('diff') && args.includes('--cached')) {
     return 'openspec/specs/feature/spec.md\n';
    }
    return {stdout: ''};
   },
   call: async () => ({saved: true}),
   pollIntervalMs: 50
  });

  assert.equal(result.mr.iid, 15);
  assert.equal(result.pipeline?.status, 'success');
  assert.ok(!gitCalls.some(c => c.includes('reset openspec')), 'should NOT reset openspec when origin tracks it');
  assert.ok(!gitCalls.some(c => c.includes('rm -r --cached openspec')), 'should NOT remove openspec from git index');
 } finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});

test('extractMeaningfulErrorTrace captures core errors and excludes runner post-cleanup noise', async () => {
 const {extractMeaningfulErrorTrace} = await import('../src/mr-service.ts');

 // 1. MSVC error followed by noisy cleanup
 const msvcRaw = [
  'Generating done (0.2s)',
  'Building CXX object CMakeFiles/RetroSSHLib.dir/src/ui/SettingsDrawerWidget.cpp.obj',
  'D:\\a\\retro-ssh\\src\\ui\\SettingsDrawerWidget.cpp(197): error C2039: \'saveProfile\': is not a member of \'ProfileManager\'',
  'D:\\a\\retro-ssh\\src\\backend/ProfileManager.h(48): note: see declaration of \'ProfileManager\'',
  'ninja: build stopped: subcommand failed.',
  '##[error]Process completed with exit code 1.',
  'Post job cleanup.',
  'git version 2.56.0.windows.2',
  'Temporarily overriding HOME',
  'Adding repository directory to the temporary git global config',
  'Cleaning up orphan processes',
  'Terminate orphan process: pid (1416)',
  '##[warning]Node.js 20 is deprecated.'
 ].join('\n');

 const msvcExtracted = extractMeaningfulErrorTrace(msvcRaw, 1000);
 assert.ok(msvcExtracted.includes('error C2039: \'saveProfile\''));
 assert.ok(msvcExtracted.includes('ninja: build stopped'));

 // 2. Clang / GCC error followed by runner cleanup
 const clangRaw = [
  '[ 34%] Building CXX object CMakeFiles/RetroSSHLib.dir/src/ui/QuickConnectDialog.cpp.o',
  '/Users/runner/work/src/ui/MainWindow.cpp:707:14: error: use of undeclared identifier \'m_profileTabBar\'',
  '        if (!m_profileTabBar || m_profileTabBar->count() == 0) {',
  '             ^',
  '5 errors generated.',
  'make[2]: *** [CMakeFiles/RetroSSHLib.dir/src/ui/MainWindow.cpp.o] Error 1',
  '##[error]Process completed with exit code 2.',
  'Post job cleanup.',
  'git config --global --add safe.directory',
  'Cleaning up orphan processes'
 ].join('\n');

 const clangExtracted = extractMeaningfulErrorTrace(clangRaw, 1000);
 assert.ok(clangExtracted.includes('error: use of undeclared identifier \'m_profileTabBar\''));

 // 3. Fallback when no explicit error marker
 const plainLog = 'line 1\nline 2\nline 3\nline 4\nline 5';
 assert.equal(extractMeaningfulErrorTrace(plainLog, 50), plainLog);
});

test('detectChangeType and renderMRDescription format type-specific MR titles and sections', async () => {
 const {detectChangeType, renderMRTitle, renderMRDescription} = await import('../src/mr-service.ts');

 // 1. Docs detection
 assert.equal(detectChangeType('更新系统参考文档与README'), 'docs');
 assert.equal(detectChangeType('update architecture notes', ['README.md', 'docs/guide.md']), 'docs');
 assert.equal(renderMRTitle('docs', '期望基于最新代码情况更新下readme.md和agents.md等等系统参考文档。'), 'docs: 期望基于最新代码情况更新下readme.md和agents.md等等系统参考文档。');
 const docsDesc = renderMRDescription({
  type: 'docs',
  description: '更新系统参考文档',
  taskId: 'task-doc-1',
  changedFiles: ['README.md', 'AGENTS.md'],
  defaultBranch: 'main',
  sourceBranch: 'specboard/task-doc-1'
 });
 assert.ok(docsDesc.includes('### 📖 文档更新说明'));
 assert.ok(docsDesc.includes('- `README.md`'));

 // 2. Fix detection
 assert.equal(detectChangeType('修复流水线测试报错及异常退出'), 'fix');
 assert.equal(renderMRTitle('fix', '修复会话断裂抛错'), 'fix: 修复会话断裂抛错');
 const fixDesc = renderMRDescription({
  type: 'fix',
  description: '修复会话断裂抛错',
  taskId: 'task-fix-1',
  changedFiles: ['src/agent-container.ts'],
  defaultBranch: 'main',
  sourceBranch: 'specboard/task-fix-1'
 });
 assert.ok(fixDesc.includes('### 🐛 问题修复说明'));

 // 3. Feat detection (default)
 assert.equal(detectChangeType('增加支持垃圾桶拖拽删除任务'), 'feat');
 assert.equal(renderMRTitle('feat', 'feat: 增加支持垃圾桶拖拽删除任务'), 'feat: 增加支持垃圾桶拖拽删除任务');
 const featDesc = renderMRDescription({
  type: 'feat',
  description: '增加垃圾桶拖拽删除',
  taskId: 'task-feat-1',
  changedFiles: ['src/runtime-api.ts', 'public/app.js'],
  defaultBranch: 'main',
  sourceBranch: 'specboard/task-feat-1'
 });
 assert.ok(featDesc.includes('### ✨ 功能特性说明'));
});
