/**
 * Stripe 商品 & 料金 一括作成スクリプト
 * Usage: node scripts/create-stripe-prices.mjs
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY 環境変数が未設定です");
  process.exit(1);
}

const PLANS = [
  // フルサポート（陸連登録 + 大会申込）
  { id: "full-intro",     name: "入門プラン",              price: 9000,   desc: "フルサポート｜エントリー1回｜初年度限定" },
  { id: "full-single",    name: "単発プラン",              price: 15000,  desc: "フルサポート｜エントリー1回" },
  { id: "full-light",     name: "ライトプラン",            price: 20000,  desc: "フルサポート｜エントリー3回" },
  { id: "full-standard",  name: "スタンダードプラン",       price: 40000,  desc: "フルサポート｜エントリー8回" },
  { id: "full-premium",   name: "プレミアムプラン",         price: 200000, desc: "フルサポート｜エントリー50回" },
  // エントリーのみ（陸連登録なし）
  { id: "entry-intro",    name: "入門プラン（陸連登録なし）",   price: 3000,   desc: "エントリーのみ｜1回｜初年度限定" },
  { id: "entry-single",   name: "単発プラン（陸連登録なし）",   price: 5000,   desc: "エントリーのみ｜1回" },
  { id: "entry-light",    name: "ライトプラン（陸連登録なし）", price: 12000,  desc: "エントリーのみ｜3回" },
  { id: "entry-standard", name: "スタンダードプラン（陸連登録なし）", price: 30000, desc: "エントリーのみ｜8回" },
  { id: "entry-premium",  name: "プレミアムプラン（陸連登録なし）",  price: 190000, desc: "エントリーのみ｜50回" },
  // 追加エントリー
  { id: "additional-entry", name: "追加エントリー",         price: 5000,   desc: "追加エントリー1回分" },
];

async function stripePost(endpoint, body) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe API error (${res.status}): ${err}`);
  }
  return res.json();
}

async function main() {
  console.log("🚀 Stripe 商品 & 料金 一括作成を開始します...\n");

  const results = [];

  for (const plan of PLANS) {
    // 1. 商品を作成
    const product = await stripePost("products", {
      name: plan.name,
      description: plan.desc,
      "metadata[plan_id]": plan.id,
    });
    console.log(`✅ 商品作成: ${plan.name} (${product.id})`);

    // 2. 料金を作成（JPYは0桁通貨なのでそのまま）
    const price = await stripePost("prices", {
      product: product.id,
      unit_amount: String(plan.price),
      currency: "jpy",
      "metadata[plan_id]": plan.id,
    });
    console.log(`   💰 料金作成: ¥${plan.price.toLocaleString()} → ${price.id}\n`);

    results.push({ planId: plan.id, name: plan.name, priceId: price.id, productId: product.id });
  }

  // 結果一覧を表示
  console.log("═".repeat(60));
  console.log("📋 作成結果一覧");
  console.log("═".repeat(60));
  for (const r of results) {
    console.log(`  ${r.name}`);
    console.log(`    Plan ID:    ${r.planId}`);
    console.log(`    Price ID:   ${r.priceId}`);
    console.log(`    Product ID: ${r.productId}`);
    console.log("");
  }

  // plans.ts 用のマッピングを出力
  console.log("═".repeat(60));
  console.log("📝 plans.ts 用マッピング (JSON)");
  console.log("═".repeat(60));
  const mapping = {};
  for (const r of results) {
    mapping[r.planId] = r.priceId;
  }
  console.log(JSON.stringify(mapping, null, 2));
}

main().catch((err) => {
  console.error("❌ エラー:", err.message);
  process.exit(1);
});
