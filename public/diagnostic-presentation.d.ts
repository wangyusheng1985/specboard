export interface DiagnosticItem{
 id?:string;
 stage?:string;
 resolved_by?:string;
 created_at?:number;
 diagnostic?:{
  occurredAt?:number;
  step?:string;
  category?:string;
  recoverySafety?:'safe_boundary'|'manual_inspection'|string;
  message?:string;
  [key:string]:any;
 };
}

export interface RunItem{
 id:string;
 stage:string;
 status:string;
 updated_at?:number;
 created_at?:number;
 error?:string;
}

export interface FilterDiagnosticsOptions{
 rows?:DiagnosticItem[];
 runs?:RunItem[];
 selected?:{
  id?:string;
  stage?:string;
  status?:string;
  outcome_state?:string;
  [key:string]:any;
 };
 viewStage?:string;
}

export interface FilterDiagnosticsResult{
 showCard:boolean;
 visible:DiagnosticItem[];
 legacy:RunItem[];
}

export interface StructuredDiagnosisResult {
 analysis: string;
 suggestions: string[];
 rawTrace: string;
}

export function normalizeStructuredDiagnosis(diagnostic: any): StructuredDiagnosisResult;

export function filterVisibleDiagnostics(options:FilterDiagnosticsOptions):FilterDiagnosticsResult;
