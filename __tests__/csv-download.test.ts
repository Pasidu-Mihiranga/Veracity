import { describe, expect, it } from 'vitest';
import { rowsToCsv } from '@/lib/csv-download';

describe('rowsToCsv', () => {
  it('quotes commas, quotes, and missing values', () => {
    expect(rowsToCsv(['name', 'note'], [['Acme, Inc.', 'said "hello"'], ['Other', null]]))
      .toBe('"name","note"\n"Acme, Inc.","said ""hello"""\n"Other",""');
  });

  it('neutralizes spreadsheet formula injection', () => {
    const csv = rowsToCsv(['value'], [['=HYPERLINK("bad")'], ['+1'], ['-2'], ['@name']]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"\'+1"');
    expect(csv).toContain('"\'-2"');
    expect(csv).toContain('"\'@name"');
  });
});
