import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from "./dto/employee.dto";
import {
  BANGLADESH_MOBILE_PATTERN,
  EMPLOYEE_CODE_PATTERN,
  assertEmployeeRules,
  maskMobile,
  maskNationalId,
  normalizeBangladeshMobile,
  normalizeEmail,
  normalizeNationalId,
  normalizeOptionalBangladeshMobile,
  nullableTrimmed,
  parseDateOnly,
  parseOptionalDateOnly,
} from "./employee-rules";

const employeeDetailSelect = {
  id: true,
  employeeCode: true,
  fullName: true,
  bengaliName: true,
  dateOfBirth: true,
  nationalId: true,
  bloodGroup: true,
  mobileNumber: true,
  alternateMobileNumber: true,
  personalEmail: true,
  officialEmail: true,
  presentAddress: true,
  permanentAddress: true,
  designation: true,
  departmentId: true,
  department: { select: { id: true, code: true, name: true, isActive: true } },
  joiningDate: true,
  confirmationDate: true,
  separationDate: true,
  separationReason: true,
  emergencyContactName: true,
  emergencyContactRelationship: true,
  emergencyContactMobile: true,
  emergencyContactAddress: true,
  isActive: true,
  _count: { select: { salaryAssignments: true, paymentProfiles: true } },
} satisfies Prisma.EmployeeSelect;

type EmployeeDetailRow = Prisma.EmployeeGetPayload<{
  select: typeof employeeDetailSelect;
}>;

