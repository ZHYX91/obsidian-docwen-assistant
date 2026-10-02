const focusableControls = 'input, select, textarea, button, [role="checkbox"], [tabindex="0"]';
const settingAttribute = "data-docwen-setting-key";

/** Refresh a settings surface without losing its scroll position or active control. */
export function preserveSettingsView(container: HTMLElement, render: () => void): void {
  const scrollPositions: { element: HTMLElement; top: number; left: number }[] = [];
  for (let element: HTMLElement | null = container; element; element = element.parentElement) {
    if (element.scrollTop || element.scrollLeft) {
      scrollPositions.push({ element, top: element.scrollTop, left: element.scrollLeft });
    }
  }
  const active = container.ownerDocument?.activeElement;
  const row = active && container.contains(active)
    ? active.closest<HTMLElement>(`[${settingAttribute}]`)
    : null;
  const key = row?.getAttribute(settingAttribute);
  const controlIndex = row && active
    ? Array.from(row.querySelectorAll(focusableControls)).indexOf(active)
    : -1;

  try {
    render();
  } finally {
    if (key && controlIndex >= 0) {
      const nextRow = Array.from(container.querySelectorAll<HTMLElement>(`[${settingAttribute}]`))
        .find((element) => element.getAttribute(settingAttribute) === key);
      const control = nextRow?.querySelectorAll<HTMLElement>(focusableControls)[controlIndex];
      if (control && !control.matches(':disabled, [aria-disabled="true"]')) {
        control.focus({ preventScroll: true });
      }
    }
    for (const { element, top, left } of scrollPositions) {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
  }
}
