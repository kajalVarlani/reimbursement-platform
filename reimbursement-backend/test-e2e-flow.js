const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('====================================================');
  console.log('🚀 STARTING COMPREHENSIVE E2E HIERARCHY & FLOW TESTS');
  console.log('====================================================\n');

  // ── Step 1: Health check
  console.log('📌 1. Checking backend connectivity...');
  try {
    const res = await fetch(`${BASE_URL}/api/user/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test', password: 'test' }),
    });
    console.log(`✅ Backend server reachable on ${BASE_URL} (status ${res.status})`);
  } catch (err) {
    console.error('❌ Could not connect to backend server on http://localhost:5000. Is it running?');
    process.exit(1);
  }

  // ── Helper: Login
  async function loginUser(email, password = 'Password123') {
    const res = await request(`${BASE_URL}/api/user/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`User login failed for ${email}: ${res.data?.message}`);
    return res.data.token;
  }

  async function loginAdmin(email, password = 'Password123') {
    const res = await request(`${BASE_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Admin login failed for ${email}: ${res.data?.message}`);
    return res.data.token;
  }

  // ── Step 2: Login all actors
  console.log('\n📌 2. Logging in all actors...');
  const convenorToken = await loginUser('music.convenor@reimbursement.com');
  console.log('✅ Music Club Convenor logged in');

  const facultyToken = await loginAdmin('profx@reimbursement.com');
  console.log('✅ Faculty Mentor (Prof X) logged in');

  const treasurerToken = await loginAdmin('treasurer@reimbursement.com');
  console.log('✅ Treasurer (Super Admin) logged in');

  const deanToken = await loginAdmin('dean@reimbursement.com');
  console.log('✅ Dean Students logged in');

  const accountantToken = await loginAdmin('accountant@reimbursement.com');
  console.log('✅ Central Accountant logged in');

  // ── Step 3: Verify Initial Club Budget
  console.log('\n📌 3. Verifying initial Club Budget for Music Club...');
  const budgetRes = await request(`${BASE_URL}/api/user/reimbursements/budget`, {
    headers: { Authorization: `Bearer ${convenorToken}` },
  });
  console.log(`✅ Budget retrieved: Allocated ₹${budgetRes.data?.allocatedAmount}, Spent ₹${budgetRes.data?.spentAmount}, Remaining ₹${budgetRes.data?.remainingAmount}`);
  if (budgetRes.data?.allocatedAmount !== 100000 || budgetRes.data?.spentAmount !== 0) {
    throw new Error(`Budget mismatch! Received: ${JSON.stringify(budgetRes.data)}`);
  }

  // ── Step 4: Treasurer creates/ensures Active 45-day cycle & Music Club submits projection
  console.log('\n📌 4. Setting up Active 45-Day Projection Cycle & Submitting Projection...');
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Check or create active cycle for current month
  const cyclePayload = {
    cycleName: 'Semester Midterm 45-Day Cycle',
    targetMonth: currentMonthKey,
    durationDays: 45,
    bufferAmount: 100000,
    deadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
    instructions: 'Submit itemized event expenses for the 45-day window.',
  };
  const cycleRes = await request(`${BASE_URL}/api/projections/window`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${treasurerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cyclePayload),
  });
  if (!cycleRes.ok) {
    throw new Error(`Cycle creation failed: ${cycleRes.data?.message}`);
  }

  // Music Club submits a ₹20,000 projection
  const projSubmitRes = await request(`${BASE_URL}/api/projections/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${convenorToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetMonth: currentMonthKey,
      items: [
        { eventName: 'Acoustic Concert', expectedAmount: 10000, description: 'Stage equipment & audio' },
        { eventName: 'Music Workshop', expectedAmount: 10000, description: 'Guest speaker & instruments' },
      ],
    }),
  });

  if (!projSubmitRes.ok) {
    throw new Error(`Projection submission failed: ${projSubmitRes.data?.message}`);
  }
  console.log(`✅ Music Club projection submitted: Status ${projSubmitRes.data?.projection?.status}, Auto-Approved: ${projSubmitRes.data?.projection?.isAutoApproved}`);
  console.log(`   Total Estimated: ₹${projSubmitRes.data?.projection?.totalEstimatedAmount}`);

  // Helper: Create a fake receipt image blob for multipart upload
  function createMultipartPayload(claimData, billData) {
    const formData = new FormData();
    formData.append('committee', claimData.committee);
    formData.append('event', claimData.event);
    formData.append('description', claimData.description || '');
    formData.append('recipientType', 'STUDENT');
    formData.append('beneficiaryName', 'Aman Sharma');
    formData.append('paymentMode', 'BANK_TRANSFER');
    formData.append('bankName', 'State Bank of India');
    formData.append('accountNumber', '123456789012');
    formData.append('ifscCode', 'SBIN0001234');
    formData.append('signatureImageUrl', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    formData.append('bills', JSON.stringify([billData]));

    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const blob = new Blob([pngBuffer], { type: 'image/png' });
    formData.append('receipts', blob, 'receipt.png');

    return formData;
  }

  // =========================================================================
  // TEST SCENARIO A: ADVANCE / WITHIN-PROJECTION CLAIM (₹5,000)
  // Flow: Convenor (Sign) ➔ Treasurer (Sign) ➔ Faculty Mentor (Sign) ➔ Dean Students (Sign) ➔ Treasurer Loopback Payout (UTR)
  // =========================================================================
  console.log('\n=============================================================');
  console.log('🧪 TEST SCENARIO A: ADVANCE CLAIM UNDER PROJECTION (₹5,000)');
  console.log('=============================================================');

  console.log('📌 A1. Submitting Claim 1 (₹5,000 within ₹20,000 approved projection)...');
  const claim1Payload = createMultipartPayload(
    {
      committee: 'Music Club',
      event: 'Acoustic Concert Sound Equipment',
      description: 'Sound equipment rental for acoustic concert',
    },
    {
      amount: 5000,
      allocatedAmount: 5000,
      vendorName: 'SoundWave Rentals',
      invoiceNumber: 'INV-2026-001',
      billDate: '2026-10-02',
    }
  );

  const claim1Res = await request(`${BASE_URL}/api/user/reimbursements`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${convenorToken}` },
    body: claim1Payload,
  });

  if (!claim1Res.ok) throw new Error(`Failed to submit Claim 1: ${claim1Res.data?.message}`);
  const claim1 = claim1Res.data.reimbursement;
  const claim1Id = claim1.id;
  console.log(`✅ Claim 1 submitted successfully! ID: ${claim1Id}`);
  console.log(`   Amount: ₹${claim1.amount}`);
  console.log(`   claimType: ${claim1.claimType} (Expected: ADVANCE)`);
  console.log(`   withinBuffer: ${claim1.withinBuffer}`);
  console.log(`   routedToAccountant: ${claim1.routedToAccountant} (Expected: false)`);
  console.log(`   currentStage: ${claim1.currentStage} (Priority ${claim1.currentPriority})`);
  console.log(`   submissionSignatureHash: ${claim1.submissionSignatureHash ? 'PRESENT (SHA-256)' : 'MISSING'}`);

  if (claim1.claimType !== 'ADVANCE' || claim1.routedToAccountant) {
    throw new Error('Claim 1 must be ADVANCE and NOT routed to accountant!');
  }
  if (claim1.currentStage !== 'TREASURER') {
    throw new Error('Claim 1 must start at Stage 1: TREASURER');
  }

  // Test Hierarchy Enforcement at Stage 1:
  console.log('\n📌 A2. Testing Hierarchy Violation: Faculty Mentor attempting to approve before Treasurer...');
  const facultyEarlyRes = await request(`${BASE_URL}/api/admin/reimbursements/${claim1Id}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ remark: 'Premature approval attempt by Faculty Mentor' }),
  });
  console.log(`   Response status: ${facultyEarlyRes.status} (Expected 403)`);
  if (facultyEarlyRes.status !== 403) {
    throw new Error('Faculty Mentor was able to approve Stage 1 claim before Treasurer! Hierarchy broken.');
  }
  console.log('✅ Faculty Mentor blocked from approving Stage 1 as required!');

  // Stage 1: Treasurer approves with signature
  console.log('\n📌 A3. Stage 1: Treasurer approves Claim 1 with Digital Signature...');
  const treasurerApproveRes = await request(`${BASE_URL}/api/admin/reimbursements/${claim1Id}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${treasurerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      remark: 'Verified within approved cycle projection',
      signatureImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    }),
  });
  if (!treasurerApproveRes.ok) throw new Error(`Treasurer approval failed: ${treasurerApproveRes.data?.message}`);
  console.log(`✅ Treasurer approved Claim 1! Next stage: ${treasurerApproveRes.data.stage || treasurerApproveRes.data.reimbursement?.currentStage}`);

  // Stage 2: Faculty Mentor (Prof X) approves with signature
  console.log('\n📌 A4. Stage 2: Faculty Mentor (Prof X) approves Claim 1...');
  const profApproveRes = await request(`${BASE_URL}/api/admin/reimbursements/${claim1Id}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${facultyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      remark: 'Event confirmed and audio vendor verified',
      signatureImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    }),
  });
  if (!profApproveRes.ok) throw new Error(`Prof X approval failed: ${profApproveRes.data?.message}`);
  console.log(`✅ Faculty Mentor approved! Next stage: ${profApproveRes.data.stage || profApproveRes.data.reimbursement?.currentStage}`);

  // Stage 3: Dean Students sanctions with signature
  console.log('\n📌 A5. Stage 3: Dean of Students sanctions Claim 1...');
  const deanApproveRes = await request(`${BASE_URL}/api/admin/reimbursements/${claim1Id}/approve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deanToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      remark: 'Sanctioned for immediate advance disbursement',
      signatureImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    }),
  });
  if (!deanApproveRes.ok) throw new Error(`Dean sanction failed: ${deanApproveRes.data?.message}`);
  console.log(`✅ Dean Students sanctioned! New status/stage: ${deanApproveRes.data.stage || deanApproveRes.data.reimbursement?.currentStage}`);

  // Check stage: should be AWAITING_PAYMENT (skips Accountant!)
  const claim1AfterDean = await request(`${BASE_URL}/api/user/reimbursements/${claim1Id}`, {
    headers: { Authorization: `Bearer ${convenorToken}` },
  });
  console.log(`   Claim 1 Stage after Dean: ${claim1AfterDean.data?.currentStage}`);
  if (claim1AfterDean.data?.currentStage !== 'AWAITING_PAYMENT') {
    throw new Error(`Expected Stage AWAITING_PAYMENT, got: ${claim1AfterDean.data?.currentStage}`);
  }

  // Stage 4: Treasurer Loopback Payment Mark-off
  console.log('\n📌 A6. Stage 4 (Loopback): Treasurer marks Claim 1 as Paid with UTR...');
  const payRes1 = await request(`${BASE_URL}/api/admin/reimbursements/${claim1Id}/mark-paid`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${treasurerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      paymentReference: 'UTR-ADV-2026-9901',
      notes: 'Disbursed via bank transfer to student beneficiary',
    }),
  });
  if (!payRes1.ok) throw new Error(`Mark paid failed: ${payRes1.data?.message}`);
  console.log(`✅ Payment marked successfully! isPaid: ${payRes1.data.reimbursement?.isPaid}, Stage: ${payRes1.data.reimbursement?.currentStage}`);

  // Check Club Budget after Claim 1 payment
  const budgetAfter1 = await request(`${BASE_URL}/api/user/reimbursements/budget`, {
    headers: { Authorization: `Bearer ${convenorToken}` },
  });
  console.log(`✅ Updated Club Budget: Allocated ₹${budgetAfter1.data?.allocatedAmount}, Spent ₹${budgetAfter1.data?.spentAmount}, Remaining ₹${budgetAfter1.data?.remainingAmount}`);
  if (budgetAfter1.data?.spentAmount !== 5000 || budgetAfter1.data?.remainingAmount !== 95000) {
    throw new Error('Club budget remaining should be 95000!');
  }

  // =========================================================================
  // TEST SCENARIO B: POST-EVENT / OVER-PROJECTION CLAIM (₹25,000)
  // Flow: Convenor (Sign) ➔ Treasurer (Sign) ➔ Faculty Mentor (Sign) ➔ Dean Students (Sign) ➔ Accountant (Sign) ➔ Treasurer Loopback Payout (UTR)
  // =========================================================================
  console.log('\n=============================================================');
  console.log('🧪 TEST SCENARIO B: POST-EVENT / OVER-PROJECTION CLAIM (₹25,000)');
  console.log('=============================================================');

  console.log('📌 B1. Submitting Claim 2 (₹25,000 - Exceeds remaining ₹15,000 projection quota)...');
  const claim2Payload = createMultipartPayload(
    {
      committee: 'Music Club',
      event: 'Annual Inter-College Band Showcase',
      description: 'Major event staging, lighting, and guest artist fees',
    },
    {
      amount: 25000,
      allocatedAmount: 25000,
      vendorName: 'LiveSound & Lights Corp',
      invoiceNumber: 'INV-2026-LIVE-88',
      billDate: '2026-10-03',
    }
  );

  const claim2Res = await request(`${BASE_URL}/api/user/reimbursements`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${convenorToken}` },
    body: claim2Payload,
  });

  if (!claim2Res.ok) throw new Error(`Failed to submit Claim 2: ${claim2Res.data?.message}`);
  const claim2 = claim2Res.data.reimbursement;
  const claim2Id = claim2.id;
  console.log(`✅ Claim 2 submitted successfully! ID: ${claim2Id}`);
  console.log(`   Amount: ₹${claim2.amount}`);
  console.log(`   claimType: ${claim2.claimType} (Expected: POST_EVENT)`);
  console.log(`   routedToAccountant: ${claim2.routedToAccountant} (Expected: true)`);
  console.log(`   accountantReason: "${claim2.accountantReason}"`);

  if (claim2.claimType !== 'POST_EVENT' || !claim2.routedToAccountant) {
    throw new Error('Claim 2 must be POST_EVENT and routedToAccountant: true!');
  }

  // Stage 1: Treasurer approves Claim 2
  console.log('\n📌 B2. Stage 1: Treasurer approves Claim 2...');
  const tApprove2 = await request(`${BASE_URL}/api/admin/reimbursements/${claim2Id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${treasurerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ remark: 'Approved as post-event manual reimbursement' }),
  });
  if (!tApprove2.ok) throw new Error(`Treasurer failed to approve Claim 2: ${tApprove2.data?.message}`);
  console.log(`✅ Treasurer approved! Next stage: ${tApprove2.data.stage || tApprove2.data.reimbursement?.currentStage}`);

  // Stage 2: Faculty Mentor approves Claim 2
  console.log('\n📌 B3. Stage 2: Faculty Mentor approves Claim 2...');
  const fApprove2 = await request(`${BASE_URL}/api/admin/reimbursements/${claim2Id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ remark: 'Verified live band performance bills' }),
  });
  if (!fApprove2.ok) throw new Error(`Faculty failed to approve Claim 2: ${fApprove2.data?.message}`);
  console.log(`✅ Faculty Mentor approved! Next stage: ${fApprove2.data.stage || fApprove2.data.reimbursement?.currentStage}`);

  // Stage 3: Dean Students sanctions Claim 2 ➔ routes to ACCOUNTANT_REVIEW
  console.log('\n📌 B4. Stage 3: Dean Students sanctions Claim 2 ➔ Routes to Accountant...');
  const dApprove2 = await request(`${BASE_URL}/api/admin/reimbursements/${claim2Id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${deanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ remark: 'Sanctioned subject to audit of original GST invoices' }),
  });
  if (!dApprove2.ok) throw new Error(`Dean failed to approve Claim 2: ${dApprove2.data?.message}`);
  console.log(`✅ Dean sanctioned! Next stage: ${dApprove2.data.stage || dApprove2.data.reimbursement?.currentStage} (Expected: ACCOUNTANT_REVIEW)`);

  const claim2AfterDean = await request(`${BASE_URL}/api/user/reimbursements/${claim2Id}`, {
    headers: { Authorization: `Bearer ${convenorToken}` },
  });
  if (claim2AfterDean.data?.currentStage !== 'ACCOUNTANT_REVIEW') {
    throw new Error(`Expected ACCOUNTANT_REVIEW stage, got: ${claim2AfterDean.data?.currentStage}`);
  }

  // Stage 4: Accountant audits and approves Claim 2
  console.log('\n📌 B5. Stage 4: Central Accountant audits GST invoices and approves Claim 2...');
  const acctApprove2 = await request(`${BASE_URL}/api/admin/reimbursements/${claim2Id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accountantToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      remark: 'All vendor GST bills checked and verified authentic',
      signatureImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    }),
  });
  if (!acctApprove2.ok) throw new Error(`Accountant approval failed: ${acctApprove2.data?.message}`);
  console.log(`✅ Accountant audited & approved! Next stage: ${acctApprove2.data.stage || acctApprove2.data.reimbursement?.currentStage} (Expected: AWAITING_PAYMENT)`);

  // Stage 5: Treasurer Loopback Payment Mark-off for Claim 2
  console.log('\n📌 B6. Stage 5 (Loopback): Treasurer marks Claim 2 as Paid...');
  const payRes2 = await request(`${BASE_URL}/api/admin/reimbursements/${claim2Id}/mark-paid`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${treasurerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentReference: 'UTR-POST-2026-7788',
      notes: 'Cleared post-event claim after accountant sign-off',
    }),
  });
  if (!payRes2.ok) throw new Error(`Mark paid Claim 2 failed: ${payRes2.data?.message}`);
  console.log(`✅ Payment marked for Claim 2! isPaid: ${payRes2.data.reimbursement?.isPaid}, Stage: ${payRes2.data.reimbursement?.currentStage}`);

  // Check Final Club Budget (Allocated 100k - 5k - 25k = 70k Remaining)
  const budgetFinal = await request(`${BASE_URL}/api/user/reimbursements/budget`, {
    headers: { Authorization: `Bearer ${convenorToken}` },
  });
  console.log(`✅ Final Club Budget: Allocated ₹${budgetFinal.data?.allocatedAmount}, Spent ₹${budgetFinal.data?.spentAmount}, Remaining ₹${budgetFinal.data?.remainingAmount}`);
  if (budgetFinal.data?.spentAmount !== 30000 || budgetFinal.data?.remainingAmount !== 70000) {
    throw new Error(`Budget remaining mismatch! Expected 70000, got ${budgetFinal.data?.remainingAmount}`);
  }

  // =========================================================================
  // TEST SCENARIO C: DIGITAL SANCTION CERTIFICATE & CRYPTOGRAPHIC AUDIT SEAL
  // =========================================================================
  console.log('\n=============================================================');
  console.log('🧪 TEST SCENARIO C: SANCTION CERTIFICATE & DIGITAL SIGNATURES');
  console.log('=============================================================');

  console.log('📌 C1. Fetching Digital Sanction Certificate for Claim 1 (Advance)...');
  const certRes1 = await request(`${BASE_URL}/api/user/reimbursements/${claim1Id}/signature-audit`, {
    headers: { Authorization: `Bearer ${convenorToken}` },
  });
  if (!certRes1.ok) throw new Error(`Failed to fetch certificate: ${certRes1.data?.message}`);
  const cert1 = certRes1.data.certificate || certRes1.data;
  console.log(`✅ Sanction Certificate Number: ${cert1.certificateNumber}`);
  console.log(`   Claim ID: ${cert1.claim.id}, Amount: ₹${cert1.claim.amount}`);
  console.log(`   Recorded Signatures: ${cert1.signatures.length}`);
  console.log(`   Verification Status: ${cert1.verificationStatus}`);

  for (const s of cert1.signatures) {
    console.log(`     - [${s.stage}] ${s.signerName} (${s.signerRole}): SHA-256 ${s.signatureHash ? s.signatureHash.substring(0, 16) + '...' : 'N/A'}`);
  }

  console.log('\n📌 C2. Fetching Digital Sanction Certificate for Claim 2 (Post-Event with Accountant)...');
  const certRes2 = await request(`${BASE_URL}/api/user/reimbursements/${claim2Id}/signature-audit`, {
    headers: { Authorization: `Bearer ${convenorToken}` },
  });
  if (!certRes2.ok) throw new Error(`Failed to fetch certificate 2: ${certRes2.data?.message}`);
  const cert2 = certRes2.data.certificate || certRes2.data;
  console.log(`✅ Sanction Certificate Number: ${cert2.certificateNumber}`);
  console.log(`   Recorded Signatures: ${cert2.signatures.length}`);
  for (const s of cert2.signatures) {
    console.log(`     - [${s.stage}] ${s.signerName} (${s.signerRole}): SHA-256 ${s.signatureHash ? s.signatureHash.substring(0, 16) + '...' : 'N/A'}`);
  }

  console.log('\n=============================================================');
  console.log('🎉 ALL COMPREHENSIVE END-TO-END FLOW TESTS PASSED PERFECTLY!');
  console.log('=============================================================');
}

run().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
