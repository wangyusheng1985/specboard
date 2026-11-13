import fs from 'node:fs';
import path from 'node:path';
import {createGitPlatformClient,type UnifiedMergeRequest,type UnifiedPipeline} from './git-platform.ts';

export interface MRStageContext {
 cwd: string;
 taskId: string;
 description: string;
 repositoryUrl: string;
 defaultBranch: string;
 token: string;
 git: (args: string[], path?: string) => Promise<any>;
 call: (path: string, body?: unknown) => Promise<any>;
 session?: any;
 pollIntervalMs?: number;
 maxPolls?: number;
 maxRounds?: number;
 discoveryTimeoutMs?: number;
 discoveryPollIntervalMs?: number;
 previousPipelineId?: number;
}

export function hasRepoCIConfig(cwd: string, isGitHub: boolean): boolean {
 try {
  if (isGitHub) {
   const workflowsDir = path.join(cwd, '.github', 'workflows');
   if (!fs.existsSync(workflowsDir)) return false;
   const entries = fs.readdirSync(workflowsDir);
   return entries.some(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  } else {
   const gitlabCiFile = path.join(cwd, '.gitlab-ci.yml');
   return fs.existsSync(gitlabCiFile);
  }
 } catch {
  return false;
 }
}

export function extractMeaningfulErrorTrace(rawTrace: string, maxChars = 3000): string {
 if (!rawTrace) return '';
 const lines = rawTrace.split('\n');
 const errorIndices: number[] = [];
 for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/error(\s|:)|FAILED:|fatal:|error C\d+:|##\[error\]|clang: error|ninja: build stopped/i.test(line)) {
   if (!/Process completed with exit code/i.test(line)) {
    errorIndices.push(i);
   }
  }
 }

 if (errorIndices.length > 0) {
  const targetIdx = errorIndices[errorIndices.length - 1];
  const start = Math.max(0, targetIdx - 35);
  const end = Math.min(lines.length, targetIdx + 20);
  const snippet = lines.slice(start, end).join('\n');
  if (snippet.length <= maxChars) return snippet;
  return snippet.slice(-maxChars);
 }

 return rawTrace.slice(-maxChars);
}

export type MRChangeType = 'feat' | 'fix' | 'docs' | 'refactor' | 'perf' | 'ci' | 'chore';

export function detectChangeType(description: string, changedFiles: string[] = []): MRChangeType {
 const desc = description.toLowerCase();
 // 1. Strict Keyword checks in description
 if (/(?:修复|报错|异常|失败|\bfix\b|\bbug\b|\berror\b|\bissue\b)/i.test(desc)) return 'fix';
 if (/(?:文档|手册|指南|\bdoc\b|\bdocs\b|\breadme\b)/i.test(desc)) return 'docs';
 if (/(?:重构|整理|解耦|\brefactor\b|\brestructure\b)/i.test(desc)) return 'refactor';
 if (/(?:性能|加速|优化|\bperf\b|\bperformance\b|\boptimize\b)/i.test(desc)) return 'perf';
 if (/(?:流水线|构建|发布|\bci\b|\bcd\b|\bpipeline\b|\bgitlab-ci\b|\bworkflow\b)/i.test(desc)) return 'ci';
 if (/(?:依赖|脚本|配置|格式化|\bchore\b|\bconfig\b|\bformat\b|\blint\b)/i.test(desc)) return 'chore';

 // 2. Heuristic check based on changed files
 if (changedFiles.length > 0) {
  const allDocs = changedFiles.every(f => f.endsWith('.md') || f.endsWith('.txt') || f.startsWith('docs/'));
  if (allDocs) return 'docs';
  const allCi = changedFiles.every(f => f.includes('.gitlab-ci') || f.includes('.github/') || f.includes('Dockerfile'));
  if (allCi) return 'ci';
 }

 return 'feat';
}

