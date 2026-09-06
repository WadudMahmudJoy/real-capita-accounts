/** Convert a number to Bangladeshi-style English words for the print layout. */
export function amountToWords(amount: number): string {
  if (amount <= 0) {
    return "Zero";
  }

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
    "Ninety",
  ];

  function convert(n: number): string {
    if (n < 20) {
      return ones[n];
    }
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ` ${ones[n % 10]}` : "");
    }
    if (n < 1000) {
      return (
        ones[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 !== 0 ? ` ${convert(n % 100)}` : "")
      );
    }
    if (n < 100000) {
      return (
        convert(Math.floor(n / 1000)) +
        " Thousand" +
        (n % 1000 !== 0 ? ` ${convert(n % 1000)}` : "")
      );
    }
    if (n < 10000000) {
      return (
        convert(Math.floor(n / 100000)) +
        " Lac" +
        (n % 100000 !== 0 ? ` ${convert(n % 100000)}` : "")
      );
    }
    return (
      convert(Math.floor(n / 10000000)) +
      " Crore" +
      (n % 10000000 !== 0 ? ` ${convert(n % 10000000)}` : "")
    );
  }

  const whole = Math.floor(amount);
  const paisa = Math.round((amount - whole) * 100);
  let result = convert(whole) + " Taka";

  if (paisa > 0) {
    result += ` and ${convert(paisa)} Paisa`;
  }

  return result;
}
