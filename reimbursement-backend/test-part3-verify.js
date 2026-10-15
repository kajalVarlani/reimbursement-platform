const { generateSignatureHash, verifySignatureHash, buildAuditTrailCertificate } = require("./src/services/digitalSignatureService");
const prisma = require("./src/prisma/client");

async function testPart3() {
  console.log("=== RUNNING PART 3 DIGITAL SIGNATURE VERIFICATION TEST ===");

  try {
    const testReimbursementId = "claim_test_sig_12345";
    const testAmount = 14500.50;
    const testSignerId = "admin_dean_987";
    const testEmail = "dean.students@university.edu";
    const testRole = "DEAN_STUDENTS";
    const testTimestamp = new Date();

    // 1. Test Hash Generation
    const hash = generateSignatureHash({
      reimbursementId: testReimbursementId,
      amount: testAmount,
      signerId: testSignerId,
      signerEmail: testEmail,
      signerRole: testRole,
      timestamp: testTimestamp,
    });

    console.log(`✅ Step 1: Generated SHA256 Signature Hash: ${hash}`);
    if (!hash || hash.length !== 64) {
      throw new Error("Invalid hash length or generation failed");
    }

    // 2. Test Verification on untampered data
    const isValid = verifySignatureHash({
      hash,
      reimbursementId: testReimbursementId,
      amount: testAmount,
      signerId: testSignerId,
      signerEmail: testEmail,
      signerRole: testRole,
      timestamp: testTimestamp,
    });
    console.log(`✅ Step 2: Signature verification against authentic data: ${isValid ? "VALID (MATCH)" : "FAILED"}`);
    if (!isValid) throw new Error("Expected signature to be valid");

    // 3. Test Tamper Detection (e.g. Someone tries to modify claim amount to ₹20,000 in DB)
    const tamperedCheck = verifySignatureHash({
      hash,
      reimbursementId: testReimbursementId,
      amount: 20000.00, // TAMPERED AMOUNT!
      signerId: testSignerId,
      signerEmail: testEmail,
      signerRole: testRole,
      timestamp: testTimestamp,
    });
    console.log(`✅ Step 3: Tamper Detection Test (Amount changed to ₹20,000): ${!tamperedCheck ? "TAMPER DETECTED & BLOCKED" : "FAILED TO DETECT"}`);
    if (tamperedCheck) throw new Error("Expected tampered signature to fail verification");

    // 4. Test Audit Trail Builder with real DB record
    const user = await prisma.user.upsert({
      where: { email: "siguser@test.com" },
      update: { name: "Signature Test User" },
      create: { name: "Signature Test User", email: "siguser@test.com", password: "pwd", designation: "CONVENOR", clubName: "Tech Club" },
    });

    const deanAdmin = await prisma.administrator.upsert({
      where: { email: "sigdean@test.com" },
      update: { name: "Dean Test Official", role: "DEAN_STUDENTS" },
      create: { name: "Dean Test Official", email: "sigdean@test.com", password: "pwd", role: "DEAN_STUDENTS" },
    });

    const convenorSigTime = new Date();
    const convenorSigUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const dbClaim = await prisma.reimbursement.create({
      data: {
        committee: "Tech Club",
        event: "Hackathon",
        amount: 8500.00,
        status: "APPROVED",
        currentStage: "AWAITING_PAYMENT",
        submissionSignatureUrl: convenorSigUrl,
        userId: user.id,
      },
    });

    const convenorHash = generateSignatureHash({
      reimbursementId: dbClaim.id,
      amount: dbClaim.amount,
      signerId: user.id,
      signerEmail: user.email,
      signerRole: user.designation,
      timestamp: convenorSigTime,
    });

    await prisma.reimbursement.update({
      where: { id: dbClaim.id },
      data: {
        submissionSignatureHash: convenorHash,
        submissionSignedAt: convenorSigTime,
      },
    });

    const deanSigTime = new Date();
    const deanHash = generateSignatureHash({
      reimbursementId: dbClaim.id,
      amount: dbClaim.amount,
      signerId: deanAdmin.id,
      signerEmail: deanAdmin.email,
      signerRole: "DEAN_STUDENTS",
      timestamp: deanSigTime,
    });

    await prisma.reimbursementApproval.create({
      data: {
        reimbursementId: dbClaim.id,
        administratorId: deanAdmin.id,
        priority: 3,
        status: "APPROVED",
        remark: "Sanctioned digitally",
        signatureImageUrl: convenorSigUrl,
        signatureHash: deanHash,
        signerName: deanAdmin.name,
        signerRole: "DEAN_STUDENTS",
        signerEmail: deanAdmin.email,
        actedAt: deanSigTime,
      },
    });

    const cert = await buildAuditTrailCertificate(dbClaim.id);
    console.log(`✅ Step 4: Audit Certificate Generated: ${cert.certificateId}`);
    console.log(`         Signatures recorded: ${cert.signatures.length}`);
    console.log(`         Tamper-Proof Status: ${cert.isTamperProof ? "100% VERIFIED AUTHENTIC" : "TAMPERED"}`);

    if (!cert.isTamperProof || cert.signatures.length !== 2) {
      throw new Error("Audit Certificate verification failed");
    }

    // Clean up
    await prisma.reimbursementApproval.deleteMany({ where: { reimbursementId: dbClaim.id } });
    await prisma.reimbursement.delete({ where: { id: dbClaim.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.administrator.delete({ where: { id: deanAdmin.id } });

    console.log("\n=== ALL PART 3 DIGITAL SIGNATURE ENGINE TESTS PASSED! ===");
    process.exit(0);
  } catch (err) {
    console.error("Part 3 test failed:", err);
    process.exit(1);
  }
}

testPart3();
