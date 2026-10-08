function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function buildEvidenceCatalog(signals = []) {
  return signals
    .filter((signal) => hasText(signal.title) && hasText(signal.source_url || signal.sourceUrl))
    .slice(0, 20)
    .map((signal, index) => ({
      id: `E${index + 1}`,
      signalId: signal.id ?? null,
      type: signal.signal_type ?? signal.type ?? 'unknown',
      title: signal.title.trim(),
      sourceUrl: signal.source_url ?? signal.sourceUrl,
      sourceName: signal.source_name ?? signal.sourceName ?? 'source',
      confidence: Number(signal.confidence ?? 0.5),
      evidence: signal.evidence ?? {},
    }));
}

export function approvedProofCatalog(proofPoints = []) {
  return proofPoints
    .filter((proof) => proof.approved === true && hasText(proof.approved_claim ?? proof.approvedClaim))
    .map((proof) => ({
      id: proof.id,
      clientName: proof.client_name ?? proof.clientName,
      claim: proof.approved_claim ?? proof.approvedClaim,
      serviceTags: proof.service_tags ?? proof.serviceTags ?? [],
      evidenceReference: proof.evidence_reference ?? proof.evidenceReference ?? null,
    }));
}
