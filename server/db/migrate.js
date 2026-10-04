import { query } from './index.js';

export async function migrate() {
  console.log('Running PostgreSQL Multi-Tenant Database Migrations...');

  // Reset/Upgrade schema for multi-tenant support
  const dropTables = [
    `DROP TABLE IF EXISTS audit_logs CASCADE`,
    `DROP TABLE IF EXISTS tickets CASCADE`,
    `DROP TABLE IF EXISTS notifications CASCADE`,
    `DROP TABLE IF EXISTS payrolls CASCADE`,
    `DROP TABLE IF EXISTS bonuses CASCADE`,
    `DROP TABLE IF EXISTS overtime CASCADE`,
    `DROP TABLE IF EXISTS advances CASCADE`,
    `DROP TABLE IF EXISTS leaves CASCADE`,
    `DROP TABLE IF EXISTS attendance CASCADE`,
    `DROP TABLE IF EXISTS employees CASCADE`,
    `DROP TABLE IF EXISTS departments CASCADE`,
    `DROP TABLE IF EXISTS organization_members CASCADE`,
    `DROP TABLE IF EXISTS settings CASCADE`,
    `DROP TABLE IF EXISTS users CASCADE`,
    `DROP TABLE IF EXISTS roles CASCADE`,
    `DROP TABLE IF EXISTS organizations CASCADE`
  ];

  for (const statement of dropTables) {
    await query(statement);
  }

  const sqlStatements = [
    // 1. Organizations
    `CREATE TABLE IF NOT EXISTS organizations (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(30) UNIQUE NOT NULL,
      owner_id VARCHAR(50),
      currency VARCHAR(10) DEFAULT '₹',
      overtime_rate NUMERIC(10,2) DEFAULT 150,
      subscription_plan VARCHAR(30) DEFAULT 'Pro',
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 2. System Roles
    `CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      description TEXT
    )`,

    // 3. Global Users
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      google_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 4. Organization Members (User Membership & Role per Org)
    `CREATE TABLE IF NOT EXISTS organization_members (
      id VARCHAR(50) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
      employee_id VARCHAR(30),
      role_name VARCHAR(30) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_org_user UNIQUE(organization_id, user_id)
    )`,

    // 5. Departments
    `CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(20),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_org_dept_name UNIQUE(organization_id, name)
    )`,

    // 6. Employees
    `CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(30) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL,
      phone VARCHAR(30),
      department_id INT REFERENCES departments(id) ON DELETE SET NULL,
      department_name VARCHAR(100),
      designation VARCHAR(100),
      joining_date DATE,
      base_salary NUMERIC(12,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 7. Attendance
    `CREATE TABLE IF NOT EXISTS attendance (
      id VARCHAR(100) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id VARCHAR(30) REFERENCES employees(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      status VARCHAR(10) NOT NULL,
      check_in TIME,
      check_out TIME,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_org_emp_date UNIQUE(organization_id, employee_id, date)
    )`,

    // 8. Leaves
    `CREATE TABLE IF NOT EXISTS leaves (
      id VARCHAR(50) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id VARCHAR(30) REFERENCES employees(id) ON DELETE CASCADE,
      type VARCHAR(30) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      duration_type VARCHAR(20) DEFAULT 'full',
      reason TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      applied_date DATE DEFAULT CURRENT_DATE,
      reviewed_by VARCHAR(50),
      review_comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 9. Advances
    `CREATE TABLE IF NOT EXISTS advances (
      id VARCHAR(50) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id VARCHAR(30) REFERENCES employees(id) ON DELETE CASCADE,
      amount NUMERIC(12,2) NOT NULL,
      repayment_months INT DEFAULT 1,
      reason TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      requested_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 10. Overtime
    `CREATE TABLE IF NOT EXISTS overtime (
      id VARCHAR(50) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id VARCHAR(30) REFERENCES employees(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      hours NUMERIC(5,2) NOT NULL,
      rate NUMERIC(10,2) DEFAULT 150,
      reason TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 11. Bonuses
    `CREATE TABLE IF NOT EXISTS bonuses (
      id VARCHAR(50) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id VARCHAR(30) REFERENCES employees(id) ON DELETE CASCADE,
      amount NUMERIC(12,2) NOT NULL,
      month VARCHAR(7) NOT NULL,
      type VARCHAR(50),
      reason TEXT,
      status VARCHAR(20) DEFAULT 'approved',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 12. Payrolls
    `CREATE TABLE IF NOT EXISTS payrolls (
      id VARCHAR(50) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id VARCHAR(30) REFERENCES employees(id) ON DELETE CASCADE,
      month VARCHAR(7) NOT NULL,
      base_salary NUMERIC(12,2) DEFAULT 0,
      worked_days INT DEFAULT 0,
      present_days INT DEFAULT 0,
      leave_days INT DEFAULT 0,
      absent_days INT DEFAULT 0,
      half_days INT DEFAULT 0,
      earned_base NUMERIC(12,2) DEFAULT 0,
      overtime_hours NUMERIC(5,2) DEFAULT 0,
      overtime_pay NUMERIC(12,2) DEFAULT 0,
      bonuses NUMERIC(12,2) DEFAULT 0,
      advance_deduction NUMERIC(12,2) DEFAULT 0,
      net_salary NUMERIC(12,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'unpaid',
      payment_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_org_emp_month UNIQUE(organization_id, employee_id, month)
    )`,

    // 13. Notifications
    `CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(50) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id VARCHAR(30) REFERENCES employees(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      read BOOLEAN DEFAULT false,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 14. Tickets
    `CREATE TABLE IF NOT EXISTS tickets (
      id VARCHAR(50) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id VARCHAR(30) REFERENCES employees(id) ON DELETE CASCADE,
      subject VARCHAR(255) NOT NULL,
      category VARCHAR(50),
      description TEXT,
      status VARCHAR(20) DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 15. Audit Logs
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(50) PRIMARY KEY,
      organization_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      user_id VARCHAR(50),
      user_name VARCHAR(100),
      action VARCHAR(100) NOT NULL,
      resource VARCHAR(100) NOT NULL,
      details TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 16. Settings
    `CREATE TABLE IF NOT EXISTS settings (
      organization_id VARCHAR(50) PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      company_name VARCHAR(100) DEFAULT 'Staffly',
      currency VARCHAR(10) DEFAULT '₹',
      overtime_rate NUMERIC(10,2) DEFAULT 150,
      subscription_plan VARCHAR(50) DEFAULT 'Pro',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Multi-Tenant Indexes for High Performance & Strict Query Isolation
    `CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id)`,
    `CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id)`,
    `CREATE INDEX IF NOT EXISTS idx_employees_org_emp ON employees(organization_id, id)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_org_emp ON attendance(organization_id, employee_id)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON attendance(organization_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_leaves_org_emp ON leaves(organization_id, employee_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payrolls_org_emp_m ON payrolls(organization_id, employee_id, month)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id)`
  ];

  for (const statement of sqlStatements) {
    await query(statement);
  }

  console.log('PostgreSQL Multi-Tenant Database Migrations completed successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  migrate().catch(console.error);
}
