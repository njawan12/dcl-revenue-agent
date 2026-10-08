import { detectKnownCommerceApps, detectShopify } from './shopify.js';

function evidence(id, title, severity, confidence, source, details = {}) {
  return { id, title, severity, confidence, source, details };
}

export function inspectStorefrontHtml(html = '', meta = {}) {
  const body = String(html);
  const lower = body.toLowerCase();
  const shopify = detectShopify(body, meta.headers ?? {});
  const technologies = detectKnownCommerceApps(body);
  const findings = [];

  const hasProductForm = /product-form|name=["']?add|\/cart\/add/i.test(body);
  const hasStickyAtc = /sticky[^\n]{0,80}(add.to.cart|atc)|add.to.cart[^\n]{0,80}sticky/i.test(lower);
  const hasSubscription = /subscribe|subscription|selling[_ -]?plan|recharge|skio|stay\.ai|stayai/i.test(lower);
  const hasReviews = /reviews?|rating|okendo|yotpo|judge\.me|stamped/i.test(lower);
  const hasShippingCopy = /free shipping|shipping|ships in|delivery/i.test(lower);
  const hasReturnsCopy = /returns?|refund/i.test(lower);
  const scriptCount = (body.match(/<script\b/gi) ?? []).length;
  const imageCount = (body.match(/<img\b/gi) ?? []).length;
  const lazyImageCount = (body.match(/loading=["']lazy["']/gi) ?? []).length;

  if (hasProductForm && !hasStickyAtc) {
    findings.push(evidence('no_sticky_atc_marker', 'No sticky add-to-cart marker detected', 0.45, 0.55, meta.url, { heuristic: true }));
  }
  if (hasProductForm && !hasReviews) {
    findings.push(evidence('reviews_not_detected', 'Reviews or rating markup not detected on product-like page', 0.35, 0.45, meta.url, { heuristic: true }));
  }
  if (hasProductForm && !hasShippingCopy) {
    findings.push(evidence('shipping_copy_not_detected', 'Shipping messaging not detected in fetched HTML', 0.3, 0.4, meta.url, { heuristic: true }));
  }
  if (hasProductForm && !hasReturnsCopy) {
    findings.push(evidence('returns_copy_not_detected', 'Returns messaging not detected in fetched HTML', 0.25, 0.4, meta.url, { heuristic: true }));
  }
  if (scriptCount >= 35) {
    findings.push(evidence('high_script_count', 'High script-tag count detected', Math.min(1, scriptCount / 80), 0.7, meta.url, { scriptCount }));
  }
  if (imageCount >= 12 && lazyImageCount / Math.max(imageCount, 1) < 0.35) {
    findings.push(evidence('low_lazy_image_ratio', 'Low lazy-loading marker ratio across images', 0.45, 0.65, meta.url, { imageCount, lazyImageCount }));
  }

  return {
    shopify,
    technologies,
    traits: { hasProductForm, hasStickyAtc, hasSubscription, hasReviews, hasShippingCopy, hasReturnsCopy, scriptCount, imageCount, lazyImageCount },
    findings,
  };
}

export function storefrontNeedVector(report) {
  const ids = new Set((report?.findings ?? []).map((f) => f.id));
  return {
    cro: ids.has('no_sticky_atc_marker') ? 0.45 : 0,
    performance: ids.has('high_script_count') || ids.has('low_lazy_image_ratio') ? 0.55 : 0,
    mobileUx: ids.has('no_sticky_atc_marker') ? 0.4 : 0,
    pdp: ['reviews_not_detected','shipping_copy_not_detected','returns_copy_not_detected'].some((id) => ids.has(id)) ? 0.5 : 0,
    subscription: report?.traits?.hasSubscription ? 0.25 : 0,
    analytics: 0,
    retention: report?.technologies?.includes('klaviyo') ? 0.2 : 0,
    qa: 0,
  };
}
