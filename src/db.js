// PostgreSQL Backend API Client Layer for Staffly

const TOKEN_KEY = 'staffly_jwt_token';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function apiFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const timeoutMs = options.timeout || 6000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timer);
    
    if (response.status === 401 || response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: Access Denied`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status} Request failed`);
    }

    return response.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// Global state cache for synchronous UI components compatibility
let memoryCache = {
  employees: [],
  attendance: [],
  leaves: [],
  advances: [],
  overtime: [],
  bonuses: [],
  payrolls: [],
  tickets: [],
  settings: { companyName: 'Staffly', currency: '₹', overtimeRate: 150, subscriptionPlan: 'Pro' }
};

// Initialize DB and fetch current data snapshot
export async function initializeDB() {
  try {
    const settings = await apiFetch('/api/settings').catch(() => memoryCache.settings);
    memoryCache.settings = settings;

    // Fetch initial datasets if logged in
    if (getAuthToken()) {
      await refreshAllData();
    }
  } catch (e) {
    console.warn('DB initialization notice:', e.message);
  }
}

export async function refreshAllData() {
  try {
    const [emp, att, lvs, adv, ot, bon, pay, tck] = await Promise.allSettled([
      apiFetch('/api/employees'),
      apiFetch('/api/attendance'),
      apiFetch('/api/leaves'),
      apiFetch('/api/finance/advances'),
      apiFetch('/api/finance/overtime'),
      apiFetch('/api/finance/bonuses'),
      apiFetch('/api/finance/payroll'),
      apiFetch('/api/tickets')
    ]);

    if (emp.status === 'fulfilled') memoryCache.employees = emp.value;
    if (att.status === 'fulfilled') memoryCache.attendance = att.value;
    if (lvs.status === 'fulfilled') memoryCache.leaves = lvs.value;
    if (adv.status === 'fulfilled') memoryCache.advances = adv.value;
    if (ot.status === 'fulfilled') memoryCache.overtime = ot.value;
    if (bon.status === 'fulfilled') memoryCache.bonuses = bon.value;
    if (pay.status === 'fulfilled') memoryCache.payrolls = pay.value;
    if (tck.status === 'fulfilled') memoryCache.tickets = tck.value;
  } catch (e) {
    console.error('Error refreshing cache:', e);
  }
}

// Authentication API calls
export async function loginUser(username, password) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  setAuthToken(res.token);
  await refreshAllData();
  return res;
}

export async function googleLoginUser(credential, email, name) {
  const res = await apiFetch('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential, email, name })
  });
  setAuthToken(res.token);
  await refreshAllData();
  return res;
}

export async function registerUser(formData, role) {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...formData, role })
  });
  setAuthToken(res.token);
  await refreshAllData();
  return res;
}

export async function fetchCurrentUser() {
  if (!getAuthToken()) return null;
  try {
    const res = await apiFetch('/api/auth/me');
    return res.user;
  } catch (e) {
    setAuthToken(null);
    return null;
  }
}

// Organization Multi-Tenant APIs
export async function fetchMyOrganizations() {
  return await apiFetch('/api/organizations/my').catch(() => []);
}

export async function createOrganization(orgData) {
  const res = await apiFetch('/api/organizations', {
    method: 'POST',
    body: JSON.stringify(orgData)
  });
  if (res.token) setAuthToken(res.token);
  await refreshAllData();
  return res;
}

export async function joinOrganization(code) {
  const res = await apiFetch('/api/organizations/join', {
    method: 'POST',
    body: JSON.stringify({ code })
  });
  if (res.token) setAuthToken(res.token);
  await refreshAllData();
  return res;
}

export async function switchOrganization(orgId) {
  const res = await apiFetch('/api/organizations/switch', {
    method: 'POST',
    body: JSON.stringify({ organization_id: orgId })
  });
  if (res.token) setAuthToken(res.token);
  await refreshAllData();
  return res;
}

export async function fetchAuditLogs() {
  return await apiFetch('/api/organizations/audit-logs').catch(() => []);
}