const identityFields = [
  "fullName",
  "bengaliName",
  "dateOfBirth",
  "nationalId",
  "bloodGroup",
] as const;
const contactFields = [
  "mobileNumber",
  "alternateMobileNumber",
  "personalEmail",
  "officialEmail",
  "presentAddress",
  "permanentAddress",
] as const;
const employmentFields = [
  "designation",
  "departmentId",
  "joiningDate",
  "confirmationDate",
  "separationDate",
  "separationReason",
] as const;
const emergencyFields = [
  "emergencyContactName",
  "emergencyContactRelationship",
  "emergencyContactMobile",
  "emergencyContactAddress",
] as const;

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListEmployeesQueryDto) {
    const search = query.search?.trim();
    const employees = await this.prisma.employee.findMany({
      where: {
        ...(query.includeDeleted ? {} : { isDeleted: false }),
        ...employeeActiveFilter(query),
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(search
          ? {
              OR: [
                { employeeCode: { contains: search, mode: "insensitive" } },
                { fullName: { contains: search, mode: "insensitive" } },
                { designation: { contains: search, mode: "insensitive" } },
                {
                  department: {
                    is: {
                      OR: [
                        { code: { contains: search, mode: "insensitive" } },
                        { name: { contains: search, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        designation: true,
        department: { select: { id: true, code: true, name: true } },
        mobileNumber: true,
        joiningDate: true,
        isActive: true,
      },
      orderBy: { employeeCode: "asc" },
    });

    return employees.map(({ mobileNumber, ...employee }) => ({
      ...employee,
      mobileNumberMasked: maskMobile(mobileNumber),
    }));
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, isDeleted: false },
      select: employeeDetailSelect,
    });
    if (!employee) throw new NotFoundException("Employee was not found.");
    return safeDetail(employee);
  }

  async create(dto: CreateEmployeeDto, user: AuthenticatedUser) {
    const state = normalizedCreateState(dto);
    assertWritableFormats(state.employeeCode, state, true);
    assertEmployeeRules(state);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await requireActiveDepartment(tx, state.departmentId);
        await assertEmployeeUnique(tx, {
          employeeCode: state.employeeCode,
          nationalId: state.nationalId,
          officialEmail: state.officialEmail,
        });

        const employee = await tx.employee.create({
          data: state,
          select: employeeDetailSelect,
        });
        await audit(
          tx,
          user.id,
          "EMPLOYEE_CREATED",
          "Employee",
          employee.id,
        );
        return safeDetail(employee);
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Employee code, National ID, or official email is already assigned to another employee.",
      );
    }
  }

  async update(id: string, dto: UpdateEmployeeDto, user: AuthenticatedUser) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one editable Employee field is required.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.employee.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException("Employee was not found.");
        if (existing.isDeleted) {
          throw new ConflictException("Deleted employee cannot be updated.");
        }

        const state = normalizedUpdateState(existing, dto);
        assertWritableFormats(existing.employeeCode, state, false);
        assertEmployeeRules(state);

        if (state.departmentId !== existing.departmentId) {
          await requireActiveDepartment(tx, state.departmentId);
        }
        if (
          state.nationalId !== existing.nationalId ||
          state.officialEmail !== existing.officialEmail
        ) {
          await assertEmployeeUnique(tx, {
            employeeCode: existing.employeeCode,
            nationalId: state.nationalId,
            officialEmail: state.officialEmail,
            excludeId: id,
            skipEmployeeCode: true,
          });
        }

        const identityChanged = changedFields(existing, state, identityFields);
        const contactChanged = changedFields(existing, state, contactFields);
        const employmentChanged = changedFields(existing, state, employmentFields);
        const emergencyChanged = changedFields(existing, state, emergencyFields);
        const activeChanged = existing.isActive !== state.isActive;

        if (
          identityChanged.length === 0 &&
          contactChanged.length === 0 &&
          employmentChanged.length === 0 &&
          emergencyChanged.length === 0 &&
          !activeChanged
        ) {
          const unchanged = await tx.employee.findUniqueOrThrow({
            where: { id },
            select: employeeDetailSelect,
          });
          return safeDetail(unchanged);
        }

        const employee = await tx.employee.update({
          where: { id },
          data: {
            fullName: state.fullName,
            bengaliName: state.bengaliName,
            dateOfBirth: state.dateOfBirth,
            nationalId: state.nationalId,
            bloodGroup: state.bloodGroup,
            mobileNumber: state.mobileNumber,
            alternateMobileNumber: state.alternateMobileNumber,
            personalEmail: state.personalEmail,
            officialEmail: state.officialEmail,
            presentAddress: state.presentAddress,
            permanentAddress: state.permanentAddress,
            designation: state.designation,
            departmentId: state.departmentId,
            joiningDate: state.joiningDate,
            confirmationDate: state.confirmationDate,
            separationDate: state.separationDate,
            separationReason: state.separationReason,
            emergencyContactName: state.emergencyContactName,
            emergencyContactRelationship: state.emergencyContactRelationship,
            emergencyContactMobile: state.emergencyContactMobile,
            emergencyContactAddress: state.emergencyContactAddress,
            isActive: state.isActive,
          },
          select: employeeDetailSelect,
        });

        if (identityChanged.length > 0) {
          await audit(tx, user.id, "EMPLOYEE_IDENTITY_UPDATED", "Employee", id, {
            changedFields: identityChanged,
            sensitiveSectionChanged: true,
          });
        }
        if (contactChanged.length > 0) {
          await audit(tx, user.id, "EMPLOYEE_CONTACT_UPDATED", "Employee", id, {
            changedFields: contactChanged,
            sensitiveSectionChanged: true,
          });
        }
        if (employmentChanged.length > 0) {
          await audit(tx, user.id, "EMPLOYEE_EMPLOYMENT_UPDATED", "Employee", id, {
            changedFields: employmentChanged,
            ...(existing.departmentId === state.departmentId
              ? {}
              : {
                  oldDepartmentId: existing.departmentId,
                  newDepartmentId: state.departmentId,
                }),
            ...(employmentChanged.includes("separationReason")
              ? { sensitiveSectionChanged: true }
              : {}),
          });
        }
        if (emergencyChanged.length > 0) {
          await audit(
            tx,
            user.id,
            "EMPLOYEE_EMERGENCY_CONTACT_UPDATED",
            "Employee",
            id,
            {
              changedFields: emergencyChanged,
              sensitiveSectionChanged: true,
            },
          );
        }
        if (activeChanged) {
          await audit(
            tx,
            user.id,
            state.isActive ? "EMPLOYEE_REACTIVATED" : "EMPLOYEE_DEACTIVATED",
            "Employee",
            id,
            { oldIsActive: existing.isActive, newIsActive: state.isActive },
          );
        }

        return safeDetail(employee);
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "National ID or official email is already assigned to another employee.",
      );
    }
  }
}

function employeeActiveFilter(query: ListEmployeesQueryDto): Prisma.EmployeeWhereInput {
  if (query.status === "ALL") return {};
  if (query.status === "INACTIVE") return { isActive: false };
  if (query.status === "ACTIVE") return { isActive: true };
  return query.includeInactive ? {} : { isActive: true };
}

