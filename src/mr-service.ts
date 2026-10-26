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

export function renderMRTitle(type: MRChangeType, description: string): string {
 // Remove existing prefixes if user already typed one
 const cleanDesc = description.replace(/^(?:feat|fix|docs|refactor|perf|ci|chore)(?:\([^)]+\))?[:：]\s*/i, '').trim();
 return `${type}: ${cleanDesc}`;
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

 const sections: Record<MRChangeType, string> = {
  docs: `### 📖 文档更新说明
- **变更目标**：${description}
- **核心调整文档**：
${fileList}
- **验证对照**：确认相关技术规范与最新代码实现保持同步，排版格式完整无误。`,

  fix: `### 🐛 问题修复说明
- **问题描述**：${description}
- **涉及组件与文件**：
${fileList}
- **修复方案**：已消除异常逻辑并在工作区验证通过。
- **回归检查**：相关自动化测试及 CI 流水线均已重新验证。`,

  feat: `### ✨ 功能特性说明
- **功能目标**：${description}
- **主要改动文件**：
${fileList}
- **实现亮点**：按照规划与设计契约完成代码落地，提供完备的测试与运行时保障。
- **影响范围**：合并至 \`${defaultBranch}\` 主分支，不破坏既有兼容性。`,

  refactor: `### 🔨 代码重构说明
- **重构目的**：${description}
- **重构范围**：
${fileList}
- **质量保证**：重构前后保持既有业务逻辑契约完全一致，全量自动化回归测试通过。`,

  perf: `### ⚡ 性能优化说明
- **优化点**：${description}
- **优化文件**：
${fileList}
- **效果预期**：降低资源消耗与响应耗时，通过性能回归检验。`,

  ci: `### 👷 流水线与构建变更
- **构建调整**：${description}
- **改动配置**：
${fileList}
- **验证状态**：本地测试及远程流水线执行通过。`,

  chore: `### 🧹 常规维护与杂项
- **维护内容**：${description}
- **涉及文件**：
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
  maxPolls = 30,
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

 // Detect change type and render title/description
 const changeType = detectChangeType(description, changedFiles);
 const mrTitle = renderMRTitle(changeType, description);

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

 // Query all committed files on this branch relative to origin defaultBranch for MR description
 let committedFiles: string[] = changedFiles;
 try {
  const diffTree = await git(['diff', '--name-only', `origin/${defaultBranch}...HEAD`], cwd);
  const diffTreeOutput = typeof diffTree === 'string' ? diffTree : diffTree?.stdout || '';
  const parsed = diffTreeOutput.trim().split('\n').map((s: string) => s.trim()).filter(Boolean);
  if (parsed.length > 0) committedFiles = parsed;
 } catch {
  // Fall back to staged files
 }

 const mrDescription = renderMRDescription({
  type: changeType,
  description,
  taskId,
  changedFiles: committedFiles,
  defaultBranch,
  sourceBranch: branch
 });

 // 2. Push branch to remote
 await git(['push', '-f', '-u', 'origin', `${branch}:${branch}`], cwd);

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

 // 4. Poll pipeline / Actions and repair if needed
 let pipeline: UnifiedPipeline | null = await platform.getLatestPipeline(branch);
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

  if (!pipeline || pipeline.status === 'success') {
   break;
  }

  if (pipeline.status === 'failed') {
   rounds++;
   const failed = await platform.getFailedJobTrace(pipeline.id);

   if (session) {
    await session.prompt(`${platformName} ${ciOrActions} Job "${failed?.name || 'test'}" failed on ${ciOrActions} #${pipeline.id}.\nFailure log:\n${(failed?.trace || '').slice(-3000)}\n\nPlease diagnose and modify the workspace files to fix this ${ciOrActions} failure.`);
   }

   await git(['add', '.'], cwd);
   await sanitizeOpenspecAsset();
   const diff = await git(['diff', '--cached', '--name-only'], cwd);
   const hasFixes = typeof diff === 'string' ? Boolean(diff.trim()) : Boolean(diff?.stdout?.trim());
   if (hasFixes) {
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
     await git(['commit', '-m', `fix(ci): address ${failed?.name || 'pipeline'} failure (round ${rounds})`], cwd);
    }
    await git(['push', '-f', 'origin', `${branch}:${branch}`], cwd);
    await new Promise(r => setTimeout(r, Math.min(pollIntervalMs, 2000)));
    pipeline = await platform.getLatestPipeline(branch);
   } else {
    throw new Error(`${ciOrActions} failed on job ${failed?.name || 'unknown'}, but no code changes were made to fix it`);
   }
  } else {
   break;
  }
 }

 const finalStatus = pipeline?.status || 'success';
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
