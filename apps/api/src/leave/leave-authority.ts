import {businessAuthority} from '../auth/business-permissions';
import {Injectable} from '@nestjs/common';
import type {Prisma} from '../generated/prisma/client';
import {binding,permission,unavailable} from '../auth/hr-access';
@Injectable()
export class LeaveAuthority {
 async subject(actorId:string,tx:Prisma.TransactionClient){try{const b=await binding(tx,actorId);return b?{employeeId:b.employeeId,revision:b.id}:null;}catch(e){if(unavailable(e))return null;throw e;}}
 async hr(actorId:string,tx:Prisma.TransactionClient,code='leave.view'){try{const grant=await permission(tx,actorId,'HR_ADMIN');if(!grant)return null;const access=await businessAuthority(tx,actorId);return access.activated&&!access.permissions.includes(code)?null:grant;}catch(e){if(unavailable(e))return null;throw e;}}
 async reviewer(actorId:string,tx:Prisma.TransactionClient){const grant=await this.hr(actorId,tx),subject=await this.subject(actorId,tx);return grant&&subject?{employeeId:subject.employeeId,revision:`${grant.id}:${subject.revision}`}:null;}
 async categorySupported(categoryId:string,tx:Prisma.TransactionClient){return Boolean(await tx.leaveCategory.findFirst({where:{id:categoryId,isActive:true}}));}
}
