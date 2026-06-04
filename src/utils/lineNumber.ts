import { LineItem } from '../types';

export type LineNumberFormat = 'sequential' | 'sectioned' | 'per-section' | 'none';

/**
 * Computes the display number string for a line item based on the chosen format.
 *
 * Formats:
 *   'sequential'  → 1, 2, 3, 4  (global counter, sections ignored)
 *   'sectioned'   → 1.1, 1.2, 2.1, 2.2  (section.item within section)
 *   'per-section' → Resets to 1 after each section header
 *   'none'        → '' (no number displayed)
 *
 * @param items    Full lineItems array
 * @param idx      Index of current item
 * @param format   The chosen format
 * @returns        Number string to display, or '' for sections/notes/none
 */
export function getLineNumber(
  items: LineItem[],
  idx: number,
  format: LineNumberFormat = 'sequential'
): string {
  const item = items[idx];
  if (!item || item.type !== 'item') return '';
  if (format === 'none') return '';

  if (format === 'sequential') {
    let count = 0;
    for (let i = 0; i <= idx; i++) {
      if (items[i]?.type === 'item') count++;
    }
    return String(count);
  }

  if (format === 'sectioned') {
    let sectionNum = 1;
    let itemInSection = 0;
    let hasItemsInPreviousSections = false;

    for (let i = 0; i <= idx; i++) {
      const row = items[i];
      if (row.type === 'section') {
        if (itemInSection > 0 || hasItemsInPreviousSections) {
          sectionNum++;
          hasItemsInPreviousSections = true;
        }
        itemInSection = 0;
      } else if (row.type === 'item') {
        itemInSection++;
      }
    }
    return `${sectionNum}.${itemInSection}`;
  }

  if (format === 'per-section') {
    // Restart counter after each section header
    let count = 0;
    for (let i = 0; i <= idx; i++) {
      const row = items[i];
      if (row.type === 'section') {
        count = 0;
      } else if (row.type === 'item') {
        count++;
      }
    }
    return String(count);
  }

  return '';
}
