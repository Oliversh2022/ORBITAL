const standardMethod = "standard";

export function getShippingQuote(method = standardMethod) {
  if (method !== standardMethod) {
    const error = new Error("当前只开放普通配送方案。");
    error.code = "delivery_method_unavailable";
    throw error;
  }

  const configuredFee = process.env.ORBITAL_STANDARD_SHIPPING_FEE?.trim();
  if (!configuredFee) {
    return { method, currency: "CNY", fee: null, status: "pending_configuration" };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(configuredFee)) {
    const error = new Error("普通配送费率配置无效，请使用非负数字且最多保留两位小数。");
    error.code = "shipping_configuration_invalid";
    throw error;
  }

  const fee = Number(configuredFee);
  if (!Number.isFinite(fee)) {
    const error = new Error("普通配送费率配置无效。");
    error.code = "shipping_configuration_invalid";
    throw error;
  }
  return { method, currency: "CNY", fee, status: "configured" };
}
