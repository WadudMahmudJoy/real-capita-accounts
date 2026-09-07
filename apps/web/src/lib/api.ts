export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type AuthRole = {
  code: "ACCOUNTANT";
  name: "Accountant";
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  roles: AuthRole[];
};

export type AuthResponse = {
  status: "ok";
  message?: string;
  user: AuthUser;
};

// ---------------------------------------------------------------------------
// Accounting foundation resource types (Phase 2A)
// ---------------------------------------------------------------------------

export type NormalBalanceSide = "DEBIT" | "CREDIT";

export type AccountClassCode =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE";

export type CompanyBackgroundMode = "DEFAULT_PREMIUM" | "CUSTOM";

export type CompanyMediaKind =
  | "office-logo"
  | "custom-background"
  | "print-logo";

export type Company = {
  id: string;
  singletonKey: string | null;
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  isActive: boolean;
  officeLogoPath: string | null;
  brandAccentColor: string | null;
  backgroundMode: CompanyBackgroundMode;
  customBackgroundPath: string | null;
  printLogoPath: string | null;
  printHeaderName: string | null;
  printFooterText: string | null;
  createdAt: string;
  updatedAt: string;
};

/** GET /company/list — every office plus the caller's session selection. */
export type CompanyListResponse = {
  activeCompanyId: string | null;
  companies: Company[];
};

export type CompanySwitchResponse = {
  status: "ok";
  activeCompanyId: string;
  company: Company;
};

export type CompanyMediaResponse = {
  status: "ok";
  kind: CompanyMediaKind;
  company: Company;
};

export type FiscalYear = {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  company?: Company;
};

export type Project = {
  id: string;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountClass = {
  id: string;
  code: AccountClassCode;
  name: string;
  normalBalance: NormalBalanceSide;
  createdAt: string;
  updatedAt: string;
};

export type AccountingPeriodStatus = "OPEN" | "LOCKED" | "CLOSED";

export type CashBankAccountType = "CASH" | "BANK" | "MFS";

export type MfsProvider = "BKASH" | "NAGAD" | "ROCKET" | "UPAY" | "OTHER";

export type AccountingPeriod = {
  id: string;
  fiscalYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AccountingPeriodStatus;
  createdAt: string;
  updatedAt: string;
  fiscalYear?: FiscalYear;
};

export type CostCenter = {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  project?: Project;
};

export type AccountGroup = {
  id: string;
  accountClassId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accountClass?: AccountClass;
};

export type LedgerAccount = {
  id: string;
  accountGroupId: string;
  code: string;
  name: string;
  normalBalance: NormalBalanceSide;
  requiresProject: boolean;
  requiresCostCenter: boolean;
  isCashBank: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  accountGroup?: AccountGroup;
  cashBankAccounts?: CashBankAccount[];
};

export type CashBankAccount = {
  id: string;
  ledgerAccountId: string;
  displayName: string;
  accountType: CashBankAccountType;
  bankName: string | null;
  branch: string | null;
  accountNumber: string | null;
  provider: MfsProvider | null;
  providerOtherName: string | null;
  walletNumber: string | null;
  accountHolderName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  ledgerAccount?: LedgerAccount;
};

export type CustomerType = "INDIVIDUAL" | "COMPANY" | "OTHER";

export type Customer = {
  id: string;
  customerCode: string;
  customerType: CustomerType;
  name: string;
  phone: string;
  email: string | null;
  nidOrPassport: string | null;
  address: string;
  professionOrBusiness: string | null;
  nomineeOrReference: string | null;
  notes: string | null;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    bookings: number;
  };
};

export type BookableItemCategory =
  | "LAND"
  | "PLOT"
  | "FLAT"
  | "UNIT"
  | "SHARE"
  | "OTHER";

export type BookableItemStatus =
  | "AVAILABLE"
  | "HOLD"
  | "BOOKED"
  | "SOLD"
  | "CANCELLED";

export type BookableItem = {
  id: string;
  itemCode: string;
  projectId: string;
  category: BookableItemCategory;
  itemIdentifier: string;
  block: string | null;
  zone: string | null;
  phase: string | null;
  sizeOrArea: string | null;
  shareQuantity: string | null;
  basePrice: string;
  status: BookableItemStatus;
  notes: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project?: Project;
  bookings?: Booking[];
  _count?: {
    bookings: number;
  };
};

export type BookingAdministrativeStatus =
  | "DRAFT"
  | "ACTIVE"
  | "HOLD"
  | "CANCELLED"
  | "REFUNDED";

export type BookingFinancialStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "FULLY_PAID"
  | "OVERDUE";

export type BookingInstallment = {
  id: string;
  bookingId: string;
  installmentNo: number;
  dueDate: string;
  amount: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingSummary = {
  totalReceivable: string;
  totalCollected: string;
  totalDue: string;
  overdueAmount: string;
  overdueInstallmentCount: number;
  nextInstallmentDate: string | null;
  financialStatus: BookingFinancialStatus;
};

export type BookingReceiptAllocation = {
  id: string;
  bookingId: string;
  voucherId: string;
  amount: string;
  allocationDate: string;
  allocationReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  voucher?: Voucher;
};

export type Booking = {
  id: string;
  bookingNumber: string;
  customerId: string;
  projectId: string;
  bookableItemId: string;
  bookingDate: string;
  totalAgreedPrice: string;
  discountAmount: string;
  netBookingValue: string;
  bookingMoney: string | null;
  administrativeStatus: BookingAdministrativeStatus;
  remarks: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  project?: Project;
  bookableItem?: BookableItem;
  installments?: BookingInstallment[];
  receiptAllocations?: BookingReceiptAllocation[];
  summary?: BookingSummary;
};

export type CustomerInput = {
  customerType?: CustomerType;
  name: string;
  phone: string;
  email?: string | null;
  nidOrPassport?: string | null;
  address: string;
  professionOrBusiness?: string | null;
  nomineeOrReference?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type BookableItemInput = {
  projectId: string;
  category: BookableItemCategory;
  itemIdentifier: string;
  block?: string | null;
  zone?: string | null;
  phase?: string | null;
  sizeOrArea?: string | null;
  shareQuantity?: number | null;
  basePrice: number;
  status?: BookableItemStatus;
  notes?: string | null;
};

export type BookingInstallmentInput = {
  installmentNo: number;
  dueDate: string;
  amount: number;
  description?: string | null;
};

export type BookingInput = {
  customerId: string;
  projectId: string;
  bookableItemId: string;
  bookingDate: string;
  totalAgreedPrice: number;
  discountAmount?: number;
  bookingMoney?: number | null;
  administrativeStatus?: BookingAdministrativeStatus;
  remarks?: string | null;
  installments?: BookingInstallmentInput[];
};

export type CreateReceiptAllocationInput = {
  voucherId: string;
  amount: number;
  allocationDate: string;
  allocationReference?: string | null;
  notes?: string | null;
};

export type CustomerListFilters = {
  search?: string;
  customerType?: CustomerType;
  isActive?: boolean;
};

export type BookableItemListFilters = {
  projectId?: string;
  category?: BookableItemCategory;
  status?: BookableItemStatus;
  search?: string;
  includeDeleted?: boolean;
};

export type BookingListFilters = {
  customerId?: string;
  projectId?: string;
  bookableItemId?: string;
  administrativeStatus?: BookingAdministrativeStatus;
  search?: string;
  includeDeleted?: boolean;
};

export type ReceiptAllocationDeleteResult = {
  id: string;
  deleted: true;
};

// ---------------------------------------------------------------------------
// Salary Foundation resource types (Phase 1)
// ---------------------------------------------------------------------------

export type SalaryConfigurationStatus = "DRAFT" | "APPROVED" | "INACTIVE";

export type BloodGroup =
  | "A_POSITIVE"
  | "A_NEGATIVE"
  | "B_POSITIVE"
  | "B_NEGATIVE"
  | "AB_POSITIVE"
  | "AB_NEGATIVE"
  | "O_POSITIVE"
  | "O_NEGATIVE";

export type DepartmentSummary = {
  id: string;
  code: string;
  name: string;
};

export type Department = DepartmentSummary & {
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { employees: number };
};

export type DepartmentInput = {
  code: string;
  name: string;
  description?: string | null;
};

export type DepartmentUpdateInput = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
};

export type EmployeeListItem = {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string;
  department: DepartmentSummary | null;
  mobileNumberMasked: string | null;
  joiningDate: string;
  isActive: boolean;
};

export type WorkScheduleDayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type WorkScheduleDay = {
  dayOfWeek: WorkScheduleDayOfWeek;
  isWorkingDay: boolean;
  startMinuteOfDay: number | null;
  endMinuteOfDay: number | null;
  unpaidBreakMinutes: number;
  crossesMidnight: boolean;
};

export type WorkScheduleDefinition = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  days: WorkScheduleDay[];
  everAssigned: boolean;
};

