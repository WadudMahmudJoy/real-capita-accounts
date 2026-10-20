import { ForbiddenException } from '@nestjs/common';
import type { Prisma, HrPermission } from '../generated/prisma/client';
import {specializedPermissionAllowed} from './onboarding-access';
export async function permission(tx:Prisma.TransactionClient,userId:string,code:HrPermission){
 const grant=await tx.userPermission.findFirst({where:{userId,code,revokedAt:null,user:{isActive:true},OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}});
 return grant&&await specializedPermissionAllowed(tx,userId,code)?grant:null;
}
export async function requirePermission(tx:Prisma.TransactionClient,userId:string,code:HrPermission){const grant=await permission(tx,userId,code);if(!grant)throw new ForbiddenException(`Explicit active ${code} permission required.`);return grant;}
export async function binding(tx:Prisma.TransactionClient,userId:string){return tx.employeeAccountBinding.findFirst({where:{userId,unboundAt:null,user:{isActive:true},employee:{isActive:true,isDeleted:false}}});}
export function unavailable(error:unknown){return typeof error==='object'&&error!==null&&'code' in error&&error.code==='P2021';}
