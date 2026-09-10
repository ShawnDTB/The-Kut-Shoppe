// The legacy simple migrations have no semicolons inside literals. Trigger
// migrations provide explicit boundaries to preserve complete compound SQL.
export function migrationStatements(source) {
  const chunks = source.includes('-- statement-boundary') ? source.split('-- statement-boundary') : source.replace(/^\s*--.*$/gm, '').split(';');
  return chunks.map((part) => part.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);
}
