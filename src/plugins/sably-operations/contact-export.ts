export const CONTACT_FIELDS = ['id','name','email','phone','country','course_interest','source','created_at','policy_version','policy_url','text_shown','granted_at'] as const;
export function contactCsvCell(value: unknown): string {
  let text = String(value ?? '');
  // Spreadsheet importers may ignore whitespace before a formula character.
  if (/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}
export function contactCsv(rows: Record<string,unknown>[]): string {
  return '\uFEFF'+[CONTACT_FIELDS.map(contactCsvCell).join(','),...rows.map(row=>CONTACT_FIELDS.map(key=>contactCsvCell(row[key])).join(','))].join('\r\n');
}
