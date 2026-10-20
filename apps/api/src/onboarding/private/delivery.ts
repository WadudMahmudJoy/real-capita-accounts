export interface DeliveryConfiguration {apiKey:string;from:string;claimUrl:string;}
export class ResendInvitationDelivery {
 constructor(private readonly config:DeliveryConfiguration,private readonly sendFetch:typeof fetch=fetch){const url=new URL(config.claimUrl);if(!config.apiKey||!config.from||url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('MAIL_CONFIGURATION_REQUIRED');}
 async send(email:string,capability:string,invitationId:string):Promise<string>{
  if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)||!/^[A-Za-z0-9_-]{43}$/.test(capability)||!/^[A-Za-z0-9_-]+$/.test(invitationId))throw new Error('INVITATION_DELIVERY_INVALID');
  // Fragment avoids placing the capability into proxy/request access logs. Claim UI removes it immediately.
  const claimUrl=new URL(this.config.claimUrl);claimUrl.hash=new URLSearchParams({capability}).toString();
  try{const response=await this.sendFetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${this.config.apiKey}`,'Content-Type':'application/json','Idempotency-Key':`invitation-${invitationId}`},body:JSON.stringify({from:this.config.from,to:[email],subject:'Real Capita account invitation',text:`Open your personal account claim page within 15 minutes: ${claimUrl.href}\nThis verifies email control only. Company identity verification is still required.`}),signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw new Error();const result=await response.json() as {id?:unknown};if(typeof result.id!=='string'||!result.id)throw new Error();return result.id;}catch{throw new Error('INVITATION_DELIVERY_UNAVAILABLE');}
 }
}
