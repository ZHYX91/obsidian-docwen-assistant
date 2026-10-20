const focusableControls = 'input, select, textarea, button, a[href], [role="checkbox"], [tabindex="0"]';
const settingAttribute = "data-docwen-setting-key";

/** Refresh a settings surface without losing its scroll position or active control. */
export function preserveSettingsView(container: HTMLElement, render: () => void): void {
  preserveViewState(container, render, settingAttribute);
}

/** Preserve keyed controls and scrolling regions when a plugin surface must be rebuilt. */
export function preserveViewState(
  container: HTMLElement,
  render: () => void,
  controlAttribute: string,
  scrollAttribute?: string,
): void {
  const scrollPositions: { element: HTMLElement; top: number; left: number }[] = [];
  for (let element: HTMLElement | null = container; element; element = element.parentElement) {
    if (element.scrollTop || element.scrollLeft) {
      scrollPositions.push({ element, top: element.scrollTop, left: element.scrollLeft });
    }
  }
  const innerScrollPositions = scrollAttribute
    ? Array.from(container.querySelectorAll<HTMLElement>(`[${scrollAttribute}]`))
      .map((element) => ({ key: element.getAttribute(scrollAttribute), top: element.scrollTop, left: element.scrollLeft }))
    : [];
  const active = container.ownerDocument?.activeElement;
  const row = active && container.contains(active)
    ? active.closest<HTMLElement>(`[${controlAttribute}]`)
    : null;
  const key = row?.getAttribute(controlAttribute);
  const controlIndex = row && active
    ? getControls(row).indexOf(active as HTMLElement)
    : -1;

  try {
    render();
  } finally {
    if (key && controlIndex >= 0) {
      const nextRow = Array.from(container.querySelectorAll<HTMLElement>(`[${controlAttribute}]`))
        .find((element) => element.getAttribute(controlAttribute) === key);
      const control = nextRow ? getControls(nextRow)[controlIndex] : undefined;
      if (control && !control.matches(':disabled, [aria-disabled="true"]')) {
        control.focus({ preventScroll: true });
      }
    }
    const scrolling = scrollAttribute ? Array.from(container.querySelectorAll<HTMLElement>(`[${scrollAttribute}]`)) : [];
    for (const { key, top, left } of innerScrollPositions) {
      const element = scrolling.find((candidate) => candidate.getAttribute(scrollAttribute!) === key);
      if (element) {
        element.scrollTop = top;
        element.scrollLeft = left;
      }
    }
    for (const { element, top, left } of scrollPositions) {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
  }
}

function getControls(row: HTMLElement): HTMLElement[] {
  return row.matches(focusableControls) ? [row] : Array.from(row.querySelectorAll<HTMLElement>(focusableControls));
}
