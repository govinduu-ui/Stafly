import express from 'express';
import { query } from '../db/index.js';
import { authenticateToken, enforceTenantIsolation, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(enforceTenantIsolation);

// --- SALARY ADVANCES ---

// GET /api/finance/advances
router.get('/advances', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const userRole = req.user.normalizedRole;
    let sql = `SELECT a.*, e.name as employee_name, e.department_name as department 
               FROM advances a 
               LEFT JOIN employees e ON a.employee_id = e.id AND a.organization_id = e.organization_id
               WHERE a.organization_id = $1`;
    const params = [orgId];

    if (userRole === 'Employee') {
      params.push(req.user.employee_id);
      sql += ` AND a.employee_id = $2`;
    }

    sql += ` ORDER BY a.created_at DESC`;
    const result = await query(sql, params);
    return res.json(result.rows.map(row => {
      const amt = parseFloat(row.amount) || 0;
      const repMonths = Math.max(parseInt(row.repayment_months, 10) || 1, 1);
      return {
        ...row,
        amount: amt,
        repayment_months: repMonths,
        monthly_repayment: Math.round(amt / repMonths),
        remaining_amount: parseFloat(row.remaining_amount ?? amt)
      };
    }));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch advances.' });
  }
});

// POST /api/finance/advances
router.post('/advances', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { amount, repayment_months, reason, employee_id } = req.body;
    const targetEmpId = employee_id || req.user.employee_id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid advance amount is required.' });
    }

    const advId = `ADV_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await query(
      `INSERT INTO advances (id, organization_id, employee_id, amount, repayment_months, reason, status, requested_date)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_DATE)`,
      [advId, orgId, targetEmpId, amount, repayment_months || 1, reason || '']
    );

    if (req.logAudit) {
      await req.logAudit('REQUEST_ADVANCE', 'Advances', `Requested salary advance of ${amount}`);
    }

    const newAdv = (await query(`SELECT * FROM advances WHERE organization_id = $1 AND id = $2`, [orgId, advId])).rows[0];
    newAdv.amount = parseFloat(newAdv.amount);

    return res.status(201).json(newAdv);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to submit advance request.' });
  }
});

// PUT /api/finance/advances/:id/status - Approve or reject advance (CEO and Finance)
router.put('/advances/:id/status', requireRole('CEO', 'Finance'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { status } = req.body;
    const advId = req.params.id;

    await query(`UPDATE advances SET status = $1 WHERE organization_id = $2 AND id = $3`, [status, orgId, advId]);
    const updated = (await query(`SELECT * FROM advances WHERE organization_id = $1 AND id = $2`, [orgId, advId])).rows[0];
    updated.amount = parseFloat(updated.amount);

    if (req.logAudit) {
      await req.logAudit('REVIEW_ADVANCE', 'Advances', `Marked advance ${advId} as ${status}`);
    }

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update advance status.' });
  }
});

// --- OVERTIME ---

// GET /api/finance/overtime
router.get('/overtime', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const userRole = req.user.normalizedRole;
    let sql = `SELECT o.*, e.name as employee_name, e.department_name as department 
               FROM overtime o 
               LEFT JOIN employees e ON o.employee_id = e.id AND o.organization_id = e.organization_id
               WHERE o.organization_id = $1`;
    const params = [orgId];

    if (userRole === 'Employee') {
      params.push(req.user.employee_id);
      sql += ` AND o.employee_id = $2`;
    }

    sql += ` ORDER BY o.created_at DESC`;
    const result = await query(sql, params);
    return res.json(result.rows.map(row => ({
      ...row,
      hours: parseFloat(row.hours),
      rate: parseFloat(row.rate)
    })));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch overtime records.' });
  }
});

// POST /api/finance/overtime
router.post('/overtime', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { date, hours, rate, reason, employee_id, status } = req.body;
    const targetEmpId = employee_id || req.user.employee_id;
    const userRole = req.user.normalizedRole;

    if (!date || !hours) {
      return res.status(400).json({ error: 'Date and hours are required for overtime.' });
    }

    const otId = `OT_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const initialStatus = (userRole === 'CEO' || userRole === 'Finance') ? (status || 'approved') : 'pending';

    await query(
      `INSERT INTO overtime (id, organization_id, employee_id, date, hours, rate, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [otId, orgId, targetEmpId, date, hours, rate || 150, reason || '', initialStatus]
    );

    const newOt = (await query(`SELECT * FROM overtime WHERE organization_id = $1 AND id = $2`, [orgId, otId])).rows[0];
    newOt.hours = parseFloat(newOt.hours);
    newOt.rate = parseFloat(newOt.rate);

    return res.status(201).json(newOt);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to record overtime.' });
  }
});

// PUT /api/finance/overtime/:id/status - Approve or reject overtime
router.put('/overtime/:id/status', requireRole('CEO', 'HR', 'Finance'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { status } = req.body;
    const otId = req.params.id;

    await query(`UPDATE overtime SET status = $1 WHERE organization_id = $2 AND id = $3`, [status, orgId, otId]);
    const updated = (await query(`SELECT * FROM overtime WHERE organization_id = $1 AND id = $2`, [orgId, otId])).rows[0];

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update overtime status.' });
  }
});

// --- BONUSES ---

// GET /api/finance/bonuses
router.get('/bonuses', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const userRole = req.user.normalizedRole;
    let sql = `SELECT b.*, e.name as employee_name, e.department_name as department 
               FROM bonuses b 
               LEFT JOIN employees e ON b.employee_id = e.id AND b.organization_id = e.organization_id
               WHERE b.organization_id = $1`;
    const params = [orgId];

    if (userRole === 'Employee') {
      params.push(req.user.employee_id);
      sql += ` AND b.employee_id = $2`;
    }

    sql += ` ORDER BY b.created_at DESC`;
    const result = await query(sql, params);
    return res.json(result.rows.map(row => ({ ...row, amount: parseFloat(row.amount) })));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch bonuses.' });
  }
});

// POST /api/finance/bonuses - CEO & Finance grant bonus
router.post('/bonuses', requireRole('CEO', 'Finance'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { employee_id, amount, month, type, reason } = req.body;

    if (!employee_id || !amount) {
      return res.status(400).json({ error: 'Employee ID and bonus amount are required.' });
    }

    const bonusId = `BON_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await query(
      `INSERT INTO bonuses (id, organization_id, employee_id, amount, month, type, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved')`,
      [bonusId, orgId, employee_id, amount, month || '2026-08', type || 'Performance', reason || '']
    );

    if (req.logAudit) {
      await req.logAudit('GRANT_BONUS', 'Bonuses', `Granted bonus of ${amount} to ${employee_id}`);
    }

    const newBonus = (await query(`SELECT * FROM bonuses WHERE organization_id = $1 AND id = $2`, [orgId, bonusId])).rows[0];
    newBonus.amount = parseFloat(newBonus.amount);

    return res.status(201).json(newBonus);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to grant bonus.' });
  }
});

