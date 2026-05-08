export function isMissingRelationError(message: string | null | undefined, relation: string) {
  const text = String(message ?? "");
  if (!text) return false;

  return text.includes(`Could not find the table 'public.${relation}'`) || text.includes(`relation "${relation}" does not exist`);
}

export function isMissingColumnError(
  message: string | null | undefined,
  column: string,
  relation?: string
) {
  const text = String(message ?? "");
  if (!text) return false;

  return (
    text.includes(`Could not find the '${column}' column`) ||
    text.includes(`column "${column}" does not exist`) ||
    (relation
      ? text.includes(`Could not find the '${column}' column of '${relation}'`)
      : false)
  );
}