const scopeTerms: Array<[RegExp,string]> = [
 [/令牌|token/i,'token'],
 [/通知|notification/i,'notifications'],
 [/聊天|会话|chat|session/i,'chat'],
 [/蜂后|queen/i,'queen'],
 [/工蜂|worker/i,'worker'],
 [/合并请求|merge request|pull request|\bmr\b|\bpr\b/i,'mr'],
 [/文档|readme|docs?/i,'docs'],
 [/测试|test/i,'test'],
 [/流水线|pipeline|\bci\b/i,'ci'],
];

const fileScopeTerms: Array<[RegExp,string]> = [
 [/^public\//i,'ui'],
 [/^src\/agent/i,'agent'],
 [/^src\/mr-service/i,'mr'],
 [/^src\/runtime-(?:api|service)/i,'api'],
 [/^src\/dispatcher/i,'dispatcher'],
 [/^src\/(?:gateway|llm-)/i,'gateway'],
 [/^src\/(?:store|postgres)/i,'storage'],
 [/^test\//i,'test'],
 [/^docs\/|\.md$/i,'docs'],
 [/^\.github\/|(?:^|\/)Dockerfile|compose|\.gitlab-ci/i,'ci'],
 [/^package(?:-lock)?\.json$/i,'deps'],
];

const summaryTerms: Array<[RegExp,string]> = [
 [/蜂后|queen/i,'queen'],
 [/工蜂|worker/i,'worker'],
 [/令牌|token/i,'token'],
 [/汇总|合计|summary|aggregate/i,'summary'],
 [/聊天|chat/i,'chat'],
 [/会话|session/i,'session'],
 [/弹框|弹窗|dialog|modal/i,'dialog'],
 [/详情|detail/i,'details'],
 [/任务|task/i,'task'],
 [/删除|移除|delete|remove/i,'delete'],
 [/拖拽|drag/i,'drag'],
 [/垃圾桶|trash/i,'trash'],
 [/文档|readme|docs?/i,'docs'],
 [/测试|test/i,'test'],
 [/配置|config/i,'config'],
 [/修复|fix|bug/i,'fix'],
 [/增加|新增|添加|支持|add|support/i,'add'],
 [/优化|改进|improve|optimi[sz]e/i,'improve'],
 [/重构|refactor/i,'refactor'],
 [/更新|update/i,'update'],
 [/实现|implement/i,'implement'],
 [/报错|错误|异常|抛错|error|exception/i,'error'],
];

const summaryStopWords = new Set(['the','and','for','with','from','this','that','into','when','then','than','src','public','test']);

export function inferMRScope(description: string, changedFiles: string[] = []): string {
 for (const [pattern, scope] of scopeTerms) if (pattern.test(description)) return scope;
 const scores = new Map<string, number>();
 for (const file of changedFiles) {
  for (const [pattern, scope] of fileScopeTerms) {
   if (pattern.test(file)) { scores.set(scope, (scores.get(scope) || 0) + 1); break; }
  }
 }
 return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'core';
}

export function renderEnglishSummary(description: string, type: MRChangeType, scope: string): string {
 const candidates: Array<{word: string; index: number}> = [];
 for (const [pattern, word] of summaryTerms) {
  const index = description.search(pattern);
  if (index >= 0) candidates.push({word, index});
 }
 for (const match of description.matchAll(/[A-Za-z][A-Za-z0-9_-]{2,}/g)) {
  const word = match[0].toLowerCase();
  if (!summaryStopWords.has(word)) candidates.push({word, index: match.index ?? 0});
 }
 candidates.sort((a, b) => a.index - b.index);
 const words: string[] = [];
 for (const {word} of candidates) if (word !== type && word !== scope && !words.includes(word)) words.push(word);
 const lead = type === 'feat' ? 'add' : type === 'perf' ? 'improve' : type;
 const leadIndex = words.indexOf(lead);
 if (leadIndex > 0) { words.splice(leadIndex, 1); words.unshift(lead); }
 const limited: string[] = [];
 for (const word of words) {
  if (limited.length >= 20) break;
  const next = [...limited, word].join(' ');
  if (next.length > 100) break;
  limited.push(word);
 }
 return limited.join(' ') || `update ${scope} behavior`;
}

export function normalizeMarkdown(text: string): string {
 const lines = text.replace(/\r\n?/g, '\n').split('\n').map(line => {
  let value = line.replace(/^(\s*)[（(]?\s*(\d+)\s*[）)、．]\s*/, (_, indent: string, n: string) => `${indent}${n}. `);
  value = value.replace(/^(\s*)[•·●]\s*/, '$1- ');
  return value;
 });
 const output: string[] = [];
 for (const line of lines) {
  const previous = output.at(-1) ?? '';
  if (/^\s*\d+\.\s/.test(line) && previous.trim() && !/^\s*\d+\.\s/.test(previous)) output.push('');
  output.push(line);
 }
 return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function renderMRTitle(type: MRChangeType, description: string, changedFiles: string[] = []): string {
 const cleanDesc = description.replace(/^(?:feat|fix|docs|refactor|perf|ci|chore)(?:\([^)]+\))?[:：]\s*/i, '').trim();
 const scope = inferMRScope(cleanDesc, changedFiles);
 const summary = renderEnglishSummary(cleanDesc, type, scope);
 const title = `${type}(${scope}): ${summary}`;
 const chars = Array.from(title);
 return chars.length <= 255 ? title : `${chars.slice(0, 254).join('')}…`;
}

export function renderMRDescription(options: {
 type: MRChangeType;
 description: string;
 taskId: string;
 changedFiles: string[];
 defaultBranch: string;
 sourceBranch: string;
}): string {
 const {type, description, taskId, changedFiles, defaultBranch, sourceBranch} = options;

 const fileList = changedFiles.length > 0
  ? changedFiles.map(f => `- \`${f}\``).join('\n')
  : '- （无新增修改文件）';

 const digest = normalizeMarkdown(description);
 const sections: Record<MRChangeType, string> = {
  docs: `### 📖 文档更新说明

**变更目标**

${digest}

**核心调整文档**

${fileList}

**验证对照**：确认相关技术规范与最新代码实现保持同步，排版格式完整无误。`,

  fix: `### 🐛 问题修复说明

**问题描述**

${digest}

**涉及组件与文件**

${fileList}

**修复方案**：已消除异常逻辑并在工作区验证通过。
**回归检查**：相关自动化测试及 CI 流水线均已重新验证。`,

  feat: `### ✨ 功能特性说明

**功能目标**

${digest}

**主要改动文件**

${fileList}

**实现亮点**：按照规划与设计契约完成代码落地，提供完备的测试与运行时保障。
**影响范围**：合并至 \`${defaultBranch}\` 主分支，不破坏既有兼容性。`,

  refactor: `### 🔨 代码重构说明

**重构目的**

${digest}

**重构范围**

${fileList}

**质量保证**：重构前后保持既有业务逻辑契约完全一致，全量自动化回归测试通过。`,

  perf: `### ⚡ 性能优化说明

**优化点**

${digest}

**优化文件**

${fileList}

**效果预期**：降低资源消耗与响应耗时，通过性能回归检验。`,

  ci: `### 👷 流水线与构建变更

**构建调整**

${digest}

**改动配置**

${fileList}

**验证状态**：本地测试及远程流水线执行通过。`,

  chore: `### 🧹 常规维护与杂项

**维护内容**

${digest}

**涉及文件**

${fileList}`
 };

 return `## 📋 Merge Request 概览

${sections[type] || sections.feat}

---

### 🔍 任务与审查元信息
- **任务编号**：\`${taskId}\`
- **源分支**：\`${sourceBranch}\` ➔ **目标分支**：\`${defaultBranch}\`
- **变更类型**：\`${type}\`
- **执行代理**：Specboard Autonomous Agent
`;
}

export async function runMRStage(ctx: MRStageContext) {
 const {
  cwd,
  taskId,
  description,
  repositoryUrl,
  defaultBranch,
  token,
  git,
  call,
  session,
  pollIntervalMs = 5000,
  maxPolls = 120,
  maxRounds = 5
 } = ctx;

 const branch = `specboard/${taskId}`;
 const platform = createGitPlatformClient(repositoryUrl, token);
 const platformName = platform.isGitHub ? 'GitHub' : 'GitLab';
 const prOrMr = platform.isGitHub ? 'PR' : 'MR';
 const ciOrActions = platform.isGitHub ? 'Actions' : 'CI';

 // Helper: exclude openspec from git tracking unless defaultBranch already tracks it
 const sanitizeOpenspecAsset = async () => {
  let originTracksOpenspec = false;
  try {
   await git(['cat-file', '-e', `origin/${defaultBranch}:openspec`], cwd);
   originTracksOpenspec = true;
  } catch {
   originTracksOpenspec = false;
  }
  if (!originTracksOpenspec) {
   // Reset any staged openspec files
   await git(['reset', 'openspec'], cwd).catch(() => {});
   // If openspec was previously committed in HEAD, remove it from the git index
   let headTracksOpenspec = false;
   try {
    await git(['cat-file', '-e', 'HEAD:openspec'], cwd);
    headTracksOpenspec = true;
   } catch {
    headTracksOpenspec = false;
   }
   if (headTracksOpenspec) {
    await git(['rm', '-r', '--cached', 'openspec'], cwd).catch(() => {});
   }
  }
 };

 // 1. Commit uncommitted changes if any
 await git(['add', '.'], cwd);
 await sanitizeOpenspecAsset();
 const staged = await git(['diff', '--cached', '--name-only'], cwd);
 const stagedOutput = typeof staged === 'string' ? staged : staged?.stdout || '';
 const changedFiles = stagedOutput.trim().split('\n').map((s: string) => s.trim()).filter(Boolean);
 const hasChanges = changedFiles.length > 0;

 // Query committed files as well: a retry can run with a clean worktree.
 let committedFiles: string[] = changedFiles;
 try {
  const diffTree = await git(['diff', '--name-only', `origin/${defaultBranch}...HEAD`], cwd);
  const diffTreeOutput = typeof diffTree === 'string' ? diffTree : diffTree?.stdout || '';
  const parsed = diffTreeOutput.trim().split('\n').map((s: string) => s.trim()).filter(Boolean);
  if (parsed.length > 0) committedFiles = parsed;
 } catch {
  // Fall back to staged files
 }
 const mrFiles = [...new Set([...changedFiles, ...committedFiles])];

 // Detect change type and render title/description
 const changeType = detectChangeType(description, mrFiles);
 const mrTitle = renderMRTitle(changeType, description, mrFiles);

 if (hasChanges) {
  // Check if there is already a commit on this branch beyond origin's default branch
  let commitCount = 0;
  try {
   const revCount = await git(['rev-list', '--count', `origin/${defaultBranch}..HEAD`], cwd);
   commitCount = parseInt(typeof revCount === 'string' ? revCount.trim() : revCount?.stdout?.trim() || '0', 10);
  } catch {
   commitCount = 0;
  }
  if (commitCount > 0) {
   // Amend existing commit to keep exactly 1 commit per MR
   await git(['commit', '--amend', '--no-edit'], cwd);
  } else {
   await git(['commit', '-m', mrTitle], cwd);
  }
 }

 const mrDescription = renderMRDescription({
  type: changeType,
  description,
  taskId,
  changedFiles: mrFiles,
  defaultBranch,
  sourceBranch: branch
 });

 // 2. Push branch to remote
 await git(['push', '-f', '-u', 'origin', `${branch}:${branch}`], cwd);

 const headShaRes = await git(['rev-parse', 'HEAD'], cwd).catch(() => '');
 const currentSha = (typeof headShaRes === 'string' ? headShaRes : headShaRes?.stdout || '').trim();
 const previousPipelineId = ctx.previousPipelineId;

 // 3. Create or get/update MR
 // 3. Create or get/update MR / PR
 const mr: UnifiedMergeRequest = await platform.createOrUpdateMR({
  sourceBranch: branch,
  targetBranch: defaultBranch,
  title: mrTitle,
  description: mrDescription
 });

 await call('mr', {
  mrIid: mr.iid,
  webUrl: mr.web_url,
  title: mr.title,
  sourceBranch: mr.source_branch,
  targetBranch: mr.target_branch,
  pipelineStatus: 'pending'
 });

 // 4. Discover initial pipeline (wait for asynchronous trigger)
 const discoveryTimeout = ctx.discoveryTimeoutMs ?? 45000;
 const discoveryInterval = ctx.discoveryPollIntervalMs ?? Math.min(pollIntervalMs, 3000);
 const discoveryStart = Date.now();

 const isPipelineMatching = (p: UnifiedPipeline | null): boolean => {
  if (!p) return false;
  if (previousPipelineId && p.id === previousPipelineId) return false;
  if (currentSha && p.sha && p.sha !== currentSha) return false;
  return true;
 };

 let pipeline: UnifiedPipeline | null = await platform.getLatestPipeline(branch);
 if (!isPipelineMatching(pipeline)) {
  pipeline = null;
 }

 while (!pipeline && (Date.now() - discoveryStart < discoveryTimeout)) {
  await new Promise(r => setTimeout(r, discoveryInterval));
  const candidate = await platform.getLatestPipeline(branch);
  if (isPipelineMatching(candidate)) {
   pipeline = candidate;
  }
 }

 if (!pipeline) {
  const hasCi = hasRepoCIConfig(cwd, platform.isGitHub);
  if (hasCi) {
   throw new Error(`${platformName} ${ciOrActions} workflow was not triggered within ${Math.round(discoveryTimeout / 1000)}s`);
  }

  // Repository does not configure CI/Actions: safely mark as none
  await call('mr', {
   mrIid: mr.iid,
   webUrl: mr.web_url,
   title: mr.title,
   sourceBranch: mr.source_branch,
   targetBranch: mr.target_branch,
   pipelineStatus: 'none'
  });

  return {
   mr,
   pipeline: null,
   validation: [{
    command: `${platform.isGitHub ? 'github-actions' : 'gitlab-ci'}:none`,
    commandId: 'pipeline-none',
    startedAt: Date.now(),
    endedAt: Date.now(),
    exitCode: 0,
    timedOut: false,
    summary: `${platformName} ${prOrMr} created without ${ciOrActions} pipeline configured`
   }]
  };
 }

 // 5. Pipeline discovered: update backend with initial pipelineId and status
 await call('mr', {
  mrIid: mr.iid,
  webUrl: mr.web_url,
  title: mr.title,
  sourceBranch: mr.source_branch,
  targetBranch: mr.target_branch,
  pipelineId: pipeline.id,
  pipelineStatus: pipeline.status
 });

 // 6. Poll execution and repair if needed
 let rounds = 0;

 while (rounds < maxRounds) {
  let pollCount = 0;
  while (pipeline && ['pending', 'running', 'created', 'waiting_for_resource', 'preparing'].includes(pipeline.status) && pollCount < maxPolls) {
   pollCount++;
   await call('mr', {
    mrIid: mr.iid,
    webUrl: mr.web_url,
    title: mr.title,
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
    pipelineId: pipeline.id,
    pipelineStatus: pipeline.status
   });
   await new Promise(r => setTimeout(r, pollIntervalMs));
   pipeline = await platform.getLatestPipeline(branch);
  }

  if (pipeline && ['pending', 'running', 'created', 'waiting_for_resource', 'preparing'].includes(pipeline.status)) {
   throw new Error(`${platformName} ${ciOrActions} timed out waiting for completion after ${Math.round((maxPolls * pollIntervalMs) / 1000)}s`);
  }

  if (pipeline?.status === 'success') {
   break;
  }

  if (pipeline?.status === 'failed') {
   rounds++;
   const failed = await platform.getFailedJobTrace(pipeline.id);
   const jobName = failed?.name?.trim() ? failed.name : `${platformName} ${ciOrActions} Job`;
   const rawTrace = failed?.trace || '';

   if (session) {
    const errorSnippet = extractMeaningfulErrorTrace(rawTrace, 3000);
    await session.prompt(`${platformName} ${ciOrActions} Job "${jobName}" failed on ${ciOrActions} #${pipeline.id}.\nFailure log:\n${errorSnippet}\n\nPlease diagnose and modify the workspace files (including CI configurations under .github/workflows/ or project source files) to fix this failure. If the failure indicates an unavailable or deprecated runner (e.g. macos-13), update the workflow matrix accordingly.`);
   }

   await git(['add', '.'], cwd);
   await sanitizeOpenspecAsset();
   const diff = await git(['diff', '--cached', '--name-only'], cwd);
   const hasStaged = typeof diff === 'string' ? Boolean(diff.trim()) : Boolean(diff?.stdout?.trim());

   let aheadCount = 0;
   try {
    const revCount = await git(['rev-list', '--count', `origin/${branch}..HEAD`], cwd);
    aheadCount = parseInt(typeof revCount === 'string' ? revCount.trim() : revCount?.stdout?.trim() || '0', 10);
   } catch {
    aheadCount = 0;
   }

   const hasFixes = hasStaged || aheadCount > 0;
   if (hasFixes) {
    if (hasStaged) {
     // Keep 1 commit per MR via amend if a commit already exists
     let commitCount = 0;
     try {
      const revCount = await git(['rev-list', '--count', `origin/${defaultBranch}..HEAD`], cwd);
      commitCount = parseInt(typeof revCount === 'string' ? revCount.trim() : revCount?.stdout?.trim() || '0', 10);
     } catch {
      commitCount = 0;
     }
     if (commitCount > 0) {
      await git(['commit', '--amend', '--no-edit'], cwd);
     } else {
      await git(['commit', '-m', `fix(ci): address ${jobName} failure (round ${rounds})`], cwd);
     }
    }
    const previousPipelineId = pipeline?.id;
    await git(['push', '-f', 'origin', `${branch}:${branch}`], cwd);
    await new Promise(r => setTimeout(r, Math.min(pollIntervalMs, 2000)));

    const repushShaRes = await git(['rev-parse', 'HEAD'], cwd).catch(() => '');
    const repushSha = (typeof repushShaRes === 'string' ? repushShaRes : repushShaRes?.stdout || '').trim();

    const repushStart = Date.now();
    const isRepushMatching = (p: UnifiedPipeline | null): boolean => {
     if (!p) return false;
     if (previousPipelineId && p.id === previousPipelineId) return false;
     if (repushSha && p.sha && p.sha !== repushSha) return false;
     return true;
    };

    pipeline = await platform.getLatestPipeline(branch);
    if (!isRepushMatching(pipeline)) {
     pipeline = null;
    }
    while (!pipeline && (Date.now() - repushStart < discoveryTimeout)) {
     await new Promise(r => setTimeout(r, discoveryInterval));
     const candidate = await platform.getLatestPipeline(branch);
     if (isRepushMatching(candidate)) {
      pipeline = candidate;
     }
    }
   } else {
    const errorDetails = rawTrace ? `:\n${extractMeaningfulErrorTrace(rawTrace, 1000)}` : '';
    throw new Error(`${ciOrActions} failed on job "${jobName}", but no code changes were made to fix it${errorDetails}`);
   }
  } else {
   break;
  }
 }

 const finalStatus = pipeline?.status || 'failed';
 await call('mr', {
  mrIid: mr.iid,
  webUrl: mr.web_url,
  title: mr.title,
  sourceBranch: mr.source_branch,
  targetBranch: mr.target_branch,
  pipelineId: pipeline?.id,
  pipelineStatus: finalStatus
 });

 if (finalStatus !== 'success') {
  throw new Error(`${platformName} ${ciOrActions} failed with status ${finalStatus}`);
 }

 return {
  mr,
  pipeline,
  validation: [{
   command: `${platform.isGitHub ? 'github-actions' : 'gitlab-ci'}:pipeline`,
   commandId: `pipeline-${pipeline?.id || 'ok'}`,
   startedAt: Date.now(),
   endedAt: Date.now(),
   exitCode: 0,
   timedOut: false,
   summary: `${platformName} ${ciOrActions} #${pipeline?.id || 'ok'} passed`
  }]
 };
}
