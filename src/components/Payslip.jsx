import React from 'react';
import { Printer, X } from 'lucide-react';

export default function Payslip({ data, onClose, settings }) {
  const handlePrint = () => {
    window.print();
  };

  const curr = settings?.currency || '₹';

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <h3 className="card-title">Salary payslip</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="payslip-template">
            <div className="payslip-header">
              <h1 className="payslip-title">{settings?.companyName || 'Staffly'} Corp Ltd.</h1>
              <p className="payslip-subtitle">Salary Slip - {data.month}</p>
            </div>
            
            <div className="payslip-info-grid">
              <div className="payslip-info-group">
                <span className="payslip-info-label">Employee Name</span>
                <span className="payslip-info-value">{data.name}</span>
              </div>
              <div className="payslip-info-group">
                <span className="payslip-info-label">Employee ID</span>
                <span className="payslip-info-value">{data.employee_id}</span>
              </div>
              <div className="payslip-info-group">
                <span className="payslip-info-label">Designation</span>
                <span className="payslip-info-value">{data.designation}</span>
              </div>
              <div className="payslip-info-group">
                <span className="payslip-info-label">Department</span>
                <span className="payslip-info-value">{data.department}</span>
              </div>
            </div>
            
            <table className="payslip-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Earnings ({curr})</th>
                  <th style={{ textAlign: 'right' }}>Deductions ({curr})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Basic Salary</td>
                  <td style={{ textAlign: 'right' }}>{data.basic_salary.toLocaleString('en-IN')}</td>
                  <td></td>
                </tr>
                 {data.overtime_pay > 0 && (
                  <tr>
                    <td>Overtime Pay</td>
                    <td style={{ textAlign: 'right' }}>{data.overtime_pay.toLocaleString('en-IN')}</td>
                    <td></td>
                  </tr>
                )}
                {data.extra_work_pay > 0 && (
                  <tr>
                    <td>Extra Work Pay</td>
                    <td style={{ textAlign: 'right' }}>{data.extra_work_pay.toLocaleString('en-IN')}</td>
                    <td></td>
                  </tr>
                )}
                {data.bonus_pay > 0 && (
                  <tr>
                    <td>Performance / Festival Bonus</td>
                    <td style={{ textAlign: 'right' }}>{data.bonus_pay.toLocaleString('en-IN')}</td>
                    <td></td>
                  </tr>
                )}
                {data.deduction_advance > 0 && (
                  <tr>
                    <td>Salary Advance Repayment</td>
                    <td></td>
                    <td style={{ textAlign: 'right' }}>-{data.deduction_advance.toLocaleString('en-IN')}</td>
                  </tr>
                )}
                {data.deduction_leave > 0 && (
                  <tr>
                    <td>Leave & Absence Deductions ({data.unpaid_days || 0}d {data.unpaid_half_days || 0}h)</td>
                    <td></td>
                    <td style={{ textAlign: 'right' }}>-{data.deduction_leave.toLocaleString('en-IN')}</td>
                  </tr>
                )}
                <tr className="total-row">
                  <td>Total Breakdown</td>
                  <td style={{ textAlign: 'right' }}>
                    {(data.basic_salary + (data.overtime_pay || 0) + (data.extra_work_pay || 0) + (data.bonus_pay || 0)).toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right', color: '#ef4444' }}>
                    {((data.deduction_advance || 0) + (data.deduction_leave || 0)) > 0 
                      ? '-' + ((data.deduction_advance || 0) + (data.deduction_leave || 0)).toLocaleString('en-IN') 
                      : '0'}
                  </td>
                </tr>
              </tbody>
            </table>
            
            <div className="payslip-net-box">
              <span className="payslip-net-label">Net Payable Salary (Round-off)</span>
              <h2 className="payslip-net-value">{curr}{data.net_salary.toLocaleString('en-IN')}</h2>
            </div>
            
            <p className="payslip-footer-note">
              This is a system generated salary statement. No physical signature is required.
            </p>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}