// Employees
export function getEmployees() { return memoryCache.employees; }
export async function fetchEmployees() {
  const data = await apiFetch('/api/employees');
  memoryCache.employees = data;
  return data;
}
export async function fetchEmployeeById(id) {
  try {
    const emp = await apiFetch(`/api/employees/${id}`);
    if (emp && emp.id) {
      const idx = memoryCache.employees.findIndex(e => e.id === emp.id);
      if (idx >= 0) {
        memoryCache.employees[idx] = emp;
      } else {
        memoryCache.employees.push(emp);
      }
    }
    return emp;
  } catch (e) {
    return memoryCache.employees.find(e => e.id === id) || null;
  }
}
export async function saveEmployee(emp) {
  const isUpdate = Boolean(emp.id && memoryCache.employees.some(e => e.id === emp.id));
  const method = isUpdate ? 'PUT' : 'POST';
  const url = isUpdate ? `/api/employees/${emp.id}` : '/api/employees';
  const res = await apiFetch(url, { method, body: JSON.stringify(emp) });
  await fetchEmployees();
  return res;
}
export async function deleteEmployee(id) {
  await apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
  await fetchEmployees();
}

// Attendance
export function getAttendance() { return memoryCache.attendance; }
export async function fetchAttendance(params = {}) {
  const queryStr = new URLSearchParams(params).toString();
  const data = await apiFetch(`/api/attendance${queryStr ? '?' + queryStr : ''}`);
  memoryCache.attendance = data;
  return data;
}
export async function saveAttendance(record) {
  const res = await apiFetch('/api/attendance', {
    method: 'POST',
    body: JSON.stringify(record)
  });
  await fetchAttendance();
  return res;
}
export async function getEmployeeAttendanceStats(employeeId, yearMonthStr = '2026-08') {
  return await apiFetch(`/api/attendance/stats?employee_id=${employeeId}&month=${yearMonthStr}`);
}

// Leaves
export function getLeaves() { return memoryCache.leaves; }
export async function fetchLeaves() {
  const data = await apiFetch('/api/leaves');
  memoryCache.leaves = data;
  return data;
}
export async function saveLeave(leave) {
  if (leave.status && (leave.status === 'approved' || leave.status === 'rejected')) {
    const res = await apiFetch(`/api/leaves/${leave.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: leave.status, review_comment: leave.review_comment })
    });
    await fetchLeaves();
    return res;
  } else {
    const res = await apiFetch('/api/leaves', {
      method: 'POST',
      body: JSON.stringify(leave)
    });
    await fetchLeaves();
    return res;
  }
}

// Advances
export function getAdvances() { return memoryCache.advances; }
export async function fetchAdvances() {
  const data = await apiFetch('/api/finance/advances');
  memoryCache.advances = data;
  return data;
}
export async function saveAdvance(adv) {
  if (adv.status && (adv.status === 'approved' || adv.status === 'rejected')) {
    const res = await apiFetch(`/api/finance/advances/${adv.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: adv.status })
    });
    await fetchAdvances();
    return res;
  } else {
    const res = await apiFetch('/api/finance/advances', {
      method: 'POST',
      body: JSON.stringify(adv)
    });
    await fetchAdvances();
    return res;
  }
}

