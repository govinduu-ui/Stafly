import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, enforceTenantIsolation } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(enforceTenantIsolation);

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const empId = req.query.employee_id || req.user.employee_id;

    const result = await query(
      `SELECT * FROM notifications 
       WHERE organization_id = $1 AND employee_id = $2 
       ORDER BY date DESC LIMIT 20`,
      [orgId, empId]
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// POST /api/notifications/mark-read
router.post('/mark-read', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const empId = req.user.employee_id;
    await query(`UPDATE notifications SET read = true WHERE organization_id = $1 AND employee_id = $2`, [orgId, empId]);
    return res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

export default router;