export type WorkScheduleAssignment = {
  id: string;
  scope: "COMPANY_DEFAULT" | "EMPLOYEE_OVERRIDE";
  employeeId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  replacesAssignmentId: string | null;
  workSchedule: Omit<
    WorkScheduleDefinition,
    "createdAt" | "updatedAt" | "everAssigned"
  >;
};

export type EffectiveWorkSchedule =
  | {
      kind: "NOT_CONFIGURED";
      code: "WORK_SCHEDULE_NOT_CONFIGURED";
      businessDate: string;
    }
  | {
      kind: "RESOLVED";
      businessDate: string;
      assignmentId: string;
      source: "COMPANY_DEFAULT" | "EMPLOYEE_OVERRIDE";
      workScheduleId: string;
      code: string;
      name: string;
      dayOfWeek: WorkScheduleDayOfWeek;
      isWorkingDay: boolean;
      startMinuteOfDay: number | null;
      endMinuteOfDay: number | null;
      crossesMidnight: boolean;
      unpaidBreakMinutes: number;
      grossScheduledMinutes: number;
      expectedWorkMinutes: number;
      timeZone: "Asia/Dhaka";
    };

export type WorkScheduleDefinitionInput = {
  code?: string;
  name: string;
  description?: string | null;
  days: WorkScheduleDay[];
};

export type UpdateWorkScheduleInput = {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  days?: WorkScheduleDay[];
};

export type CreateWorkScheduleAssignmentInput = {
  scope: "COMPANY_DEFAULT" | "EMPLOYEE_OVERRIDE";
  employeeId?: string | null;
  workScheduleId?: string;
  newSchedule?: WorkScheduleDefinitionInput;
  effectiveFrom: string;
  effectiveTo?: string | null;
  changeReason?: string | null;
};

export type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  bengaliName: string | null;
  dateOfBirth: string | null;
  hasNationalId: boolean;
  nationalIdMasked: string | null;
  bloodGroup: BloodGroup | null;
  mobileNumber: string | null;
  alternateMobileNumber: string | null;
  personalEmail: string | null;
  officialEmail: string | null;
  presentAddress: string | null;
  permanentAddress: string | null;
  designation: string;
  departmentId: string | null;
  department: (DepartmentSummary & { isActive: boolean }) | null;
  joiningDate: string;
  confirmationDate: string | null;
  separationDate: string | null;
  separationReason: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactMobile: string | null;
  emergencyContactAddress: string | null;
  isActive: boolean;
  _count: {
    salaryAssignments: number;
    paymentProfiles: number;
  };
};

export type EmployeeInput = {
  employeeCode: string;
  fullName: string;
  designation: string;
  departmentId: string;
  joiningDate: string;
  mobileNumber: string;
  bengaliName?: string | null;
  dateOfBirth?: string | null;
  nationalId?: string | null;
  bloodGroup?: BloodGroup | null;
  alternateMobileNumber?: string | null;
  personalEmail?: string | null;
  officialEmail?: string | null;
  presentAddress?: string | null;
  permanentAddress?: string | null;
  confirmationDate?: string | null;
  separationDate?: string | null;
  separationReason?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactMobile?: string | null;
  emergencyContactAddress?: string | null;
  isActive?: boolean;
};

export type EmployeeUpdateInput = Partial<Omit<EmployeeInput, "employeeCode">>;

export type EmployeeListFilters = {
  includeInactive?: boolean;
  includeDeleted?: boolean;
  search?: string;
  departmentId?: string;
  status?: "ACTIVE" | "INACTIVE" | "ALL";
};

