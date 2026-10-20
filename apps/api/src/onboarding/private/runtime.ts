/** Reject executable loading controls before private credentials are decoded. */
export function assertSafePrivateNodeEnvironment(environment:NodeJS.ProcessEnv):void {
 if(environment.NODE_OPTIONS||environment.NODE_PATH)throw new Error('PRIVATE_NODE_LOADING_CONFIGURATION_REJECTED');
}
