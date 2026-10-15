import { useRef, useState, useEffect, useCallback } from 'react';
import { HiOutlineX, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck } from 'react-icons/hi';
import { TbShieldCheck } from 'react-icons/tb';

function SignaturePadModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Digitally Sign and Approve',
  actionLabel = 'Sign and Approve',
  actionColor = '#2a9d6e',
  requireRemark = false,
  remarkLabel = 'Remark / Note (optional)',
  remarkPlaceholder = 'Enter your remarks here',
  claimInfo = null,
  processing = false,
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [remark, setRemark] = useState('');
  const [penColor, setPenColor] = useState('#0B3E33');
  const lastPos = useRef(null);

  const getCanvas = () => canvasRef.current;
  const getCtx = () => getCanvas()?.getContext('2d');

  const resizeCanvas = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 180 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '180px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = 'rgba(79, 124, 130, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(16, 148);
    ctx.lineTo(rect.width - 16, 148);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = penColor;
  }, [penColor]);

  useEffect(() => {
    if (isOpen) {
      setHasSignature(false);
      setRemark('');
      setTimeout(() => resizeCanvas(), 50);
    }
  }, [isOpen, resizeCanvas]);

  const getPos = (e) => {
    const canvas = getCanvas();
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e);
    const ctx = getCtx();
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = getCtx();
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    setHasSignature(false);
    resizeCanvas();
  };

  const handleConfirm = () => {
    if (!hasSignature) return;
    if (requireRemark && !remark.trim()) return;
    const canvas = getCanvas();
    const dataUrl = canvas.toDataURL('image/png');
    onConfirm(dataUrl, remark.trim());
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !processing) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(11, 62, 51, 0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '20px',
        boxShadow: '0 24px 80px rgba(11,62,51,0.22)',
        width: '100%', maxWidth: '520px', overflow: 'hidden',
      }}>
        <div style={{
          background: 'linear-gradient(135deg,#0B3E33 0%,#4F7C82 100%)',
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', color: '#fff',
            }}>
              <TbShieldCheck />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>{title}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                HMAC-SHA256 Tamper-Proof Seal
              </div>
            </div>
          </div>
          <button onClick={onClose} disabled={processing}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '8px', color: '#fff', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px' }}>
            <HiOutlineX />
          </button>
        </div>

        {claimInfo && (
          <div style={{ padding: '12px 24px', background: 'rgba(79,124,130,0.07)', borderBottom: '1px solid rgba(79,124,130,0.12)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {claimInfo.committee && <span style={{ fontSize: '12.5px', color: '#4F7C82', fontWeight: 600 }}>Club: {claimInfo.committee}</span>}
            {claimInfo.event && <span style={{ fontSize: '12.5px', color: '#0B3E33', fontWeight: 600 }}>Event: {claimInfo.event}</span>}
            {claimInfo.amount != null && <span style={{ fontSize: '12.5px', color: '#2a9d6e', fontWeight: 700 }}>Rs.{Number(claimInfo.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>}
          </div>
        )}

        <div style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#0B3E33', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HiOutlinePencil /> Draw your signature below
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {['#0B3E33','#1a1a2e','#4F7C82','#7c3aed'].map((c) => (
                  <button key={c} onClick={() => { setPenColor(c); const ctx = getCtx(); if (ctx) ctx.strokeStyle = c; }}
                    style={{ width: '18px', height: '18px', borderRadius: '50%', background: c, border: penColor === c ? '2.5px solid #fff' : '2px solid transparent', outline: penColor === c ? ('2px solid ' + c) : 'none', cursor: 'pointer', padding: 0 }} />
                ))}
                <button onClick={clearCanvas} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#dc4b4b', background: 'rgba(220,75,75,0.07)', border: '1px solid rgba(220,75,75,0.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                  <HiOutlineTrash /> Clear
                </button>
              </div>
            </div>

            <div style={{ position: 'relative', border: '2px ' + (hasSignature ? 'solid #2a9d6e' : 'dashed rgba(79,124,130,0.35)'), borderRadius: '12px', background: hasSignature ? 'rgba(42,157,110,0.02)' : '#fafefe', overflow: 'hidden', cursor: 'crosshair', userSelect: 'none' }}>
              {!hasSignature && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '6px', pointerEvents: 'none', color: 'rgba(79,124,130,0.45)' }}>
                  <HiOutlinePencil style={{ fontSize: '28px' }} />
                  <span style={{ fontSize: '12.5px', fontWeight: 500 }}>Sign here</span>
                </div>
              )}
              <canvas ref={canvasRef}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                style={{ display: 'block', touchAction: 'none' }} />
            </div>
            {hasSignature && (
              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#2a9d6e', fontWeight: 600 }}>
                <HiOutlineCheck /> Signature captured - Cryptographic seal will be generated on submit
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#0B3E33', display: 'block', marginBottom: '6px' }}>
              {remarkLabel}{requireRemark && <span style={{ color: '#dc4b4b' }}> *</span>}
            </label>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={remarkPlaceholder} rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid rgba(79,124,130,0.3)', fontSize: '13.5px', fontFamily: 'Inter,sans-serif', color: '#0B3E33', background: '#fafefe', resize: 'vertical', outline: 'none' }} />
          </div>

          <div style={{ background: 'rgba(79,124,130,0.06)', border: '1px solid rgba(79,124,130,0.15)', borderRadius: '10px', padding: '10px 14px', fontSize: '11.5px', color: '#4F7C82', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <TbShieldCheck style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }} />
            <span>Your visual signature and a <strong>tamper-proof HMAC-SHA256 cryptographic seal</strong> will be permanently recorded in the audit trail. This action is <strong>irreversible</strong>.</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} disabled={processing} style={{ padding: '10px 20px', borderRadius: '10px', border: '1.5px solid rgba(79,124,130,0.25)', background: '#fff', color: '#4F7C82', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleConfirm} disabled={!hasSignature || (requireRemark && !remark.trim()) || processing}
              style={{ padding: '10px 24px', borderRadius: '10px', background: hasSignature ? actionColor : 'rgba(42,157,110,0.3)', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 700, cursor: hasSignature ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {processing ? 'Processing...' : (<><TbShieldCheck style={{ fontSize: '16px' }} />{actionLabel}</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignaturePadModal;