function normalizedCreateState(dto: CreateEmployeeDto) {
  return {
    employeeCode: dto.employeeCode.trim().toUpperCase(),
    fullName: dto.fullName.trim(),
    bengaliName: nullableTrimmed(dto.bengaliName),
    dateOfBirth: parseOptionalDateOnly(dto.dateOfBirth, "dateOfBirth"),
    nationalId: normalizeNationalId(dto.nationalId),
    bloodGroup: dto.bloodGroup ?? null,
    mobileNumber: normalizeBangladeshMobile(dto.mobileNumber),
    alternateMobileNumber: normalizeOptionalBangladeshMobile(
      dto.alternateMobileNumber,
    ),
    personalEmail: normalizeEmail(dto.personalEmail),
    officialEmail: normalizeEmail(dto.officialEmail),
    presentAddress: nullableTrimmed(dto.presentAddress),
    permanentAddress: nullableTrimmed(dto.permanentAddress),
    designation: dto.designation.trim(),
    departmentId: dto.departmentId.trim(),
    joiningDate: parseDateOnly(dto.joiningDate, "joiningDate"),
    confirmationDate: parseOptionalDateOnly(
      dto.confirmationDate,
      "confirmationDate",
    ),
    separationDate: parseOptionalDateOnly(dto.separationDate, "separationDate"),
    separationReason: nullableTrimmed(dto.separationReason),
    emergencyContactName: nullableTrimmed(dto.emergencyContactName),
    emergencyContactRelationship: nullableTrimmed(
      dto.emergencyContactRelationship,
    ),
    emergencyContactMobile: normalizeOptionalBangladeshMobile(
      dto.emergencyContactMobile,
    ),
    emergencyContactAddress: nullableTrimmed(dto.emergencyContactAddress),
    isActive: dto.isActive ?? true,
  };
}

function normalizedUpdateState(
  existing: Prisma.EmployeeGetPayload<Record<string, never>>,
  dto: UpdateEmployeeDto,
) {
  return {
    fullName: dto.fullName === undefined ? existing.fullName : dto.fullName.trim(),
    bengaliName:
      dto.bengaliName === undefined
        ? existing.bengaliName
        : nullableTrimmed(dto.bengaliName),
    dateOfBirth:
      dto.dateOfBirth === undefined
        ? existing.dateOfBirth
        : parseOptionalDateOnly(dto.dateOfBirth, "dateOfBirth"),
    nationalId:
      dto.nationalId === undefined
        ? existing.nationalId
        : normalizeNationalId(dto.nationalId),
    bloodGroup: dto.bloodGroup === undefined ? existing.bloodGroup : dto.bloodGroup,
    mobileNumber:
      dto.mobileNumber === undefined
        ? existing.mobileNumber
        : normalizeBangladeshMobile(dto.mobileNumber),
    alternateMobileNumber:
      dto.alternateMobileNumber === undefined
        ? existing.alternateMobileNumber
        : normalizeOptionalBangladeshMobile(dto.alternateMobileNumber),
    personalEmail:
      dto.personalEmail === undefined
        ? existing.personalEmail
        : normalizeEmail(dto.personalEmail),
    officialEmail:
      dto.officialEmail === undefined
        ? existing.officialEmail
        : normalizeEmail(dto.officialEmail),
    presentAddress:
      dto.presentAddress === undefined
        ? existing.presentAddress
        : nullableTrimmed(dto.presentAddress),
    permanentAddress:
      dto.permanentAddress === undefined
        ? existing.permanentAddress
        : nullableTrimmed(dto.permanentAddress),
    designation:
      dto.designation === undefined ? existing.designation : dto.designation.trim(),
    departmentId:
      dto.departmentId === undefined ? existing.departmentId : dto.departmentId.trim(),
    joiningDate:
      dto.joiningDate === undefined
        ? existing.joiningDate
        : parseDateOnly(dto.joiningDate, "joiningDate"),
    confirmationDate:
      dto.confirmationDate === undefined
        ? existing.confirmationDate
        : parseOptionalDateOnly(dto.confirmationDate, "confirmationDate"),
    separationDate:
      dto.separationDate === undefined
        ? existing.separationDate
        : parseOptionalDateOnly(dto.separationDate, "separationDate"),
    separationReason:
      dto.separationReason === undefined
        ? existing.separationReason
        : nullableTrimmed(dto.separationReason),
    emergencyContactName:
      dto.emergencyContactName === undefined
        ? existing.emergencyContactName
        : nullableTrimmed(dto.emergencyContactName),
    emergencyContactRelationship:
      dto.emergencyContactRelationship === undefined
        ? existing.emergencyContactRelationship
        : nullableTrimmed(dto.emergencyContactRelationship),
    emergencyContactMobile:
      dto.emergencyContactMobile === undefined
        ? existing.emergencyContactMobile
        : normalizeOptionalBangladeshMobile(dto.emergencyContactMobile),
    emergencyContactAddress:
      dto.emergencyContactAddress === undefined
        ? existing.emergencyContactAddress
        : nullableTrimmed(dto.emergencyContactAddress),
    isActive: dto.isActive === undefined ? existing.isActive : dto.isActive,
  };
}

