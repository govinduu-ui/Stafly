import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, enforceTenantIsolation } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(enforceTenantIsolation);

// GET /api/tickets
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const userRole = req.user.normalizedRole;
    let sql = `SELECT t.*, e.name as employee_name 
               FROM tickets t 
               LEFT JOIN employees e ON t.employee_id = e.id AND t.organization_id = e.organization_id
               WHERE t.organization_id = $1`;
    const params = [orgId];

    if (userRole === 'Employee') {
      params.push(req.user.employee_id);
      sql += ` AND t.employee_id = $2`;
    }

    sql += ` ORDER BY t.created_at DESC`;
    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch support tickets.' });
  }
});

// POST /api/tickets
router.post('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { subject, category, description, employee_id } = req.body;
    const targetEmpId = employee_id || req.user.employee_id;

    if (!subject) return res.status(400).json({ error: 'Ticket subject is required.' });

    const ticketId = `TCK_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await query(
      `INSERT INTO tickets (id, organization_id, employee_id, subject, category, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
      [ticketId, orgId, targetEmpId, subject, category || 'General', description || '']
    );

    const newTicket = (await query(`SELECT * FROM tickets WHERE organization_id = $1 AND id = $2`, [orgId, ticketId])).rows[0];
    return res.status(201).json(newTicket);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create support ticket.' });
  }
});

// PUT /api/tickets/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { status } = req.body;
    await query(`UPDATE tickets SET status = $1 WHERE organization_id = $2 AND id = $3`, [status, orgId, req.params.id]);
    return res.json({ message: 'Ticket status updated' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update ticket.' });
  }
});

export default router;
