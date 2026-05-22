/**
 * Detect if the SDK is running inside MoBrowser.
 * MoBrowser exposes window.externalMessage.send for IPC to Rust.
 */
export function isMoBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.externalMessage !== 'undefined' &&
    typeof window.externalMessage.send === 'function'
  );
}
