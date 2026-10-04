import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { authenticateToken, enforceTenantIsolation, requireRole, requireSelfOrRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(enforceTenantIsolation);

// GET /api/employees - CEO/HR/Finance list employees in their active organization, or Employee gets their own profile
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const userRole = req.user.normalizedRole;
    let sql = `SELECT e.*, d.name as department 
       FROM employees e 
       LEFT JOIN departments d ON e.department_id = d.id 
       WHERE e.organization_id = $1`;
    const params = [orgId];

    if (userRole === 'Employee') {
      params.push(req.user.employee_id);
      sql += ` AND e.id = $2`;
    } else if (!['CEO', 'HR', 'Finance'].includes(userRole)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions.' });
    }

    sql += ` ORDER BY e.id ASC`;
    const result = await query(sql, params);

    const employees = result.rows.map(emp => ({
      ...emp,
      department: emp.department || emp.department_name || 'IT',
      base_salary: parseFloat(emp.base_salary)
    }));

    return res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return res.status(500).json({ error: 'Failed to fetch employees.' });
  }
});

// GET /api/employees/:id - Fetch single employee
router.get('/:id', requireSelfOrRole('CEO', 'HR', 'Finance'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const empId = req.params.id;

    const result = await query(
      `SELECT e.*, d.name as department 
       FROM employees e 
       LEFT JOIN departments d ON e.department_id = d.id 
       WHERE e.organization_id = $1 AND e.id = $2`,
      [orgId, empId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found in your organization.' });
    }

    const emp = result.rows[0];
    emp.department = emp.department || emp.department_name || 'IT';
    emp.base_salary = parseFloat(emp.base_salary);

    return res.json(emp);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch employee details.' });
  }
});

// POST /api/employees - Create employee in organization (CEO/HR)
router.post('/', requireRole('CEO', 'HR'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { id: reqId, name, email, phone, department, designation, joining_date, base_salary, status, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    let empId = reqId;
    if (!empId) {
      const countRes = await query(`SELECT COUNT(*) as count FROM employees WHERE organization_id = $1`, [orgId]);
      empId = `EMP_${orgId}_${parseInt(countRes.rows[0].count, 10) + 101}`;
    }

    const deptRes = await query(`SELECT id FROM departments WHERE organization_id = $1 AND name = $2`, [orgId, department || 'IT']);
    const deptId = deptRes.rows[0] ? deptRes.rows[0].id : null;

    await query(
      `INSERT INTO employees (id, organization_id, name, email, phone, department_id, department_name, designation, joining_date, base_salary, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET 
       name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, department_name = EXCLUDED.department_name,
       designation = EXCLUDED.designation, base_salary = EXCLUDED.base_salary, status = EXCLUDED.status`,
      [empId, orgId, name, email, phone || '', deptId, department || 'IT', designation || 'Staff', joining_date || new Date().toISOString().split('T')[0], base_salary || 30000, status || 'active']
    );

    // Link or Create User
    let uRes = await query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    let userId;
    if (uRes.rows.length === 0) {
      userId = `USR_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const defaultHash = await bcrypt.hash('password123', 10);
      await query(
        `INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)`,
        [userId, name, email.toLowerCase(), defaultHash]
      );
    } else {
      userId = uRes.rows[0].id;
    }

    // Add Organization Membership
    const targetRole = role || 'Employee';
    const memId = `MEM_${orgId}_${userId}`;
    await query(
      `INSERT INTO organization_members (id, organization_id, user_id, employee_id, role_name, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role_name = EXCLUDED.role_name, employee_id = EXCLUDED.employee_id`,
      [memId, orgId, userId, empId, targetRole]
    );

    if (req.logAudit) {
      await req.logAudit('CREATE_EMPLOYEE', 'Employees', `Added employee ${name} (${empId})`);
    }

    const newEmp = (await query(`SELECT * FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, empId])).rows[0];
    newEmp.base_salary = parseFloat(newEmp.base_salary);

    return res.status(201).json(newEmp);
  } catch (error) {
    console.error('Error creating employee:', error);
    return res.status(500).json({ error: 'Failed to create employee.' });
  }
});

// PUT /api/employees/:id - Update employee (CEO/HR)
router.put('/:id', requireSelfOrRole('CEO', 'HR'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const empId = req.params.id;
    const { name, email, phone, department, designation, base_salary, status } = req.body;

    const existing = await query(`SELECT * FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, empId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found in your organization.' });
    }

    const cur = existing.rows[0];
    const newName = name || cur.name;
    const newEmail = email || cur.email;
    const newPhone = phone !== undefined ? phone : cur.phone;
    const newDept = department || cur.department_name;
    const newDesig = designation || cur.designation;
    const newSal = base_salary !== undefined ? base_salary : cur.base_salary;
    const newStatus = status || cur.status;

    await query(
      `UPDATE employees 
       SET name = $1, email = $2, phone = $3, department_name = $4, designation = $5, base_salary = $6, status = $7
       WHERE organization_id = $8 AND id = $9`,
      [newName, newEmail, newPhone, newDept, newDesig, newSal, newStatus, orgId, empId]
    );

    if (req.logAudit) {
      await req.logAudit('UPDATE_EMPLOYEE', 'Employees', `Updated employee ${empId}`);
    }

    const updated = (await query(`SELECT * FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, empId])).rows[0];
    updated.base_salary = parseFloat(updated.base_salary);

    return res.json(updated);
  } catch (error) {
    console.error('Error updating employee:', error);
    return res.status(500).json({ error: 'Failed to update employee.' });
  }
});

// DELETE /api/employees/:id - Delete employee (CEO/HR)
router.delete('/:id', requireRole('CEO', 'HR'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const empId = req.params.id;

    await query(`DELETE FROM organization_members WHERE organization_id = $1 AND employee_id = $2`, [orgId, empId]);
    await query(`DELETE FROM employees WHERE organization_id = $1 AND id = $2`, [orgId, empId]);

    if (req.logAudit) {
      await req.logAudit('DELETE_EMPLOYEE', 'Employees', `Deleted employee ${empId}`);
    }

    return res.json({ message: `Employee ${empId} deleted successfully.` });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return res.status(500).json({ error: 'Failed to delete employee.' });
  }
});

export default router;
