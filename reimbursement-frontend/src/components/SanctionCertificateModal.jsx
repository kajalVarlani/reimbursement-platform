import { useRef } from 'react';
import { HiOutlineX, HiOutlinePrinter, HiOutlineCheckCircle, HiOutlineExclamationCircle } from 'react-icons/hi';
import { TbShieldCheck, TbCertificate } from 'react-icons/tb';

function SanctionCertificateModal({ isOpen, onClose, certificate, loading }) {
  const printRef = useRef(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(11, 62, 51, 0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 70px rgba(11, 62, 51, 0.25)',
          width: '100%',
          maxWidth: '840px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top Action Bar */}
        <div style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #0B3E33 0%, #4F7C82 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TbCertificate style={{ fontSize: '24px' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.5px' }}>
                DIGITAL SANCTION CERTIFICATE
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)' }}>
                Official University Cryptographic Approval & Payout Record
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#ffffff',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <HiOutlinePrinter style={{ fontSize: '16px' }} /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                color: '#ffffff',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              <HiOutlineX />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ padding: '32px 36px', overflowY: 'auto', flex: 1 }} ref={printRef} className="printable-certificate">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#4F7C82' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
              <p style={{ fontWeight: 600 }}>Loading cryptographic sanction certificate...</p>
            </div>
          ) : !certificate ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#dc4b4b' }}>
              <HiOutlineExclamationCircle style={{ fontSize: '40px', marginBottom: '8px' }} />
              <p style={{ fontWeight: 600 }}>Certificate details could not be retrieved.</p>
            </div>
          ) : (
            <div>
              {/* Formal Certificate Header */}
              <div style={{
                borderBottom: '2px solid rgba(79, 124, 130, 0.25)',
                paddingBottom: '20px',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#0B3E33', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    ClaimNest University
                  </div>
                  <div style={{ fontSize: '13px', color: '#4F7C82', fontWeight: 600 }}>
                    Office of Finance & Student Affairs
                  </div>
                  <div style={{ fontSize: '11px', color: '#93B1B5', marginTop: '4px' }}>
                    Automated Reimbursement & Advance Sanction Authority
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: certificate.isTamperProof ? 'rgba(42, 157, 110, 0.12)' : 'rgba(220, 75, 75, 0.12)',
                    color: certificate.isTamperProof ? '#2a9d6e' : '#dc4b4b',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: '1px solid ' + (certificate.isTamperProof ? 'rgba(42, 157, 110, 0.3)' : 'rgba(220, 75, 75, 0.3)'),
                  }}>
                    <TbShieldCheck style={{ fontSize: '16px' }} />
                    {certificate.isTamperProof ? 'HMAC-SHA256 VERIFIED' : 'UNVERIFIED / PENDING'}
                  </div>
                  <div style={{ fontSize: '11.5px', fontFamily: 'monospace', color: '#4F7C82', marginTop: '6px' }}>
                    {certificate.certificateId || ('CERT-' + certificate.claimId?.slice(-8).toUpperCase())}
                  </div>
                </div>
              </div>

              {/* Claim Overview Card */}
              <div style={{
                background: '#f8fcfa',
                border: '1px solid rgba(79, 124, 130, 0.18)',
                borderRadius: '16px',
                padding: '20px 24px',
                marginBottom: '28px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}>
                <div>
                  <div style={{ fontSize: '11.5px', color: '#93B1B5', fontWeight: 600, textTransform: 'uppercase' }}>
                    Committee / Club
                  </div>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0B3E33', marginTop: '2px' }}>
                    {certificate.committee}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#93B1B5', fontWeight: 600, textTransform: 'uppercase' }}>
                    Event / Purpose
                  </div>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0B3E33', marginTop: '2px' }}>
                    {certificate.event}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#93B1B5', fontWeight: 600, textTransform: 'uppercase' }}>
                    Sanctioned Amount
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#2a9d6e', marginTop: '2px' }}>
                    Rs. {Number(certificate.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#93B1B5', fontWeight: 600, textTransform: 'uppercase' }}>
                    Classification
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: certificate.claimType === 'ADVANCE' ? '#2a9d6e' : '#e09c3a', marginTop: '2px' }}>
                    {certificate.claimType === 'ADVANCE' ? 'Cycle Advance (Within Projection)' : 'Post-Event Reimbursement'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#93B1B5', fontWeight: 600, textTransform: 'uppercase' }}>
                    Approval Status
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: certificate.status === 'APPROVED' ? '#2a9d6e' : '#0B3E33', marginTop: '2px' }}>
                    {certificate.status} {certificate.currentStage ? '(' + certificate.currentStage + ')' : ''}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: '#93B1B5', fontWeight: 600, textTransform: 'uppercase' }}>
                    Payment Status
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: certificate.isPaid ? '#2a9d6e' : '#e09c3a', marginTop: '2px' }}>
                    {certificate.isPaid ? 'PAID / DISBURSED' : 'PENDING DISBURSEMENT'}
                  </div>
                </div>
              </div>

              {/* Digital Signatures Audit Trail */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0B3E33', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TbShieldCheck style={{ fontSize: '20px', color: '#2a9d6e' }} />
                  Cryptographic Signature Chain of Custody
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {certificate.signatures && certificate.signatures.length > 0 ? (
                    certificate.signatures.map((sig, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1.5px solid ' + (sig.isValid ? 'rgba(42, 157, 110, 0.25)' : 'rgba(79, 124, 130, 0.18)'),
                          borderRadius: '14px',
                          padding: '16px 20px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '16px',
                        }}
                      >
                        <div style={{ flex: '1 1 300px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#f0f8fa',
                              color: '#0B3E33',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(79, 124, 130, 0.2)',
                            }}>
                              {sig.stage || ('Stage ' + (idx + 1))}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0B3E33' }}>
                              {sig.signerName}
                            </span>
                            <span style={{ fontSize: '12px', color: '#4F7C82', fontWeight: 500 }}>
                              ({sig.role})
                            </span>
                          </div>

                          {sig.remarks && (
                            <div style={{ fontSize: '12.5px', color: '#4F7C82', marginTop: '6px', fontStyle: 'italic' }}>
                              "{sig.remarks}"
                            </div>
                          )}

                          <div style={{ fontSize: '11px', color: '#93B1B5', marginTop: '6px' }}>
                            Signed on: {new Date(sig.signedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>

                          {sig.signatureHash && (
                            <div style={{
                              marginTop: '8px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: 'rgba(79, 124, 130, 0.05)',
                              fontSize: '10.5px',
                              fontFamily: 'monospace',
                              color: '#4F7C82',
                              wordBreak: 'break-all',
                            }}>
                              HMAC-SHA256: {sig.signatureHash}
                            </div>
                          )}
                        </div>

                        {/* Visual signature image box */}
                        <div style={{
                          minWidth: '150px',
                          height: '65px',
                          border: '1px dashed rgba(79, 124, 130, 0.3)',
                          borderRadius: '8px',
                          background: '#fafefe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          padding: '4px',
                        }}>
                          {sig.signatureImageUrl ? (
                            <img
                              src={sig.signatureImageUrl}
                              alt={'Signature of ' + sig.signerName}
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <span style={{ fontSize: '11px', color: '#93B1B5', fontStyle: 'italic' }}>
                              [Visual Seal Recorded]
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '13px', color: '#93B1B5', fontStyle: 'italic' }}>
                      No signature audit steps recorded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Disbursement Reference if Paid */}
              {certificate.isPaid && (
                <div style={{
                  background: 'rgba(42, 157, 110, 0.08)',
                  border: '1.5px solid rgba(42, 157, 110, 0.3)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  marginBottom: '24px',
                }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#2a9d6e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HiOutlineCheckCircle style={{ fontSize: '18px' }} />
                    Disbursement & Payout Confirmation
                  </div>
                  <div style={{ fontSize: '13px', color: '#0B3E33', marginTop: '6px' }}>
                    Disbursed with Transaction / UTR Reference: <strong>{certificate.paymentReference || 'Direct Bank/UPI Transfer'}</strong>
                  </div>
                  {certificate.paidAt && (
                    <div style={{ fontSize: '11.5px', color: '#4F7C82', marginTop: '4px' }}>
                      Completed at: {new Date(certificate.paidAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  )}
                </div>
              )}

              {/* Security Seal Footer */}
              <div style={{
                borderTop: '1px dashed rgba(79, 124, 130, 0.3)',
                paddingTop: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                color: '#93B1B5',
              }}>
                <div>
                  This is a computer-generated cryptographic sanction certificate issued by ClaimNest.
                </div>
                <div>
                  Timestamp: {new Date(certificate.generatedAt || Date.now()).toISOString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-certificate, .printable-certificate * {
            visibility: visible;
          }
          .printable-certificate {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default SanctionCertificateModal;
