import {Injectable,ServiceUnavailableException} from '@nestjs/common';
// Transport contracts, not environment-configurable authority assertions. A future
// independently deployed identity/authority broker must implement these interfaces.
// Tests inject scoped implementations only in their disposable application instance.
@Injectable()
export class AuthorityWriter {
 execute(actor:string,command:string,payload:Record<string,unknown>):Promise<Record<string,unknown>>{
  void actor;void command;void payload;
  return Promise.reject(new ServiceUnavailableException('PRIVATE_AUTHORITY_EXECUTOR_UNCONFIGURED'));
 }
}
@Injectable()
export class MdClaimVerifier {
 verify(actor:string,claimReference:string):Promise<{ticketToken:string}>{
  void actor;void claimReference;
  return Promise.reject(new ServiceUnavailableException('INDEPENDENT_MD_IDENTITY_VERIFIER_UNCONFIGURED'));
 }
}
