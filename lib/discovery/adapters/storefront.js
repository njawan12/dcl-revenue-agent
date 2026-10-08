import { defineDiscoverySource } from '../sources.js';
import { safeFetchText } from '../http.js';
import { inspectStorefrontHtml } from '../storefront.js';
import { registrableDomain } from '../domain.js';

export function createStorefrontSource({ candidates = [], fetchImpl = fetch }) {
  return defineDiscoverySource({
    name: 'storefront-crawl',
    async discover() {
      const accounts = [];
      const signals = [];
      for (const candidate of candidates) {
        const websiteUrl = candidate.url ?? `https://${candidate.domain}`;
        try {
          const fetched = await safeFetchText(websiteUrl, { fetchImpl });
          const report = inspectStorefrontHtml(fetched.text, { url: fetched.url, headers: fetched.headers });
          if (!report.shopify.isShopify) continue;
          const domain = registrableDomain(fetched.url);
          accounts.push({
            domain,
            name: candidate.name,
            url: fetched.url,
            country: candidate.country,
            industry: candidate.industry,
            employeeCount: candidate.employeeCount,
            sourceUrl: fetched.url,
            evidence: { shopifyConfidence: report.shopify.confidence, technologies: report.technologies },
          });
          signals.push({
            accountDomain: domain,
            type: 'account_fit',
            title: 'Shopify storefront verified',
            sourceUrl: fetched.url,
            confidence: report.shopify.confidence,
            evidence: { shopify: report.shopify, technologies: report.technologies },
          });
          for (const technology of report.technologies) {
            signals.push({
              accountDomain: domain,
              type: 'technology',
              title: `${technology} detected`,
              sourceUrl: fetched.url,
              confidence: 0.75,
              evidence: { technology, detection: 'public_html_marker' },
            });
          }
          for (const finding of report.findings) {
            signals.push({
              accountDomain: domain,
              type: 'storefront',
              title: finding.title,
              sourceUrl: fetched.url,
              confidence: finding.confidence,
              evidence: finding,
              fingerprint: `${domain}|storefront|${finding.id}`,
            });
          }
        } catch {
          // Per-account failures are intentionally contained; batch discovery continues.
        }
      }
      return { accounts, signals };
    },
  });
}