// --- PAYROLL CALCULATION & PROCESSING ---

// GET /api/finance/payroll - Generate & fetch payroll sheet
router.get('/payroll', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const month = req.query.month || '2026-08';
    const userRole = req.user.normalizedRole;

    let employeesSql = `SELECT * FROM employees WHERE organization_id = $1 AND status = 'active'`;
    const empParams = [orgId];

    if (userRole === 'Employee') {
      empParams.push(req.user.employee_id);
      employeesSql += ` AND id = $2`;
    }

    const employees = (await query(employeesSql, empParams)).rows;
    const payrollSheet = [];

    for (const emp of employees) {
      // 1. Attendance Stats
      const attRes = await query(
        `SELECT status, COUNT(*) as count FROM attendance 
         WHERE organization_id = $1 AND employee_id = $2 AND date::text LIKE $3 
         GROUP BY status`,
        [orgId, emp.id, `${month}%`]
      );
      const attMap = { P: 0, L: 0, A: 0, H: 0 };
      attRes.rows.forEach(r => { attMap[r.status] = parseInt(r.count, 10); });

      const workedDays = attMap.P + (attMap.H * 0.5);
      const baseSalary = parseFloat(emp.base_salary || 0);
      const perDaySalary = baseSalary / 30;
      const earnedBase = Math.round(workedDays * perDaySalary);

      // 2. Overtime
      const otRes = await query(
        `SELECT SUM(hours) as total_hours, SUM(hours * rate) as total_pay 
         FROM overtime 
         WHERE organization_id = $1 AND employee_id = $2 AND status = 'approved'`,
        [orgId, emp.id]
      );
      const otHours = parseFloat(otRes.rows[0].total_hours || 0);
      const otPay = parseFloat(otRes.rows[0].total_pay || 0);

      // 3. Bonuses
      const bonRes = await query(
        `SELECT SUM(amount) as total_bonus 
         FROM bonuses 
         WHERE organization_id = $1 AND employee_id = $2 AND month = $3 AND status = 'approved'`,
        [orgId, emp.id, month]
      );
      const totalBonuses = parseFloat(bonRes.rows[0].total_bonus || 0);

      // 4. Advances Deduction
      const advRes = await query(
        `SELECT SUM(amount / GREATEST(repayment_months, 1)) as deduction 
         FROM advances 
         WHERE organization_id = $1 AND employee_id = $2 AND status = 'approved'`,
        [orgId, emp.id]
      );
      const advanceDeduction = Math.round(parseFloat(advRes.rows[0].deduction || 0));

      const grossSalary = earnedBase + otPay + totalBonuses;
      const netSalary = Math.max(0, grossSalary - advanceDeduction);

      const payRecordRes = await query(
        `SELECT * FROM payrolls WHERE organization_id = $1 AND employee_id = $2 AND month = $3`,
        [orgId, emp.id, month]
      );
      const status = payRecordRes.rows[0] ? payRecordRes.rows[0].status : 'unpaid';

      payrollSheet.push({
        id: `PAY_${orgId}_${emp.id}_${month}`,
        employee_id: emp.id,
        employee_name: emp.name,
        department: emp.department_name || emp.department || 'IT',
        designation: emp.designation,
        month,
        base_salary: baseSalary,
        worked_days: workedDays,
        present_days: attMap.P,
        leave_days: attMap.L,
        absent_days: attMap.A,
        half_days: attMap.H,
        earned_base: earnedBase,
        overtime_hours: otHours,
        overtime_pay: otPay,
        bonuses: totalBonuses,
        advance_deduction: advanceDeduction,
        net_salary: netSalary,
        status,
        payment_date: payRecordRes.rows[0] ? payRecordRes.rows[0].payment_date : null
      });
    }

    return res.json(payrollSheet);
  } catch (error) {
    console.error('Error generating payroll sheet:', error);
    return res.status(500).json({ error: 'Failed to generate payroll sheet.' });
  }
});

