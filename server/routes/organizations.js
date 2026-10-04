import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'staffly_jwt_secret_key_super_secure_2026';

function generateToken(user, orgId, orgName, roleName, empId) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      organization_id: orgId,
      organization_name: orgName,
      role: roleName,
      employee_id: empId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/organizations - Create a new Organization
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, currency, overtime_rate, subscription_plan, details } = req.body;
    if (!name) return res.status(400).json({ error: 'Organization name is required.' });

    const code = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10) + '_' + Math.floor(100 + Math.random() * 900);
    const orgId = `ORG_${code}`;

    // Insert Organization
    await query(
      `INSERT INTO organizations (id, name, code, owner_id, currency, overtime_rate, subscription_plan, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orgId, name, code, req.user.id, currency || '₹', overtime_rate || 150, subscription_plan || 'Pro', details || '']
    );

    // Insert Settings
    await query(
      `INSERT INTO settings (organization_id, company_name, currency, overtime_rate, subscription_plan)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id) DO UPDATE SET company_name = EXCLUDED.company_name`,
      [orgId, name, currency || '₹', overtime_rate || 150, subscription_plan || 'Pro']
    );

    // Add membership as CEO
    const memId = `MEM_${orgId}_${req.user.id}`;
    await query(
      `INSERT INTO organization_members (id, organization_id, user_id, employee_id, role_name, status)
       VALUES ($1, $2, $3, null, 'CEO', 'active')`,
      [memId, orgId, req.user.id]
    );

    // Default Departments
    for (const d of ['IT', 'HR', 'Finance', 'Operations']) {
      await query(
        `INSERT INTO departments (organization_id, name, code) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [orgId, d, d.substring(0, 3).toUpperCase()]
      );
    }

    if (req.logAudit) {
      await req.logAudit('CREATE_ORGANIZATION', 'Organizations', `Created organization ${name} (${code})`);
    }

    const token = generateToken(req.user, orgId, name, 'CEO', null);

    return res.status(201).json({
      message: `Organization '${name}' created successfully`,
      organization: { id: orgId, name, code, role: 'CEO' },
      token
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    return res.status(500).json({ error: 'Failed to create organization.' });
  }
});

// POST /api/organizations/join - Join existing Organization by Code
router.post('/join', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Organization code is required.' });

    const orgRes = await query(`SELECT * FROM organizations WHERE UPPER(code) = UPPER($1)`, [code.trim()]);
    if (orgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Organization code not found.' });
    }

    const org = orgRes.rows[0];

    // Check existing membership
    const existMem = await query(
      `SELECT * FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [org.id, req.user.id]
    );

    let roleName = 'Employee';
    let empId = null;

    if (existMem.rows.length === 0) {
      // Create employee record inside organization
      const countRes = await query(`SELECT COUNT(*) as count FROM employees WHERE organization_id = $1`, [org.id]);
      empId = `EMP_${org.code}_${parseInt(countRes.rows[0].count, 10) + 101}`;

      await query(
        `INSERT INTO employees (id, organization_id, user_id, name, email, phone, designation, joining_date, base_salary, status)
         VALUES ($1, $2, $3, $4, $5, '9876543210', 'Staff Associate', CURRENT_DATE, 30000, 'active')`,
        [empId, org.id, req.user.id, req.user.name, req.user.email]
      );

      const memId = `MEM_${org.id}_${req.user.id}`;
      await query(
        `INSERT INTO organization_members (id, organization_id, user_id, employee_id, role_name, status)
         VALUES ($1, $2, $3, $4, 'Employee', 'active')`,
        [memId, org.id, req.user.id, empId]
      );
    } else {
      roleName = existMem.rows[0].role_name;
      empId = existMem.rows[0].employee_id;
    }

    const token = generateToken(req.user, org.id, org.name, roleName, empId);

    return res.json({
      message: `Successfully joined ${org.name}`,
      organization: { id: org.id, name: org.name, code: org.code, role: roleName },
      token
    });
  } catch (error) {
    console.error('Error joining organization:', error);
    return res.status(500).json({ error: 'Failed to join organization.' });
  }
});

// GET /api/organizations/my - Fetch all organizations user belongs to
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT o.id, o.name, o.code, o.currency, om.role_name as role, om.employee_id
       FROM organization_members om
       JOIN organizations o ON om.organization_id = o.id
       WHERE om.user_id = $1 AND om.status = 'active'`,
      [req.user.id]
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user organizations.' });
  }
});

// POST /api/organizations/switch - Switch active organization context
router.post('/switch', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.body;
    if (!organization_id) return res.status(400).json({ error: 'Target organization ID is required.' });

    const memRes = await query(
      `SELECT om.*, o.name as organization_name
       FROM organization_members om
       JOIN organizations o ON om.organization_id = o.id
       WHERE om.organization_id = $1 AND om.user_id = $2 AND om.status = 'active'`,
      [organization_id, req.user.id]
    );

    if (memRes.rows.length === 0) {
      return res.status(403).json({ error: 'You are not an active member of this organization.' });
    }

    const mem = memRes.rows[0];
    const userRes = await query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
    const user = userRes.rows[0] || req.user;

    const token = generateToken(user, mem.organization_id, mem.organization_name, mem.role_name, mem.employee_id);

    return res.json({
      message: `Switched context to ${mem.organization_name}`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        organization_id: mem.organization_id,
        organization_name: mem.organization_name,
        role: mem.role_name,
        employee_id: mem.employee_id
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to switch organization.' });
  }
});

// GET /api/organizations/audit-logs - CEO and HR view organization audit logs
router.get('/audit-logs', authenticateToken, requireRole('CEO', 'HR'), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM audit_logs WHERE organization_id = $1 ORDER BY timestamp DESC LIMIT 50`,
      [req.user.organization_id]
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

export default router;
