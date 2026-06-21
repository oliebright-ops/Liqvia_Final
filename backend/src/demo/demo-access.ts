/** Whether anonymous demo guest sessions are allowed (default: enabled). */
export function isDemoGuestEnabled(): boolean {
  return process.env.DEMO_GUEST_ENABLED !== 'false';
}
