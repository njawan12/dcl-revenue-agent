const SHOPIFY_MARKERS = [
  /cdn\.shopify\.com/i,
  /shopify-section/i,
  /window\.Shopify/i,
  /Shopify\.theme/i,
  /\/cdn\/shop\/files\//i,
  /myshopify\.com/i,
  /shopify-payment-button/i,
  /shopify-features/i,
];

const PLUS_MARKERS = [
  /Shopify Plus/i,
  /shopifyPlus/i,
  /checkoutExtensibility/i,
];

export function detectShopify(html = '', headers = {}) {
  const body = String(html);
  const headerText = Object.entries(headers ?? {}).map(([k,v]) => `${k}:${v}`).join('\n');
  const evidence = [];
  for (const marker of SHOPIFY_MARKERS) {
    if (marker.test(body) || marker.test(headerText)) evidence.push(marker.source);
  }
  const uniqueEvidence = [...new Set(evidence)];
  const confidence = Math.min(1, uniqueEvidence.length * 0.22);
  const plusEvidence = PLUS_MARKERS.filter((marker) => marker.test(body) || marker.test(headerText)).map((m) => m.source);
  return {
    isShopify: confidence >= 0.35,
    confidence,
    evidence: uniqueEvidence,
    isShopifyPlusLikely: plusEvidence.length > 0,
    plusConfidence: Math.min(0.9, plusEvidence.length * 0.35),
    plusEvidence,
  };
}

export function detectKnownCommerceApps(html = '') {
  const body = String(html).toLowerCase();
  const markers = {
    klaviyo: ['klaviyo', 'static.klaviyo.com'],
    recharge: ['rechargepayments', 'rechargeapps', 'rechargecdn'],
    skio: ['skio', 'skio.com'],
    stayai: ['stay.ai', 'stayai'],
    gorgias: ['gorgias', 'gorgias.chat'],
    okendo: ['okendo', 'oke-reviews'],
    yotpo: ['yotpo'],
    attentive: ['attentive', 'attn.tv'],
    postscript: ['postscript', 'postscript.io'],
    rebuy: ['rebuyengine', 'rebuy'],
  };
  return Object.entries(markers)
    .filter(([, needles]) => needles.some((needle) => body.includes(needle)))
    .map(([technology]) => technology);
}
