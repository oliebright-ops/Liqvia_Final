/** Broadcast after uploads or settings changes so module hooks refetch live data. */
export const WORKSPACE_REFRESH_EVENT = 'liqvia:workspace-refresh';

export function notifyWorkspaceRefresh(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKSPACE_REFRESH_EVENT));
  }
}

export function onWorkspaceRefresh(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(WORKSPACE_REFRESH_EVENT, listener);
  return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, listener);
}
