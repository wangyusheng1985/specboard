export const TOOL_OUTPUT_LIMIT = 50000;

export function truncateToolOutput(text, limit = TOOL_OUTPUT_LIMIT) {
 const source = String(text ?? '');
 if (source.length <= limit) {
  return {text: source, truncated: false, originalLength: source.length, limit};
 }
 const headLength = Math.floor(limit * 0.6);
 const tailLength = limit - headLength;
 return {
  text: `${source.slice(0, headLength)}\n\n...[中间内容已截断]...\n\n${source.slice(-tailLength)}`,
  truncated: true,
  originalLength: source.length,
  limit
 };
}
