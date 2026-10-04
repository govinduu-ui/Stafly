import bcrypt from 'bcryptjs';
import { query } from './index.js';
import { migrate } from './migrate.js';

export async function seed() {
  await migrate();
  console.log('Seeding Multi-Tenant data for 4 Organization Scenarios...');

  const defaultPassHash = await bcrypt.hash('password123', 10);
  const adminPassHash = await bcrypt.hash('admin', 10);

  // 1. Roles
  const roles = [
    { name: 'CEO', description: 'Chief Executive Officer / Business Owner' },
    { name: 'HR', description: 'Human Resources Manager / Personnel Admin' },
    { name: 'Finance', description: 'Finance Officer / Payroll Manager' },
    { name: 'Employee', description: 'Standard Staff Member' }
  ];

  for (const r of roles) {
    await query(`INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`, [r.name, r.description]);
  }

  // Helper function to seed an entire organization
  async function seedOrganization({ id, name, code, ownerEmail, ownerName, ownerPass, currency, overtimeRate, departments, membersData }) {
    // 1. Organization
    await query(
      `INSERT INTO organizations (id, name, code, owner_id, currency, overtime_rate, subscription_plan, details)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pro', $7)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [id, name, code, `USR_${code}_OWN`, currency || '₹', overtimeRate || 150, `${name} Workspace`]
    );

    // Settings
    await query(
      `INSERT INTO settings (organization_id, company_name, currency, overtime_rate, subscription_plan)
       VALUES ($1, $2, $3, $4, 'Pro')
       ON CONFLICT (organization_id) DO UPDATE SET company_name = EXCLUDED.company_name`,
      [id, name, currency || '₹', overtimeRate || 150]
    );

    // 2. Departments
    const deptMap = {};
    for (const dName of departments) {
      const codeStr = dName.substring(0, 3).toUpperCase();
      const res = await query(
        `INSERT INTO departments (organization_id, name, code, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, name) DO UPDATE SET code = EXCLUDED.code
         RETURNING id`,
        [id, dName, codeStr, `${dName} Department`]
      );
      if (res.rows[0]) deptMap[dName] = res.rows[0].id;
    }

    // 3. Members & Employees
    for (const m of membersData) {
      const userId = m.user_id || `USR_${id}_${m.emp_id}`;
      const passHash = m.password ? await bcrypt.hash(m.password, 10) : defaultPassHash;

      // User account
      await query(
        `INSERT INTO users (id, name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [userId, m.name, m.email, passHash]
      );

      // Employee record (if not standalone CEO without emp record)
      if (m.emp_id) {
        const dId = deptMap[m.department] || null;
        await query(
          `INSERT INTO employees (id, organization_id, user_id, name, email, phone, department_id, department_name, designation, joining_date, base_salary, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
           ON CONFLICT (id) DO UPDATE SET base_salary = EXCLUDED.base_salary`,
          [m.emp_id, id, userId, m.name, m.email, m.phone || '9876543210', dId, m.department || 'General', m.designation || 'Staff', m.joining_date || '2025-01-01', m.base_salary || 30000]
        );
      }

      // Organization Membership
      const memId = `MEM_${id}_${userId}`;
      await query(
        `INSERT INTO organization_members (id, organization_id, user_id, employee_id, role_name, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role_name = EXCLUDED.role_name`,
        [memId, id, userId, m.emp_id || null, m.role]
      );

      // Sample Attendance for August 2026
      if (m.emp_id) {
        const todayStr = '2026-08-27';
        for (let dayNum = 1; dayNum <= 27; dayNum++) {
          const dateStr = `2026-08-${String(dayNum).padStart(2, '0')}`;
          const isSun = new Date(2026, 7, dayNum).getDay() === 0;
          let status = isSun ? 'P' : (dateStr === todayStr ? (m.role === 'Employee' ? 'P' : 'P') : 'P');

          await query(
            `INSERT INTO attendance (id, organization_id, employee_id, date, status, check_in, check_out)
             VALUES ($1, $2, $3, $4, $5, '09:00:00', '17:00:00')
             ON CONFLICT (organization_id, employee_id, date) DO NOTHING`,
            [`ATT_${id}_${m.emp_id}_${dateStr}`, id, m.emp_id, dateStr, status]
          );
        }
      }
    }
  }

  // --- SCENARIO 1: 1 CEO + 1 Employee (Apex Solopreneurs) ---
  await seedOrganization({
    id: 'ORG_SOLO',
    name: 'Apex Solopreneurs',
    code: 'APEX',
    ownerEmail: 'owner@apex.com',
    ownerName: 'Vikram Apex (CEO)',
    currency: '$',
    overtimeRate: 200,
    departments: ['Operations'],
    membersData: [
      { user_id: 'USR_APEX_CEO', emp_id: null, name: 'Vikram Apex', email: 'owner@apex.com', password: 'password123', role: 'CEO' },
      { user_id: 'USR_APEX_EMP1', emp_id: 'EMP_SOLO_101', name: 'Rohan Associate', email: 'staff@apex.com', password: 'password123', role: 'Employee', department: 'Operations', designation: 'Operations Lead', base_salary: 40000 }
    ]
  });

  // --- SCENARIO 2: 1 CEO + HR + Finance + 10 Employees (Staffly Tech) ---
  const stafflyMembers = [
    { user_id: 'USR001', emp_id: null, name: 'Owner Admin', email: 'admin@staffly.com', password: 'admin', role: 'CEO' },
    { user_id: 'USR_EMP101', emp_id: 'EMP101', name: 'Rahul Sharma', email: 'rahul@staffly.com', password: 'password123', role: 'Employee', department: 'IT', designation: 'Senior Software Engineer', base_salary: 45000 },
    { user_id: 'USR_EMP102', emp_id: 'EMP102', name: 'Priya Patel', email: 'priya@staffly.com', password: 'password123', role: 'HR', department: 'HR', designation: 'HR Manager', base_salary: 55000 },
    { user_id: 'USR_EMP103', emp_id: 'EMP103', name: 'Akhil Nair', email: 'akhil@staffly.com', password: 'password123', role: 'Finance', department: 'Finance', designation: 'Finance Manager', base_salary: 40000 },
    { user_id: 'USR_EMP104', emp_id: 'EMP104', name: 'Arjun Kumar', email: 'arjun@staffly.com', password: 'password123', role: 'Employee', department: 'Sales', designation: 'Sales Executive', base_salary: 28000 },
    { user_id: 'USR_EMP105', emp_id: 'EMP105', name: 'Ananya Rao', email: 'ananya@staffly.com', password: 'password123', role: 'Employee', department: 'Marketing', designation: 'Marketing Specialist', base_salary: 32000 },
    { user_id: 'USR_EMP106', emp_id: 'EMP106', name: 'Sneha Gupta', email: 'sneha@staffly.com', password: 'password123', role: 'Employee', department: 'IT', designation: 'QA Engineer', base_salary: 30000 },
    { user_id: 'USR_EMP107', emp_id: 'EMP107', name: 'Vikram Singh', email: 'vikram@staffly.com', password: 'password123', role: 'Employee', department: 'Operations', designation: 'Operations Coordinator', base_salary: 35000 },
    { user_id: 'USR_EMP108', emp_id: 'EMP108', name: 'Kavita Reddy', email: 'kavita@staffly.com', password: 'password123', role: 'Employee', department: 'IT', designation: 'Product Designer', base_salary: 48000 }
  ];

  await seedOrganization({
    id: 'ORG_STAFFLY',
    name: 'Staffly Tech',
    code: 'STAFFLY',
    ownerEmail: 'admin@staffly.com',
    ownerName: 'Owner Admin',
    currency: '₹',
    overtimeRate: 150,
    departments: ['IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations'],
    membersData: stafflyMembers
  });

  // Sample Leaves, Advances, Overtime for Staffly
  await query(
    `INSERT INTO leaves (id, organization_id, employee_id, type, start_date, end_date, duration_type, reason, status)
     VALUES ('LV_STAFFLY_01', 'ORG_STAFFLY', 'EMP101', 'casual', '2026-08-28', '2026-08-29', 'full', 'Family event', 'pending')
     ON CONFLICT (id) DO NOTHING`
  );
  await query(
    `INSERT INTO advances (id, organization_id, employee_id, amount, repayment_months, reason, status)
     VALUES ('ADV_STAFFLY_01', 'ORG_STAFFLY', 'EMP101', 5000, 1, 'Medical emergency', 'approved')
     ON CONFLICT (id) DO NOTHING`
  );

  // --- SCENARIO 3: Large Company 100+ Employees (Global Enterprise Corp) ---
  const globalMembers = [
    { user_id: 'USR_GLOBAL_CEO', emp_id: null, name: 'Elizabeth CEO', email: 'ceo@globalcorp.com', password: 'password123', role: 'CEO' },
    { user_id: 'USR_GLOBAL_HR', emp_id: 'EMP_GLB_HR1', name: 'David HR Director', email: 'hr@globalcorp.com', password: 'password123', role: 'HR', department: 'HR', designation: 'HR Director', base_salary: 85000 },
    { user_id: 'USR_GLOBAL_FIN', emp_id: 'EMP_GLB_FIN1', name: 'Sarah VP Finance', email: 'finance@globalcorp.com', password: 'password123', role: 'Finance', department: 'Finance', designation: 'VP Finance', base_salary: 90000 }
  ];

  // Dynamically generate 100 enterprise employees for Scenario 3
  for (let i = 1; i <= 100; i++) {
    const empId = `EMP_GLB_${String(i).padStart(3, '0')}`;
    const depts = ['IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations'];
    const dept = depts[i % depts.length];
    globalMembers.push({
      user_id: `USR_GLB_${i}`,
      emp_id: empId,
      name: `Enterprise Staff ${i}`,
      email: `emp${i}@globalcorp.com`,
      password: 'password123',
      role: 'Employee',
      department: dept,
      designation: `${dept} Specialist ${i}`,
      base_salary: 35000 + (i % 10) * 2500
    });
  }

  await seedOrganization({
    id: 'ORG_GLOBAL',
    name: 'Global Enterprise Corp',
    code: 'GLOBAL',
    ownerEmail: 'ceo@globalcorp.com',
    ownerName: 'Elizabeth CEO',
    currency: '$',
    overtimeRate: 250,
    departments: ['IT', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations'],
    membersData: globalMembers
  });

  // --- SCENARIO 4: Small Studio without HR/Finance roles (Studio Craft) ---
  await seedOrganization({
    id: 'ORG_CRAFT',
    name: 'Studio Craft',
    code: 'CRAFT',
    ownerEmail: 'lead@studiocraft.com',
    ownerName: 'Sophia Lead',
    currency: '€',
    overtimeRate: 180,
    departments: ['Design'],
    membersData: [
      { user_id: 'USR_CRAFT_CEO', emp_id: null, name: 'Sophia Lead', email: 'lead@studiocraft.com', password: 'password123', role: 'CEO' },
      { user_id: 'USR_CRAFT_E1', emp_id: 'EMP_CRF_101', name: 'Alex UI Lead', email: 'alex@studiocraft.com', password: 'password123', role: 'Employee', department: 'Design', designation: 'Senior UI Designer', base_salary: 50000 },
      { user_id: 'USR_CRAFT_E2', emp_id: 'EMP_CRF_102', name: 'Maya Motion Artist', email: 'maya@studiocraft.com', password: 'password123', role: 'Employee', department: 'Design', designation: 'Motion Designer', base_salary: 45000 }
    ]
  });

  console.log('PostgreSQL Multi-Tenant Seeding completed for all 4 scenarios cleanly!');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed().catch(console.error);
}
