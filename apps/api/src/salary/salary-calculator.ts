import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";

const Decimal = Prisma.Decimal;
const HighPrecisionDecimal = Decimal.clone({ precision: 80 });
const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);
const CALCULATED_PERCENTAGE_PLACES = 40;

function currency(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export type SalaryComponentInput = {
  code: string;
  name: string;
  percentage: Prisma.Decimal;
  displayOrder: number;
};

export type CalculationInput = {
  grossSalary: string;
  components: SalaryComponentInput[];
  attendanceDeduction: string;
  providentFundDeduction: string;
  loanOrSalaryAdvanceDeduction: string;
  aitDeduction: string;
  otherApprovedDeductions: Array<{
    amount: string;
    description: string;
    approvalReference?: string;
  }>;
  selectedBankPercentage: string;
};

@Injectable()
export class SalaryCalculator {
  calculate(input: CalculationInput) {
    const grossSalary = currency(new Decimal(input.grossSalary));
    if (grossSalary.lessThanOrEqualTo(ZERO)) {
      throw new BadRequestException("Gross Salary must be greater than zero.");
    }
    if (!input.components.length) {
      throw new BadRequestException("At least one salary component is required.");
    }

    const ordered = [...input.components].sort(
      (left, right) => left.displayOrder - right.displayOrder,
    );
    const percentageTotal = ordered.reduce(
      (total, component) => total.plus(component.percentage),
      ZERO,
    );
    if (!percentageTotal.equals(HUNDRED)) {
      throw new BadRequestException(
        "Salary component percentages must total exactly 100.0000.",
      );
    }

    let allocated = ZERO;
    const earningComponents = ordered.map((component, index) => {
      const amount =
        index === ordered.length - 1
          ? grossSalary.minus(allocated)
          : currency(grossSalary.times(component.percentage).div(HUNDRED));
      if (amount.lessThan(ZERO)) {
        throw new BadRequestException(
          "Gross Salary is too small for the configured component distribution and currency precision.",
        );
      }
      allocated = allocated.plus(amount);
      return {
        code: component.code,
        name: component.name,
        percentage: component.percentage.toFixed(4),
        displayOrder: component.displayOrder,
        amount: amount.toFixed(2),
      };
    });

    const categories = {
      attendanceDeduction: currency(new Decimal(input.attendanceDeduction)),
      providentFundDeduction: currency(
        new Decimal(input.providentFundDeduction),
      ),
      loanOrSalaryAdvanceDeduction: currency(
        new Decimal(input.loanOrSalaryAdvanceDeduction),
      ),
      aitDeduction: currency(new Decimal(input.aitDeduction)),
    };
    for (const amount of Object.values(categories)) {
      if (amount.lessThan(ZERO)) {
        throw new BadRequestException(
          "Every deduction amount must be non-negative.",
        );
      }
    }

    const otherApprovedDeductions = input.otherApprovedDeductions.map((item) => {
      const amount = currency(new Decimal(item.amount));
      if (amount.lessThan(ZERO)) {
        throw new BadRequestException(
          "Every deduction amount must be non-negative.",
        );
      }
      if (amount.greaterThan(ZERO) && !item.description.trim()) {
        throw new BadRequestException(
          "Other approved deduction requires a description.",
        );
      }
      return { ...item, description: item.description.trim(), amount };
    });

    const totalDeductions = Object.values(categories)
      .reduce((total, amount) => total.plus(amount), ZERO)
      .plus(
        otherApprovedDeductions.reduce(
          (total, item) => total.plus(item.amount),
          ZERO,
        ),
      );
    if (totalDeductions.greaterThan(grossSalary)) {
      throw new BadRequestException(
        "Total Deductions must not exceed Total Earnings.",
      );
    }

    const netPay = grossSalary.minus(totalDeductions);
    const selectedBankPercentage = new Decimal(input.selectedBankPercentage);
    if (
      selectedBankPercentage.lessThan(ZERO) ||
      selectedBankPercentage.greaterThan(HUNDRED)
    ) {
      throw new BadRequestException(
        "Selected Bank Percentage must be between 0 and 100.",
      );
    }
    const bankPay = currency(
      grossSalary.times(selectedBankPercentage).div(HUNDRED),
    );
    if (bankPay.greaterThan(netPay)) {
      throw new BadRequestException(
        "Bank allocation exceeds net pay. Lower the selected bank percentage or correct the deductions.",
      );
    }
    const cashPay = netPay.minus(bankPay);
    const amountFor = (code: string) =>
      earningComponents.find(
        (component) => component.code.trim().toUpperCase() === code,
      )?.amount;

    return {
      grossSalary: grossSalary.toFixed(2),
      earningComponents,
      basic: amountFor("BASIC"),
      houseRent: amountFor("HOUSE_RENT"),
      conveyance: amountFor("CONVEYANCE"),
      totalEarnings: grossSalary.toFixed(2),
      attendanceDeduction: categories.attendanceDeduction.toFixed(2),
      providentFundDeduction: categories.providentFundDeduction.toFixed(2),
      loanOrSalaryAdvanceDeduction:
        categories.loanOrSalaryAdvanceDeduction.toFixed(2),
      aitDeduction: categories.aitDeduction.toFixed(2),
      otherApprovedDeductions: otherApprovedDeductions.map((item) => ({
        ...item,
        amount: item.amount.toFixed(2),
      })),
      totalDeductions: totalDeductions.toFixed(2),
      netPay: netPay.toFixed(2),
      selectedBankPercentage: selectedBankPercentage.toFixed(6),
      policyCashShare: HUNDRED.minus(selectedBankPercentage).toFixed(6),
      maximumAllowedBankPercentage: safePercentage(netPay, grossSalary),
      bankPay: bankPay.toFixed(2),
      cashPay: cashPay.toFixed(2),
      reconciliationDifference: netPay.minus(bankPay.plus(cashPay)).toFixed(2),
      warnings: [] as string[],
      roundingPolicy:
        "ROUND_HALF_UP; final earning component and Cash Pay receive residuals.",
    };
  }

  calculateAllNetByBank(input: { grossSalary: string; netPay: string }) {
    const grossSalary = currency(new Decimal(input.grossSalary));
    if (grossSalary.lessThanOrEqualTo(ZERO)) {
      throw new BadRequestException("Gross Salary must be greater than zero.");
    }
    const netPay = currency(new Decimal(input.netPay));
    if (netPay.lessThan(ZERO) || netPay.greaterThan(grossSalary)) {
      throw new BadRequestException("Net Pay must be between zero and Gross Salary.");
    }
    const selectedBankPercentage = safePercentage(netPay, grossSalary);
    const replayedBankPay = currency(
      grossSalary.times(new Decimal(selectedBankPercentage)).div(HUNDRED),
    );
    if (!replayedBankPay.equals(netPay)) {
      throw new BadRequestException(
        "An exact all-net-by-bank percentage cannot be represented safely for this Gross Salary and Net Pay.",
      );
    }
    return {
      selectedBankPercentage,
      bankPay: netPay.toFixed(2),
      cashPay: "0.00",
      percentagePrecision:
        "Calculated helper percentage; not limited to persisted payment-profile precision.",
    };
  }
}

function safePercentage(numerator: Prisma.Decimal, denominator: Prisma.Decimal) {
  return new HighPrecisionDecimal(numerator.toString())
    .times(100)
    .div(denominator.toString())
    .toDecimalPlaces(
      CALCULATED_PERCENTAGE_PLACES,
      HighPrecisionDecimal.ROUND_DOWN,
    )
    .toFixed(CALCULATED_PERCENTAGE_PLACES);
}
