import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, enforceTenantIsolation, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(enforceTenantIsolation);

// GET /api/leaves
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const userRole = req.user.normalizedRole;
    let sql = `SELECT l.*, e.name as employee_name, e.department_name as department 
               FROM leaves l 
               LEFT JOIN employees e ON l.employee_id = e.id AND l.organization_id = e.organization_id
               WHERE l.organization_id = $1`;
    const params = [orgId];

    if (userRole === 'Employee') {
      params.push(req.user.employee_id);
      sql += ` AND l.employee_id = $2`;
    }

    sql += ` ORDER BY l.created_at DESC`;

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    return res.status(500).json({ error: 'Failed to fetch leave requests.' });
  }
});

// POST /api/leaves - Apply for leave
router.post('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { type, start_date, end_date, duration_type, reason, employee_id } = req.body;
    const targetEmpId = employee_id || req.user.employee_id;

    if (!type || !start_date || !end_date) {
      return res.status(400).json({ error: 'Leave type, start date, and end date are required.' });
    }

    const leaveId = `LV_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await query(
      `INSERT INTO leaves (id, organization_id, employee_id, type, start_date, end_date, duration_type, reason, status, applied_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', CURRENT_DATE)`,
      [leaveId, orgId, targetEmpId, type, start_date, end_date, duration_type || 'full', reason || '']
    );

    if (req.logAudit) {
      await req.logAudit('APPLY_LEAVE', 'Leaves', `Applied for ${type} leave from ${start_date} to ${end_date}`);
    }

    const newLeave = (await query(`SELECT * FROM leaves WHERE organization_id = $1 AND id = $2`, [orgId, leaveId])).rows[0];

    return res.status(201).json(newLeave);
  } catch (error) {
    console.error('Error submitting leave:', error);
    return res.status(500).json({ error: 'Failed to submit leave request.' });
  }
});

// PUT /api/leaves/:id/status - Approve or reject leave (CEO and HR)
router.put('/:id/status', requireRole('CEO', 'HR'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { status, review_comment } = req.body;
    const leaveId = req.params.id;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid leave status.' });
    }

    await query(
      `UPDATE leaves 
       SET status = $1, reviewed_by = $2, review_comment = $3 
       WHERE organization_id = $4 AND id = $5`,
      [status, req.user.name, review_comment || '', orgId, leaveId]
    );

    const updatedLeave = (await query(`SELECT * FROM leaves WHERE organization_id = $1 AND id = $2`, [orgId, leaveId])).rows[0];

    if (updatedLeave) {
      const notifText = `Your leave request from ${updatedLeave.start_date} to ${updatedLeave.end_date} has been ${status}.`;
      await query(
        `INSERT INTO notifications (id, organization_id, employee_id, text, read) 
         VALUES ($1, $2, $3, $4, false)`,
        [`NT_${Date.now()}`, orgId, updatedLeave.employee_id, notifText]
      );
    }

    if (req.logAudit) {
      await req.logAudit('REVIEW_LEAVE', 'Leaves', `Marked leave ${leaveId} as ${status}`);
    }

    return res.json(updatedLeave);
  } catch (error) {
    console.error('Error updating leave status:', error);
    return res.status(500).json({ error: 'Failed to update leave status.' });
  }
});

export default router;
