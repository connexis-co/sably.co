import { createHash } from "node:crypto";

export const currencies = {
  CO: "COP",
  MX: "MXN",
  ES: "EUR",
  AR: "ARS",
  CL: "CLP",
  PE: "PEN",
  EC: "USD",
  US: "USD",
};

export function readAmount(json, row, source, withCoupon) {
  const data = json?.data;
  if (data?.countryIsoCode !== row.market || data.products?.length !== 1)
    return null;
  const product = data.products[0];
  const offer = product?.offer;
  if (String(product?.id) !== row.product || typeof offer?.key !== "string")
    return null;
  if (
    createHash("sha256").update(offer.key).digest("hex") !== source.ofertaSha256
  )
    return null;
  if (currencies[row.market] !== row.currency) return null;
  const cards = offer.paymentMethods?.filter(
    (m) => m.type === "CREDIT_CARD" && m.amount?.currency === row.currency,
  );
  if (cards?.length !== 1) return null;
  const card = cards[0];
  const amount = card.amount?.value;
  const applied = card.additionalData?.isCouponApplied === true;
  const discount =
    card.summary?.items?.some(
      (i) => i.type === "COUPON" && Number.isFinite(i.value) && i.value > 0,
    ) === true;
  if (
    !(Number.isFinite(amount) && amount > 0) ||
    applied !== withCoupon ||
    discount !== withCoupon
  )
    return null;
  return amount;
}

export async function verify(row, source, read) {
  if (
    !source ||
    !currencies[row.market] ||
    currencies[row.market] !== row.currency
  )
    return null;
  const amount = readAmount(await read(row, source, null), row, source, false);
  if (!amount) return null;
  let discounted = null;
  if (row.coupon) {
    discounted = readAmount(
      await read(row, source, row.coupon),
      row,
      source,
      true,
    );
    if (!(discounted > 0 && discounted < amount)) return null;
  }
  return { amount, coupon_amount: discounted };
}
