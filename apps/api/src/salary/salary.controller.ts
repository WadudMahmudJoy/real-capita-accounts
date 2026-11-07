import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreatePaymentProfileDto, CreateSalaryAssignmentDto, CreateSalaryStructureDto, SalaryPreviewDto, UpdatePaymentProfileDto, UpdateSalaryAssignmentDto, UpdateSalaryStructureDto } from "./dto/salary.dto";
import { SalaryService } from "./salary.service";

@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class SalaryController {
  constructor(private readonly service: SalaryService) {}
  @Get("salary-structures") listStructures(){return this.service.listStructures();}
  @Post("salary-structures") createStructure(@Body() dto:CreateSalaryStructureDto,@CurrentUser() user:AuthenticatedUser){return this.service.createStructure(dto,user);}
  @Get("salary-structures/:id") getStructure(@Param("id") id:string){return this.service.getStructure(id);}
  @Patch("salary-structures/:id") updateStructure(@Param("id") id:string,@Body() dto:UpdateSalaryStructureDto,@CurrentUser() user:AuthenticatedUser){return this.service.updateStructure(id,dto,user);}
  @Post("salary-structures/:id/approve") approveStructure(@Param("id") id:string,@CurrentUser() user:AuthenticatedUser){return this.service.approveStructure(id,user);}
  @Post("salary-structures/:id/inactivate") inactivateStructure(@Param("id") id:string,@CurrentUser() user:AuthenticatedUser){return this.service.inactivateStructure(id,user);}
  @Get("employees/:employeeId/salary-assignments") listAssignments(@Param("employeeId") employeeId:string){return this.service.listAssignments(employeeId);}
  @Post("employees/:employeeId/salary-assignments") createAssignment(@Param("employeeId") employeeId:string,@Body() dto:CreateSalaryAssignmentDto,@CurrentUser() user:AuthenticatedUser){return this.service.createAssignment(employeeId,dto,user);}
  @Patch("salary-assignments/:id") updateAssignment(@Param("id") id:string,@Body() dto:UpdateSalaryAssignmentDto){return this.service.updateAssignment(id,dto);}
  @Post("salary-assignments/:id/approve") approveAssignment(@Param("id") id:string,@CurrentUser() user:AuthenticatedUser){return this.service.approveAssignment(id,user);}
  @Get("employees/:employeeId/payment-profiles") listProfiles(@Param("employeeId") employeeId:string){return this.service.listProfiles(employeeId);}
  @Post("employees/:employeeId/payment-profiles") createProfile(@Param("employeeId") employeeId:string,@Body() dto:CreatePaymentProfileDto,@CurrentUser() user:AuthenticatedUser){return this.service.createProfile(employeeId,dto,user);}
  @Patch("payment-profiles/:id") updateProfile(@Param("id") id:string,@Body() dto:UpdatePaymentProfileDto){return this.service.updateProfile(id,dto);}
  @Post("payment-profiles/:id/approve") approveProfile(@Param("id") id:string,@CurrentUser() user:AuthenticatedUser){return this.service.approveProfile(id,user);}
  @Post("salary-calculations/preview") preview(@Body() dto:SalaryPreviewDto){return this.service.preview(dto);}
}
