const crypto = require("crypto");
const prisma = require("../prisma/client");

const SEAL_SECRET = process.env.JWT_SECRET || "university-reimbursement-cryptographic-seal-2026";

/**
 * Generate a tamper-proof cryptographic HMAC-SHA256 signature hash
 */
function generateSignatureHash({ reimbursementId, amount, signerId, signerEmail, signerRole, timestamp }) {
  const ts = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp || Date.now()).toISOString();
  const amtStr = parseFloat(amount || 0).toFixed(2);
  const rawPayload = `CLAIM:${reimbursementId}|AMT:${amtStr}|SIGNER:${signerId}|EMAIL:${(signerEmail || "").toLowerCase().trim()}|ROLE:${(signerRole || "").toUpperCase().trim()}|TS:${ts}`;
  return crypto.createHmac("sha256", SEAL_SECRET).update(rawPayload).digest("hex").toUpperCase();
}

/**
 * Verify if a signature hash matches the recorded claim data
 */
function verifySignatureHash({ hash, reimbursementId, amount, signerId, signerEmail, signerRole, timestamp }) {
  if (!hash) return false;
  try {
    const computed = generateSignatureHash({ reimbursementId, amount, signerId, signerEmail, signerRole, timestamp });
    const bufA = Buffer.from(hash.toUpperCase(), "utf8");
    const bufB = Buffer.from(computed.toUpperCase(), "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

/**
 * Build a complete cryptographic and visual audit trail certificate for a reimbursement claim
 */
async function buildAuditTrailCertificate(reimbursementId) {
  const claim = await prisma.reimbursement.findUnique({
    where: { id: reimbursementId },
    include: {
      user: {
        select: { id: true, name: true, email: true, designation: true, clubName: true },
      },
      approvals: {
        include: {
          administrator: {
            select: { id: true, name: true, email: true, role: true, position: { select: { name: true } } },
          },
        },
        orderBy: { priority: "asc" },
      },
      bills: {
        include: { bill: true },
      },
    },
  });

  if (!claim) return null;

  // 1. Convenor Submission Signature
  const convenorSignedAt = claim.submissionSignedAt || claim.createdAt;
  const convenorHashValid = claim.submissionSignatureHash
    ? verifySignatureHash({
        hash: claim.submissionSignatureHash,
        reimbursementId: claim.id,
        amount: claim.amount,
        signerId: claim.userId,
        signerEmail: claim.user?.email,
        signerRole: claim.user?.designation || "CONVENOR",
        timestamp: convenorSignedAt,
      })
    : Boolean(claim.submissionSignatureUrl);

  const auditSignatures = [
    {
      stage: "Stage 0: Submission",
      role: claim.user?.designation || "CLUB_CONVENOR",
      signerName: claim.user?.name || "Club Convenor",
      signerEmail: claim.user?.email,
      signatureImageUrl: claim.submissionSignatureUrl,
      signatureHash: claim.submissionSignatureHash,
      signedAt: convenorSignedAt,
      isValid: convenorHashValid,
      remarks: `Submitted claim for ${claim.committee} - ${claim.event}`,
    },
  ];

  // 2. Administrative Approvals
  for (const app of claim.approvals) {
    if (app.status === "APPROVED") {
      const signedAt = app.actedAt || app.updatedAt;
      const roleStr = app.signerRole || app.administrator?.role || "ADMINISTRATOR";
      const isValid = app.signatureHash
        ? verifySignatureHash({
            hash: app.signatureHash,
            reimbursementId: claim.id,
            amount: claim.amount,
            signerId: app.administratorId,
            signerEmail: app.signerEmail || app.administrator?.email,
            signerRole: roleStr,
            timestamp: signedAt,
          })
        : Boolean(app.signatureImageUrl);

      auditSignatures.push({
        stage: `Stage ${app.priority}: ${roleStr}`,
        role: roleStr,
        signerName: app.signerName || app.administrator?.name || "Official",
        signerEmail: app.signerEmail || app.administrator?.email,
        signatureImageUrl: app.signatureImageUrl,
        signatureHash: app.signatureHash,
        signedAt,
        isValid,
        remarks: app.remark || "Approved with digital sign-off",
      });
    }
  }

  // 3. Payment Mark-off Seal (Treasurer Loopback)
  if (claim.isPaid) {
    auditSignatures.push({
      stage: "Disbursement Seal: Payout Complete",
      role: "TREASURER (DISBURSEMENT)",
      signerName: "University Treasurer",
      signatureHash: `DISBURSED-${(claim.paymentReference || "DIRECT").toUpperCase()}`,
      signedAt: claim.paidAt,
      isValid: true,
      remarks: `Funds released & portal debited with UTR / Transaction Ref: ${claim.paymentReference || "Direct Transfer"}`,
    });
  }

  const allValid = auditSignatures.every((s) => s.isValid !== false);

  return {
    certificateId: `SANCTION-CERT-${claim.id.slice(-8).toUpperCase()}`,
    claimId: claim.id,
    committee: claim.committee,
    event: claim.event,
    amount: claim.amount,
    claimType: claim.claimType,
    status: claim.status,
    currentStage: claim.currentStage,
    isPaid: claim.isPaid,
    paymentReference: claim.paymentReference,
    paidAt: claim.paidAt,
    generatedAt: new Date(),
    isTamperProof: allValid,
    signatures: auditSignatures,
  };
}

module.exports = {
  generateSignatureHash,
  verifySignatureHash,
  buildAuditTrailCertificate,
};
