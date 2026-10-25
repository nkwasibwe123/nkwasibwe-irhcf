"use strict";

function createCapabilityDiscoveryRepository({ pool } = {}) {
  if (!pool || typeof pool.query !== "function") {
    throw new Error("Capability discovery repository requires a PostgreSQL pool.");
  }

  return {
    async listKnownCapabilities() {
      const result = await pool.query(`
        SELECT DISTINCT requested_capability AS name
        FROM capability_requests
        WHERE requested_capability IS NOT NULL
        UNION
        SELECT DISTINCT capability AS name
        FROM capability_discovery_proposals
        WHERE capability IS NOT NULL
      `);
      return result.rows.map(row => row.name).filter(Boolean);
    },

    async saveProposal(proposal) {
      const result = await pool.query(`
        INSERT INTO capability_discovery_proposals
          (fingerprint, title, description, source, capability, risks, status,
           requires_sandbox, requires_security_review, requires_regression_tests,
           requires_human_promotion, discovered_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (fingerprint) DO NOTHING
        RETURNING id
      `, [
        proposal.fingerprint, proposal.title, proposal.description,
        proposal.source, proposal.capability, JSON.stringify(proposal.risks || []),
        "PROPOSED", true, true, true, true, proposal.discoveredAt
      ]);
      return result.rowCount > 0;
    }
  };
}

module.exports = { createCapabilityDiscoveryRepository };
