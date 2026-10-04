import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, FileText, CreditCard, Clock, Send, ShieldAlert, CheckCircle, User
} from 'lucide-react';
import * as db from '../db';

export default function EmployeeDashboard({ activeTab, setActiveTab, employeeId, onSelectPayslip, settings, showToast }) {
  const [employee, setEmployee] = useState(() => {
    return db.getEmployees().find(e => e.id === employeeId) || null;
  });
  
  // Support Tickets States
  const [tickets, setTickets] = useState(() => db.getTickets().filter(t => t.employee_id === employeeId));
  const [newTicket, setNewTicket] = useState({ category: 'IT Support', subject: '', description: '', priority: 'Medium' });
  const [profileSubTab, setProfileSubTab] = useState('contact'); // 'contact', 'biometrics', 'support'
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Data lists initialized with cached state immediately
  const [attendance, setAttendance] = useState(() => db.getAttendance().filter(a => a.employee_id === employeeId));
  const [leaves, setLeaves] = useState(() => db.getLeaves().filter(l => l.employee_id === employeeId));
  const [advances, setAdvances] = useState(() => db.getAdvances().filter(a => a.employee_id === employeeId));
  const [overtime, setOvertime] = useState(() => db.getOvertime().filter(o => o.employee_id === employeeId));
  const [bonuses, setBonuses] = useState(() => db.getBonuses().filter(b => b.employee_id === employeeId));
  const [payrolls, setPayrolls] = useState(() => db.getPayrolls().filter(p => p.employee_id === employeeId));
  
  // Leave Form states
  const [leaveForm, setLeaveForm] = useState({
    type: 'casual',
    start_date: '',
    end_date: '',
    duration_type: 'full',
    reason: ''
  });

  // Advance Form states
  const [advanceForm, setAdvanceForm] = useState({
    amount: 5000,
    monthly_repayment: 1000,
    reason: ''
  });

  // Overtime Form states
  const [otForm, setOtForm] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: 4,
    description: ''
  });

  // Profile Form states
  const [profileForm, setProfileForm] = useState({
    phone: '',
    address: '123 Tech Park, Sector 4, Bangalore',
    emergency_contact: 'Mother: 9876501234',
    profile_photo: '',
    govt_id_photo: ''
  });

  const syncLocalState = useCallback((targetEmp) => {
    if (targetEmp) {
      setEmployee(targetEmp);
      setProfileForm(prev => ({
        phone: targetEmp.phone || prev.phone || '',
        address: targetEmp.address || prev.address || '123 Tech Park, Sector 4, Bangalore',
        emergency_contact: targetEmp.emergency_contact || prev.emergency_contact || 'Mother: 9876501234',
        profile_photo: targetEmp.profile_photo || prev.profile_photo || '',
        govt_id_photo: targetEmp.govt_id_photo || prev.govt_id_photo || ''
      }));
    }
    setAttendance(db.getAttendance().filter(a => a.employee_id === employeeId));
    setLeaves(db.getLeaves().filter(l => l.employee_id === employeeId));
    setAdvances(db.getAdvances().filter(a => a.employee_id === employeeId));
    setOvertime(db.getOvertime().filter(o => o.employee_id === employeeId));
    setBonuses(db.getBonuses().filter(b => b.employee_id === employeeId));
    setPayrolls(db.getPayrolls().filter(p => p.employee_id === employeeId));
    setTickets(db.getTickets().filter(t => t.employee_id === employeeId));
  }, [employeeId]);

  const loadData = useCallback(async () => {
    // 1. Instant check in memory
    let cached = db.getEmployees().find(e => e.id === employeeId);
    if (!cached) {
      cached = await db.fetchEmployeeById(employeeId);
    }
    syncLocalState(cached);

    // 2. Non-blocking fresh data sync
    try {
      await db.refreshAllData();
      const fresh = db.getEmployees().find(e => e.id === employeeId);
      syncLocalState(fresh || cached);
    } catch (err) {
      console.warn('Background sync warning:', err.message);
    }
  }, [employeeId, syncLocalState]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fallback to active member representation so rendering is instant and never hangs
  const activeEmployee = employee || {
    id: employeeId || 1,
    name: 'Team Member',
    designation: 'Staff Associate',
    department: 'Operations',
    base_salary: 30000,
    email: 'user@staffly.com',
    joining_date: '2025-01-15'
  };

  // CALCULATE TOP METRICS
  const currentMonthStr = '2026-08';
  
  // Calculate this month's net salary sheet details
  const currentSheet = db.calculateSalarySheet(employeeId, currentMonthStr);
  const displaySalary = currentSheet ? currentSheet.net_salary : activeEmployee.base_salary;

  // Attendance ratio for August
  const presentDaysCount = attendance.filter(a => a.status === 'P').length + (attendance.filter(a => a.status === 'H').length * 0.5);
  const workingDays = 26; // company standard working days in a month

  // Leave balances: Casual limit 5, Sick limit 3, Paid limit 8
  const approvedLeaves = leaves.filter(l => l.status === 'approved');
  const usedCasual = approvedLeaves.filter(l => l.type === 'casual').length;
  const usedSick = approvedLeaves.filter(l => l.type === 'sick').length;
  const usedPaid = approvedLeaves.filter(l => l.type === 'paid').length;
  
  const balanceCasual = Math.max(0, 5 - usedCasual);
  const balanceSick = Math.max(0, 3 - usedSick);
  const balancePaid = Math.max(0, 8 - usedPaid);
  const totalLeaveBalance = balanceCasual + balanceSick + balancePaid;

  // Active advance repayments
  const activeAdvance = advances.find(a => a.status === 'approved');

  // SUBMIT APPLICATIONS
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) {
      alert('Please fill out all leave details.');
      return;
    }
    try {
      await db.saveLeave({
        employee_id: employeeId,
        ...leaveForm
      });
      alert('Leave application submitted to owner for approval.');
      setLeaveForm({ type: 'casual', start_date: '', end_date: '', duration_type: 'full', reason: '' });
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to submit leave.');
    }
  };

  const handleRequestAdvance = async (e) => {
    e.preventDefault();
    if (!advanceForm.reason || advanceForm.amount <= 0) {
      alert('Please state a valid reason and amount.');
      return;
    }
    try {
      await db.saveAdvance({
        employee_id: employeeId,
        amount: Number(advanceForm.amount),
        repayment_months: Number(advanceForm.monthly_repayment || 1),
        reason: advanceForm.reason
      });
      alert('Advance request submitted for approval.');
      setAdvanceForm({ amount: 5000, monthly_repayment: 1000, reason: '' });
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to request advance.');
    }
  };

  const handleRequestOvertime = async (e) => {
    e.preventDefault();
    if (otForm.hours <= 0 || !otForm.description) {
      alert('Please enter hours and description.');
      return;
    }
    const calculatedRate = settings?.overtimeRate || Math.round(activeEmployee.base_salary / 26 / 8); 
    try {
      await db.saveOvertime({
        employee_id: employeeId,
        date: otForm.date,
        hours: Number(otForm.hours),
        rate: calculatedRate,
        reason: otForm.description,
        status: 'pending'
      });
      alert('Extra work request submitted for approval.');
      setOtForm({ date: new Date().toISOString().split('T')[0], hours: 4, description: '' });
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to request overtime.');
    }
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert("File size exceeds 1MB. Please compress the image to save space.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileForm(prev => ({
        ...prev,
        [field]: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    db.saveEmployee({
      ...activeEmployee,
      phone: profileForm.phone,
      address: profileForm.address,
      emergency_contact: profileForm.emergency_contact,
      profile_photo: profileForm.profile_photo,
      govt_id_photo: profileForm.govt_id_photo
    });
    alert('Profile information and biometric credentials updated successfully.');
    if (showToast) {
      showToast('Profile Updated', 'Your contact details and biometric images have been saved.', 'success');
    }
    loadData();
  };

  const handleSubmitTicket = (e) => {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.description) {
      alert('Please fill out the ticket subject and description.');
      return;
    }
    db.saveTicket({
      employee_id: employeeId,
      employee_name: activeEmployee.name,
      ...newTicket
    });
    alert('Your support ticket has been submitted to the administration team.');
    setNewTicket({ category: 'IT Support', subject: '', description: '', priority: 'Medium' });
    
    // Reload local list
    const allTickets = db.getTickets();
    setTickets(allTickets.filter(t => t.employee_id === employeeId));

    if (showToast) {
      showToast('Ticket Logged', 'A support technician has been assigned to your ticket.', 'info');
    }
  };

  // Helper to compile activity feed
  const recentActivities = [];
  payrolls.forEach(p => {
    recentActivities.push({
      id: p.id,
      text: `Salary credited for ${p.month}`,
      date: p.processed_date,
      icon: <CreditCard size={14} style={{ color: 'var(--success)' }} />,
      bg: 'rgba(16, 185, 129, 0.1)'
    });
  });
  leaves.filter(l => l.status === 'approved').forEach(l => {
    recentActivities.push({
      id: l.id,
      text: `Leave approved from ${l.start_date} to ${l.end_date}`,
      date: l.start_date,
      icon: <CheckCircle size={14} style={{ color: 'var(--primary)' }} />,
      bg: 'var(--primary-glow)'
    });
  });
  overtime.filter(o => o.status === 'approved').forEach(o => {
    recentActivities.push({
      id: o.id,
      text: `Overtime added: ${o.hours} hours`,
      date: o.date,
      icon: <Clock size={14} style={{ color: 'var(--accent-cyan)' }} />,
      bg: 'rgba(6, 182, 212, 0.1)'
    });
  });
  recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));

  const curr = settings?.currency || '₹';

  return (
    <div>
      
      {/* 1. OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Greetings section */}
          <div style={{ marginBottom: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f2d59' }}>Good morning, {activeEmployee.name} 👋</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{activeEmployee.designation} • {activeEmployee.department} Department</p>
          </div>

          {/* Metrics Cards */}
          <div className="metrics-grid">
            <div className="metric-card-styled">
              <div className="metric-card-left">
                <div className="metric-circle-icon blue-theme">
                  <CreditCard size={22} />
                </div>
                <div className="metric-details">
                  <span className="metric-bold-val">{curr}{(Number(displaySalary) || 0).toLocaleString('en-IN')}</span>
                  <span className="metric-label-desc">Salary (This Month)</span>
                </div>
              </div>
            </div>

            <div className="metric-card-styled">
              <div className="metric-card-left">
                <div className="metric-circle-icon orange-theme" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                  <Calendar size={22} />
                </div>
                <div className="metric-details">
                  <span className="metric-bold-val">{presentDaysCount} / {workingDays}</span>
                  <span className="metric-label-desc">Attendance Days</span>
                </div>
              </div>
            </div>

            <div className="metric-card-styled">
              <div className="metric-card-left">
                <div className="metric-circle-icon grey-theme" style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}>
                  <ShieldAlert size={22} />
                </div>
                <div className="metric-details">
                  <span className="metric-bold-val">{totalLeaveBalance} Days</span>
                  <span className="metric-label-desc">Leave Balance</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-layout-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Attendance detailed view */}
              <div className="glass-card">
                <h3 className="card-title-v2">My Attendance Log (Aug 2026)</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                  {Array.from({ length: 27 }, (_, i) => i + 1).map(dayNum => {
                    const dateStr = `2026-08-${String(dayNum).padStart(2, '0')}`;
                    const record = db.getAttendance().find(a => a.employee_id === employeeId && a.date === dateStr);
                    const status = record ? record.status : 'A';
                    
                    return (
                      <div 
                        key={dayNum} 
                        className={`matrix-cell ${status}`}
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'default',
                          background: status === 'P' ? '#10b981' : status === 'A' ? '#e2e8f0' : status === 'L' ? '#f59e0b' : '#0ea5e9',
                          color: status === 'A' ? '#64748b' : '#ffffff'
                        }}
                        title={`August ${dayNum}: ${status}`}
                      >
                        {dayNum}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Recent Activity Timeline */}
              <div className="glass-card">
                <h3 className="card-title-v2">Recent Activity</h3>
                <div className="activity-list" style={{ marginTop: '16px' }}>
                  {recentActivities.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No recent logs.</p>
                  ) : (
                    recentActivities.slice(0, 3).map(act => (
                      <div className="activity-item" key={act.id} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                        <div className="activity-icon-container" style={{ background: act.bg, width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {act.icon}
                        </div>
                        <div className="activity-details" style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="activity-text" style={{ fontSize: '13px', fontWeight: 600 }}>{act.text}</span>
                          <span className="activity-time" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{act.date}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Active Advance Repayment Progress */}
              {activeAdvance && (
                <div className="glass-card">
                  <h3 className="card-title-v2"><CreditCard size={18} /> Advance Loan Balance</h3>
                  <div style={{ fontSize: '13.5px', marginBottom: '8px', marginTop: '12px' }}>
                    Total Borrowed: <strong>{curr}{(Number(activeAdvance.amount) || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Remaining: {curr}{(Number(activeAdvance.remaining_amount ?? activeAdvance.amount) || 0).toLocaleString('en-IN')}</span>
                    <span>Repayment: {curr}{(Number(activeAdvance.monthly_repayment) || Math.round((Number(activeAdvance.amount) || 0) / Math.max(Number(activeAdvance.repayment_months) || 1, 1))).toLocaleString('en-IN')}/mo</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${Math.min(100, Math.max(0, (((Number(activeAdvance.amount) || 1) - (Number(activeAdvance.remaining_amount ?? activeAdvance.amount) || 0)) / (Number(activeAdvance.amount) || 1)) * 100))}%`, 
                        height: '100%', 
                        background: '#0f2d59' 
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. LEAVE APPLICATIONS */}
      {activeTab === 'leaves' && (
        <div className="dashboard-layout-grid">
          <div className="glass-card">
            <h3 className="card-title-v2"><Calendar size={18} /> Apply for Leave</h3>
            <form onSubmit={handleApplyLeave} style={{ marginTop: '16px' }}>
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="leave-type">Leave Type</label>
                  <select id="leave-type" className="form-control" value={leaveForm.type} onChange={(e) => setLeaveForm({...leaveForm, type: e.target.value})}>
                    <option value="casual">Casual Leave (Bal: {balanceCasual})</option>
                    <option value="sick">Sick Leave (Bal: {balanceSick})</option>
                    <option value="paid">Paid Leave (Bal: {balancePaid})</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="leave-duration">Duration</label>
                  <select id="leave-duration" className="form-control" value={leaveForm.duration_type} onChange={(e) => setLeaveForm({...leaveForm, duration_type: e.target.value})}>
                    <option value="full">Full Day</option>
                    <option value="half_morning">Half Day (Morning)</option>
                    <option value="half_afternoon">Half Day (Afternoon)</option>
                  </select>
                </div>
              </div>
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="leave-start">Start Date</label>
                  <input id="leave-start" type="date" className="form-control" value={leaveForm.start_date} onChange={(e) => setLeaveForm({...leaveForm, start_date: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="leave-end">End Date</label>
                  <input id="leave-end" type="date" className="form-control" value={leaveForm.end_date} onChange={(e) => setLeaveForm({...leaveForm, end_date: e.target.value})} required />
                </div>
              </div>
              <div className="form-group" style={{ margin: '16px 0' }}>
                <label className="form-label" htmlFor="leave-reason">Reason for Leave</label>
                <input id="leave-reason" type="text" className="form-control" placeholder="Brief reason" value={leaveForm.reason} onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#0f2d59' }}>Submit Leave Request</button>
            </form>
          </div>

          <div className="glass-card">
            <h3 className="card-title-v2">Leave Balances</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px', marginTop: '16px' }}>
              <div style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '20px', color: '#0f2d59', fontWeight: 800 }}>{balanceCasual}</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Casual (Max 5)</span>
              </div>
              <div style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '20px', color: 'var(--success)', fontWeight: 800 }}>{balanceSick}</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sick (Max 3)</span>
              </div>
              <div style={{ background: 'var(--bg-base)', padding: '16px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '20px', color: 'var(--warning)', fontWeight: 800 }}>{balancePaid}</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Paid (Max 8)</span>
              </div>
            </div>
            
            <h3 className="card-title-v2" style={{ marginBottom: '12px', fontSize: '14px' }}>My Leave History</h3>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {leaves.slice().reverse().map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '8px 0' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{l.start_date} to {l.end_date}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Type: {l.type} • {l.duration_type}</div>
                  </div>
                  <span className={`badge ${l.status}`} style={{ fontSize: '10px' }}>{l.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. ADVANCE & OVERTIME REQUESTS */}
      {activeTab === 'requests' && (
        <div className="dashboard-layout-grid">
          {/* Salary Advance Request */}
          <div className="glass-card">
            <h3 className="card-title-v2"><CreditCard size={18} /> Request Salary Advance</h3>
            <form onSubmit={handleRequestAdvance} style={{ marginTop: '16px' }}>
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="adv-amt">Advance Amount ({curr})</label>
                  <input id="adv-amt" type="number" className="form-control" min="1000" max="30000" value={advanceForm.amount} onChange={(e) => setAdvanceForm({...advanceForm, amount: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="adv-repay">Monthly Repayment ({curr})</label>
                  <input id="adv-repay" type="number" className="form-control" min="500" max={advanceForm.amount} value={advanceForm.monthly_repayment} onChange={(e) => setAdvanceForm({...advanceForm, monthly_repayment: e.target.value})} required />
                </div>
              </div>
              <div className="form-group" style={{ margin: '16px 0' }}>
                <label className="form-label" htmlFor="adv-reason">Emergency Reason</label>
                <input id="adv-reason" type="text" className="form-control" placeholder="Medical treatment, educational deposits" value={advanceForm.reason} onChange={(e) => setAdvanceForm({...advanceForm, reason: e.target.value})} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#0f2d59' }}>Submit Advance Request</button>
            </form>

            <h3 className="card-title-v2" style={{ marginTop: '24px', marginBottom: '12px', fontSize: '14px' }}>My Advance History</h3>
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {advances.slice().reverse().map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '8px 0' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{curr}{(Number(a.amount) || 0).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Repayment: {curr}{(Number(a.monthly_repayment) || Math.round((Number(a.amount) || 0) / Math.max(Number(a.repayment_months) || 1, 1))).toLocaleString('en-IN')}/mo</div>
                  </div>
                  <span className={`badge ${a.status}`} style={{ fontSize: '10px' }}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Overtime Request */}
          <div className="glass-card">
            <h3 className="card-title-v2"><Clock size={18} /> Log Extra Work / Overtime</h3>
            <form onSubmit={handleRequestOvertime} style={{ marginTop: '16px' }}>
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="ot-req-date">Work Date</label>
                  <input id="ot-req-date" type="date" className="form-control" value={otForm.date} onChange={(e) => setOtForm({...otForm, date: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ot-req-hours">Hours Logged</label>
                  <input id="ot-req-hours" type="number" className="form-control" min="1" max="18" value={otForm.hours} onChange={(e) => setOtForm({...otForm, hours: e.target.value})} required />
                </div>
              </div>
              <div className="form-group" style={{ margin: '16px 0' }}>
                <label className="form-label" htmlFor="ot-req-desc">Task Description</label>
                <input id="ot-req-desc" type="text" className="form-control" placeholder="Server support, additional testing" value={otForm.description} onChange={(e) => setOtForm({...otForm, description: e.target.value})} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#0f2d59' }}>Submit Overtime Log</button>
            </form>

            <h3 className="card-title-v2" style={{ marginTop: '24px', marginBottom: '12px', fontSize: '14px' }}>My Overtime Logs</h3>
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {overtime.slice().reverse().map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '8px 0' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{o.hours} Hours on {o.date}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>"{o.description}"</div>
                  </div>
                  <span className={`badge ${o.status}`} style={{ fontSize: '10px' }}>{o.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. PAYSLIP HISTORY */}
      {activeTab === 'payslips' && (
        <div className="glass-card">
          <h3 className="card-title-v2"><FileText size={18} /> My Payslip Archive</h3>
          <div className="table-container" style={{ marginTop: '16px' }}>
            {payrolls.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No historical payslips found.</p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Salary Month</th>
                    <th style={{ textAlign: 'right' }}>Basic Salary</th>
                    <th style={{ textAlign: 'right' }}>Overtime / Additions</th>
                    <th style={{ textAlign: 'right' }}>Deductions</th>
                    <th style={{ textAlign: 'right' }}>Net Paid</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map(pay => {
                    const basicSalary = Number(pay.basic_salary ?? pay.base_salary) || 0;
                    const additions = (Number(pay.overtime_pay) || 0) + (Number(pay.bonus_pay ?? pay.bonuses) || 0);
                    const deductions = (Number(pay.deduction_advance ?? pay.advance_deduction) || 0) + (Number(pay.deduction_leave) || 0);
                    const netSalary = Number(pay.net_salary) || Math.max(0, basicSalary + additions - deductions);
                    
                    return (
                      <tr key={pay.id}>
                        <td><strong>{pay.month}</strong></td>
                        <td style={{ textAlign: 'right' }}>{curr}{basicSalary.toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>+{curr}{additions.toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{curr}{deductions.toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{curr}{netSalary.toLocaleString('en-IN')}</td>
                        <td><span className="badge present" style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>Paid</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }} onClick={() => onSelectPayslip({
                            ...pay,
                            name: activeEmployee.name,
                            designation: activeEmployee.designation,
                            department: activeEmployee.department,
                            employee_id: activeEmployee.id
                          })}>
                            Download Payslip
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 5. MY PROFILE */}
      {activeTab === 'profile' && (
        <div className="glass-card">
          <div className="profile-header-card" style={{ background: 'linear-gradient(135deg, #0f2d59 0%, #1e3b68 100%)', borderRadius: '8px', padding: '32px' }}>
            <div className="profile-avatar-large">
              {activeEmployee.name ? activeEmployee.name.charAt(0) : 'U'}
            </div>
            <div className="profile-info-large">
              <h2>{activeEmployee.name}</h2>
              <p>ID: {activeEmployee.id} • {activeEmployee.designation}</p>
              <p style={{ marginTop: '8px', opacity: 0.85 }}>Date Joined: {activeEmployee.joining_date}</p>
            </div>
          </div>

          {/* Sub-tab menu */}
          <div className="attendance-tabs" style={{ marginTop: '24px', marginBottom: '24px' }}>
            <button 
              className={`attendance-tab-btn ${profileSubTab === 'contact' ? 'active' : ''}`}
              onClick={() => setProfileSubTab('contact')}
            >
              Contact Info
            </button>
            <button 
              className={`attendance-tab-btn ${profileSubTab === 'biometrics' ? 'active' : ''}`}
              onClick={() => setProfileSubTab('biometrics')}
            >
              Face ID & Photo
            </button>
            <button 
              className={`attendance-tab-btn ${profileSubTab === 'support' ? 'active' : ''}`}
              onClick={() => setProfileSubTab('support')}
            >
              FAQ & Support Kiosk
            </button>
          </div>

          {profileSubTab === 'contact' && (
            <form onSubmit={handleSaveProfile}>
              <h3 className="card-title-v2" style={{ marginBottom: '16px', fontSize: '16px' }}><User size={18} /> Update Contact Information</h3>
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="prof-email">Corporate Email Address (Read-only)</label>
                  <input id="prof-email" type="email" className="form-control" value={activeEmployee.email || ''} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="prof-phone">Mobile Phone Number</label>
                  <input id="prof-phone" type="text" className="form-control" placeholder="9876543210" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} required />
                </div>
              </div>
              <div className="form-group" style={{ margin: '16px 0' }}>
                <label className="form-label" htmlFor="prof-address">Residential Address</label>
                <input id="prof-address" type="text" className="form-control" placeholder="House 12, Sector 5, Bangalore" value={profileForm.address} onChange={(e) => setProfileForm({...profileForm, address: e.target.value})} required />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="prof-emergency">Emergency Contact Details</label>
                <input id="prof-emergency" type="text" className="form-control" placeholder="Spouse: 9876509876" value={profileForm.emergency_contact} onChange={(e) => setProfileForm({...profileForm, emergency_contact: e.target.value})} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ background: '#0f2d59', height: '40px', padding: '0 24px' }}>Save Profile Details</button>
            </form>
          )}

          {profileSubTab === 'biometrics' && (
            <form onSubmit={handleSaveProfile}>
              <h3 className="card-title-v2" style={{ marginBottom: '12px', fontSize: '16px' }}>
                Face Verification & Credentials
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Your face check-in matches your camera image against the reference portrait uploaded below. Please upload a clear front-facing portrait photo and a valid government ID (Passport / Driver License).
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                
                {/* Profile portrait upload */}
                <div style={{ border: '1px dashed var(--border-color)', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Reference Portrait Photo</span>
                  <div style={{ width: '120px', height: '120px', borderRadius: '60px', overflow: 'hidden', background: '#f1f5f9', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {profileForm.profile_photo ? (
                      <img src={profileForm.profile_photo} alt="Biometric Ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={48} color="#94a3b8" />
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleFileChange(e, 'profile_photo')}
                    style={{ display: 'none' }}
                    id="profile-photo-upload"
                  />
                  <label 
                    htmlFor="profile-photo-upload" 
                    className="btn btn-secondary" 
                    style={{ cursor: 'pointer', height: '36px', display: 'inline-flex', alignItems: 'center', padding: '0 16px', fontSize: '12.5px' }}
                  >
                    Upload Portrait Image
                  </label>
                </div>

                {/* Govt ID upload */}
                <div style={{ border: '1px dashed var(--border-color)', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Government Valid ID</span>
                  <div style={{ width: '100%', maxWidth: '200px', height: '120px', borderRadius: '6px', overflow: 'hidden', background: '#f1f5f9', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {profileForm.govt_id_photo ? (
                      <img src={profileForm.govt_id_photo} alt="Govt ID Card" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <FileText size={40} color="#94a3b8" />
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleFileChange(e, 'govt_id_photo')}
                    style={{ display: 'none' }}
                    id="govt-id-upload"
                  />
                  <label 
                    htmlFor="govt-id-upload" 
                    className="btn btn-secondary" 
                    style={{ cursor: 'pointer', height: '36px', display: 'inline-flex', alignItems: 'center', padding: '0 16px', fontSize: '12.5px' }}
                  >
                    Upload ID Card
                  </label>
                </div>

              </div>

              <button type="submit" className="btn btn-primary" style={{ background: '#0f2d59', height: '44px', padding: '0 32px' }}>
                Save Profile Credentials
              </button>
            </form>
          )}

          {profileSubTab === 'support' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              {/* FAQ Section */}
              <div>
                <h3 className="card-title-v2" style={{ fontSize: '15px', marginBottom: '12px' }}>Frequently Asked Questions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { q: "How does the Face Check-In verify my identity?", a: "The Face Check-In matches your facial geometry mapping vector against the 'Biometric Reference Photo' saved in your profile tab. Keep this photo clear and well-lit." },
                    { q: "When are payslips generated?", a: "Payslips are drafted and processed by the Finance Department on the 28th of every month. You will receive an in-app notification when credited." },
                    { q: "How do I request a salary loan/advance?", a: "Go to the 'Overtime & Loans' tab. Select the loan amount and repayment speed, then submit. The manager will review your request." }
                  ].map((faq, idx) => {
                    const isOpen = expandedFaq === idx;
                    return (
                      <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div 
                          onClick={() => setExpandedFaq(isOpen ? null : idx)}
                          style={{ padding: '12px 16px', background: 'var(--bg-base)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <span>{faq.q}</span>
                          <span>{isOpen ? '−' : '+'}</span>
                        </div>
                        {isOpen && (
                          <div style={{ padding: '12px 16px', fontSize: '12.5px', color: 'var(--text-secondary)', background: 'var(--bg-surface)', lineHeight: 1.5 }}>
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Ticket Form */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                <h3 className="card-title-v2" style={{ fontSize: '15px', marginBottom: '16px' }}>Submit a Support Ticket</h3>
                <form onSubmit={handleSubmitTicket}>
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="tck-cat">Category</label>
                      <select 
                        id="tck-cat" 
                        className="form-control"
                        value={newTicket.category}
                        onChange={(e) => setNewTicket({...newTicket, category: e.target.value})}
                      >
                        <option value="IT Support">IT Support & Device Permissions</option>
                        <option value="Payroll">Payroll & Tax Inquiries</option>
                        <option value="Leaves">Leaves & Clock-In Adjustments</option>
                        <option value="Facilities">Facilities & Office Access</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="tck-prior">Priority Level</label>
                      <select 
                        id="tck-prior" 
                        className="form-control"
                        value={newTicket.priority}
                        onChange={(e) => setNewTicket({...newTicket, priority: e.target.value})}
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: '12px 0' }}>
                    <label className="form-label" htmlFor="tck-sub">Subject Summary</label>
                    <input 
                      id="tck-sub" 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Cannot log in to terminal, PF calculations mismatch"
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label className="form-label" htmlFor="tck-desc">Detailed Message / Description</label>
                    <textarea 
                      id="tck-desc" 
                      className="form-control" 
                      rows="3"
                      placeholder="Please explain the issue or concern in detail..."
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                      style={{ resize: 'vertical', padding: '8px 12px' }}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ background: '#0f2d59', height: '40px', padding: '0 24px' }}>
                    Submit Ticket Request
                  </button>
                </form>
              </div>

              {/* Submitted Tickets list */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                <h3 className="card-title-v2" style={{ fontSize: '15px', marginBottom: '12px' }}>My Active Support Tickets</h3>
                <div className="table-container">
                  {tickets.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', padding: '16px 0', textAlign: 'center' }}>No active tickets logged.</p>
                  ) : (
                    <table className="custom-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>TICKET ID</th>
                          <th>CATEGORY</th>
                          <th>SUBJECT</th>
                          <th>PRIORITY</th>
                          <th>STATUS</th>
                          <th style={{ textAlign: 'right' }}>DATE CREATED</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickets.map(t => (
                          <tr key={t.id}>
                            <td><code>{t.id}</code></td>
                            <td>{t.category}</td>
                            <td><strong>{t.subject}</strong></td>
                            <td><span className={`badge ${t.priority === 'High' ? 'rejected' : t.priority === 'Medium' ? 'pending' : 'approved'}`} style={{ fontSize: '10px' }}>{t.priority}</span></td>
                            <td><span className={`badge ${t.status === 'resolved' ? 'approved' : 'pending'}`} style={{ fontSize: '10px' }}>{t.status}</span></td>
                            <td style={{ textAlign: 'right' }}>{new Date(t.date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
