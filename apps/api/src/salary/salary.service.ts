import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { parseIsoDate } from "../common/date-rules";
import { Prisma, SalaryConfigurationStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentProfileDto, CreateSalaryAssignmentDto, CreateSalaryStructureDto, SalaryComponentDto, SalaryPreviewDto, UpdatePaymentProfileDto, UpdateSalaryAssignmentDto, UpdateSalaryStructureDto } from "./dto/salary.dto";
import { SalaryCalculator } from "./salary-calculator";
import { normalizeSalaryPrismaError } from "./salary-prisma-errors";

const D = Prisma.Decimal;
const STANDARD_BANK_PERCENTAGE = new D("60.000000");

@Injectable()
export class SalaryService {
  constructor(private readonly prisma: PrismaService, private readonly calculator: SalaryCalculator) {}

  listStructures() { return this.prisma.salaryStructure.findMany({ include: { components: { orderBy: { displayOrder: "asc" } } }, orderBy: [{ code: "asc" }, { version: "desc" }] }); }
  async getStructure(id: string) { const value = await this.prisma.salaryStructure.findUnique({ where: { id }, include: { components: { orderBy: { displayOrder: "asc" } } } }); if (!value) throw new NotFoundException("Salary Structure was not found."); return value; }

  async createStructure(dto: CreateSalaryStructureDto, user: AuthenticatedUser) {
    const dates = dateRange(dto.effectiveFrom, dto.effectiveTo);
    validateComponents(dto.components);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const latest = await tx.salaryStructure.findFirst({ where: { code: dto.code }, orderBy: { version: "desc" }, select: { version: true } });
        const value = await tx.salaryStructure.create({ data: { code: dto.code, version: (latest?.version ?? 0) + 1, name: dto.name, description: clean(dto.description), ...dates, createdById: user.id, components: { create: componentData(dto.components) } }, include: { components: { orderBy: { displayOrder: "asc" } } } });
        await audit(tx, user.id, "SALARY_STRUCTURE_CREATED", "SalaryStructure", value.id, { code: value.code, version: value.version });
        return value;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { normalizeSalaryPrismaError(error, { duplicateMessage: "Salary Structure code and version already exist." }); }
  }