// Overtime
export function getOvertime() { return memoryCache.overtime; }
export async function fetchOvertime() {
  const data = await apiFetch('/api/finance/overtime');
  memoryCache.overtime = data;
  return data;
}
export async function saveOvertime(ot) {
  if (ot.status && (ot.status === 'approved' || ot.status === 'rejected')) {
    const res = await apiFetch(`/api/finance/overtime/${ot.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: ot.status })
    });
    await fetchOvertime();
    return res;
  } else {
    const res = await apiFetch('/api/finance/overtime', {
      method: 'POST',
      body: JSON.stringify(ot)
    });
    await fetchOvertime();
    return res;
  }
}

// Bonuses
export function getBonuses() { return memoryCache.bonuses; }
export async function fetchBonuses() {
  const data = await apiFetch('/api/finance/bonuses');
  memoryCache.bonuses = data;
  return data;
}
export async function saveBonus(bonus) {
  const res = await apiFetch('/api/finance/bonuses', {
    method: 'POST',
    body: JSON.stringify(bonus)
  });
  await fetchBonuses();
  return res;
}

// Payroll
export function getPayrolls() { return memoryCache.payrolls; }
export async function fetchPayroll(month = '2026-08') {
  const data = await apiFetch(`/api/finance/payroll?month=${month}`);
  memoryCache.payrolls = data;
  return data;
}
export function calculateSalarySheet(employeeId, yearMonthStr = '2026-08') {
  const p = memoryCache.payrolls.find(item => item.employee_id === employeeId);
  if (p) return p;
  const emp = memoryCache.employees.find(e => e.id === employeeId);
  return {
    id: `PAY_${employeeId}_${yearMonthStr}`,
    employee_id: employeeId,
    employee_name: emp ? emp.name : 'Employee',
    department: emp ? emp.department : 'IT',
    designation: emp ? emp.designation : 'Staff',
    month: yearMonthStr,
    base_salary: emp ? emp.base_salary : 30000,
    worked_days: 25,
    present_days: 25,
    leave_days: 1,
    absent_days: 0,
    half_days: 0,
    earned_base: emp ? emp.base_salary : 30000,
    overtime_hours: 0,
    overtime_pay: 0,
    bonuses: 0,
    advance_deduction: 0,
    net_salary: emp ? emp.base_salary : 30000,
    status: 'unpaid'
  };
}
export function generateMonthlyPayrollSheet(yearMonthStr = '2026-08') {
  return memoryCache.payrolls;
}
export async function paySalary(employeeId, yearMonthStr = '2026-08') {
  const res = await apiFetch('/api/finance/payroll/pay', {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId, month: yearMonthStr })
  });
  await fetchPayroll(yearMonthStr);
  return res;
}
export async function payAllSalaries(yearMonthStr = '2026-08') {
  return await paySalary('ALL', yearMonthStr);
}

// Settings
export function getSettings() { return memoryCache.settings; }
export async function saveSettings(settings) {
  const res = await apiFetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
  memoryCache.settings = settings;
  return res;
}
export async function resetWorkspaceData() {
  await apiFetch('/api/settings/reset', { method: 'POST' });
  await refreshAllData();
}

// Notifications
export async function getNotifications(employeeId) {
  return await apiFetch(`/api/notifications?employee_id=${employeeId}`).catch(() => []);
}
export async function addNotification(employeeId, text) {
  // Handled automatically on backend operations
}
export async function markNotificationsRead(employeeId) {
  await apiFetch('/api/notifications/mark-read', { method: 'POST' });
}

// Holidays
export function getHolidays() {
  return [
    { id: 'HOL001', date: '2026-01-26', name: 'Republic Day', type: 'National' },
    { id: 'HOL002', date: '2026-08-15', name: 'Independence Day', type: 'National' },
    { id: 'HOL003', date: '2026-10-02', name: 'Gandhi Jayanti', type: 'National' },
    { id: 'HOL004', date: '2026-10-20', name: 'Diwali Festival', type: 'Festival' },
    { id: 'HOL005', date: '2026-12-25', name: 'Christmas', type: 'Festival' }
  ];
}

// Tickets
export function getTickets() { return memoryCache.tickets; }
export async function fetchTickets() {
  const data = await apiFetch('/api/tickets');
  memoryCache.tickets = data;
  return data;
}
export async function saveTicket(ticket) {
  const res = await apiFetch('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(ticket)
  });
  await fetchTickets();
  return res;
}
export async function updateTicketStatus(ticketId, status) {
  const res = await apiFetch(`/api/tickets/${ticketId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
  await fetchTickets();
  return res;
}

// User helper
export function getUsers() {
  return [
    { id: 'USR001', name: 'Owner Admin', email: 'admin@staffly.com', role: 'admin' },
    { id: 'USR_EMP101', name: 'Rahul Sharma', email: 'rahul@staffly.com', role: 'employee', employee_id: 'EMP101' },
    { id: 'USR_EMP102', name: 'Priya Patel', email: 'priya@staffly.com', role: 'manager', employee_id: 'EMP102' },
    { id: 'USR_EMP103', name: 'Akhil Nair', email: 'akhil@staffly.com', role: 'finance_manager', employee_id: 'EMP103' }
  ];
}
