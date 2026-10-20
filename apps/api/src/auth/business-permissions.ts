import {ForbiddenException} from '@nestjs/common';
import type {Prisma} from '../generated/prisma/client';
import {binding} from './hr-access';
import {routePermission} from '../authority/permission-registry';

export async function businessAuthority(db:Prisma.TransactionClient,actor:string){
 const installed=await db.$queryRaw<{installed:string|null}[]>`SELECT to_regclass('public.authority_mandates')::text installed`;
 if(!installed[0]?.installed)return {activated:false,permissions:[] as string[]};
 const state=await db.$queryRaw<{activated:boolean;permissions:string[]}[]>`SELECT EXISTS(SELECT 1 FROM authority_mandates WHERE kind='MD') activated, authority_effective(${actor}) permissions`;
 return {activated:state[0]?.activated===true,permissions:state[0]?.permissions??[]};
}
// Supplemental for specialized financial/HR authorization. Only the global
// Employee master can replace the old ACCOUNTANT entry gate after activation.
export async function enforceBusinessPermission(db:Prisma.TransactionClient,actor:string,controller:string,handler:string,method:string){
 const code=routePermission(controller,handler,method);
 if(!code)return undefined;
 const access=await businessAuthority(db,actor);
 if(!access.activated)return undefined; // Exact pre-MD compatibility; database errors never downgrade.
 if(code.startsWith('leave.')&&['leave.view','leave.create','leave.withdraw','leave.history.view'].includes(code)&&await binding(db,actor))return code;
 if(!access.permissions.includes(code))throw new ForbiddenException(`PERMISSION_REQUIRED:${code}`);
 return code;
}
