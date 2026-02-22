/** エントリー手数料（円） */
export const ENTRY_SERVICE_FEE = 1500;

/** 工賃（1エントリーあたりの運営コスト、円） */
export const OPERATION_COST = 500;

/** Stripe決済手数料率 (3.6%) */
export const STRIPE_FEE_RATE = 0.036;

/** 陸連登録料（陸協ごと） */
export interface JaafRegistration {
  /** 陸協ID */
  associationId: string;
  /** 陸協名 */
  name: string;
  /** 登録料（円） */
  fee: number;
}

export const JAAF_REGISTRATIONS: JaafRegistration[] = [
  { associationId: "hokkaido", name: "北海道陸上競技協会", fee: 4400 },
  { associationId: "sapporo", name: "札幌陸上競技協会", fee: 4400 },
];

/**
 * Stripe手数料込みの合計金額を計算する
 * Stripe手数料 = ceil(合計 / (1 - rate)) - 合計
 */
export function calcTotalWithStripe(baseFee: number, serviceFee: number): {
  baseFee: number;
  serviceFee: number;
  stripeFee: number;
  total: number;
} {
  const subtotal = baseFee + serviceFee;
  const total = Math.ceil(subtotal / (1 - STRIPE_FEE_RATE));
  const stripeFee = total - subtotal;
  return { baseFee, serviceFee, stripeFee, total };
}
