import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getArchivePromptGuidance} from '../src/archive-policy.ts';
import {getArchivePromptGuidance as reExportedGuidance} from '../src/agent-container.ts';

test('getArchivePromptGuidance returns strict no-clarification and archive-without-syncing rule when remote does not track specs', () => {
  const guidance = getArchivePromptGuidance(false);
  assert.equal(guidance, reExportedGuidance(false));
  assert.match(guidance, /DOES NOT track openspec\/specs/);
  assert.match(guidance, /You MUST NOT call request_clarification to ask whether to sync specs/);
  assert.match(guidance, /directly select 'Archive without syncing'/);
  assert.match(guidance, /without user interruption/);
});

test('getArchivePromptGuidance returns auto-sync rule without user confirmation when remote tracks specs', () => {
  const guidance = getArchivePromptGuidance(true);
  assert.equal(guidance, reExportedGuidance(true));
  assert.match(guidance, /The remote repository tracks openspec\/specs/);
  assert.match(guidance, /You MUST automatically synchronize delta specs into openspec\/specs/);
  assert.match(guidance, /immediately without calling request_clarification or asking the user for confirmation/);
});
