export interface Plan {
  id: string;
  name: string;
  price: number;
  entryLimit: number;
  includesJaafReg: boolean;
  firstYearOnly?: boolean;
  stripePriceId: string;
  color: string;
}

export const PLANS: Plan[] = [
  // フルサポート（陸連登録 + 大会申込）
  {
    id: "full-intro",
    name: "入門プラン",
    price: 9000,
    entryLimit: 1,
    includesJaafReg: true,
    firstYearOnly: true,
    stripePriceId: "price_1T1okEHJ0fnIcl70OYKOpGxU",
    color: "green",
  },
  {
    id: "full-single",
    name: "単発プラン",
    price: 15000,
    entryLimit: 1,
    includesJaafReg: true,
    stripePriceId: "price_1T1okFHJ0fnIcl70jFFBoK1h",
    color: "gray",
  },
  {
    id: "full-light",
    name: "ライトプラン",
    price: 20000,
    entryLimit: 3,
    includesJaafReg: true,
    stripePriceId: "price_1T1okFHJ0fnIcl70GhSHbrbw",
    color: "blue",
  },
  {
    id: "full-standard",
    name: "スタンダードプラン",
    price: 40000,
    entryLimit: 8,
    includesJaafReg: true,
    stripePriceId: "price_1T1okGHJ0fnIcl708FspMCqf",
    color: "orange",
  },
  {
    id: "full-premium",
    name: "プレミアムプラン",
    price: 200000,
    entryLimit: 50,
    includesJaafReg: true,
    stripePriceId: "price_1T1okGHJ0fnIcl70A8pbpU0r",
    color: "purple",
  },

  // エントリーのみ（陸連登録なし）
  {
    id: "entry-intro",
    name: "入門プラン（陸連登録なし）",
    price: 3000,
    entryLimit: 1,
    includesJaafReg: false,
    firstYearOnly: true,
    stripePriceId: "price_1T1okHHJ0fnIcl70FLFZvZWr",
    color: "gray",
  },
  {
    id: "entry-single",
    name: "単発プラン（陸連登録なし）",
    price: 5000,
    entryLimit: 1,
    includesJaafReg: false,
    stripePriceId: "price_1T1okIHJ0fnIcl70FUymj04h",
    color: "gray",
  },
  {
    id: "entry-light",
    name: "ライトプラン（陸連登録なし）",
    price: 12000,
    entryLimit: 3,
    includesJaafReg: false,
    stripePriceId: "price_1T1okIHJ0fnIcl70LXC92Vwx",
    color: "gray",
  },
  {
    id: "entry-standard",
    name: "スタンダードプラン（陸連登録なし）",
    price: 30000,
    entryLimit: 8,
    includesJaafReg: false,
    stripePriceId: "price_1T1okJHJ0fnIcl70PdtmkjTJ",
    color: "gray",
  },
  {
    id: "entry-premium",
    name: "プレミアムプラン（陸連登録なし）",
    price: 190000,
    entryLimit: 50,
    includesJaafReg: false,
    stripePriceId: "price_1T1okKHJ0fnIcl70n5EJLD9j",
    color: "gray",
  },
];

export const ADDITIONAL_ENTRY_PRICE = 5000;
export const ADDITIONAL_ENTRY_STRIPE_PRICE_ID = "price_1T1okKHJ0fnIcl70ztmD0ZPI";

export function getPlanById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function getFullSupportPlans(): Plan[] {
  return PLANS.filter((p) => p.includesJaafReg);
}

export function getEntryOnlyPlans(): Plan[] {
  return PLANS.filter((p) => !p.includesJaafReg);
}