function assertWritableFormats(
  employeeCode: string,
  state: ReturnType<typeof normalizedCreateState> | ReturnType<typeof normalizedUpdateState>,
  requireDepartment: boolean,
) {
  if (!EMPLOYEE_CODE_PATTERN.test(employeeCode)) {
    throw new BadRequestException("Employee Code has an invalid format.");
  }
  if (!state.fullName || !state.designation || (requireDepartment && !state.departmentId)) {
    throw new BadRequestException(
      "Full Name, Designation, and Department are required.",
    );
  }
  for (const [field, value] of [
    ["Mobile Number", state.mobileNumber],
    ["Alternate Mobile Number", state.alternateMobileNumber],
    ["Emergency Contact Mobile", state.emergencyContactMobile],
  ] as const) {
    if (value && !BANGLADESH_MOBILE_PATTERN.test(value)) {
      throw new BadRequestException(`${field} must be a valid Bangladesh mobile number.`);
    }
  }
  if (state.nationalId && !/^\d{10,17}$/.test(state.nationalId)) {
    throw new BadRequestException("National ID must contain 10 to 17 digits.");
  }
}

async function requireActiveDepartment(
  tx: Prisma.TransactionClient,
  departmentId: string | null,
) {
  if (!departmentId) {
    throw new BadRequestException("Department is required.");
  }
  const department = await tx.department.findUnique({
    where: { id: departmentId },
    select: { isActive: true },
  });
  if (!department) throw new NotFoundException("Department was not found.");
  if (!department.isActive) {
    throw new ConflictException("Inactive Department cannot be assigned.");
  }
}

async function assertEmployeeUnique(
  tx: Prisma.TransactionClient,
  values: {
    employeeCode: string;
    nationalId: string | null;
    officialEmail: string | null;
    excludeId?: string;
    skipEmployeeCode?: boolean;
  },
) {
  const exclude = values.excludeId ? { id: { not: values.excludeId } } : {};
  if (!values.skipEmployeeCode) {
    const duplicateCode = await tx.employee.findFirst({
      where: { employeeCode: values.employeeCode, ...exclude },
      select: { id: true },
    });
    if (duplicateCode) throw new ConflictException("Employee code already exists.");
  }
  if (values.nationalId) {
    const duplicateNid = await tx.employee.findFirst({
      where: { nationalId: values.nationalId, ...exclude },
      select: { id: true },
    });
    if (duplicateNid) {
      throw new ConflictException(
        "National ID is already assigned to another employee.",
      );
    }
  }
  if (values.officialEmail) {
    const duplicateEmail = await tx.employee.findFirst({
      where: { officialEmail: values.officialEmail, ...exclude },
      select: { id: true },
    });
    if (duplicateEmail) {
      throw new ConflictException(
        "Official email is already assigned to another employee.",
      );
    }
  }
}

function changedFields<
  TExisting extends Record<string, unknown>,
  TState extends Record<string, unknown>,
  TKey extends keyof TExisting & keyof TState & string,
>(existing: TExisting, state: TState, fields: readonly TKey[]): string[] {
  return fields.filter((field) => !sameValue(existing[field], state[field]));
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  return left === right;
}

function safeDetail(row: EmployeeDetailRow) {
  const { nationalId, ...detail } = row;
  return {
    ...detail,
    hasNationalId: Boolean(nationalId),
    nationalIdMasked: maskNationalId(nationalId),
  };
}

async function audit(
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonObject,
) {
  await tx.auditEvent.create({
    data: { userId, action, entityType, entityId, metadata },
  });
}
