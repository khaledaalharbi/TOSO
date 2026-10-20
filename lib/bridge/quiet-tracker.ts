/**
 * Measures how long a terminal screen has been visibly unchanged.
 *
 * Raw PTY bytes are the wrong clock: some TUIs (Hermes' prompt_toolkit seen
 * live) re-emit invisible control sequences such as cursor-blink toggles
 * about once a second while sitting idle, so "no bytes for 1.5s" never
 * happens and a finished turn is never recognised. What the user can see —
 * the rendered screen — is what has to settle.
 */
export function createQuietTracker() {
  let lastSignature: string | null = null;
  let changedAt = 0;
  return {
    /** Feed the current screen signature; returns ms since it last changed. */
    observe(signature: string, now = Date.now()): number {
      if (signature !== lastSignature) {
        lastSignature = signature;
        changedAt = now;
      }
      return now - changedAt;
    },
  };
}
