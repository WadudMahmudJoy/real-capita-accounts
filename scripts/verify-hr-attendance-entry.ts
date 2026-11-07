import 'reflect-metadata';
import assert from 'node:assert/strict';
import {RolesGuard} from '../apps/api/src/auth/guards/roles.guard';
async function main(){let checks=0;const guard=new RolesGuard({getAllAndOverride:()=>['ACCOUNTANT']} as any);const context=(permission:string,verified:boolean,roles:any[]=[])=>({getHandler:()=>null,getClass:()=>null,switchToHttp:()=>({getRequest:()=>({user:{roles},businessPermission:permission,hrAttendanceAuthorized:verified})})} as any);
 for(const code of ['attendance.view','attendance.edit','attendance.approve','attendance.manage']){assert.equal(guard.canActivate(context(code,true)),true);checks++;assert.throws(()=>guard.canActivate(context(code,false)));checks++;}
 for(const code of ['payroll.view','payroll.approve','payroll.documents.view','vouchers.post','schedules.manage']){assert.throws(()=>guard.canActivate(context(code,true)));checks++;}
 assert.equal(guard.canActivate(context('payroll.approve',false,[{code:'ACCOUNTANT'}])),true);checks++;
 console.log(`PASS ${checks} HR attendance entry checks: protected HR plus delegated scope only; financial/schedule gates preserved`);
}main().catch(error=>{console.error(error);process.exitCode=1;});