  async updateStructure(id: string, dto: UpdateSalaryStructureDto, user: AuthenticatedUser) {
    const existing = await this.getStructure(id);
    requireDraft(existing.status, "Salary Structure");
    if (dto.components) validateComponents(dto.components);
    const effectiveFrom = dto.effectiveFrom ? parseIsoDate(dto.effectiveFrom, "effectiveFrom") : existing.effectiveFrom;
    const effectiveTo = dto.effectiveTo === undefined ? existing.effectiveTo : dto.effectiveTo === null ? null : parseIsoDate(dto.effectiveTo, "effectiveTo");
    assertDateRange(effectiveFrom, effectiveTo);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.components) { await tx.salaryStructureComponent.deleteMany({ where: { salaryStructureId: id } }); await tx.salaryStructureComponent.createMany({ data: componentData(dto.components).map((component) => ({ ...component, salaryStructureId: id })) }); }
        const value = await tx.salaryStructure.update({ where: { id }, data: { ...(dto.name === undefined ? {} : { name: dto.name }), ...(dto.description === undefined ? {} : { description: clean(dto.description) }), effectiveFrom, effectiveTo }, include: { components: { orderBy: { displayOrder: "asc" } } } });
        await audit(tx, user.id, "SALARY_STRUCTURE_UPDATED", "SalaryStructure", id);
        return value;
      });
    } catch (error) { normalizeSalaryPrismaError(error, { duplicateMessage: "Salary Structure components must have unique codes and display orders.", notFoundMessage: "Salary Structure was not found." }); }
  }

  async approveStructure(id: string, user: AuthenticatedUser) {
    try { return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.salaryStructure.findUnique({ where: { id }, include: { components: true } });
      if (!existing) throw new NotFoundException("Salary Structure was not found.");
      requireDraft(existing.status, "Salary Structure"); validateComponents(existing.components.map((c) => ({ ...c, percentage: c.percentage.toString() })));
      const value = await tx.salaryStructure.update({ where: { id }, data: { status: SalaryConfigurationStatus.APPROVED, approvedById: user.id, approvedAt: new Date() }, include: { components: { orderBy: { displayOrder: "asc" } } } });
      await audit(tx, user.id, "SALARY_STRUCTURE_APPROVED", "SalaryStructure", id);
      return value;
    }); } catch(error) { normalizeSalaryPrismaError(error,{notFoundMessage:"Salary Structure was not found."}); }
  }

  async inactivateStructure(id: string, user: AuthenticatedUser) {
    try { return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.salaryStructure.findUnique({ where: { id } }); if (!existing) throw new NotFoundException("Salary Structure was not found.");
      if (existing.status !== SalaryConfigurationStatus.APPROVED) throw new ConflictException("Only an APPROVED Salary Structure can be inactivated.");
      const value = await tx.salaryStructure.update({ where: { id }, data: { status: SalaryConfigurationStatus.INACTIVE } });
      await audit(tx, user.id, "SALARY_STRUCTURE_INACTIVATED", "SalaryStructure", id); return value;
    }); } catch(error) { normalizeSalaryPrismaError(error,{notFoundMessage:"Salary Structure was not found."}); }
  }

  listAssignments(employeeId: string) { return this.prisma.employeeSalaryAssignment.findMany({ where: { employeeId }, include: { salaryStructure: true }, orderBy: { effectiveFrom: "desc" } }); }
  async createAssignment(employeeId: string, dto: CreateSalaryAssignmentDto, user: AuthenticatedUser) {
    await this.requireEmployee(employeeId); await this.requireStructure(dto.salaryStructureId); const dates = dateRange(dto.effectiveFrom, dto.effectiveTo); positive(dto.grossSalary, "Gross Salary");
    const hasApproved = await this.prisma.employeeSalaryAssignment.count({ where: { employeeId, status: SalaryConfigurationStatus.APPROVED } });
    if (hasApproved && !clean(dto.changeReason)) throw new BadRequestException("changeReason is required for a salary revision.");
    try { return await this.prisma.$transaction(async (tx) => { const value = await tx.employeeSalaryAssignment.create({ data: { employeeId, salaryStructureId: dto.salaryStructureId, grossSalary: new D(dto.grossSalary), ...dates, changeReason: clean(dto.changeReason), createdById: user.id } }); await audit(tx,user.id,"SALARY_ASSIGNMENT_CREATED","EmployeeSalaryAssignment",value.id,{employeeId}); return value; }); } catch(error) { normalizeSalaryPrismaError(error,{referenceMessage:"Employee or Salary Structure was not found."}); }
  }
  async updateAssignment(id: string, dto: UpdateSalaryAssignmentDto) { const existing=await this.prisma.employeeSalaryAssignment.findUnique({where:{id}}); if(!existing) throw new NotFoundException("Salary Assignment was not found."); requireDraft(existing.status,"Salary Assignment"); if(dto.salaryStructureId)await this.requireStructure(dto.salaryStructureId);const from=dto.effectiveFrom?parseIsoDate(dto.effectiveFrom,"effectiveFrom"):existing.effectiveFrom; const to=dto.effectiveTo===undefined?existing.effectiveTo:dto.effectiveTo===null?null:parseIsoDate(dto.effectiveTo,"effectiveTo"); assertDateRange(from,to); if(dto.grossSalary) positive(dto.grossSalary,"Gross Salary"); try{return await this.prisma.employeeSalaryAssignment.update({where:{id},data:{...(dto.salaryStructureId===undefined?{}:{salaryStructureId:dto.salaryStructureId}),...(dto.grossSalary===undefined?{}:{grossSalary:new D(dto.grossSalary)}),effectiveFrom:from,effectiveTo:to,...(dto.changeReason===undefined?{}:{changeReason:clean(dto.changeReason)})}});}catch(error){normalizeSalaryPrismaError(error,{referenceMessage:"Salary Structure was not found.",notFoundMessage:"Salary Assignment was not found."});} }
  async approveAssignment(id: string, user: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const value = await tx.employeeSalaryAssignment.findUnique({ where: { id }, include: { salaryStructure: true, employee: true } });
        if (!value) throw new NotFoundException("Salary Assignment was not found.");
        requireDraft(value.status, "Salary Assignment");
        if (!value.employee.isActive || value.employee.isDeleted) throw new BadRequestException("Employee must be active.");
        if (value.salaryStructure.status !== SalaryConfigurationStatus.APPROVED) throw new BadRequestException("Salary Structure must be APPROVED.");
        positive(value.grossSalary, "Gross Salary");
        const approvedHistory = await tx.employeeSalaryAssignment.count({ where: { id: { not: id }, employeeId: value.employeeId, status: SalaryConfigurationStatus.APPROVED } });
        if (approvedHistory && !clean(value.changeReason)) throw new BadRequestException("changeReason is required for a salary revision.");
        await closePredecessor(tx, "assignment", value.employeeId, value.effectiveFrom, id, user.id);
        await assertNoOverlap(tx, "assignment", value.employeeId, value.effectiveFrom, value.effectiveTo, id);
        const approved = await tx.employeeSalaryAssignment.update({ where: { id }, data: { status: SalaryConfigurationStatus.APPROVED, approvedById: user.id, approvedAt: new Date() } });
        await audit(tx, user.id, "SALARY_ASSIGNMENT_APPROVED", "EmployeeSalaryAssignment", id, { employeeId: value.employeeId });
        return approved;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      normalizeSalaryPrismaError(error, { notFoundMessage: "Salary Assignment was not found.", overlapMessage: "Approved assignment effective dates overlap an existing record." });
    }
  }

  listProfiles(employeeId:string){return this.prisma.employeePaymentProfile.findMany({where:{employeeId},orderBy:{effectiveFrom:"desc"}}).then((rows)=>rows.map(withPolicyCashShare));}
  async createProfile(employeeId:string,dto:CreatePaymentProfileDto,user:AuthenticatedUser){await this.requireEmployee(employeeId);const percentage=new D(dto.selectedBankPercentage??"60");validatePayment(percentage,dto);const dates=dateRange(dto.effectiveFrom,dto.effectiveTo);const hasApproved=await this.prisma.employeePaymentProfile.count({where:{employeeId,status:SalaryConfigurationStatus.APPROVED}});if(hasApproved&&!clean(dto.changeReason))throw new BadRequestException("changeReason is required for a payment profile revision.");try{return await this.prisma.$transaction(async(tx)=>{const value=await tx.employeePaymentProfile.create({data:{employeeId,selectedBankPercentage:percentage,bankName:clean(dto.bankName),accountName:clean(dto.accountName),accountNumber:clean(dto.accountNumber),branchName:clean(dto.branchName),...dates,changeReason:clean(dto.changeReason),createdById:user.id}});await audit(tx,user.id,"PAYMENT_PROFILE_CREATED","EmployeePaymentProfile",value.id,{employeeId,nonStandard:!percentage.equals(STANDARD_BANK_PERCENTAGE)});if(!percentage.equals(STANDARD_BANK_PERCENTAGE))await audit(tx,user.id,"NON_STANDARD_BANK_PERCENTAGE_CONFIGURED","EmployeePaymentProfile",value.id,{employeeId,selectedBankPercentage:percentage.toFixed(6)});return withPolicyCashShare(value);});}catch(error){normalizeSalaryPrismaError(error,{referenceMessage:"Employee was not found."});}}
  async updateProfile(id:string,dto:UpdatePaymentProfileDto){const existing=await this.prisma.employeePaymentProfile.findUnique({where:{id}});if(!existing)throw new NotFoundException("Payment Profile was not found.");requireDraft(existing.status,"Payment Profile");const percentage=dto.selectedBankPercentage===undefined?existing.selectedBankPercentage:new D(dto.selectedBankPercentage);const merged={bankName:dto.bankName===undefined?existing.bankName:dto.bankName,accountName:dto.accountName===undefined?existing.accountName:dto.accountName,accountNumber:dto.accountNumber===undefined?existing.accountNumber:dto.accountNumber,branchName:dto.branchName===undefined?existing.branchName:dto.branchName,changeReason:dto.changeReason===undefined?existing.changeReason:dto.changeReason};validatePayment(percentage,merged);const from=dto.effectiveFrom?parseIsoDate(dto.effectiveFrom,"effectiveFrom"):existing.effectiveFrom;const to=dto.effectiveTo===undefined?existing.effectiveTo:dto.effectiveTo===null?null:parseIsoDate(dto.effectiveTo,"effectiveTo");assertDateRange(from,to);try{return await this.prisma.employeePaymentProfile.update({where:{id},data:{selectedBankPercentage:percentage,bankName:clean(merged.bankName),accountName:clean(merged.accountName),accountNumber:clean(merged.accountNumber),branchName:clean(merged.branchName),changeReason:clean(merged.changeReason),effectiveFrom:from,effectiveTo:to}}).then(withPolicyCashShare);}catch(error){normalizeSalaryPrismaError(error,{notFoundMessage:"Payment Profile was not found."});}}
  async approveProfile(id:string,user:AuthenticatedUser){
    try {
      return await this.prisma.$transaction(async(tx)=>{const value=await tx.employeePaymentProfile.findUnique({where:{id},include:{employee:true}});if(!value)throw new NotFoundException("Payment Profile was not found.");requireDraft(value.status,"Payment Profile");if(!value.employee.isActive||value.employee.isDeleted)throw new BadRequestException("Employee must be active.");validatePayment(value.selectedBankPercentage,value);const approvedHistory=await tx.employeePaymentProfile.count({where:{id:{not:id},employeeId:value.employeeId,status:SalaryConfigurationStatus.APPROVED}});if(approvedHistory&&!clean(value.changeReason))throw new BadRequestException("changeReason is required for a payment profile revision.");await closePredecessor(tx,"profile",value.employeeId,value.effectiveFrom,id,user.id);await assertNoOverlap(tx,"profile",value.employeeId,value.effectiveFrom,value.effectiveTo,id);const approved=await tx.employeePaymentProfile.update({where:{id},data:{status:SalaryConfigurationStatus.APPROVED,approvedById:user.id,approvedAt:new Date()}});await audit(tx,user.id,"PAYMENT_PROFILE_APPROVED","EmployeePaymentProfile",id,{employeeId:value.employeeId});return withPolicyCashShare(approved);},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    } catch (error) {
      normalizeSalaryPrismaError(error, { notFoundMessage: "Payment Profile was not found.", overlapMessage: "Approved payment profile effective dates overlap an existing record." });
    }
  }

  async preview(dto:SalaryPreviewDto){if(Boolean(dto.salaryStructureId)===Boolean(dto.components))throw new BadRequestException("Provide either salaryStructureId or draft components.");let components:SalaryComponentDto[];if(dto.salaryStructureId){const structure=await this.prisma.salaryStructure.findUnique({where:{id:dto.salaryStructureId},include:{components:true}});if(!structure)throw new NotFoundException("Salary Structure was not found.");if(structure.status!==SalaryConfigurationStatus.APPROVED)throw new BadRequestException("Salary Structure must be APPROVED for preview by ID.");components=structure.components.map((c)=>({...c,percentage:c.percentage.toString()}));}else{components=dto.components!;validateComponents(components);}return this.calculator.calculate({grossSalary:dto.grossSalary,components:components.map((c)=>({...c,percentage:new D(c.percentage)})),attendanceDeduction:dto.attendanceDeduction??"0",providentFundDeduction:dto.providentFundDeduction??"0",loanOrSalaryAdvanceDeduction:dto.loanOrSalaryAdvanceDeduction??"0",aitDeduction:dto.aitDeduction??"0",otherApprovedDeductions:dto.otherApprovedDeductions??[],selectedBankPercentage:dto.selectedBankPercentage});}
  private async requireEmployee(id:string){const value=await this.prisma.employee.findFirst({where:{id,isDeleted:false}});if(!value)throw new NotFoundException("Employee was not found.");return value;}
  private async requireStructure(id:string){const value=await this.prisma.salaryStructure.findUnique({where:{id},select:{id:true}});if(!value)throw new NotFoundException("Salary Structure was not found.");return value;}
}

