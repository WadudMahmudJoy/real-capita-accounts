// Project the existing payroll foundation for independent migration parity.
export function withoutPaymentFoundation(schema: string) {
  let result = schema.replace(/^model PayrollCashAcknowledgment \{[\s\S]*?^\}\r?\n/m, "").replace(/^.*cashAcknowledgment.*\r?\n/gm, "").replace(/^.*@@unique\(\[verificationAuthority, evidenceKind, evidenceReference\]\).*\r?\n/gm, "");
  for (const name of ["PayrollPaymentChannel", "PayrollPaymentBatchStatus", "PayrollSourceActionKind", "PayrollReservationState", "PayrollSourceAuthorization", "PayrollPaymentBatch", "PayrollPaymentLine", "PayrollPaymentConfirmation", "PayrollFinanceDelegate", "PayrollFinanceDelegateRevocation", "PayrollSourceAction", "PayrollSourceDecision", "PayrollPaymentReservation", "PayrollCancellationRequest", "PayrollCancellationDecision"]) {
    result = result.replace(new RegExp(`^(?:model|enum) ${name} \\{[\\s\\S]*?^\\}\\r?\\n`, "m"), "");
  }
  return result.replace(/^.*(?:PayrollSourceAuthorization|PayrollPaymentBatch|PayrollPaymentLine|PayrollPaymentConfirmation|PayrollFinanceDelegate|PayrollFinanceDelegateRevocation|PayrollSourceAction|PayrollSourceDecision|PayrollPaymentReservation|PayrollCancellationRequest|PayrollCancellationDecision)\[\].*\r?\n/gm, "")
    .replace(/^.*payroll(?:Material|Authority)Version\s+Int.*\r?\n/gm, "");
}
