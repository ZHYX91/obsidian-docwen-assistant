/** Per-snapshot positions shared by all semantic projections. */
export class SourceTextIndex {
  private readonly lowSurrogates: number[] = [];
  private readonly newlines: number[] = [];

  constructor(source: string) {
    for (let offset = 0; offset < source.length; offset += 1) {
      const code = source.charCodeAt(offset);
      if (code === 10) this.newlines.push(offset);
      if (code >= 0xdc00 && code <= 0xdfff && offset > 0) {
        const previous = source.charCodeAt(offset - 1);
        if (previous >= 0xd800 && previous <= 0xdbff) this.lowSurrogates.push(offset);
      }
    }
  }

  unicodeOffset(utf16Offset: number): number {
    return utf16Offset - countBefore(this.lowSurrogates, utf16Offset);
  }

  lineNumber(utf16Offset: number): number {
    return countBefore(this.newlines, utf16Offset);
  }
}

function countBefore(positions: readonly number[], offset: number): number {
  let start = 0;
  let end = positions.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (positions[middle] < offset) start = middle + 1;
    else end = middle;
  }
  return start;
}
