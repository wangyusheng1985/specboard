export declare const TOOL_OUTPUT_LIMIT: number;
export interface TruncatedToolOutput {
 text: string;
 truncated: boolean;
 originalLength: number;
 limit: number;
}
export declare function truncateToolOutput(text: string, limit?: number): TruncatedToolOutput;
