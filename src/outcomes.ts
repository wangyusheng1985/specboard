import type {DiagnosticCategory} from './diagnostics.ts';
export const outcomeStates=['clarifying','awaiting_proposal_approval','executing','recovering','blocked','delivered','archived','paused','stopped'] as const;
export type OutcomeState=typeof outcomeStates[number];
export type RecoveryEvidence={category:DiagnosticCategory;safeBoundary:boolean;sessionReady:boolean;containerExited:boolean;workspaceReleased:boolean;unconfirmedTool:boolean;localValidationFailure?:boolean;requirementDecision?:boolean};
export type RecoveryStrategy='retry_request'|'repair_artifacts'|'repair_implementation'|'reconcile_read_only'|'clarify'|'block';
export function recoveryStrategy(e:RecoveryEvidence):RecoveryStrategy{
 if(e.requirementDecision)return 'clarify';
 if(e.category==='model_auth')return 'block';
 if(e.unconfirmedTool||!e.sessionReady||!e.containerExited||!e.workspaceReleased)return 'reconcile_read_only';
 if(!e.safeBoundary)return 'block';
 if(['model_timeout','model_rate_limit','model_upstream'].includes(e.category))return 'retry_request';
 if(e.category==='artifact_validation')return 'repair_artifacts';
 if(e.category==='unknown'&&e.safeBoundary)return 'retry_request';
 if(e.localValidationFailure)return 'repair_implementation';
 return 'block';
}
export type ExecutionBudget={maxRounds:number;maxActiveMs:number;usedRounds:number;usedActiveMs:number};
export const defaultExecutionBudget:Readonly<ExecutionBudget>=Object.freeze({maxRounds:5,maxActiveMs:30*60*1000,usedRounds:0,usedActiveMs:0});
export function budgetAvailable(b:ExecutionBudget){return b.usedRounds<b.maxRounds&&b.usedActiveMs<b.maxActiveMs;}
export function recoveryDelay(round:number,retryAfterMs=0,jitter=0){return Math.max([2000,4000,8000,16000,30000][Math.min(4,Math.max(0,round-1))],Math.max(0,retryAfterMs))+Math.min(1000,Math.max(0,jitter));}
export function projectOutcome(row:{outcome_state?:string|null;stage:string;status:string}):OutcomeState{
 if(row.stage==='Apply'&&row.outcome_state==='awaiting_proposal_approval')return row.status==='running'||row.status==='queued'?'executing':'blocked';
 if(row.outcome_state&&outcomeStates.includes(row.outcome_state as OutcomeState))return row.outcome_state as OutcomeState;
 if(row.status==='paused')return 'paused';if(row.status==='stopped')return 'stopped';if(row.status==='running'||row.status==='queued')return 'executing';if(row.status==='failed'||row.status==='interrupted')return 'blocked';if(row.stage==='Propose'&&row.status==='waiting_input')return 'awaiting_proposal_approval';if((row.stage==='Apply'||row.stage==='MR')&&row.status==='waiting_input')return 'delivered';if(row.stage==='Archive'&&row.status==='completed')return 'archived';return row.stage==='Explore'?'clarifying':'executing';
}
export function completionOutcome(stage:string):OutcomeState{
 if(stage==='Explore')return 'clarifying';
 if(stage==='Propose')return 'awaiting_proposal_approval';
 if(stage==='Apply')return 'delivered';
 if(stage==='MR')return 'delivered';
 if(stage==='Archive')return 'archived';
 throw new Error('Unknown stage');
}

export function allowedStageTransition(from:string,to:string,context:{explicitUserAction:boolean;proposalApproved:boolean;applyDelivered:boolean}){
 if(!context.explicitUserAction)return false;
 if(from==='Explore'&&to==='Propose')return true;
 if(from==='Propose'&&to==='Apply')return context.proposalApproved;
 if(from==='Apply'&&to==='MR')return context.applyDelivered;
 if(from==='Apply'&&to==='Archive')return context.applyDelivered;
 if(from==='MR'&&to==='Archive')return context.applyDelivered;
 return false;
}
