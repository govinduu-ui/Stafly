import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, FileText, CreditCard, Clock, Plus, Trash2, Edit, 
  Search, Award, Check, X, AlertCircle, TrendingUp, HelpCircle
} from 'lucide-react';
import * as db from '../db';
import PaymentGatewayModal from './PaymentGatewayModal';

export default function AdminDashboard({ activeTab, setActiveTab, userRole, currentUserEmpId, onSelectPayslip, settings, showToast }) {
  const [employees, setEmployees] = useState([]);
  const [paymentGatewayData, setPaymentGatewayData] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [overtime, setOvertime] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [holidays, setHolidays] = useState([]);
  
  // Support Tickets State
  const [tickets, setTickets] = useState([]);
  
  // States for search and forms
  const [searchQuery, setSearchQuery] = useState('');
  const [payrollSearch, setPayrollSearch] = useState('');
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [newEmp, setNewEmp] = useState({
    id: '', name: '', email: '', phone: '', department: 'IT', designation: '', base_salary: 25000, profile_photo: '', govt_id_photo: ''
  });
  
  // Overtime logging states
  const [otLog, setOtLog] = useState({
    employee_id: '', date: new Date().toISOString().split('T')[0], hours: 4, rate: settings?.overtimeRate || 150, type: 'overtime', description: ''
  });

  // Bonus logging states
  const [bonusLog, setBonusLog] = useState({
    employee_id: '', amount: 2000, type: 'performance', reason: ''
  });

  // Selected payroll month
  const [payrollMonth, setPayrollMonth] = useState('2026-08');

  // Attendance filter state
  const [attendanceFilter, setAttendanceFilter] = useState('logged_in');

  // Selected attendance grid date filter (Mon-Sat or All)
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState('2026-08-27');

  // Load database tables
  const reloadData = async () => {
    await db.refreshAllData();
    setEmployees(db.getEmployees());
    setAttendance(db.getAttendance());
    setLeaves(db.getLeaves());
    setAdvances(db.getAdvances());
    setOvertime(db.getOvertime());
    setBonuses(db.getBonuses());
    setPayrolls(db.getPayrolls());
    setHolidays(db.getHolidays());
    setTickets(db.getTickets());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Update default rate when settings change
  useEffect(() => {
    if (settings?.overtimeRate) {
      setOtLog(prev => ({ ...prev, rate: settings.overtimeRate }));
    }
  }, [settings]);

  // Calculations for Top Metric Cards
  const totalEmployees = employees.length;
  
  // Present Today (Aug 27, 2026)
  const todayStr = '2026-08-27';
  const presentToday = attendance.filter(a => a.date === todayStr && a.status === 'P').length;
  const lateToday = attendance.filter(a => a.date === todayStr && a.status === 'H').length;
  const absentToday = attendance.filter(a => a.date === todayStr && a.status === 'A').length;
  const pendingLeavesCount = leaves.filter(l => l.status === 'pending').length;

  // Outstanding advances
  const outstandingAdvances = advances
    .filter(a => a.status === 'approved')
    .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

  // Total payroll for the selected month
  const activePayrolls = db.generateMonthlyPayrollSheet(payrollMonth);
  const totalPayrollExpense = activePayrolls.reduce((sum, p) => sum + (parseFloat(p.net_salary) || 0), 0);
  
  // Total bonuses this month
  const totalBonusesThisMonth = bonuses
    .filter(b => (b.month || b.date || '').startsWith(payrollMonth))
    .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

  const handleAddEmpFileChange = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert("File size exceeds 1MB. Please compress the image to save space.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewEmp(prev => ({
        ...prev,
        [field]: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!newEmp.id || !newEmp.name || !newEmp.email) {
      alert('Please fill out Employee ID, Name, and Email.');
      return;
    }
    const empData = {
      ...newEmp,
      joining_date: new Date().toISOString().split('T')[0],
      base_salary: Number(newEmp.base_salary),
      status: 'active'
    };
    try {
      await db.saveEmployee(empData);
      setShowAddEmpModal(false);
      setNewEmp({ id: '', name: '', email: '', phone: '', department: 'IT', designation: '', base_salary: 25000, profile_photo: '', govt_id_photo: '' });
      if (showToast) {
        showToast('Employee Added', `${empData.name} has been registered successfully.`, 'success');
      }
      await reloadData();
    } catch (err) {
      alert(err.message || 'Failed to add employee.');
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (window.confirm(`Are you sure you want to remove employee ${id}? This clears all their attendance, advances, and payroll history.`)) {
      try {
        await db.deleteEmployee(id);
        await reloadData();
      } catch (err) {
        alert(err.message || 'Failed to delete employee.');
      }
    }
  };

  // Leaves & Advances Approvals
  const handleLeaveAction = async (leaveId, status) => {
    const leave = leaves.find(l => l.id === leaveId);
    if (!leave) return;
    try {
      await db.saveLeave({ ...leave, status });
      await reloadData();
    } catch (err) {
      alert(err.message || 'Failed to update leave status.');
    }
  };

  const handleAdvanceAction = async (advId, status) => {
    const adv = advances.find(a => a.id === advId);
    if (!adv) return;
    try {
      await db.saveAdvance({ ...adv, status });
      await reloadData();
    } catch (err) {
      alert(err.message || 'Failed to update advance status.');
    }
  };

  const handleOvertimeAction = async (otId, status) => {
    const ot = overtime.find(o => o.id === otId);
    if (!ot) return;
    try {
      await db.saveOvertime({ ...ot, status });
      await reloadData();
    } catch (err) {
      alert(err.message || 'Failed to update overtime status.');
    }
  };

  const handleResolveTicket = async (ticketId) => {
    try {
      await db.updateTicketStatus(ticketId, 'resolved');
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket && showToast) {
        showToast('Ticket Resolved', `Ticket #${ticketId} was resolved.`, 'success');
      }
      await reloadData();
    } catch (err) {
      alert(err.message || 'Failed to resolve ticket.');
    }
  };

  // Overtime & Bonus Creation
  const handleAddOvertime = async (e) => {
    e.preventDefault();
    if (!otLog.employee_id) {
      alert('Please select an employee.');
      return;
    }
    const otData = {
      ...otLog,
      hours: Number(otLog.hours),
      rate: Number(otLog.rate),
      status: 'approved'
    };
    try {
      await db.saveOvertime(otData);
      setOtLog({ employee_id: '', date: new Date().toISOString().split('T')[0], hours: 4, rate: settings?.overtimeRate || 150, type: 'overtime', description: '' });
      alert('Extra work/overtime entry logged successfully.');
      await reloadData();
    } catch (err) {
      alert(err.message || 'Failed to log overtime.');
    }
  };

  const handleAddBonus = async (e) => {
    e.preventDefault();
    if (!bonusLog.employee_id) {
      alert('Please select an employee.');
      return;
    }
    try {
      await db.saveBonus({
        ...bonusLog,
        amount: Number(bonusLog.amount)
      });
      setBonusLog({ employee_id: '', amount: 2000, type: 'performance', reason: '' });
      alert('Bonus awarded successfully.');
      await reloadData();
    } catch (err) {
      alert(err.message || 'Failed to award bonus.');
    }
  };

  // Attendance Cell Toggling
  const handleToggleAttendance = async (employeeId, dateStr, currentStatus) => {
    const statuses = ['P', 'A', 'L', 'H'];
    const nextIdx = (statuses.indexOf(currentStatus) + 1) % statuses.length;
    const nextStatus = statuses[nextIdx];
    try {
      await db.saveAttendance({
        employee_id: employeeId,
        date: dateStr,
        status: nextStatus
      });
      await reloadData();
    } catch (err) {
      alert(err.message || 'Failed to update attendance.');
    }
  };

  // Process Payroll
  const handlePaySalary = (empId) => {
    const sheet = activePayrolls.find(p => p.employee_id === empId);
    if (!sheet) return;
    setPaymentGatewayData({
      amount: sheet.net_salary,
      employeeName: sheet.employee_name || sheet.name,
      employeeId: empId,
      isBatch: false
    });
  };

  const handlePayAllSalaries = () => {
    const unpaidList = activePayrolls.filter(p => p.status !== 'paid');
    if (unpaidList.length === 0) {
      alert('All salaries for this month are already paid.');
      return;
    }
    const totalAmount = unpaidList.reduce((sum, p) => sum + p.net_salary, 0);
    setPaymentGatewayData({
      amount: totalAmount,
      isBatch: true,
      drafts: unpaidList
    });
  };

  const handlePaymentSuccess = async () => {
    try {
      if (paymentGatewayData.isBatch) {
        await db.payAllSalaries(payrollMonth);
      } else if (paymentGatewayData.employeeId) {
        await db.paySalary(paymentGatewayData.employeeId, payrollMonth);
      }
      setPaymentGatewayData(null);
      await reloadData();
      if (showToast) {
        showToast('Payment Successful', 'Salary payout completed successfully!', 'success');
      }
    } catch (err) {
      alert(err.message || 'Payment processing failed.');
    }
  };

  // Filtered lists
  const filteredEmployees = employees.filter(e => 
    (e.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.department || e.department_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPayrolls = activePayrolls.filter(p => 
    (p.employee_name || p.name || '').toLowerCase().includes(payrollSearch.toLowerCase()) ||
    (p.employee_id || '').toLowerCase().includes(payrollSearch.toLowerCase()) ||
    (p.designation || '').toLowerCase().includes(payrollSearch.toLowerCase())
  );

  const pendingLeaves = leaves.filter(l => l.status === 'pending' && (userRole === 'admin' || userRole === 'manager') && l.employee_id !== currentUserEmpId);
  const pendingAdvances = advances.filter(a => a.status === 'pending' && (userRole === 'admin' || userRole === 'finance_manager') && a.employee_id !== currentUserEmpId);
  const pendingOvertimes = overtime.filter(o => o.status === 'pending' && (userRole === 'admin' || userRole === 'manager' || userRole === 'finance_manager') && o.employee_id !== currentUserEmpId);

  // Dynamic Department stats calculator (Image 2 style)
  const getDeptStats = (deptName) => {
    const deptEmps = employees.filter(e => (e.department || e.department_name) === deptName);
    const total = deptEmps.length;
    const present = attendance.filter(a => a.date === todayStr && a.status === 'P' && deptEmps.some(e => e.id === a.employee_id)).length;
    const late = attendance.filter(a => a.date === todayStr && a.status === 'H' && deptEmps.some(e => e.id === a.employee_id)).length;
    const absent = total - present - late;
    return {
      total,
      present: String(present).padStart(2, '0'),
      late: String(late).padStart(2, '0'),
      absent: String(absent).padStart(2, '0')
    };
  };

  // Dynamic attendance chart statistics (Image 2 style)
  const getDailyAttendanceData = () => {
    const days = [
      { label: 'Mon', date: '2026-08-24' },
      { label: 'Tue', date: '2026-08-25' },
      { label: 'Wed', date: '2026-08-26' },
      { label: 'Thu', date: '2026-08-27' },
      { label: 'Fri', date: '2026-08-28' },
      { label: 'Sat', date: '2026-08-29' }
    ];
    return days.map(d => {
      const dayRecords = attendance.filter(a => a.date === d.date);
      const total = dayRecords.length || 1;
      const present = dayRecords.filter(a => a.status === 'P').length;
      const late = dayRecords.filter(a => a.status === 'H').length;
      const absent = dayRecords.filter(a => a.status === 'A').length;

      return {
        label: d.label,
        date: d.date,
        onTimePercent: Math.round((present / total) * 100),
        latePercent: Math.round((late / total) * 100),
        absentPercent: Math.round((absent / total) * 100)
      };
    });
  };

  const curr = settings?.currency || '₹';

  return (
    <div>
      
      {/* 1. OVERVIEW (Image 2 mockup style) */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Stat metrics cards */}
          <div className="metrics-grid">
            <div className="metric-card-styled">
              <div className="metric-card-left">
                <div className="metric-circle-icon blue-theme">
                  <Clock size={22} />
                </div>
                <div className="metric-details">
                  <span className="metric-bold-val">{presentToday}</span>
                  <span className="metric-label-desc">On Time Employee</span>
                  <span className="metric-rate-badge">12% ↑ compared to last week</span>
                </div>
              </div>
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </div>
            </div>

            <div className="metric-card-styled">
              <div className="metric-card-left">
                <div className="metric-circle-icon orange-theme">
                  <AlertCircle size={22} />
                </div>
                <div className="metric-details">
                  <span className="metric-bold-val">{lateToday}</span>
                  <span className="metric-label-desc">Late Employee</span>
                  <span className="metric-rate-badge">12% ↑ compared to last week</span>
                </div>
              </div>
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </div>
            </div>

            <div className="metric-card-styled">
              <div className="metric-card-left">
                <div className="metric-circle-icon grey-theme">
                  <Calendar size={22} />
                </div>
                <div className="metric-details">
                  <span className="metric-bold-val">{absentToday}</span>
                  <span className="metric-label-desc">Absent Today</span>
                  <span className="metric-rate-badge">12% ↑ compared to last week</span>
                </div>
              </div>
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </div>
            </div>
          </div>

          {/* Two columns: chart + sidebar list */}
          <div className="dashboard-layout-grid">
            
            {/* Left side content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Attendance Chart card */}
              <div className="glass-card">
                <div className="card-header-v2">
                  <h3 
                    className="card-title-v2" 
                    onClick={() => {
                      setSelectedCalendarDay('2026-08-27');
                      setSelectedMonth('2026-08');
                      setActiveTab('attendance');
                    }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Click to view Attendance Calendar"
                  >
                    Attendance Status
                  </h3>
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span className="legend-dot on-time"></span>
                      <span>On time</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot late"></span>
                      <span>Late</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot absent"></span>
                      <span>Absent</span>
                    </div>
                  </div>
                </div>

                <div className="chart-graph-bars">
                  {getDailyAttendanceData().map(item => (
                    <div 
                      className="chart-bar-item" 
                      key={item.label}
                      onClick={() => {
                        const mStr = item.date.substring(0, 7); // '2026-08'
                        setSelectedMonth(mStr);
                        setSelectedCalendarDay(item.date);
                        setActiveTab('attendance');
                      }}
                      style={{ cursor: 'pointer' }}
                      title={`Click to view Day ${parseInt(item.date.split('-')[2], 10)} Attendance`}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-end', width: '12px', gap: '2px' }}>
                        <div className="chart-bar-fill-v2" style={{ height: `${item.onTimePercent}%` }} title={`On Time: ${item.onTimePercent}%`}></div>
                        <div className="chart-bar-fill-v2 late" style={{ height: `${item.latePercent}%` }} title={`Late: ${item.latePercent}%`}></div>
                        <div className="chart-bar-fill-v2 absent" style={{ height: `${item.absentPercent}%` }} title={`Absent: ${item.absentPercent}%`}></div>
                      </div>
                      <span className="chart-bar-label-v2">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department summaries block */}
              <div className="glass-card">
                <div className="card-header-v2">
                  <h3 className="card-title-v2">Department</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>12 July, 2024</span>
                </div>

                <div className="dept-cards-grid">
                  {['HR', 'IT', 'Finance', 'Marketing'].map(dName => {
                    const stats = getDeptStats(dName);
                    return (
                      <div className="dept-card" key={dName}>
                        <span className="dept-title">{dName === 'HR' ? 'Human Resources' : dName}</span>
                        <div className="dept-main-stats">
                          <span className="dept-count">{stats.total}</span>
                          <div className="dept-sub-stats">
                            <span>On Time {stats.present}</span>
                            <span>Late {stats.late}</span>
                            <span>Absent {stats.absent}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Right side content */}
            <div>
              <div className="glass-card" style={{ minHeight: '400px' }}>
                <div className="card-header-v2" style={{ marginBottom: '12px' }}>
                  <h3 className="card-title-v2">Attendance</h3>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setActiveTab('attendance')}>See all</span>
                </div>

                <div className="attendance-list-widget">
                  <div className="attendance-tabs">
                    <button 
                      className={`attendance-tab-btn ${attendanceFilter === 'logged_in' ? 'active' : ''}`}
                      onClick={() => setAttendanceFilter('logged_in')}
                    >
                      Logged in <span style={{ background: attendanceFilter === 'logged_in' ? 'var(--primary-glow)' : 'transparent', color: attendanceFilter === 'logged_in' ? 'var(--primary)' : 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', marginLeft: '4px' }}>{presentToday + lateToday}</span>
                    </button>
                    <button 
                      className={`attendance-tab-btn ${attendanceFilter === 'on_time' ? 'active' : ''}`}
                      onClick={() => setAttendanceFilter('on_time')}
                    >
                      On time <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '4px' }}>{presentToday}</span>
                    </button>
                    <button 
                      className={`attendance-tab-btn ${attendanceFilter === 'late' ? 'active' : ''}`}
                      onClick={() => setAttendanceFilter('late')}
                    >
                      Late <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '4px' }}>{lateToday}</span>
                    </button>
                  </div>

                  {(() => {
                    const filtered = employees.filter(emp => {
                      if (emp.status !== 'active') return false;
                      const record = attendance.find(a => a.employee_id === emp.id && a.date === todayStr);
                      const status = record ? record.status : 'A';
                      if (attendanceFilter === 'logged_in') {
                        return status === 'P' || status === 'H';
                      }
                      if (attendanceFilter === 'on_time') {
                        return status === 'P';
                      }
                      if (attendanceFilter === 'late') {
                        return status === 'H';
                      }
                      return false;
                    });

                    if (filtered.length === 0) {
                      return (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
                          No employees matched this status today.
                        </p>
                      );
                    }

                    return filtered.slice(0, 4).map(emp => {
                      const record = attendance.find(a => a.employee_id === emp.id && a.date === todayStr);
                      const status = record ? record.status : 'A';
                      const initials = emp.name.split(' ').map(n => n.charAt(0)).join('');
                      
                      return (
                        <div className="attendance-user-row" key={emp.id}>
                          <div className="attendance-user-info">
                            <div className="attendance-avatar">{initials}</div>
                            <div className="attendance-details-text">
                              <span className="attendance-name">{emp.name}</span>
                              <span className="attendance-subtext">{emp.designation} | Regular</span>
                            </div>
                          </div>
                          <div className="attendance-status-indicator" style={{ color: status === 'P' ? 'var(--success)' : status === 'H' ? 'var(--warning)' : 'var(--danger)' }}>
                            <span className={`status-dot ${status === 'P' ? 'on-time' : status === 'H' ? 'late' : 'absent'}`}></span>
                            <span>{status === 'P' ? 'On time' : status === 'H' ? 'Late' : 'Absent'}</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 2. EMPLOYEES DIRECTORY */}
      {activeTab === 'employees' && (
        <div className="glass-card">
          <div className="card-header-v2">
            <h3 className="card-title-v2">Employees Directory ({filteredEmployees.length} of {totalEmployees})</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search name, ID, dept..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', height: '38px', minWidth: '200px' }}
                />
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
              </div>
              <button className="btn btn-primary" style={{ background: '#0f2d59', height: '38px' }} onClick={() => setShowAddEmpModal(true)}>
                <Plus size={16} /> Add Employee
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Joining Date</th>
                  <th>Base Salary</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.id}>
                    <td><code>{emp.id}</code></td>
                    <td>
                      <div className="profile-cell">
                        <div className="avatar-circle">{emp.name.charAt(0)}</div>
                        <div>
                          <div className="avatar-text-name">{emp.name}</div>
                          <div className="avatar-text-sub">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{emp.department}</span></td>
                    <td>{emp.designation}</td>
                    <td>{emp.joining_date}</td>
                    <td style={{ fontWeight: 600 }}>{curr}{emp.base_salary.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => {
                          const newSal = prompt(`Enter new base salary for ${emp.name}:`, emp.base_salary);
                          if (newSal !== null && !isNaN(newSal)) {
                            db.saveEmployee({ ...emp, base_salary: Number(newSal) });
                            reloadData();
                          }
                        }} title="Edit Salary" aria-label="Edit Salary">
                          <Edit size={13} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDeleteEmployee(emp.id)} title="Remove Employee" aria-label="Remove Employee">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Employee Modal */}
          {showAddEmpModal && (
            <div className="gateway-overlay">
              <div className="gateway-container" style={{ maxWidth: '500px', padding: '0', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div className="gateway-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f2d59' }}>Add New Employee</h3>
                  <button className="gateway-close-btn" style={{ border: 'none', background: 'transparent' }} onClick={() => setShowAddEmpModal(false)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
                <form onSubmit={handleAddEmployee} style={{ padding: '20px' }}>
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="emp-id">Employee ID</label>
                      <input id="emp-id" type="text" className="form-control" placeholder="EMP109" value={newEmp.id} onChange={(e) => setNewEmp({...newEmp, id: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="emp-name">Full Name</label>
                      <input id="emp-name" type="text" className="form-control" placeholder="Rahul Roy" value={newEmp.name} onChange={(e) => setNewEmp({...newEmp, name: e.target.value})} required />
                    </div>
                  </div>
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="emp-email">Email Address</label>
                      <input id="emp-email" type="email" className="form-control" placeholder="rahulroy@staffly.com" value={newEmp.email} onChange={(e) => setNewEmp({...newEmp, email: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="emp-phone">Phone Number</label>
                      <input id="emp-phone" type="text" className="form-control" placeholder="9876543218" value={newEmp.phone} onChange={(e) => setNewEmp({...newEmp, phone: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="emp-dept">Department</label>
                      <select id="emp-dept" className="form-control" value={newEmp.department} onChange={(e) => setNewEmp({...newEmp, department: e.target.value})}>
                        <option value="IT">IT</option>
                        <option value="HR">HR</option>
                        <option value="Finance">Finance</option>
                        <option value="Sales">Sales</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Operations">Operations</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="emp-desig">Designation</label>
                      <input id="emp-desig" type="text" className="form-control" placeholder="Software Engineer" value={newEmp.designation} onChange={(e) => setNewEmp({...newEmp, designation: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label className="form-label" htmlFor="emp-salary">Base Salary (Monthly - {curr})</label>
                    <input id="emp-salary" type="number" className="form-control" value={newEmp.base_salary} onChange={(e) => setNewEmp({...newEmp, base_salary: e.target.value})} />
                  </div>
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="new-emp-photo">Portrait Photo (Optional)</label>
                      <input 
                        id="new-emp-photo"
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAddEmpFileChange(e, 'profile_photo')}
                        className="form-control"
                        style={{ padding: '6px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="new-emp-id-doc">Govt Valid ID Photo (Optional)</label>
                      <input 
                        id="new-emp-id-doc"
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAddEmpFileChange(e, 'govt_id_photo')}
                        className="form-control"
                        style={{ padding: '6px' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddEmpModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ background: '#0f2d59' }}>Add Employee</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. INTERACTIVE MONTH CALENDAR */}
      {activeTab === 'attendance' && (() => {
        // Month days computation helper
        const getCalendarDays = (yearMonthStr) => {
          const [year, month] = yearMonthStr.split('-').map(Number);
          const firstDay = new Date(year, month - 1, 1);
          const startDayOfWeek = firstDay.getDay(); // 0 Sunday, 1 Monday, etc.
          const lastDay = new Date(year, month, 0);
          const totalDays = lastDay.getDate();
          
          const daysArr = [];
          
          // Padding cells
          for (let i = 0; i < startDayOfWeek; i++) {
            daysArr.push({ isPadding: true });
          }
          
          // Active days
          for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${yearMonthStr}-${String(d).padStart(2, '0')}`;
            daysArr.push({ isPadding: false, dayNum: d, dateStr });
          }
          
          return daysArr;
        };

        const calDays = getCalendarDays(selectedMonth);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Calendar panel */}
            <div className="glass-card">
              <div className="card-header-v2" style={{ flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 className="card-title-v2">Attendance Calendar</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Select a month to view the day-by-day attendance rates. Click on a specific day to view/manage its detailed logs.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Month:</span>
                  <select 
                    className="form-control" 
                    value={selectedMonth} 
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      // Default selected day to the 1st of that month
                      setSelectedCalendarDay(`${e.target.value}-01`);
                    }}
                    style={{ width: '160px', height: '36px', padding: '4px 8px' }}
                  >
                    <option value="2026-08">August 2026</option>
                    <option value="2026-07">July 2026</option>
                    <option value="2026-06">June 2026</option>
                  </select>
                </div>
              </div>

              {/* 7-column calendar header */}
              <div className="calendar-grid" style={{ marginBottom: '8px' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => (
                  <div className="calendar-header-day" key={dayName}>{dayName}</div>
                ))}
              </div>

              {/* Calendar cell matrix */}
              <div className="calendar-grid">
                {calDays.map((item, idx) => {
                  if (item.isPadding) {
                    return <div className="calendar-padding-cell" key={`pad-${idx}`}></div>;
                  }

                  // Calculate stats for this date
                  const activeEmps = employees.filter(e => e.status === 'active');
                  const total = activeEmps.length || 1;
                  const dayRecords = attendance.filter(a => a.date === item.dateStr);
                  const present = dayRecords.filter(a => a.status === 'P').length;
                  const late = dayRecords.filter(a => a.status === 'H').length;
                  
                  const presentPercent = Math.round(((present + late) / total) * 100);
                  const absentPercent = 100 - presentPercent;

                  const isActive = selectedCalendarDay === item.dateStr;

                  return (
                    <div 
                      key={item.dateStr}
                      className={`calendar-day-cell ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedCalendarDay(item.dateStr)}
                    >
                      <span className="calendar-day-number">{item.dayNum}</span>
                      <div className="calendar-day-stats">
                        <span className="calendar-stat-att">Att: {presentPercent}%</span>
                        <span className="calendar-stat-abs">Abs: {absentPercent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Day List View */}
            {selectedCalendarDay && (() => {
              // Parse date for clean header
              const [y, m, d] = selectedCalendarDay.split('-');
              const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
              const cleanDateText = `${monthsList[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;

              return (
                <div className="glass-card">
                  <div className="card-header-v2" style={{ marginBottom: '16px' }}>
                    <h3 className="card-title-v2">Attendance Ledger: {cleanDateText}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Click on status badges to cycle states: ON TIME → LATE → ABSENT.
                    </p>
                  </div>
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>EMPLOYEE</th>
                          <th>ROLE</th>
                          <th>DEPARTMENT</th>
                          <th style={{ textAlign: 'right' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.filter(e => e.status === 'active').map(emp => {
                          const record = attendance.find(a => a.employee_id === emp.id && a.date === selectedCalendarDay);
                          // Treat 'L' (Leave) and 'A' (Absent) as 'A' (Absent)
                          const status = record ? (record.status === 'L' ? 'A' : record.status) : 'A';
                          
                          return (
                            <tr key={emp.id}>
                              <td>
                                <div className="profile-cell">
                                  <div className="avatar-circle">{emp.name.charAt(0)}</div>
                                  <div>
                                    <div className="avatar-text-name">{emp.name}</div>
                                    <div className="avatar-text-sub">{emp.id}</div>
                                  </div>
                                </div>
                              </td>
                              <td>{emp.designation}</td>
                              <td><span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{emp.department}</span></td>
                              <td style={{ textAlign: 'right' }}>
                                <button 
                                  className={`badge ${status === 'P' ? 'approved' : status === 'H' ? 'pending' : 'rejected'}`}
                                  onClick={() => {
                                    // Cycle states: Present (P) -> Late (H) -> Absent (A)
                                    const nextStatus = status === 'P' ? 'H' : status === 'H' ? 'A' : 'P';
                                    db.saveAttendance({
                                      employee_id: emp.id,
                                      date: selectedCalendarDay,
                                      status: nextStatus
                                    });
                                    reloadData();
                                  }}
                                  style={{ border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                                >
                                  {status === 'P' ? 'ON TIME' : status === 'H' ? 'LATE' : 'ABSENT'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

          </div>
        );
      })()}

      {/* 4. REQUEST HUB */}
      {activeTab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Leaves Approvals */}
          <div className="glass-card">
            <h3 className="card-title-v2"><Calendar size={18} /> Leave Applications</h3>
            <div className="table-container" style={{ marginTop: '12px' }}>
              {pendingLeaves.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', textAlign: 'center', padding: '20px 0' }}>No pending leave applications.</p>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Duration</th>
                      <th>Reason</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLeaves.map(l => {
                      const emp = employees.find(e => e.id === l.employee_id);
                      return (
                        <tr key={l.id}>
                          <td>
                            <div className="profile-cell">
                              <div className="avatar-circle">{emp?.name.charAt(0)}</div>
                              <div>
                                <div className="avatar-text-name">{emp?.name}</div>
                                <div className="avatar-text-sub">{emp?.id}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className="badge leave">{l.type}</span></td>
                          <td>{l.start_date} to {l.end_date}</td>
                          <td>"{l.reason}"</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleLeaveAction(l.id, 'approved')}>Approve</button>
                              <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleLeaveAction(l.id, 'rejected')}>Reject</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Advances Approvals */}
          {(userRole === 'admin' || userRole === 'finance_manager') && (
            <div className="glass-card">
              <h3 className="card-title-v2"><CreditCard size={18} /> Salary Advance Requests</h3>
              <div className="table-container" style={{ marginTop: '12px' }}>
                {pendingAdvances.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', textAlign: 'center', padding: '20px 0' }}>No pending salary advance requests.</p>
                ) : (
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Requested Amount</th>
                        <th>Monthly Repayment</th>
                        <th>Reason</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingAdvances.map(a => {
                        const emp = employees.find(e => e.id === a.employee_id);
                        return (
                          <tr key={a.id}>
                            <td>
                              <div className="profile-cell">
                                <div className="avatar-circle">{emp?.name.charAt(0)}</div>
                                <div>
                                  <div className="avatar-text-name">{emp?.name}</div>
                                  <div className="avatar-text-sub">{emp?.id}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontWeight: 700 }}>{curr}{a.amount.toLocaleString('en-IN')}</td>
                            <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{curr}{a.monthly_repayment.toLocaleString('en-IN')}/mo</td>
                            <td>"{a.reason}"</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleAdvanceAction(a.id, 'approved')}>Approve</button>
                                <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleAdvanceAction(a.id, 'rejected')}>Reject</button>
                              </div>
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

          {/* Support Tickets Console */}
          <div className="glass-card">
            <h3 className="card-title-v2">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Employee Support Tickets
              </span>
            </h3>
            <div className="table-container" style={{ marginTop: '12px' }}>
              {tickets.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', textAlign: 'center', padding: '20px 0' }}>No support tickets logged.</p>
              ) : (
                <table className="custom-table" style={{ fontSize: '12.5px' }}>
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Employee</th>
                      <th>Category</th>
                      <th>Subject</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.slice().reverse().map(t => (
                      <tr key={t.id}>
                        <td><code>{t.id}</code></td>
                        <td><strong>{t.employee_name}</strong> <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({t.employee_id})</span></td>
                        <td>{t.category}</td>
                        <td>
                          <div><strong>{t.subject}</strong></div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}>"{t.description}"</div>
                        </td>
                        <td><span className={`badge ${t.priority === 'High' ? 'rejected' : t.priority === 'Medium' ? 'pending' : 'approved'}`} style={{ fontSize: '10.5px' }}>{t.priority}</span></td>
                        <td><span className={`badge ${t.status === 'resolved' ? 'approved' : 'pending'}`} style={{ fontSize: '10.5px' }}>{t.status}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          {t.status === 'open' ? (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '6px 12px', fontSize: '11.5px', background: '#10b981' }} 
                              onClick={() => handleResolveTicket(t.id)}
                            >
                              Resolve
                            </button>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>No action needed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}

      {/* 5. ADD EXTRA WORK */}
      {activeTab === 'overtime' && (
        <div className="dashboard-layout-grid">
          <div className="glass-card">
            <h3 className="card-title-v2"><Clock size={18} /> Record Extra Work / Overtime</h3>
            <form onSubmit={handleAddOvertime} style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label className="form-label">Select Employee</label>
                <select className="form-control" value={otLog.employee_id} onChange={(e) => setOtLog({...otLog, employee_id: e.target.value})} required>
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Work Date</label>
                  <input type="date" className="form-control" value={otLog.date} onChange={(e) => setOtLog({...otLog, date: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Entry Type</label>
                  <select className="form-control" value={otLog.type} onChange={(e) => setOtLog({...otLog, type: e.target.value})}>
                    <option value="overtime">Overtime</option>
                    <option value="extra_work">Extra Work</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Hours Completed</label>
                  <input type="number" className="form-control" min="1" max="24" value={otLog.hours} onChange={(e) => setOtLog({...otLog, hours: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Hourly Rate ({curr})</label>
                  <input type="number" className="form-control" min="50" value={otLog.rate} onChange={(e) => setOtLog({...otLog, rate: e.target.value})} required />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Notes</label>
                <input type="text" className="form-control" placeholder="Task details" value={otLog.description} onChange={(e) => setOtLog({...otLog, description: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#0f2d59', marginTop: '16px' }}>Add Log & Credit to Payroll</button>
            </form>
          </div>

          <div className="glass-card">
            <h3 className="card-title-v2">Overtime Log History</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', maxHeight: '350px', overflowY: 'auto' }}>
              {overtime.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No logs recorded yet.</p>
              ) : (
                overtime.slice(-6).reverse().map(o => {
                  const emp = employees.find(e => e.id === o.employee_id);
                  return (
                    <div key={o.id} style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{emp?.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.date} • {o.hours} hrs @ {curr}{o.rate}/hr</div>
                      </div>
                      <span className={`badge ${o.status}`} style={{ fontSize: '10px' }}>{o.status}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. GIVE BONUSES */}
      {activeTab === 'bonuses' && (
        <div className="dashboard-layout-grid">
          <div className="glass-card">
            <h3 className="card-title-v2"><Award size={18} /> Give Bonus</h3>
            <form onSubmit={handleAddBonus} style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label className="form-label">Select Employee</label>
                <select className="form-control" value={bonusLog.employee_id} onChange={(e) => setBonusLog({...bonusLog, employee_id: e.target.value})} required>
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Bonus Amount ({curr})</label>
                  <input type="number" className="form-control" min="500" value={bonusLog.amount} onChange={(e) => setBonusLog({...bonusLog, amount: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Bonus Type</label>
                  <select className="form-control" value={bonusLog.type} onChange={(e) => setBonusLog({...bonusLog, type: e.target.value})}>
                    <option value="performance">Performance Bonus</option>
                    <option value="festival">Festival Bonus</option>
                    <option value="referral">Referral Bonus</option>
                    <option value="special">Special Bonus</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Reason</label>
                <input type="text" className="form-control" placeholder="Outstanding performance in Q3" value={bonusLog.reason} onChange={(e) => setBonusLog({...bonusLog, reason: e.target.value})} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#0f2d59', marginTop: '16px' }}>Award Bonus</button>
            </form>
          </div>

          <div className="glass-card">
            <h3 className="card-title-v2">Bonus Record History</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', maxHeight: '350px', overflowY: 'auto' }}>
              {bonuses.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No bonuses awarded this month.</p>
              ) : (
                bonuses.slice(-6).reverse().map(b => {
                  const emp = employees.find(e => e.id === b.employee_id);
                  return (
                    <div key={b.id} style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{emp?.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.date} • {b.type}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--success)' }}>{curr}{b.amount.toLocaleString('en-IN')}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. PAYROLL CENTER (Image 3 mockup style) */}
      {activeTab === 'payroll' && (
        <div className="glass-card">
          <div className="card-header-v2" style={{ borderBottom: 'none', paddingBottom: '0', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f2d59' }}>Payroll Center</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Review and process employee salaries for the current billing cycle.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="form-control" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} style={{ width: '140px', height: '36px', padding: '4px 8px' }}>
                <option value="2026-06">June 2026</option>
                <option value="2026-07">July 2026</option>
                <option value="2026-08">August 2026</option>
              </select>
              
              <button className="btn btn-secondary" style={{ height: '36px', padding: '0 16px', fontSize: '13px', background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1' }} onClick={() => alert('CSV file exported successfully.')}>
                Export CSV
              </button>
              
              <button className="btn btn-primary" style={{ background: '#0f2d59', height: '36px', padding: '0 16px', fontSize: '13px' }} onClick={handlePayAllSalaries}>
                Pay All ({curr})
              </button>
            </div>
          </div>

          {/* Search bar inside table */}
          <div style={{ position: 'relative', margin: '20px 0 16px 0' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search employees..." 
              value={payrollSearch}
              onChange={(e) => setPayrollSearch(e.target.value)}
              style={{ width: '100%', height: '38px', paddingLeft: '36px', fontSize: '13px', background: 'var(--bg-base)', border: '1px solid var(--border-color)' }}
            />
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          </div>

          <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ background: '#f8fafc', color: '#475569', padding: '12px 18px', fontSize: '11px', fontWeight: 600 }}>EMPLOYEE</th>
                  <th style={{ background: '#f8fafc', color: '#475569', padding: '12px 18px', fontSize: '11px', fontWeight: 600 }}>BASE PAY</th>
                  <th style={{ background: '#f8fafc', color: '#475569', padding: '12px 18px', fontSize: '11px', fontWeight: 600 }}>ALLOWANCES</th>
                  <th style={{ background: '#f8fafc', color: '#475569', padding: '12px 18px', fontSize: '11px', fontWeight: 600 }}>DEDUCTIONS</th>
                  <th style={{ background: '#f8fafc', color: '#475569', padding: '12px 18px', fontSize: '11px', fontWeight: 600 }}>NET PAY</th>
                  <th style={{ background: '#f8fafc', color: '#475569', padding: '12px 18px', fontSize: '11px', fontWeight: 600 }}>STATUS</th>
                  <th style={{ background: '#f8fafc', color: '#475569', padding: '12px 18px', fontSize: '11px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayrolls.map(sheet => {
                  const additions = (sheet.overtime_pay || 0) + (sheet.bonus_pay || 0) + (sheet.extra_work_pay || 0);
                  const deductions = (sheet.deduction_advance || 0) + (sheet.deduction_leave || 0);
                  
                  return (
                    <tr key={sheet.employee_id}>
                      <td style={{ padding: '14px 18px' }}>
                        <div className="profile-cell" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="avatar-circle" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#eff6ff', color: '#1e3b68', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                            {sheet.name ? sheet.name.charAt(0) : 'E'}
                          </div>
                          <div>
                            <div className="avatar-text-name" style={{ fontWeight: 700, color: 'var(--text-main)' }}>{sheet.name}</div>
                            <div className="avatar-text-sub" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sheet.designation}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 500 }}>{curr}{sheet.basic_salary.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '14px 18px', color: '#065f46', fontWeight: 600 }}>
                        {additions > 0 ? `+ ${curr}${additions.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#991b1b', fontWeight: 600 }}>
                        {deductions > 0 ? `- ${curr}${deductions.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#1e3b68' }}>
                        {curr}{sheet.net_salary.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span 
                          className="badge" 
                          style={{ 
                            background: sheet.status === 'paid' ? '#ecfdf5' : '#eff6ff', 
                            color: sheet.status === 'paid' ? '#065f46' : '#1e40af',
                            border: sheet.status === 'paid' ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                        >
                          {sheet.status === 'paid' ? 'PAID' : 'PENDING'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', height: '30px' }} onClick={() => onSelectPayslip(sheet)}>
                            View Payslip
                          </button>
                          {sheet.status !== 'paid' && (
                            <button className="btn btn-primary" style={{ background: '#0f2d59', padding: '6px 12px', fontSize: '12px', borderRadius: '4px', height: '30px' }} onClick={() => handlePaySalary(sheet.employee_id)}>
                              Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Row */}
          <div style={{ background: '#f8fafc', padding: '16px 24px', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 6px 6px', display: 'flex', justifyContent: 'flex-end', gap: '16px', fontSize: '14px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total Payout Amount:</span>
            <span style={{ fontWeight: 800, color: '#0f2d59' }}>{curr}{totalPayrollExpense.toLocaleString('en-IN')}</span>
          </div>

          {/* Info Notice matching Image 3 alert banner */}
          <div className="calc-logic-alert">
            <AlertCircle size={18} style={{ color: '#1e3b68', flexShrink: 0, marginTop: '2px' }} />
            <span className="calc-logic-text">
              <strong>Calculation Logic:</strong> Deductions in red reflect unpaid leaves or active salary advances calculated up to the 25th of the current month. Allowances include standard HRA, LTA, and approved reimbursements. Net pay is final and ready for disbursement.
            </span>
          </div>
        </div>
      )}

      {/* 8. REPORTS & CHARTS */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="dashboard-layout-grid">
            {/* Expense breakdown card */}
            <div className="glass-card">
              <h3 className="card-title-v2"><TrendingUp size={18} /> Monthly Spending Report</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Payroll, Overtime payments, bonuses, and salary advances for {payrollMonth}.
              </p>
              
              <div className="chart-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>Total Net Payroll:</span>
                  <span style={{ fontWeight: 700 }}>{curr}{totalPayrollExpense.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: '80%', height: '100%', background: 'var(--primary)' }}></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>Total Bonuses Awarded:</span>
                  <span style={{ fontWeight: 700 }}>{curr}{totalBonusesThisMonth.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: 'var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (totalBonusesThisMonth / (totalPayrollExpense || 1)) * 100)}%`, height: '100%', background: 'var(--success)' }}></div>
                </div>
              </div>
            </div>

            {/* Department Headcount Bar Chart */}
            <div className="glass-card">
              <h3 className="card-title-v2"><Users size={18} /> Department Headcount</h3>
              <div className="chart-graph-bars" style={{ marginTop: '20px' }}>
                {['IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations'].map(dept => {
                  const count = employees.filter(e => e.department === dept).length;
                  const percent = totalEmployees > 0 ? (count / totalEmployees) * 100 : 0;
                  return (
                    <div className="chart-bar-item" key={dept}>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>{count}</span>
                      <div className="chart-bar-fill-v2" style={{ height: `${Math.max(10, percent)}%`, width: '16px' }} title={`${count} Employees`}></div>
                      <span className="chart-bar-label-v2">{dept}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {paymentGatewayData && (
        <PaymentGatewayModal 
          amount={paymentGatewayData.amount}
          employeeName={paymentGatewayData.employeeName}
          isBatch={paymentGatewayData.isBatch}
          onPaymentSuccess={handlePaymentSuccess}
          onCancel={() => setPaymentGatewayData(null)}
          settings={settings}
        />
      )}
    </div>
  );
}
