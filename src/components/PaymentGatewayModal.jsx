import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Smartphone, ShieldCheck, RefreshCw, CheckCircle, X, Globe
} from 'lucide-react';

export default function PaymentGatewayModal({ amount, employeeName, isBatch, onPaymentSuccess, onCancel, settings }) {
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [paymentState, setPaymentState] = useState('input'); // 'input', 'processing', 'success'
  const [processingMessage, setProcessingMessage] = useState('');
  const [txnId, setTxnId] = useState('');
  
  // Card Inputs
  const [cardDetails, setCardDetails] = useState({
    number: '4315 2816 9081 1234',
    expiry: '12/29',
    cvv: '123',
    name: 'Owner Admin'
  });

  // UPI Input
  const [upiId, setUpiId] = useState('admin@okaxis');

  // Netbanking Input
  const [bank, setBank] = useState('SBI');

  // Set randomized transaction ID on load
  useEffect(() => {
    const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
    setTxnId(`TXN_RPRY_${randomHex}`);
  }, []);

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    setPaymentState('processing');
    
    // Simulate payment authorization timeline
    const stages = [
      'Establishing secure connection...',
      'Validating payment tokens...',
      'Authorizing transaction with bank vault...',
      'Locking payroll ledger and finalizing...'
    ];

    let currentStage = 0;
    setProcessingMessage(stages[0]);

    const interval = setInterval(() => {
      currentStage++;
      if (currentStage < stages.length) {
        setProcessingMessage(stages[currentStage]);
      } else {
        clearInterval(interval);
        setPaymentState('success');
        
        // Finalize payout after checkmark animation completes
        setTimeout(() => {
          onPaymentSuccess();
        }, 1800);
      }
    }, 900);
  };

  const curr = settings?.currency || '₹';

  return (
    <div className="gateway-overlay">
      <div className="gateway-container">
        
        {/* Gateway Header */}
        <div className="gateway-header">
          <div className="gateway-merchant-info">
            <div className="gateway-merchant-logo">{settings?.companyName ? settings.companyName.charAt(0) : 'S'}</div>
            <div>
              <h3 className="gateway-merchant-name">{settings?.companyName || 'Staffly'} Corp Ltd.</h3>
              <p className="gateway-purpose">
                {isBatch ? 'Batch Payroll Payout' : `Salary payout to ${employeeName}`}
              </p>
            </div>
          </div>
          <div className="gateway-amount-section">
            <span className="gateway-currency">{curr}</span>
            <span className="gateway-amount">{amount.toLocaleString('en-IN')}</span>
          </div>
          <button className="gateway-close-btn" onClick={onCancel} aria-label="Cancel Transaction">
            <X size={16} />
          </button>
        </div>

        {paymentState === 'input' && (
          <div className="gateway-body">
            {/* Payment Options Menu */}
            <div className="gateway-sidebar">
              <button 
                type="button"
                className={`gateway-menu-item ${selectedMethod === 'card' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('card')}
              >
                <CreditCard size={16} />
                <span>Card Payout</span>
              </button>
              <button 
                type="button"
                className={`gateway-menu-item ${selectedMethod === 'upi' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('upi')}
              >
                <Smartphone size={16} />
                <span>UPI / QR Code</span>
              </button>
              <button 
                type="button"
                className={`gateway-menu-item ${selectedMethod === 'netbanking' ? 'active' : ''}`}
                onClick={() => setSelectedMethod('netbanking')}
              >
                <Globe size={16} />
                <span>Net Banking</span>
              </button>
            </div>

            {/* Selected Method Details Panel */}
            <div className="gateway-details-panel">
              <form onSubmit={handlePaymentSubmit}>
                
                {/* 1. CARD METHOD */}
                {selectedMethod === 'card' && (
                  <div className="gateway-form-content">
                    <h4 className="gateway-section-title">Enter Card Details</h4>
                    <div className="gateway-input-group">
                      <label htmlFor="gt-card-num" className="gateway-input-label">Card Number</label>
                      <input 
                        id="gt-card-num"
                        type="text" 
                        className="gateway-control" 
                        value={cardDetails.number}
                        onChange={(e) => setCardDetails({...cardDetails, number: e.target.value})}
                        placeholder="4315 2816 9081 1234"
                        required 
                      />
                    </div>
                    <div className="gateway-input-row">
                      <div className="gateway-input-group" style={{ flex: 1 }}>
                        <label htmlFor="gt-card-exp" className="gateway-input-label">Expiry Date</label>
                        <input 
                          id="gt-card-exp"
                          type="text" 
                          className="gateway-control" 
                          value={cardDetails.expiry}
                          onChange={(e) => setCardDetails({...cardDetails, expiry: e.target.value})}
                          placeholder="MM/YY"
                          required 
                        />
                      </div>
                      <div className="gateway-input-group" style={{ flex: 1 }}>
                        <label htmlFor="gt-card-cvv" className="gateway-input-label">CVV / CVC</label>
                        <input 
                          id="gt-card-cvv"
                          type="password" 
                          className="gateway-control" 
                          maxLength="3"
                          value={cardDetails.cvv}
                          onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value})}
                          placeholder="•••"
                          required 
                        />
                      </div>
                    </div>
                    <div className="gateway-input-group">
                      <label htmlFor="gt-card-name" className="gateway-input-label">Cardholder Name</label>
                      <input 
                        id="gt-card-name"
                        type="text" 
                        className="gateway-control" 
                        value={cardDetails.name}
                        onChange={(e) => setCardDetails({...cardDetails, name: e.target.value})}
                        placeholder="Owner Admin"
                        required 
                      />
                    </div>
                  </div>
                )}

                {/* 2. UPI METHOD */}
                {selectedMethod === 'upi' && (
                  <div className="gateway-form-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <h4 className="gateway-section-title">UPI Payout Payer</h4>
                    
                    {/* Simulated QR Code */}
                    <div className="gateway-qr-box">
                      <div className="gateway-qr-mock">
                        {/* CSS-generated QR mock block */}
                        <div className="gateway-qr-square top-left"></div>
                        <div className="gateway-qr-square top-right"></div>
                        <div className="gateway-qr-square bottom-left"></div>
                        <div className="gateway-qr-dot dot-1"></div>
                        <div className="gateway-qr-dot dot-2"></div>
                        <div className="gateway-qr-dot dot-3"></div>
                      </div>
                      <p className="gateway-qr-subtext">Scan with BHIM, GPay, Paytm, or PhonePe</p>
                    </div>

                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0' }}>— OR —</span>

                    <div className="gateway-input-group" style={{ width: '100%' }}>
                      <label htmlFor="gt-upi-id" className="gateway-input-label" style={{ textAlign: 'left' }}>Enter Payer Virtual Address (VPA)</label>
                      <input 
                        id="gt-upi-id"
                        type="text" 
                        className="gateway-control" 
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="admin@okhdfc"
                        required 
                      />
                    </div>
                  </div>
                )}

                {/* 3. NETBANKING METHOD */}
                {selectedMethod === 'netbanking' && (
                  <div className="gateway-form-content">
                    <h4 className="gateway-section-title">Select Corporate Bank Account</h4>
                    <div className="gateway-input-group">
                      <label htmlFor="gt-bank-select" className="gateway-input-label">Select Bank</label>
                      <select 
                        id="gt-bank-select"
                        className="gateway-control"
                        value={bank}
                        onChange={(e) => setBank(e.target.value)}
                      >
                        <option value="SBI">State Bank of India (Corporate)</option>
                        <option value="HDFC">HDFC Bank (Corporate)</option>
                        <option value="ICICI">ICICI Bank Ltd.</option>
                        <option value="AXIS">Axis Bank Corporate</option>
                        <option value="PNB">Punjab National Bank</option>
                      </select>
                    </div>
                    <div className="gateway-input-group" style={{ marginTop: '12px' }}>
                      <label htmlFor="gt-corp-id" className="gateway-input-label">Corporate User ID</label>
                      <input id="gt-corp-id" type="text" className="gateway-control" value="STFF_CORP_ADM" disabled />
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Secure Netbanking redirected page will simulate authorization checkout.
                    </p>
                  </div>
                )}

                {/* Pay Action CTA Button */}
                <button type="submit" className="gateway-pay-btn">
                  Pay Securely {curr}{amount.toLocaleString('en-IN')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* PROCESSING SCREEN */}
        {paymentState === 'processing' && (
          <div className="gateway-screen-center">
            <RefreshCw className="gateway-spinner animate-spin" size={48} />
            <h4 style={{ fontSize: '16px', fontWeight: 700, marginTop: '20px', color: 'var(--text-main)' }}>Processing Payment</h4>
            <p className="gateway-screen-sub">{processingMessage}</p>
            <div className="gateway-security-badge">
              <ShieldCheck size={14} />
              <span>PCI-DSS Compliant • 256-bit SSL Payout Gateway</span>
            </div>
          </div>
        )}

        {/* SUCCESS SCREEN */}
        {paymentState === 'success' && (
          <div className="gateway-screen-center animate-pulse">
            <CheckCircle style={{ color: 'var(--success)' }} size={60} />
            <h4 style={{ fontSize: '18px', fontWeight: 800, marginTop: '16px', color: 'var(--success)' }}>Payout Successful</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Transaction ID: <code>{txnId}</code></p>
            <p className="gateway-screen-sub" style={{ marginTop: '12px' }}>Payroll updated and locked in ledger.</p>
          </div>
        )}

        {/* Gateway Footer */}
        <div className="gateway-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 800, letterSpacing: '0.5px' }}>Razorpay</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Simulated Sandbox</span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Secure payment checkout</span>
        </div>

      </div>
    </div>
  );
}
