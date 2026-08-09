import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { parseIsoDate } from "../common/date-rules";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from "./dto/employee.dto";

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListEmployeesQueryDto) {
    return this.prisma.employee.findMany({
      where: {
        ...(query.includeDeleted ? {} : { isDeleted: false }),
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { employeeCode: "asc" },
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, isDeleted: false },
      include: { _count: { select: { salaryAssignments: true, paymentProfiles: true } } },
    });
    if (!employee) throw new NotFoundException("Employee was not found.");
    return employee;
  }

  async create(dto: CreateEmployeeDto, user: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.create({ data: { ...dto, joiningDate: parseIsoDate(dto.joiningDate, "joiningDate") } });
        await tx.auditEvent.create({ data: { userId: user.id, action: "EMPLOYEE_CREATED", entityType: "Employee", entityId: employee.id } });
        return employee;
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(error, "Employee code already exists.");
    }
  }

  async update(id: string, dto: UpdateEmployeeDto, user: AuthenticatedUser) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Employee was not found.");
    if (existing.isDeleted) throw new ConflictException("Deleted employee cannot be updated.");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.update({
          where: { id },
          data: {
            ...(dto.employeeCode === undefined ? {} : { employeeCode: dto.employeeCode }),
            ...(dto.fullName === undefined ? {} : { fullName: dto.fullName }),
            ...(dto.designation === undefined ? {} : { designation: dto.designation }),
            ...(dto.joiningDate === undefined ? {} : { joiningDate: parseIsoDate(dto.joiningDate, "joiningDate") }),
            ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
            ...(dto.isDeleted === undefined ? {} : { isDeleted: dto.isDeleted, deletedAt: dto.isDeleted ? new Date() : null, isActive: dto.isDeleted ? false : dto.isActive }),
          },
        });
        await tx.auditEvent.create({ data: { userId: user.id, action: dto.isDeleted || dto.isActive === false ? "EMPLOYEE_DEACTIVATED" : "EMPLOYEE_UPDATED", entityType: "Employee", entityId: id } });
        return employee;
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(error, "Employee code already exists.");
    }
  }
}
