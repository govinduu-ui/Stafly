import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, enforceTenantIsolation, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(enforceTenantIsolation);

// GET /api/departments
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const result = await query(`SELECT * FROM departments WHERE organization_id = $1 ORDER BY id ASC`, [orgId]);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch departments.' });
  }
});

// POST /api/departments
router.post('/', requireRole('CEO', 'HR'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { name, code, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required.' });

    const result = await query(
      `INSERT INTO departments (organization_id, name, code, description) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (organization_id, name) DO UPDATE SET code = EXCLUDED.code
       RETURNING *`,
      [orgId, name, code || name.substring(0, 3).toUpperCase(), description || `${name} Department`]
    );

    if (req.logAudit) {
      await req.logAudit('CREATE_DEPARTMENT', 'Departments', `Created department ${name}`);
    }

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create department.' });
  }
});

export default router;
