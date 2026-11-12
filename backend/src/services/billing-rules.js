export function isFlutterwaveTransactionValid(transaction, expectedPayment) {
  if (!transaction || transaction.status !== "successful") return false;
  const paidAmount = Number(transaction.amount);
  const expectedAmount = Number(expectedPayment.amount.toString());
  return (
    transaction.tx_ref === expectedPayment.reference &&
    String(transaction.currency).toUpperCase() === String(expectedPayment.currency).toUpperCase() &&
    Number.isFinite(paidAmount) &&
    paidAmount >= expectedAmount
  );
}

export function nextBillingDate(periodEnd, intervalMonths, now = new Date()) {
  const start = periodEnd && periodEnd > now ? periodEnd : now;
  const originalDay = start.getUTCDate();
  const result = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth() + intervalMonths,
    1,
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
    start.getUTCMilliseconds()
  ));
  const lastDayOfTargetMonth = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0
  )).getUTCDate();

  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
}