export type SalaryStructureComponent = {
  id?: string;
  salaryStructureId?: string;
  code: string;
  name: string;
  percentage: string;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SalaryStructure = {
  id: string;
  code: string;
  version: number;
  name: string;
  description: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: SalaryConfigurationStatus;
  createdById: string;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  components?: SalaryStructureComponent[];
};

export type SalaryStructureInput = {
  code: string;
  name: string;
  description?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  components: Array<Pick<SalaryStructureComponent, "code" | "name" | "percentage" | "displayOrder">>;
};

export type SalaryStructureUpdateInput = Omit<
  Partial<SalaryStructureInput>,
  "code"
>;

export type EmployeeSalaryAssignment = {
  id: string;
  employeeId: string;
  salaryStructureId: string;
  grossSalary: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: SalaryConfigurationStatus;
  changeReason: string | null;
  createdById: string;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  salaryStructure?: SalaryStructure;
};

export type SalaryAssignmentInput = {
  salaryStructureId: string;
  grossSalary: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  changeReason?: string | null;
};

export type EmployeePaymentProfile = {
  id: string;
  employeeId: string;
  selectedBankPercentage: string;
  policyCashShare?: string;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  branchName: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: SalaryConfigurationStatus;
  changeReason: string | null;
  createdById: string;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentProfileInput = {
  selectedBankPercentage?: string;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  branchName?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  changeReason?: string | null;
};

export type OtherApprovedDeductionInput = {
  amount: string;
  description: string;
  approvalReference?: string;
};

export type SalaryPreviewInput = {
  grossSalary: string;
  salaryStructureId?: string;
  components?: Array<Pick<SalaryStructureComponent, "code" | "name" | "percentage" | "displayOrder">>;
  attendanceDeduction?: string;
  providentFundDeduction?: string;
  loanOrSalaryAdvanceDeduction?: string;
  aitDeduction?: string;
  otherApprovedDeductions?: OtherApprovedDeductionInput[];
  selectedBankPercentage: string;
};

export type SalaryPreviewResult = {
  grossSalary: string;
  earningComponents: Array<{
    code: string;
    name: string;
    percentage: string;
    displayOrder: number;
    amount: string;
  }>;
  basic?: string;
  houseRent?: string;
  conveyance?: string;
  totalEarnings: string;
  attendanceDeduction: string;
  providentFundDeduction: string;
  loanOrSalaryAdvanceDeduction: string;
  aitDeduction: string;
  otherApprovedDeductions: OtherApprovedDeductionInput[];
  totalDeductions: string;
  netPay: string;
  selectedBankPercentage: string;
  policyCashShare: string;
  maximumAllowedBankPercentage: string;
  bankPay: string;
  cashPay: string;
  reconciliationDifference: string;
  warnings: string[];
  roundingPolicy: string;
};

// ---------------------------------------------------------------------------
// Voucher resource types (Phase 2C)
// ---------------------------------------------------------------------------

export type VoucherType =
  | "DEBIT"
  | "CREDIT"
  | "JOURNAL"
  | "CONTRA"
  | "PAYMENT"
  | "RECEIPT";

export type VoucherStatus = "DRAFT" | "POSTED";

export type VoucherLineSide = "DEBIT" | "CREDIT";

/** Basic user info embedded on voucher records (createdBy / postedBy). */
export type VoucherUserRef = {
  id: string;
  fullName: string;
  email: string;
};

export type VoucherLine = {
  id: string;
  voucherId: string;
  lineNo: number;
  side: VoucherLineSide;
  ledgerAccountId: string;
  projectId: string | null;
  costCenterId: string | null;
  cashBankAccountId: string | null;
  description: string | null;
  // Decimal values are serialised as strings by the API.
  amount: string;
  createdAt: string;
  updatedAt: string;
  ledgerAccount?: LedgerAccount;
  project?: Project | null;
  costCenter?: CostCenter | null;
  cashBankAccount?: CashBankAccount | null;
};

/**
 * Narrow document-company summary embedded on voucher detail responses.
 * Mirrors the backend voucher-relation select: only the fields the premium
 * print template consumes. `printLogoPath` is a presence signal for the
 * public company media endpoint — never a browser URL.
 */
export type VoucherCompanySummary = {
  id: string;
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  printLogoPath: string | null;
  printHeaderName: string | null;
  printFooterText: string | null;
  updatedAt: string;
};

export type Voucher = {
  id: string;
  companyId: string;
  company?: VoucherCompanySummary;
  fiscalYearId: string;
  accountingPeriodId: string;
  voucherType: VoucherType;
  status: VoucherStatus;
  systemVoucherNo: string;
  physicalSiNo: string | null;
  voucherDate: string;
  postingDate: string | null;
  narration: string | null;
  // Decimal values are serialised as strings by the API.
  totalDebit: string;
  totalCredit: string;
  createdById: string;
  postedById: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fiscalYear?: FiscalYear;
  accountingPeriod?: AccountingPeriod;
  createdBy?: VoucherUserRef;
  postedBy?: VoucherUserRef | null;
  lines?: VoucherLine[];
  _count?: { lines: number };
  reversalOfVoucherId?: string | null;
  correctionReason?: string | null;
  reversalOf?: {
    id: string;
    systemVoucherNo: string;
    status: VoucherStatus;
  } | null;
  reversedBy?: {
    id: string;
    systemVoucherNo: string;
    status: VoucherStatus;
    correctionReason: string | null;
    isDeleted: boolean;
  } | null;
};

export type VoucherListFilters = {
  voucherType?: VoucherType;
  status?: VoucherStatus;
  fiscalYearId?: string;
  accountingPeriodId?: string;
};

// ---------------------------------------------------------------------------
// Typed request payloads (must match backend DTO whitelists exactly)
// ---------------------------------------------------------------------------

export type CompanyInput = {
  name: string;
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
};

/**
 * PATCH /company/:id payload: the Basic Info fields plus the D7A/D7B
 * branding fields. `null` explicitly clears the nullable branding values.
 */
export type UpdateCompanyInput = Partial<CompanyInput> & {
  brandAccentColor?: string | null;
  backgroundMode?: CompanyBackgroundMode;
  printHeaderName?: string | null;
  printFooterText?: string | null;
};

export type CreateFiscalYearInput = {
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type UpdateFiscalYearInput = {
  name?: string;
  startDate?: string;
  endDate?: string;
  isClosed?: boolean;
};

export type ProjectInput = {
  code: string;
  name: string;
  location?: string;
  notes?: string;
  isActive?: boolean;
};

export type CreateAccountingPeriodInput = {
  fiscalYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  status?: AccountingPeriodStatus;
};

export type UpdateAccountingPeriodInput = {
  fiscalYearId?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: AccountingPeriodStatus;
};

export type CostCenterInput = {
  projectId: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
};

export type AccountGroupInput = {
  accountClassId: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
};

export type LedgerAccountInput = {
  accountGroupId: string;
  code: string;
  name: string;
  normalBalance: NormalBalanceSide;
  requiresProject?: boolean;
  requiresCostCenter?: boolean;
  isCashBank?: boolean;
  isActive?: boolean;
  description?: string;
};

export type CashBankAccountInput = {
  ledgerAccountId: string;
  displayName: string;
  accountType: CashBankAccountType;
  bankName?: string;
  branch?: string;
  accountNumber?: string;
  provider?: MfsProvider | null;
  providerOtherName?: string | null;
  walletNumber?: string | null;
  accountHolderName?: string | null;
  isActive?: boolean;
};

// The client never supplies status, systemVoucherNo, companyId, totals, or
// posting fields; the backend derives them. Totals are recomputed server-side
// from the line amounts.
export type CreateVoucherLineInput = {
  side: VoucherLineSide;
  ledgerAccountId: string;
  amount: number;
  projectId?: string;
  costCenterId?: string;
  cashBankAccountId?: string;
  description?: string;
};

export type CreateVoucherInput = {
  fiscalYearId: string;
  accountingPeriodId: string;
  voucherType: VoucherType;
  voucherDate: string;
  narration: string;
  physicalSiNo?: string;
  lines: CreateVoucherLineInput[];
};

export type UpdateVoucherInput = {
  fiscalYearId?: string;
  accountingPeriodId?: string;
  voucherType?: VoucherType;
  voucherDate?: string;
  narration?: string;
  physicalSiNo?: string;
  lines?: CreateVoucherLineInput[];
};

// ---------------------------------------------------------------------------
// Fetch layer
// ---------------------------------------------------------------------------

/**
 * Error raised for any non-successful API interaction. `status` is `0` when the
 * API could not be reached at all (network/connection failure).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConnectionError() {
    return this.status === 0;
  }
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };

    if (Array.isArray(body.message)) {
      return body.message.join(" ");
    }

    if (body.message) {
      return body.message;
    }
  } catch {
    return "Request failed. Please try again.";
  }

  return "Request failed. Please try again.";
}

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Shared, cookie-authenticated fetch helper.
 *
 * - Always sends `credentials: "include"` so the HttpOnly session cookie flows.
 * - Never reads or writes auth tokens in localStorage.
 * - Serialises plain objects as JSON with an explicit Content-Type, but passes
 *   `FormData` bodies through untouched: the browser must derive the multipart
 *   boundary itself, so no Content-Type header is set for multipart requests.
 * - Throws a typed {@link ApiError} on connection failure or non-2xx response so
 *   callers can present clear auth/connection messages.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;
  const hasBody = body !== undefined;
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      body: hasBody ? (isFormData ? body : JSON.stringify(body)) : undefined,
      credentials: "include",
      headers:
        hasBody && !isFormData
          ? { "Content-Type": "application/json" }
          : undefined,
      method,
      signal,
    });
  } catch (error) {
    // Re-throw aborts untouched so callers can ignore unmounted requests.
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      `Unable to reach the API at ${API_BASE_URL}. Please confirm the API server is running.`,
      0,
    );
  }

  if (!response.ok) {
    throw new ApiError(await readApiError(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Resource helpers
// ---------------------------------------------------------------------------

export async function getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  const body = await apiFetch<AuthResponse>("/auth/me", { signal });
  return body.user;
}

export async function logout(): Promise<void> {
  await apiFetch<unknown>("/auth/logout", { method: "POST" });
}

export function getCompany(signal?: AbortSignal): Promise<Company> {
  return apiFetch<Company>("/company", { signal });
}

export function createCompany(input: CompanyInput): Promise<Company> {
  return apiFetch<Company>("/company", { body: input, method: "POST" });
}

export function updateCompany(
  id: string,
  input: UpdateCompanyInput,
): Promise<Company> {
  return apiFetch<Company>(`/company/${id}`, { body: input, method: "PATCH" });
}

/**
 * Every office plus the caller's current session selection
 * (`GET /company/list`).
 */
export function getCompanies(
  signal?: AbortSignal,
): Promise<CompanyListResponse> {
  return apiFetch<CompanyListResponse>("/company/list", { signal });
}

/** Explicit session switch to another office (`POST /company/:id/switch`). */
export function switchCompany(companyId: string): Promise<CompanySwitchResponse> {
  return apiFetch<CompanySwitchResponse>(`/company/${companyId}/switch`, {
    method: "POST",
  });
}

/**
 * Uploads a branding image for one of the closed media kinds through the
 * D7B multipart endpoint. The FormData body is transported without a manual
 * Content-Type so the browser sets the multipart boundary itself.
 */
export function uploadCompanyMedia(
  companyId: string,
  kind: CompanyMediaKind,
  file: File,
): Promise<CompanyMediaResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<CompanyMediaResponse>(
    `/company/${companyId}/media/${kind}`,
    { body: formData, method: "POST" },
  );
}

/** Removes a previously uploaded branding image (`DELETE /company/:id/media/:kind`). */
export function removeCompanyMedia(
  companyId: string,
  kind: CompanyMediaKind,
): Promise<CompanyMediaResponse> {
  return apiFetch<CompanyMediaResponse>(
    `/company/${companyId}/media/${kind}`,
    { method: "DELETE" },
  );
}

/**
 * Public read URL for a company media asset. The optional `revision` appends
 * a cache-busting query so replaced images (publicly cached for a short
 * window) are re-fetched immediately after upload/remove mutations.
 */
export function companyMediaUrl(
  companyId: string,
  kind: CompanyMediaKind,
  revision?: number,
): string {
  const base = `${API_BASE_URL}/company-media/${companyId}/${kind}`;
  return revision === undefined ? base : `${base}?v=${revision}`;
}

export function getFiscalYears(signal?: AbortSignal): Promise<FiscalYear[]> {
  return apiFetch<FiscalYear[]>("/fiscal-years", { signal });
}

export function createFiscalYear(
  input: CreateFiscalYearInput,
): Promise<FiscalYear> {
  return apiFetch<FiscalYear>("/fiscal-years", { body: input, method: "POST" });
}

export function updateFiscalYear(
  id: string,
  input: UpdateFiscalYearInput,
): Promise<FiscalYear> {
  return apiFetch<FiscalYear>(`/fiscal-years/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function activateFiscalYear(id: string): Promise<FiscalYear> {
  return apiFetch<FiscalYear>(`/fiscal-years/${id}/activate`, {
    method: "POST",
  });
}

export function getProjects(signal?: AbortSignal): Promise<Project[]> {
  return apiFetch<Project[]>("/projects", { signal });
}

export function createProject(input: ProjectInput): Promise<Project> {
  return apiFetch<Project>("/projects", { body: input, method: "POST" });
}

export function updateProject(
  id: string,
  input: Partial<ProjectInput>,
): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, { body: input, method: "PATCH" });
}

export function getAccountClasses(signal?: AbortSignal): Promise<AccountClass[]> {
  return apiFetch<AccountClass[]>("/account-classes", { signal });
}

export function getAccountingPeriods(
  signal?: AbortSignal,
): Promise<AccountingPeriod[]> {
  return apiFetch<AccountingPeriod[]>("/accounting-periods", { signal });
}

export function createAccountingPeriod(
  input: CreateAccountingPeriodInput,
): Promise<AccountingPeriod> {
  return apiFetch<AccountingPeriod>("/accounting-periods", {
    body: input,
    method: "POST",
  });
}

export function updateAccountingPeriod(
  id: string,
  input: UpdateAccountingPeriodInput,
): Promise<AccountingPeriod> {
  return apiFetch<AccountingPeriod>(`/accounting-periods/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getCostCenters(signal?: AbortSignal): Promise<CostCenter[]> {
  return apiFetch<CostCenter[]>("/cost-centers", { signal });
}

export function createCostCenter(input: CostCenterInput): Promise<CostCenter> {
  return apiFetch<CostCenter>("/cost-centers", { body: input, method: "POST" });
}

export function updateCostCenter(
  id: string,
  input: Partial<CostCenterInput>,
): Promise<CostCenter> {
  return apiFetch<CostCenter>(`/cost-centers/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getAccountGroups(signal?: AbortSignal): Promise<AccountGroup[]> {
  return apiFetch<AccountGroup[]>("/account-groups", { signal });
}

export function createAccountGroup(
  input: AccountGroupInput,
): Promise<AccountGroup> {
  return apiFetch<AccountGroup>("/account-groups", {
    body: input,
    method: "POST",
  });
}

export function updateAccountGroup(
  id: string,
  input: Partial<AccountGroupInput>,
): Promise<AccountGroup> {
  return apiFetch<AccountGroup>(`/account-groups/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getLedgerAccounts(
  signal?: AbortSignal,
): Promise<LedgerAccount[]> {
  return apiFetch<LedgerAccount[]>("/ledger-accounts", { signal });
}

export function createLedgerAccount(
  input: LedgerAccountInput,
): Promise<LedgerAccount> {
  return apiFetch<LedgerAccount>("/ledger-accounts", {
    body: input,
    method: "POST",
  });
}

export function updateLedgerAccount(
  id: string,
  input: Partial<LedgerAccountInput>,
): Promise<LedgerAccount> {
  return apiFetch<LedgerAccount>(`/ledger-accounts/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getCashBankAccounts(
  signal?: AbortSignal,
): Promise<CashBankAccount[]> {
  return apiFetch<CashBankAccount[]>("/cash-bank-accounts", { signal });
}

export function createCashBankAccount(
  input: CashBankAccountInput,
): Promise<CashBankAccount> {
  return apiFetch<CashBankAccount>("/cash-bank-accounts", {
    body: input,
    method: "POST",
  });
}

export function updateCashBankAccount(
  id: string,
  input: Partial<CashBankAccountInput>,
): Promise<CashBankAccount> {
  return apiFetch<CashBankAccount>(`/cash-bank-accounts/${id}`, {
    body: input,
    method: "PATCH",
  });
}

function buildCustomerQuery(filters?: CustomerListFilters): string {
  if (!filters) {
    return "";
  }

  const params = new URLSearchParams();

  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.customerType) {
    params.set("customerType", filters.customerType);
  }
  if (typeof filters.isActive === "boolean") {
    params.set("isActive", String(filters.isActive));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildBookableItemQuery(filters?: BookableItemListFilters): string {
  if (!filters) {
    return "";
  }

  const params = new URLSearchParams();

  if (filters.projectId) {
    params.set("projectId", filters.projectId);
  }
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (typeof filters.includeDeleted === "boolean") {
    params.set("includeDeleted", String(filters.includeDeleted));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildBookingQuery(filters?: BookingListFilters): string {
  if (!filters) {
    return "";
  }

  const params = new URLSearchParams();

  if (filters.customerId) {
    params.set("customerId", filters.customerId);
  }
  if (filters.projectId) {
    params.set("projectId", filters.projectId);
  }
  if (filters.bookableItemId) {
    params.set("bookableItemId", filters.bookableItemId);
  }
  if (filters.administrativeStatus) {
    params.set("administrativeStatus", filters.administrativeStatus);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (typeof filters.includeDeleted === "boolean") {
    params.set("includeDeleted", String(filters.includeDeleted));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getCustomers(
  filters?: CustomerListFilters,
  signal?: AbortSignal,
): Promise<Customer[]> {
  return apiFetch<Customer[]>(`/customers${buildCustomerQuery(filters)}`, {
    signal,
  });
}

export function getCustomer(id: string, signal?: AbortSignal): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`, { signal });
}

export function createCustomer(input: CustomerInput): Promise<Customer> {
  return apiFetch<Customer>("/customers", { body: input, method: "POST" });
}

export function updateCustomer(
  id: string,
  input: Partial<CustomerInput>,
): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getBookableItems(
  filters?: BookableItemListFilters,
  signal?: AbortSignal,
): Promise<BookableItem[]> {
  return apiFetch<BookableItem[]>(
    `/bookable-items${buildBookableItemQuery(filters)}`,
    { signal },
  );
}

export function getBookableItem(
  id: string,
  signal?: AbortSignal,
): Promise<BookableItem> {
  return apiFetch<BookableItem>(`/bookable-items/${id}`, { signal });
}

export function createBookableItem(
  input: BookableItemInput,
): Promise<BookableItem> {
  return apiFetch<BookableItem>("/bookable-items", {
    body: input,
    method: "POST",
  });
}

export function updateBookableItem(
  id: string,
  input: Partial<BookableItemInput>,
): Promise<BookableItem> {
  return apiFetch<BookableItem>(`/bookable-items/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getBookings(
  filters?: BookingListFilters,
  signal?: AbortSignal,
): Promise<Booking[]> {
  return apiFetch<Booking[]>(`/bookings${buildBookingQuery(filters)}`, {
    signal,
  });
}

export function getBooking(id: string, signal?: AbortSignal): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}`, { signal });
}

export function createBooking(input: BookingInput): Promise<Booking> {
  return apiFetch<Booking>("/bookings", { body: input, method: "POST" });
}

export function updateBooking(
  id: string,
  input: Partial<BookingInput>,
): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getReceiptAllocations(
  bookingId: string,
  signal?: AbortSignal,
): Promise<BookingReceiptAllocation[]> {
  return apiFetch<BookingReceiptAllocation[]>(
    `/bookings/${bookingId}/receipt-allocations`,
    { signal },
  );
}

export function createReceiptAllocation(
  bookingId: string,
  input: CreateReceiptAllocationInput,
): Promise<BookingReceiptAllocation> {
  return apiFetch<BookingReceiptAllocation>(
    `/bookings/${bookingId}/receipt-allocations`,
    {
      body: input,
      method: "POST",
    },
  );
}

export function deleteReceiptAllocation(
  bookingId: string,
  allocationId: string,
): Promise<ReceiptAllocationDeleteResult> {
  return apiFetch<ReceiptAllocationDeleteResult>(
    `/bookings/${bookingId}/receipt-allocations/${allocationId}`,
    { method: "DELETE" },
  );
}

// ---------------------------------------------------------------------------
// Salary Foundation resource helpers (Phase 1)
// ---------------------------------------------------------------------------

function buildEmployeeQuery(filters?: EmployeeListFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (typeof filters.includeInactive === "boolean") {
    params.set("includeInactive", String(filters.includeInactive));
  }
  if (typeof filters.includeDeleted === "boolean") {
    params.set("includeDeleted", String(filters.includeDeleted));
  }
  if (filters.search) params.set("search", filters.search);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getEmployees(
  filters?: EmployeeListFilters,
  signal?: AbortSignal,
): Promise<EmployeeListItem[]> {
  return apiFetch<EmployeeListItem[]>(`/employees${buildEmployeeQuery(filters)}`, {
    signal,
  });
}

export function getWorkSchedules(
  includeInactive = false,
  signal?: AbortSignal,
) {
  return apiFetch<WorkScheduleDefinition[]>(
    `/work-schedules?includeInactive=${includeInactive}`,
    { signal },
  );
}

export function getWorkSchedule(id: string, signal?: AbortSignal) {
  return apiFetch<WorkScheduleDefinition>(
    `/work-schedules/${encodeURIComponent(id)}`,
    { signal },
  );
}

export function createWorkSchedule(input: WorkScheduleDefinitionInput) {
  return apiFetch<WorkScheduleDefinition>("/work-schedules", {
    body: input,
    method: "POST",
  });
}

export function getEffectiveWorkSchedule(
  businessDate: string,
  employeeId?: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ businessDate });
  if (employeeId) query.set("employeeId", employeeId);
  return apiFetch<EffectiveWorkSchedule>(`/work-schedules/effective?${query}`, {
    signal,
  });
}

export function getWorkScheduleAssignments(
  employeeId?: string,
  signal?: AbortSignal,
) {
  const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
  return apiFetch<WorkScheduleAssignment[]>(
    `/work-schedules/assignments${query}`,
    { signal },
  );
}

export function createWorkScheduleAssignment(
  input: CreateWorkScheduleAssignmentInput,
) {
  return apiFetch<WorkScheduleAssignment>("/work-schedules/assignments", {
    body: input,
    method: "POST",
  });
}

export function updateWorkSchedule(
  id: string,
  input: UpdateWorkScheduleInput,
) {
  return apiFetch<WorkScheduleDefinition>(
    `/work-schedules/${encodeURIComponent(id)}`,
    { body: input, method: "PATCH" },
  );
}

export function replaceWorkScheduleAssignment(
  id: string,
  input: {
    effectiveFrom: string;
    workScheduleId?: string;
    newSchedule?: WorkScheduleDefinitionInput;
    changeReason: string;
    expectedUpdatedAt: string;
  },
) {
  return apiFetch<WorkScheduleAssignment>(
    `/work-schedules/assignments/${encodeURIComponent(id)}/replace`,
    { body: input, method: "POST" },
  );
}

export function endWorkScheduleAssignment(
  id: string,
  input: {
    effectiveTo: string;
    changeReason: string;
    expectedUpdatedAt: string;
  },
) {
  return apiFetch<WorkScheduleAssignment>(
    `/work-schedules/assignments/${encodeURIComponent(id)}/end`,
    { body: input, method: "POST" },
  );
}

export function cancelWorkScheduleAssignment(
  id: string,
  input: { changeReason: string; expectedUpdatedAt: string },
) {
  return apiFetch<WorkScheduleAssignment>(
    `/work-schedules/assignments/${encodeURIComponent(id)}/cancel`,
    { body: input, method: "POST" },
  );
}

export function getEmployee(
  id: string,
  signal?: AbortSignal,
): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${id}`, { signal });
}

export function createEmployee(input: EmployeeInput): Promise<Employee> {
  return apiFetch<Employee>("/employees", { body: input, method: "POST" });
}

export function updateEmployee(
  id: string,
  input: EmployeeUpdateInput,
): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getDepartments(signal?: AbortSignal): Promise<Department[]> {
  return apiFetch<Department[]>("/departments", { signal });
}

export function createDepartment(
  input: DepartmentInput,
): Promise<Department> {
  return apiFetch<Department>("/departments", { body: input, method: "POST" });
}

export function updateDepartment(
  id: string,
  input: DepartmentUpdateInput,
): Promise<Department> {
  return apiFetch<Department>(`/departments/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getSalaryStructures(
  signal?: AbortSignal,
): Promise<SalaryStructure[]> {
  return apiFetch<SalaryStructure[]>("/salary-structures", { signal });
}

export function getSalaryStructure(
  id: string,
  signal?: AbortSignal,
): Promise<SalaryStructure> {
  return apiFetch<SalaryStructure>(`/salary-structures/${id}`, { signal });
}

export function createSalaryStructure(
  input: SalaryStructureInput,
): Promise<SalaryStructure> {
  return apiFetch<SalaryStructure>("/salary-structures", {
    body: input,
    method: "POST",
  });
}

export function updateSalaryStructure(
  id: string,
  input: SalaryStructureUpdateInput,
): Promise<SalaryStructure> {
  return apiFetch<SalaryStructure>(`/salary-structures/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function approveSalaryStructure(id: string): Promise<SalaryStructure> {
  return apiFetch<SalaryStructure>(`/salary-structures/${id}/approve`, {
    method: "POST",
  });
}

export function inactivateSalaryStructure(id: string): Promise<SalaryStructure> {
  return apiFetch<SalaryStructure>(`/salary-structures/${id}/inactivate`, {
    method: "POST",
  });
}

export function getSalaryAssignments(
  employeeId: string,
  signal?: AbortSignal,
): Promise<EmployeeSalaryAssignment[]> {
  return apiFetch<EmployeeSalaryAssignment[]>(
    `/employees/${employeeId}/salary-assignments`,
    { signal },
  );
}

export function createSalaryAssignment(
  employeeId: string,
  input: SalaryAssignmentInput,
): Promise<EmployeeSalaryAssignment> {
  return apiFetch<EmployeeSalaryAssignment>(
    `/employees/${employeeId}/salary-assignments`,
    { body: input, method: "POST" },
  );
}

export function updateSalaryAssignment(
  id: string,
  input: Partial<SalaryAssignmentInput>,
): Promise<EmployeeSalaryAssignment> {
  return apiFetch<EmployeeSalaryAssignment>(`/salary-assignments/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function approveSalaryAssignment(
  id: string,
): Promise<EmployeeSalaryAssignment> {
  return apiFetch<EmployeeSalaryAssignment>(`/salary-assignments/${id}/approve`, {
    method: "POST",
  });
}

export function getPaymentProfiles(
  employeeId: string,
  signal?: AbortSignal,
): Promise<EmployeePaymentProfile[]> {
  return apiFetch<EmployeePaymentProfile[]>(
    `/employees/${employeeId}/payment-profiles`,
    { signal },
  );
}

export function createPaymentProfile(
  employeeId: string,
  input: PaymentProfileInput,
): Promise<EmployeePaymentProfile> {
  return apiFetch<EmployeePaymentProfile>(
    `/employees/${employeeId}/payment-profiles`,
    { body: input, method: "POST" },
  );
}

export function updatePaymentProfile(
  id: string,
  input: Partial<PaymentProfileInput>,
): Promise<EmployeePaymentProfile> {
  return apiFetch<EmployeePaymentProfile>(`/payment-profiles/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function approvePaymentProfile(
  id: string,
): Promise<EmployeePaymentProfile> {
  return apiFetch<EmployeePaymentProfile>(`/payment-profiles/${id}/approve`, {
    method: "POST",
  });
}

export function previewSalary(
  input: SalaryPreviewInput,
): Promise<SalaryPreviewResult> {
  return apiFetch<SalaryPreviewResult>("/salary-calculations/preview", {
    body: input,
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Voucher resource helpers (Phase 2C)
// ---------------------------------------------------------------------------

function buildVoucherQuery(filters?: VoucherListFilters): string {
  if (!filters) {
    return "";
  }

  const params = new URLSearchParams();

  if (filters.voucherType) {
    params.set("voucherType", filters.voucherType);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.fiscalYearId) {
    params.set("fiscalYearId", filters.fiscalYearId);
  }
  if (filters.accountingPeriodId) {
    params.set("accountingPeriodId", filters.accountingPeriodId);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getVouchers(
  filters?: VoucherListFilters,
  signal?: AbortSignal,
): Promise<Voucher[]> {
  return apiFetch<Voucher[]>(`/vouchers${buildVoucherQuery(filters)}`, {
    signal,
  });
}

export function getVoucher(
  id: string,
  signal?: AbortSignal,
): Promise<Voucher> {
  return apiFetch<Voucher>(`/vouchers/${id}`, { signal });
}

export function createVoucher(input: CreateVoucherInput): Promise<Voucher> {
  return apiFetch<Voucher>("/vouchers", { body: input, method: "POST" });
}

export function updateVoucher(
  id: string,
  input: UpdateVoucherInput,
): Promise<Voucher> {
  return apiFetch<Voucher>(`/vouchers/${id}`, { body: input, method: "PATCH" });
}

export function deleteVoucher(
  id: string,
): Promise<{ id: string; status: VoucherStatus; isDeleted: boolean }> {
  return apiFetch<{ id: string; status: VoucherStatus; isDeleted: boolean }>(
    `/vouchers/${id}`,
    { method: "DELETE" },
  );
}

export function postVoucher(id: string): Promise<Voucher> {
  return apiFetch<Voucher>(`/vouchers/${id}/post`, { method: "POST" });
}

export function createReversal(
  id: string,
  input: { reason: string },
): Promise<Voucher> {
  return apiFetch<Voucher>(`/vouchers/${id}/reversal`, {
    body: input,
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Report resource types (Phase 2D)
//
// These mirror the JSON returned by the guarded `/reports/*` endpoints. All
// money values are serialised by the API as fixed two-decimal strings.
// ---------------------------------------------------------------------------

export type ReportType =
  | "LEDGER"
  | "CASH_BOOK"
  | "BANK_BOOK"
  | "TRIAL_BALANCE"
  | "INCOME_STATEMENT"
  | "BALANCE_SHEET"
  | "PROJECT_LEDGER"
  | "PROJECT_COST"
  | "PROJECT_FINANCIAL_SUMMARY"
  | "COST_CENTER_SUMMARY";

/**
 * Company summary embedded on the report fiscal year. Carries the owner
 * company's document-branding fields so report printing derives branding
 * from the fiscal year's owning company — never the active office.
 * `printLogoPath` is a presence signal for the public company media
 * endpoint — never a browser URL.
 */
export type ReportCompanySummary = {
  id: string;
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  printLogoPath: string | null;
  printHeaderName: string | null;
  printFooterText: string | null;
  updatedAt: string;
};

export type ReportFiscalYearSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  company: ReportCompanySummary;
};

export type ReportAccountingPeriodSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type ReportDateRange = {
  startDate: string;
  endDate: string;
};

export type ReportProjectSummary = {
  id: string;
  code: string;
  name: string;
};

export type ReportCostCenterSummary = {
  id: string;
  code: string;
  name: string;
  project: ReportProjectSummary;
};

/** Project / cost-center filters echoed back by every report. */
export type ReportFilterSummary = {
  project: ReportProjectSummary | null;
  costCenter: ReportCostCenterSummary | null;
};

/** Normal-balance-aware balance presentation. Money values are strings. */
export type ReportBalanceSummary = {
  debit: string;
  credit: string;
  signedAmount: string;
  balanceSide: NormalBalanceSide;
};

export type ReportLedgerAccountSummary = {
  id: string;
  code: string;
  name: string;
  normalBalance: NormalBalanceSide;
  isActive: boolean;
};

export type ReportAccountClassSummary = {
  id: string;
  code: AccountClassCode;
  name: string;
  normalBalance: NormalBalanceSide;
};

export type ReportAccountGroupSummary = {
  id: string;
  code: string;
  name: string;
};

export type ReportCashBankAccountSummary = {
  id: string;
  displayName: string;
  accountType: CashBankAccountType;
  ledgerAccountId: string;
  bankName: string | null;
  branch: string | null;
  accountNumber: string | null;
  isActive: boolean;
  provider: MfsProvider | null;
  providerOtherName: string | null;
  walletNumber: string | null;
  accountHolderName: string | null;
};

/** Ledger account with its account group/class, as returned in report rows. */
export type ReportLedgerAccountWithGroup = ReportLedgerAccountSummary & {
  accountGroup: ReportAccountGroupSummary & {
    accountClass: ReportAccountClassSummary;
  };
};

// --- General Ledger / Ledger Statement ---

export type LedgerReportLine = {
  id: string;
  voucherDate: string;
  systemVoucherNo: string;
  voucherType: VoucherType;
  narration: string | null;
  lineNo: number;
  lineDescription: string | null;
  debit: string;
  credit: string;
  runningBalance: ReportBalanceSummary;
  project: ReportProjectSummary | null;
  costCenter: ReportCostCenterSummary | null;
  cashBankAccount: ReportCashBankAccountSummary | null;
};

export type LedgerReport = {
  reportType: "LEDGER";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  ledgerAccount: ReportLedgerAccountWithGroup;
  filters: ReportFilterSummary;
  openingBalance: ReportBalanceSummary;
  periodDebit: string;
  periodCredit: string;
  closingBalance: ReportBalanceSummary;
  lines: LedgerReportLine[];
};

// --- Cash Book / Bank Book ---

export type CashBankReportOppositeAccount = {
  id: string;
  ledgerAccount: ReportLedgerAccountSummary;
  side: VoucherLineSide;
  amount: string;
};

export type CashBankReportLine = {
  id: string;
  voucherDate: string;
  systemVoucherNo: string;
  voucherType: VoucherType;
  narration: string | null;
  cashBankAccount: ReportCashBankAccountSummary | null;
  ledgerAccount: ReportLedgerAccountSummary;
  oppositeAccounts: CashBankReportOppositeAccount[];
  description: string | null;
  debit: string;
  credit: string;
  runningBalance: ReportBalanceSummary;
  project: ReportProjectSummary | null;
  costCenter: ReportCostCenterSummary | null;
};

export type CashBankReport = {
  reportType: "CASH_BOOK" | "BANK_BOOK" | "MFS_BOOK";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  accountType: CashBankAccountType;
  cashBankAccount: ReportCashBankAccountSummary | null;
  filters: ReportFilterSummary & {
    ledgerAccount: ReportLedgerAccountSummary | null;
  };
  openingBalance: ReportBalanceSummary;
  periodDebit: string;
  periodCredit: string;
  closingBalance: ReportBalanceSummary;
  lines: CashBankReportLine[];
};

// --- Trial Balance ---

export type TrialBalanceTotals = {
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
  difference: string;
  isBalanced: boolean;
};

export type TrialBalanceRow = {
  ledgerAccount: ReportLedgerAccountWithGroup;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
};

export type TrialBalanceReport = {
  reportType: "TRIAL_BALANCE";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  filters: ReportFilterSummary;
  totals: TrialBalanceTotals;
  rows: TrialBalanceRow[];
};

// --- Income Statement ---

/** Account-group subtotal within an income statement section. */
export type FinancialStatementGroupSummary = {
  id: string;
  code: string;
  name: string;
  total: string;
};

/** One ledger-account line in an income statement section. */
export type IncomeStatementRow = {
  accountClass: ReportAccountClassSummary;
  accountGroup: ReportAccountGroupSummary;
  amount: string;
  creditMovement: string;
  debitMovement: string;
  ledgerAccount: ReportProjectSummary;
};

/** Income or Expense section of the income statement. */
export type IncomeStatementSection = {
  groups: FinancialStatementGroupSummary[];
  rows: IncomeStatementRow[];
  total: string;
};

export type IncomeStatementReport = {
  reportType: "INCOME_STATEMENT";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  filters: ReportFilterSummary;
  income: IncomeStatementSection;
  expenses: IncomeStatementSection;
  netIncome: string;
  isProfit: boolean;
};

// --- Balance Sheet ---

/** One ledger-account line in a balance sheet section. */
export type BalanceSheetRow = {
  accountClass: ReportAccountClassSummary;
  accountGroup: ReportAccountGroupSummary;
  amount: string;
  balanceCredit: string;
  balanceDebit: string;
  creditMovement: string;
  debitMovement: string;
  ledgerAccount: ReportProjectSummary;
  normalBalance: NormalBalanceSide;
};

/** Assets, Liabilities, or Equity section of the balance sheet. */
export type BalanceSheetSection = {
  groups: FinancialStatementGroupSummary[];
  rows: BalanceSheetRow[];
  total: string;
};

export type BalanceSheetReport = {
  reportType: "BALANCE_SHEET";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  asOfDate: string;
  filters: ReportFilterSummary;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalLiabilitiesAndEquity: string;
  difference: string;
  isBalanced: boolean;
  currentPeriodProfitLoss: string;
  currentPeriodPLLabel: string;
  currentPeriodPLIsProfit: boolean;
  adjustedTotalEquity: string;
  adjustedTotalLiabilitiesAndEquity: string;
  adjustedDifference: string;
  isBalancedAdjusted: boolean;
};

// --- Project Ledger ---

export type ProjectLedgerReportLine = {
  id: string;
  voucherId: string;
  date: string;
  systemVoucherNo: string;
  voucherType: VoucherType;
  ledgerAccountId: string;
  ledgerCode: string;
  ledgerName: string;
  accountClass: {
    code: string;
    name: string;
  };
  accountGroup: {
    code: string;
    name: string;
  };
  costCenterId: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  narration: string | null;
  lineDescription: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
};

export type ProjectLedgerReport = {
  reportType: "PROJECT_LEDGER";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  project: ReportProjectSummary;
  costCenter: {
    id: string;
    code: string;
    name: string;
  } | null;
  filters: {
    costCenter: {
      id: string;
      code: string;
      name: string;
    } | null;
    ledgerAccount: string | null;
    voucherType: string | null;
  };
  totals: {
    debitTotal: string;
    creditTotal: string;
    netMovement: string;
  };
  openingBalance: string;
  lineCount: number;
  lines: ProjectLedgerReportLine[];
};

// --- Project Cost Report ---

export type ProjectCostReportRow = {
  accountClass: {
    code: string;
    name: string;
  };
  accountGroup: {
    code: string;
    name: string;
  };
  costCenterId: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  creditTotal: string;
  debitTotal: string;
  lastTransactionDate: string | null;
  ledgerAccount: {
    id: string;
    code: string;
    name: string;
  };
  netAmount: string;
};

export type ProjectCostReport = {
  reportType: "PROJECT_COST";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  project: ReportProjectSummary;
  costCenter: {
    id: string;
    code: string;
    name: string;
  } | null;
  filters: {
    costCenter: {
      id: string;
      code: string;
      name: string;
    } | null;
    expenseOnly: boolean;
    ledgerAccount: string | null;
    accountClass: string | null;
    accountGroup: string | null;
  };
  totals: {
    assetProjectCostTotal: string;
    creditTotal: string;
    debitTotal: string;
    equityTotal: string;
    expenseTotal: string;
    incomeTotal: string;
    liabilityTotal: string;
    netMovement: string;
  };
  lineCount: number;
  groupedRowCount: number;
  rows: ProjectCostReportRow[];
};

// --- Cost Center Summary ---

export type CostCenterSummaryRow = {
  assetProjectCostTotal: string;
  costCenterCode: string | null;
  costCenterId: string | null;
  costCenterName: string | null;
  creditTotal: string;
  debitTotal: string;
  equityTotal: string;
  expenseTotal: string;
  incomeTotal: string;
  lastTransactionDate: string | null;
  liabilityTotal: string;
  lineCount: number;
  netMovement: string;
};

export type CostCenterSummaryReport = {
  reportType: "COST_CENTER_SUMMARY";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  project: ReportProjectSummary;
  costCenter: {
    id: string;
    code: string;
    name: string;
  } | null;
  filters: {
    costCenter: {
      id: string;
      code: string;
      name: string;
    } | null;
    ledgerAccount: string | null;
    accountClass: string | null;
    accountGroup: string | null;
  };
  totals: {
    assetProjectCostTotal: string;
    costCenterCount: number;
    creditTotal: string;
    debitTotal: string;
    equityTotal: string;
    expenseTotal: string;
    incomeTotal: string;
    liabilityTotal: string;
    lineCount: number;
    netMovement: string;
    unassignedLineCount: number;
  };
  rows: CostCenterSummaryRow[];
};

// --- Project Financial Summary ---

export type ProjectFinancialSummaryClassBreakdown = {
  accountClass: {
    code: string;
    name: string;
  };
  creditTotal: string;
  debitTotal: string;
  lineCount: number;
  netMovement: string;
  percentageOfTotalCredit: string;
  percentageOfTotalDebit: string;
};

export type ProjectFinancialSummaryManagementTotals = {
  projectAssetCostTotal: string;
  projectCostTotal: string;
  projectEquityTotal: string;
  projectExpenseTotal: string;
  projectIncomeTotal: string;
  projectLiabilityTotal: string;
};

export type ProjectFinancialSummaryCostCenterRow = {
  assetProjectCostTotal: string;
  costCenterCode: string | null;
  costCenterId: string | null;
  costCenterName: string | null;
  creditTotal: string;
  debitTotal: string;
  expenseTotal: string;
  lastTransactionDate: string | null;
  lineCount: number;
  netMovement: string;
};

export type ProjectFinancialSummaryTopLedgerRow = {
  accountClassCode: string | null;
  accountClassName: string | null;
  creditTotal: string;
  debitTotal: string;
  ledgerAccountId: string;
  ledgerCode: string | null;
  ledgerName: string | null;
  lineCount: number;
  netMovement: string;
};

export type ProjectFinancialSummaryReport = {
  reportType: "PROJECT_FINANCIAL_SUMMARY";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  project: ReportProjectSummary;
  filters: {
    costCenter: {
      id: string;
      code: string;
      name: string;
    } | null;
    ledgerAccount: string | null;
    accountClass: string | null;
    accountGroup: string | null;
  };
  totals: {
    creditTotal: string;
    debitTotal: string;
    firstTransactionDate: string | null;
    lastTransactionDate: string | null;
    lineCount: number;
    netMovement: string;
    voucherCount: number;
  };
  classBreakdown: ProjectFinancialSummaryClassBreakdown[];
  managementTotals: ProjectFinancialSummaryManagementTotals;
  costCenterBreakdown: ProjectFinancialSummaryCostCenterRow[];
  topLedgerBreakdown: ProjectFinancialSummaryTopLedgerRow[];
};

export type ProjectFundMovementReportLine = {
  id: string;
  date: string;
  voucherId: string;
  voucherNo: string;
  voucherNumber: string;
  voucherType: VoucherType;
  ledgerAccount: ReportLedgerAccountSummary;
  ledgerCode: string;
  ledgerName: string;
  cashBankAccount: ReportCashBankAccountSummary | null;
  cashBankAccountName: string | null;
  cashBankAccountType: CashBankAccountType | null;
  project: ReportProjectSummary;
  projectCode: string | null;
  projectName: string | null;
  costCenter: ReportCostCenterSummary | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  narration: string | null;
  description: string | null;
  particular: string;
  debit: string;
  credit: string;
  inflow: string;
  outflow: string;
  runningBalance: ReportBalanceSummary;
  runningBalanceAmount: string;
};

export type ProjectFundMovementReport = {
  reportType: "PROJECT_FUND_MOVEMENT";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  project: ReportProjectSummary;
  costCenter: ReportCostCenterSummary | null;
  filters: {
    costCenter: ReportCostCenterSummary | null;
    project: ReportProjectSummary | null;
    accountType: string;
    voucherType: string;
    cashBankAccountId: string | null;
  };
  totals: {
    periodDebit: string;
    periodCredit: string;
    netMovement: string;
  };
  openingBalance: ReportBalanceSummary;
  periodDebit: string;
  periodCredit: string;
  closingBalance: ReportBalanceSummary;
  lineCount: number;
  lines: ProjectFundMovementReportLine[];
};

/**
 * Shared report query parameters. `fiscalYearId` is always required; the rest
 * are optional and report-specific. Empty values are omitted from the request.
 */
export type ReportQueryParams = {
  fiscalYearId: string;
  accountingPeriodId?: string;
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  ledgerAccountId?: string;
  projectId?: string;
  costCenterId?: string;
  cashBankAccountId?: string;
  voucherType?: string;
  accountGroupId?: string;
  accountClassCode?: string;
  expenseOnly?: boolean;
  accountType?: string;
  dateFrom?: string;
  dateTo?: string;
};

// ---------------------------------------------------------------------------
// Report resource helpers (Phase 2D)
// ---------------------------------------------------------------------------

function buildReportQuery(params: ReportQueryParams): string {
  const search = new URLSearchParams();

  search.set("fiscalYearId", params.fiscalYearId);

  if (params.accountingPeriodId) {
    search.set("accountingPeriodId", params.accountingPeriodId);
  }
  if (params.startDate) {
    search.set("startDate", params.startDate);
  }
  if (params.endDate) {
    search.set("endDate", params.endDate);
  }
  if (params.asOfDate) {
    search.set("asOfDate", params.asOfDate);
  }
  if (params.ledgerAccountId) {
    search.set("ledgerAccountId", params.ledgerAccountId);
  }
  if (params.projectId) {
    search.set("projectId", params.projectId);
  }
  if (params.costCenterId) {
    search.set("costCenterId", params.costCenterId);
  }
  if (params.cashBankAccountId) {
    search.set("cashBankAccountId", params.cashBankAccountId);
  }
  if (params.voucherType) {
    search.set("voucherType", params.voucherType);
  }
  if (params.accountGroupId) {
    search.set("accountGroupId", params.accountGroupId);
  }
  if (params.accountClassCode) {
    search.set("accountClassCode", params.accountClassCode);
  }
  if (params.expenseOnly) {
    search.set("expenseOnly", "true");
  }
  if (params.accountType) {
    search.set("accountType", params.accountType);
  }
  if (params.dateFrom) {
    search.set("dateFrom", params.dateFrom);
  }
  if (params.dateTo) {
    search.set("dateTo", params.dateTo);
  }

  return `?${search.toString()}`;
}

export function getLedgerReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<LedgerReport> {
  return apiFetch<LedgerReport>(`/reports/ledger${buildReportQuery(params)}`, {
    signal,
  });
}

export function getCashBookReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<CashBankReport> {
  return apiFetch<CashBankReport>(
    `/reports/cash-book${buildReportQuery(params)}`,
    { signal },
  );
}

export function getBankBookReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<CashBankReport> {
  return apiFetch<CashBankReport>(
    `/reports/bank-book${buildReportQuery(params)}`,
    { signal },
  );
}

export function getMfsBookReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<CashBankReport> {
  return apiFetch<CashBankReport>(
    `/reports/mfs-book${buildReportQuery(params)}`,
    { signal },
  );
}

export function getTrialBalanceReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<TrialBalanceReport> {
  return apiFetch<TrialBalanceReport>(
    `/reports/trial-balance${buildReportQuery(params)}`,
    { signal },
  );
}

export function getIncomeStatementReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<IncomeStatementReport> {
  return apiFetch<IncomeStatementReport>(
    `/reports/income-statement${buildReportQuery(params)}`,
    { signal },
  );
}

export function getBalanceSheetReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<BalanceSheetReport> {
  return apiFetch<BalanceSheetReport>(
    `/reports/balance-sheet${buildReportQuery(params)}`,
    { signal },
  );
}

export function getProjectLedgerReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<ProjectLedgerReport> {
  return apiFetch<ProjectLedgerReport>(
    `/reports/project-ledger${buildReportQuery(params)}`,
    { signal },
  );
}

export function getProjectCostReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<ProjectCostReport> {
  return apiFetch<ProjectCostReport>(
    `/reports/project-cost${buildReportQuery(params)}`,
    { signal },
  );
}

export function getCostCenterSummaryReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<CostCenterSummaryReport> {
  return apiFetch<CostCenterSummaryReport>(
    `/reports/cost-center-summary${buildReportQuery(params)}`,
    { signal },
  );
}

export function getProjectFinancialSummaryReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<ProjectFinancialSummaryReport> {
  return apiFetch<ProjectFinancialSummaryReport>(
    `/reports/project-financial-summary${buildReportQuery(params)}`,
    { signal },
  );
}

export function getProjectFundMovementReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<ProjectFundMovementReport> {
  return apiFetch<ProjectFundMovementReport>(
    `/reports/project-fund-movement${buildReportQuery(params)}`,
    { signal },
  );
}

/**
 * Narrow an unknown caught value to a user-facing message. Aborts are re-thrown
 * by {@link apiFetch}; everything else lands here.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