// POST /api/finance/payroll/pay - Process salary payment (CEO and Finance)
router.post('/payroll/pay', requireRole('CEO', 'Finance'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { employee_id, month } = req.body;
    const targetMonth = month || '2026-08';

    if (employee_id && employee_id !== 'ALL') {
      const payId = `PAY_${orgId}_${employee_id}_${targetMonth}`;
      await query(
        `INSERT INTO payrolls (id, organization_id, employee_id, month, status, payment_date)
         VALUES ($1, $2, $3, $4, 'paid', CURRENT_TIMESTAMP)
         ON CONFLICT (organization_id, employee_id, month) DO UPDATE SET status = 'paid', payment_date = CURRENT_TIMESTAMP`,
        [payId, orgId, employee_id, targetMonth]
      );
      if (req.logAudit) {
        await req.logAudit('PAY_SALARY', 'Payroll', `Paid salary for employee ${employee_id} (${targetMonth})`);
      }
      return res.json({ message: `Salary paid successfully for employee ${employee_id}.` });
    } else {
      const emps = (await query(`SELECT id FROM employees WHERE organization_id = $1 AND status = 'active'`, [orgId])).rows;
      for (const e of emps) {
        const payId = `PAY_${orgId}_${e.id}_${targetMonth}`;
        await query(
          `INSERT INTO payrolls (id, organization_id, employee_id, month, status, payment_date)
           VALUES ($1, $2, $3, $4, 'paid', CURRENT_TIMESTAMP)
           ON CONFLICT (organization_id, employee_id, month) DO UPDATE SET status = 'paid', payment_date = CURRENT_TIMESTAMP`,
          [payId, orgId, e.id, targetMonth]
        );
      }
      if (req.logAudit) {
        await req.logAudit('PAY_ALL_SALARIES', 'Payroll', `Processed batch salary payout for all employees (${targetMonth})`);
      }
      return res.json({ message: `All active employee salaries paid for ${targetMonth}.` });
    }
  } catch (error) {
    console.error('Error processing salary payment:', error);
    return res.status(500).json({ error: 'Failed to process salary payment.' });
  }
});

export default router;
