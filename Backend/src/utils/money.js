// Phase 2: Calculate GST in rupees and convert rupee amounts to Razorpay paise.
export function calculateGst(amount, gstPercent = 18) {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(gstPercent) || gstPercent < 0) {
    throw new TypeError('Amount and GST percent must be non-negative numbers.');
  }

  return Math.round((amount * gstPercent) / 100 * 100) / 100;
}

export function rupeesToPaise(amount) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TypeError('Rupee amount must be a non-negative number.');
  }

  const paise = Math.round(amount * 100);
  if (!Number.isSafeInteger(paise)) throw new RangeError('Rupee amount is too large to convert safely.');
  return paise;
}

export function getPayableAmount(plan, gstSettings = {}) {
  const baseAmountRupees = Number(plan?.price);
  const gstEnabled = gstSettings.enabled ?? true;
  const gstRate = Number(gstSettings.rate ?? plan?.gstPercent ?? 18);
  if (!Number.isFinite(baseAmountRupees) || baseAmountRupees < 0
    || typeof gstEnabled !== 'boolean'
    || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100
    || Math.abs(gstRate * 100 - Math.round(gstRate * 100)) > 1e-8) {
    throw new TypeError('Plan price and GST percent must be valid non-negative numbers.');
  }
  const baseAmount = rupeesToPaise(baseAmountRupees);
  const rateBasisPoints = Math.round(gstRate * 100);
  const gstAmount = gstEnabled
    ? Number((BigInt(baseAmount) * BigInt(rateBasisPoints) + 5000n) / 10000n)
    : 0;
  const totalAmount = baseAmount + gstAmount;
  if (!Number.isSafeInteger(totalAmount)) {
    throw new RangeError('Total payment amount is too large to represent safely.');
  }
  return {
    baseAmount,
    gstRate,
    gstEnabled,
    gstLabel: String(gstSettings.label || 'GST').trim() || 'GST',
    gstAmount,
    totalAmount,
    currency: 'INR',
  };
}

export function paiseToRupees(amount) {
  if (!Number.isSafeInteger(amount)) throw new TypeError('Paise amount must be a safe integer.');
  return amount / 100;
}
