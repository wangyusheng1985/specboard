export function getArchivePromptGuidance(remoteTracksSpecs: boolean): string {
  if (!remoteTracksSpecs) {
    return `For Archive stage: The remote repository DOES NOT track openspec/specs. You MUST NOT call request_clarification to ask whether to sync specs. You are required to directly select 'Archive without syncing' (move the change directly into openspec/changes/archive/<date>-task-<id>/) and complete the archive stage immediately without user interruption.`;
  }
  return `For Archive stage: The remote repository tracks openspec/specs. You MUST automatically synchronize delta specs into openspec/specs and move the change into openspec/changes/archive/<date>-task-<id>/ immediately without calling request_clarification or asking the user for confirmation.`;
}
