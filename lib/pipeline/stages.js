export const PIPELINE_STAGES = ['new','qualified','ready','contacted','engaged','meeting','opportunity','proposal','won','lost'];
export function validatePipelineInput({stage, nextAction, due, revision}) {
  if (!PIPELINE_STAGES.includes(stage)) return 'Choose a valid pipeline stage.';
  if (!Number.isInteger(revision) || revision < 0) return 'Refresh the pipeline before saving.';
  if (nextAction.length > 1000) return 'Keep the next action under 1,000 characters.';
  if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(`${due}T00:00:00Z`)) || new Date(`${due}T00:00:00Z`).toISOString().slice(0,10) !== due)) return 'Choose a valid due date.';
  if (due && !nextAction.trim()) return 'Add a next action before choosing a due date.';
  return null;
}
