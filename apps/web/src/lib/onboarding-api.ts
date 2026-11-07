import {apiFetch, ApiError} from './api';

export type OnboardingStatus = {
  installed: boolean; configured: boolean; canManage: boolean; canReview: boolean;
  own: {userId: string; version: number; state: string; emailVerified: boolean; identityVerified: boolean; employeeBound: boolean; mdActivated: boolean};
  items: {id: string; invitationId: string | null; userId: string; email: string; fullName: string; state: string; emailVerified: boolean; identityVerified: boolean; employeeId: string | null; version: number}[];
  requests: {id: string; targetUserId: string; permission: string; status: string; reason: string; version: number}[];
  history: {id: string; action: string; createdAt: string}[];
  blockers: string[];
};

export const onboardingStatus = () => apiFetch<OnboardingStatus>('/onboarding/status');
export const prepareOnboarding = (command: string, payload: Record<string, unknown>) =>
  apiFetch<{evidenceUrl: string; nonce: string; origin: string}>('/onboarding/prepare', {method: 'POST', body: {command, payload}});
export type OnboardingProof = {claims: Record<string, unknown>; signature: string};
export async function onboardingCommand<T = unknown>(command: string, payload: Record<string, unknown>, proof: OnboardingProof): Promise<T> {
  try { return await apiFetch<T>('/onboarding/commands', {method: 'POST', body: {command, payload, proof}}); }
  catch (error) {
    if (!(error instanceof ApiError) || error.isOutcomeUnknown || error.status === 0 || error.status >= 500) {
      const id = error instanceof ApiError ? error.reconciliationId : undefined;
      throw new ApiError(`The protected operation may have committed. Do not retry or reissue. Request authorized read-only reconciliation.${id ? ` Reference: ${id}` : ''}`, error instanceof ApiError ? error.status : 503, true, id);
    }
    throw error;
  }
}
export function onboardingResultMessage(result: unknown): {text: string; reconcile: boolean} {
  if (result && typeof result === 'object' && 'status' in result && result.status === 'ISSUED') {
    const delivery = result as {deliveryStatus?: unknown; deliveryRecorded?: unknown};
    if (delivery.deliveryStatus !== 'ACCEPTED' || delivery.deliveryRecorded !== true) return {text:'Invitation issued; delivery or its audit recording is uncertain. Preserve any received link. Do not reissue; request authorized read-only reconciliation.', reconcile:true};
    return {text:'Invitation issued. The email provider accepted the request; inbox delivery is not confirmed.', reconcile:false};
  }
  return {text:'The protected operation was recorded. Review current state and audit history; pending requests grant no authority.', reconcile:false};
}
export async function protectedOnboardingCommand<T>(command: string, payload: Record<string, unknown>): Promise<T> {
  const proof = await collectOnboardingProof(command, payload);
  return onboardingCommand<T>(command, payload, proof);
}
export const claimAccount = (capability: string, password: string) =>
  apiFetch<unknown>('/onboarding/claim', {method: 'POST', body: {capability, password}});

/** Evidence is collected privately, never typed into the application. */
export async function collectOnboardingProof(command: string, payload: Record<string, unknown>): Promise<OnboardingProof> {
  const popup = window.open('about:blank', '_blank', 'popup,width=640,height=760');
  if (!popup) throw new Error('Allow the private verification window to continue.');
  try {
    const prepared = await prepareOnboarding(command, payload);
    const url = new URL(prepared.evidenceUrl);
    if (url.origin !== prepared.origin || url.username || url.password ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
      throw new Error('The private verification service is not securely configured.');
    }
    return await new Promise<OnboardingProof>((resolve, reject) => {
      const cleanup = () => {window.removeEventListener('message', receive); window.clearTimeout(timeout); popup.close();};
      const receive = (event: MessageEvent) => {
        if (event.source !== popup || event.origin !== prepared.origin || event.data?.type !== 'REAL_CAPITA_ONBOARDING_PROOF' || event.data?.nonce !== prepared.nonce) return;
        if (!event.data.proof || typeof event.data.proof !== 'object' || typeof event.data.proof.signature !== 'string' || typeof event.data.proof.claims !== 'object' || event.data.proof.claims === null || JSON.stringify(event.data.proof).length > 8192) {cleanup(); reject(new Error('Private verification did not return a valid approval.')); return;}
        cleanup(); resolve(event.data.proof);
      };
      const timeout = window.setTimeout(() => {cleanup(); reject(new Error('Private verification expired. Start a new verification.'));}, 120000);
      window.addEventListener('message', receive);
      popup.location.replace(url.href);
    });
  } catch (error) {popup.close(); throw error;}
}
