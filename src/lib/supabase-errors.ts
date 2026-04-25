export function isMissingRelationError(message: string | null | undefined, relation: string) {
  const text = String(message ?? "");
  if (!text) return false;

  return text.includes(`Could not find the table 'public.${relation}'`) || text.includes(`relation "${relation}" does not exist`);
}
