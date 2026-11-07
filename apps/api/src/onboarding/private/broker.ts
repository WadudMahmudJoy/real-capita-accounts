import {createServer,ServerOptions} from 'node:https';
import {IncomingMessage,ServerResponse} from 'node:http';
import {TLSSocket} from 'node:tls';
import {OnboardingPrivateExecutor,PrivateOperationError} from './executor';
import {CommandEnvelope} from './proof';
import {IndependentEvidenceCollector} from './collector';
/** Separate process only: never register this server in the ordinary Nest application. */
export async function startOnboardingBroker(executor:OnboardingPrivateExecutor,tls:ServerOptions,clientFingerprints:string[],port:number,collector?:IndependentEvidenceCollector){
 if(!tls.key||!tls.cert||!tls.ca||tls.rejectUnauthorized===false||!clientFingerprints.length||clientFingerprints.some(v=>!/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(v))||!Number.isInteger(port)||port<1024||port>65535)throw new Error('BROKER_MTLS_CONFIGURATION_REQUIRED');
 await executor.attest();
 const handle=async(req:IncomingMessage,res:ServerResponse)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  const socket=req.socket as TLSSocket;if(!socket.authorized||!clientFingerprints.includes(socket.getPeerCertificate().fingerprint256)){res.writeHead(403).end('{"error":"PRIVATE_CLIENT_DENIED"}');return;}
  try{
   if(req.method==='GET'&&req.url==='/readiness'){await executor.attest();res.end(JSON.stringify({ready:Boolean(collector),providerReady:Boolean(collector),executorReady:true}));return;}
   if(req.method!=='POST'||!['/commands','/execute','/claim','/prepare'].includes(req.url??'')||req.headers['content-type']!=='application/json'){res.writeHead(404).end('{}');return;}
   let body='';for await(const chunk of req){body+=(chunk as Buffer).toString();if(Buffer.byteLength(body)>65536)throw new Error();}
   const input=JSON.parse(body) as Record<string,unknown>;
   if(req.url==='/prepare'){if(!collector)throw new Error();const result=await collector.prepare(input as unknown as Parameters<IndependentEvidenceCollector['prepare']>[0]);res.end(JSON.stringify(result));return;}
   const result=req.url==='/claim'?await executor.claim(input.capability,input.password):await executor.execute(input as unknown as CommandEnvelope);res.end(JSON.stringify(result));
  }catch(error){res.writeHead(error instanceof PrivateOperationError?error.status:503).end('{"error":"PRIVATE_OPERATION_UNAVAILABLE_OR_DENIED"}');}
 };
 const server=createServer({...tls,minVersion:'TLSv1.3',requestCert:true,rejectUnauthorized:true},(req,res)=>{void handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(503);res.end('{"error":"PRIVATE_OPERATION_UNAVAILABLE_OR_DENIED"}');});});
 server.requestTimeout=20000;server.headersTimeout=10000;
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve();});});return server;
}
