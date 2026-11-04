import type {StructuredDiagnosis} from './diagnostics.ts';

export interface SynthesizeDiagnosticInput {
  message: string;
  details?: string;
  rawTrace?: string;
  stage?: string;
  taskDescription?: string;
  code?: string;
  category?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
}

/**
 * 启发式本地降级处理：当 LLM 不可用、超时或解析失败时执行
 */
export function buildHeuristicStructuredDiagnosis(input: SynthesizeDiagnosticInput): StructuredDiagnosis {
  const rawTrace = (input.rawTrace || input.details || input.message || '').trim();
  
  // 整理 input.message，去掉技术噪声
  let cleanMessage = (input.message || '').trim();
  // 去除常见的堆栈前缀、JSON 格式噪声或无用报错前缀
  cleanMessage = cleanMessage
    .replace(/^Error:\s*/i, '')
    .replace(/^(?:uncaughtException|unhandledRejection):\s*/i, '')
    .replace(/\{"error":\{.*?"message":"([^"]+)".*?\}\}/gs, '$1')
    .replace(/\{"message":"([^"]+)".*?\}/gs, '$1')
    .trim();
  if (!cleanMessage) {
    cleanMessage = '任务执行未能完成';
  }

  // 检查是否为 CI / Runner 故障
  const fullText = `${input.message || ''} ${input.details || ''} ${input.rawTrace || ''}`;
  const isCiFailure = /cancelled|macos-13|runner|actions failed|github-actions|gitlab-ci|pipeline/i.test(fullText) || input.stage === 'MR';

  // 根据 category / message 给出通用可执行建议（保证 >= 1 条）
  const suggestions: string[] = [];
  const lowerCat = (input.category || '').toLowerCase();
  const lowerMsg = (cleanMessage + ' ' + (input.details || '')).toLowerCase();

  let analysis = cleanMessage;

  if (isCiFailure) {
    analysis = 'CI 流水线失败且未成功运行。';
    suggestions.push('检查并更新 .github/workflows/ 或 CI 配置文件中的构建矩阵，将已下线或不可用的 Runner 标签（如 macos-13）替换为支持的版本（如 macos-14）。');
    suggestions.push('确认流水线触发规则与环境变量配置无误。');
    suggestions.push('在下方“补充信息”中说明修复意图，触发重新推送流水线。');
  } else if (lowerCat === 'artifact_validation' || lowerMsg.includes('artifact') || lowerMsg.includes('proposal') || lowerMsg.includes('tasks.md')) {
    suggestions.push('检查工作区任务产物（如 tasks.md / proposal.md / design.md），确保符合 OpenSpec 规范且无空缺或格式错误。');
    suggestions.push('根据阶段要求补充缺失的产物文件或在澄清对话中确认产物范围。');
  } else if (lowerCat === 'model_auth' || lowerMsg.includes('auth') || lowerMsg.includes('401') || lowerMsg.includes('403') || lowerMsg.includes('unauthorized')) {
    suggestions.push('检查 LLM 网关 Relay 配置及 API Token 凭据是否有效且具备访问权限。');
    suggestions.push('在设置中验证模型供应商鉴权配置是否过期。');
  } else if (lowerCat === 'model_timeout' || lowerCat === 'model_rate_limit' || lowerMsg.includes('timeout') || lowerMsg.includes('rate limit') || lowerMsg.includes('429')) {
    suggestions.push('检查上游大模型供应商服务状态，确认是否触发限流（Rate Limit）或响应超时。');
    suggestions.push('稍后在补充信息中发送消息重试，或在后台配置多 Relay 故障转移。');
  } else if (lowerMsg.includes('actions') || lowerMsg.includes('pipeline') || lowerMsg.includes('ci') || lowerMsg.includes('workflow')) {
    suggestions.push('查看 CI / GitHub Actions 运行记录，检查失败 Job 的具体步骤及 Runner 环境。');
    suggestions.push('在工作区修复导致 CI 构建或测试失败的代码后重新触发流水线。');
  } else if (lowerCat === 'runtime_environment' || lowerMsg.includes('docker') || lowerMsg.includes('spawn') || lowerMsg.includes('enomem')) {
    suggestions.push('检查 Agent 容器执行环境及宿主机资源（CPU/内存/磁盘空间）是否充足。');
    suggestions.push('检查工作区依赖安装与环境变量配置。');
  } else {
    suggestions.push('查看原始技术上下文与堆栈跟踪，定位具体的执行异常点。');
    suggestions.push('在任务界面的“补充信息”中输入排查提示或补充说明以恢复执行。');
  }

  return {
    analysis,
    suggestions,
    rawTrace: rawTrace || cleanMessage
  };
}

/**
 * 结构化诊断合成服务：
 * - 尝试调用 LLM Gateway 提炼分析与建议
 * - 8 秒超时与严格 try/catch
 * - 失败时使用启发式降级
 */
export async function synthesizeStructuredDiagnostic(input: SynthesizeDiagnosticInput): Promise<StructuredDiagnosis> {
  const fallback = buildHeuristicStructuredDiagnosis(input);
  const gatewayUrl = (input.gatewayUrl || process.env.GATEWAY_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');
  const gatewayToken = input.gatewayToken || process.env.GATEWAY_TOKEN || '';

  // 如果没有配置网关或处于单元测试无网络环境，直接降级
  if (!gatewayUrl) {
    return fallback;
  }

  try {
    const prompt = `你是一个软件工程异常诊断专家。请根据以下任务失败上下文，提炼出精炼的根因分析及人工介入解决建议。
必须严格输出且仅输出合法 JSON 格式，不要包含任何 markdown 标记（如 \`\`\`json）：
{
  "analysis": "精炼清晰的问题根因说明（一到两句话，说明为什么受阻）",
  "suggestions": ["第一条具体可行的人工介入解决步骤", "第二条排查或操作建议（至少1条）"],
  "rawTrace": "保留或整理的关键错误上下文/堆栈摘要"
}

任务上下文：
- 阶段 (Stage): ${input.stage || '未知'}
- 任务描述: ${input.taskDescription || '无'}
- 故障分类: ${input.category || 'unknown'}
- 错误代码/标识: ${input.code || 'none'}
- 错误信息 (Message): ${input.message}
- 详细日志或堆栈 (Details / Raw Trace):
${(input.rawTrace || input.details || input.message || '').slice(0, 4000)}
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${gatewayUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(gatewayToken ? { authorization: `Bearer ${gatewayToken}` } : {})
      },
      body: JSON.stringify({
        model: 'agent-default',
        input: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return fallback;
    }

    const data: any = await res.json();
    let text = '';
    if (data?.output) {
      for (const item of data.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.type === 'output_text') text += c.text;
          }
        }
      }
    } else if (data?.choices?.[0]?.message?.content) {
      text = data.choices[0].message.content;
    }

    if (!text) {
      return fallback;
    }

    // 提取并解析 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallback;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.analysis !== 'string' || !Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      return fallback;
    }

    const suggestions = parsed.suggestions
      .map((s: any) => String(s).trim())
      .filter(Boolean);

    if (suggestions.length === 0) {
      return fallback;
    }

    return {
      analysis: parsed.analysis.trim(),
      suggestions,
      rawTrace: (typeof parsed.rawTrace === 'string' && parsed.rawTrace.trim())
        ? parsed.rawTrace.trim()
        : fallback.rawTrace
    };
  } catch {
    // 任何超时、网络故障、解析错误均平滑退化
    return fallback;
  }
}
