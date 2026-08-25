/**
 * Write-through cache for per-frame DOM mutations.
 *
 * The render loop touches ~20 properties every animation frame, but most of
 * them only change every few hundred frames (chapter labels, the progress
 * readout, copy that is fully faded out). Assigning an identical value still
 * costs a style invalidation, so every write goes through here and no-ops when
 * nothing actually changed.
 */
export function createWriter() {
  const cache = new WeakMap<Element, Map<string, string>>();

  const changed = (element: Element, key: string, value: string) => {
    let entries = cache.get(element);
    if (!entries) {
      entries = new Map();
      cache.set(element, entries);
    }
    if (entries.get(key) === value) return false;
    entries.set(key, value);
    return true;
  };

  return {
    /** Set a custom property (`--name`) on an element. */
    variable(element: HTMLElement | null, name: string, value: string) {
      if (!element || !changed(element, name, value)) return;
      element.style.setProperty(name, value);
    },
    style(element: HTMLElement | null, property: string, value: string) {
      if (!element || !changed(element, property, value)) return;
      element.style.setProperty(property, value);
    },
    text(element: Element | null, value: string) {
      if (!element || !changed(element, "#text", value)) return;
      element.textContent = value;
    },
  };
}
