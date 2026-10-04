import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, enforceTenantIsolation } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(enforceTenantIsolation);

// GET /api/attendance
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { employee_id, month, date } = req.query;
    const userRole = req.user.normalizedRole;

    let sql = `SELECT a.*, e.name as employee_name, e.department_name as department 
               FROM attendance a 
               LEFT JOIN employees e ON a.employee_id = e.id AND a.organization_id = e.organization_id
               WHERE a.organization_id = $1`;
    const params = [orgId];

    if (userRole === 'Employee') {
      params.push(req.user.employee_id);
      sql += ` AND a.employee_id = $${params.length}`;
    } else if (employee_id) {
      params.push(employee_id);
      sql += ` AND a.employee_id = $${params.length}`;
    }

    if (date) {
      params.push(date);
      sql += ` AND a.date = $${params.length}`;
    } else if (month) {
      params.push(`${month}%`);
      sql += ` AND a.date::text LIKE $${params.length}`;
    }

    sql += ` ORDER BY a.date DESC, a.employee_id ASC`;

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return res.status(500).json({ error: 'Failed to fetch attendance records.' });
  }
});

// POST /api/attendance - Mark or update attendance record
router.post('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { employee_id, date, status, check_in, check_out, note } = req.body;
    const userRole = req.user.normalizedRole;

    const targetEmpId = employee_id || req.user.employee_id;

    if (userRole === 'Employee' && targetEmpId !== req.user.employee_id) {
      return res.status(403).json({ error: 'Access Denied: You can only record attendance for yourself.' });
    }

    if (!targetEmpId || !date || !status) {
      return res.status(400).json({ error: 'Employee ID, date, and status are required.' });
    }

    const attId = `ATT_${orgId}_${targetEmpId}_${date}`;
    const checkInTime = check_in || (status === 'P' ? '09:00:00' : null);
    const checkOutTime = check_out || (status === 'P' ? '17:00:00' : null);

    await query(
      `INSERT INTO attendance (id, organization_id, employee_id, date, status, check_in, check_out, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (organization_id, employee_id, date) DO UPDATE SET 
       status = EXCLUDED.status, check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out, note = EXCLUDED.note`,
      [attId, orgId, targetEmpId, date, status, checkInTime, checkOutTime, note || '']
    );

    const updatedRecord = (await query(`SELECT * FROM attendance WHERE organization_id = $1 AND id = $2`, [orgId, attId])).rows[0];

    return res.status(200).json({ message: 'Attendance recorded successfully', record: updatedRecord });
  } catch (error) {
    console.error('Error saving attendance:', error);
    return res.status(500).json({ error: 'Failed to save attendance record.' });
  }
});

// GET /api/attendance/stats - Get monthly summary for employee
router.get('/stats', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const targetEmpId = req.query.employee_id || req.user.employee_id;
    const month = req.query.month || '2026-08';

    const userRole = req.user.normalizedRole;
    if (userRole === 'Employee' && targetEmpId !== req.user.employee_id) {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const result = await query(
      `SELECT status, COUNT(*) as count 
       FROM attendance 
       WHERE organization_id = $1 AND employee_id = $2 AND date::text LIKE $3 
       GROUP BY status`,
      [orgId, targetEmpId, `${month}%`]
    );

    const counts = { P: 0, L: 0, A: 0, H: 0 };
    result.rows.forEach(r => {
      counts[r.status] = parseInt(r.count, 10);
    });

    const totalDays = 27;
    const workedDays = counts.P + (counts.H * 0.5);

    return res.json({
      employee_id: targetEmpId,
      month,
      present: counts.P,
      leave: counts.L,
      absent: counts.A,
      half_day: counts.H,
      worked_days: workedDays,
      attendance_percentage: Math.round((workedDays / Math.max(totalDays, 1)) * 100)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to calculate attendance stats.' });
  }
});

export default router;