function clean(value:string|null|undefined){const result=value?.trim();return result?result:null;}
function dateRange(from:string,to?:string){const effectiveFrom=parseIsoDate(from,"effectiveFrom");const effectiveTo=to?parseIsoDate(to,"effectiveTo"):null;assertDateRange(effectiveFrom,effectiveTo);return{effectiveFrom,effectiveTo};}
function assertDateRange(from:Date,to:Date|null){if(to&&to<=from)throw new BadRequestException("effectiveTo must be later than effectiveFrom.");}
function positive(value:string|Prisma.Decimal,label:string){if(new D(value).lessThanOrEqualTo(0))throw new BadRequestException(`${label} must be greater than zero.`);}
function requireDraft(status:SalaryConfigurationStatus,label:string){if(status!==SalaryConfigurationStatus.DRAFT)throw new ConflictException(`${label} is immutable unless it is DRAFT.`);}
function validateComponents(components:Array<{code:string;percentage:string|Prisma.Decimal;displayOrder:number}>){if(!components.length)throw new BadRequestException("At least one salary component is required.");const codes=new Set<string>();const orders=new Set<number>();let total=new D(0);for(const c of components){const code=c.code.trim().toUpperCase();if(codes.has(code))throw new BadRequestException("Salary component codes must be unique.");if(orders.has(c.displayOrder))throw new BadRequestException("Salary component displayOrder values must be unique.");codes.add(code);orders.add(c.displayOrder);const percentage=new D(c.percentage);if(percentage.lessThanOrEqualTo(0)||percentage.greaterThan(100))throw new BadRequestException("Component percentage must be greater than zero and at most 100.");total=total.plus(percentage);}if(!total.equals(100))throw new BadRequestException("Salary component percentages must total exactly 100.0000.");}
function componentData(components:SalaryComponentDto[]){return components.map((c)=>({code:c.code.toUpperCase(),name:c.name,percentage:new D(c.percentage),displayOrder:c.displayOrder}));}
function validatePayment(percentage:Prisma.Decimal,value:{bankName?:string|null;accountName?:string|null;accountNumber?:string|null;changeReason?:string|null}){if(percentage.lessThan(0)||percentage.greaterThan(100))throw new BadRequestException("Selected Bank Percentage must be between 0 and 100.");if(percentage.greaterThan(0)&&(!clean(value.bankName)||!clean(value.accountName)||!clean(value.accountNumber)))throw new BadRequestException("Bank name, account name, and account number are required when Bank Percentage is greater than zero.");if(!percentage.equals(STANDARD_BANK_PERCENTAGE)&&!clean(value.changeReason))throw new BadRequestException("changeReason is required for a non-standard Bank Percentage.");}
function withPolicyCashShare<T extends {selectedBankPercentage:Prisma.Decimal}>(value:T){return{...value,policyCashShare:new D(100).minus(value.selectedBankPercentage).toFixed(6)};}
async function audit(tx:Prisma.TransactionClient,userId:string,action:string,entityType:string,entityId:string,metadata?:Prisma.InputJsonObject){await tx.auditEvent.create({data:{userId,action,entityType,entityId,metadata}});}
type EffectiveKind="assignment"|"profile";
async function closePredecessor(tx:Prisma.TransactionClient,kind:EffectiveKind,employeeId:string,start:Date,currentId:string,userId:string){const model=kind==="assignment"?tx.employeeSalaryAssignment:tx.employeePaymentProfile;const predecessor=await (model as typeof tx.employeeSalaryAssignment).findFirst({where:{id:{not:currentId},employeeId,status:SalaryConfigurationStatus.APPROVED,effectiveTo:null,effectiveFrom:{lt:start}},orderBy:{effectiveFrom:"desc"}});if(predecessor){await (model as typeof tx.employeeSalaryAssignment).update({where:{id:predecessor.id},data:{effectiveTo:start}});await audit(tx,userId,"SALARY_EFFECTIVE_RANGE_CLOSED",kind==="assignment"?"EmployeeSalaryAssignment":"EmployeePaymentProfile",predecessor.id,{employeeId,newEffectiveTo:start.toISOString()});}}
async function assertNoOverlap(tx:Prisma.TransactionClient,kind:EffectiveKind,employeeId:string,start:Date,end:Date|null,currentId:string){const where={id:{not:currentId},employeeId,status:SalaryConfigurationStatus.APPROVED,effectiveFrom:end?{lt:end}:undefined,OR:[{effectiveTo:null},{effectiveTo:{gt:start}}]};const model=kind==="assignment"?tx.employeeSalaryAssignment:tx.employeePaymentProfile;const overlap=await (model as typeof tx.employeeSalaryAssignment).findFirst({where,select:{id:true}});if(overlap)throw new ConflictException(`Approved ${kind} effective dates overlap an existing record.`);}
