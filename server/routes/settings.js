import express from 'express';
import { query } from '../db/index.js';
import { seed } from '../db/seed.js';
import { authenticateToken, enforceTenantIsolation, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(enforceTenantIsolation);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const result = await query(`SELECT * FROM settings WHERE organization_id = $1`, [orgId]);
    if (result.rows.length === 0) {
      return res.json({ companyName: 'Staffly', currency: '₹', overtimeRate: 150, subscriptionPlan: 'Pro' });
    }
    const row = result.rows[0];
    return res.json({
      companyName: row.company_name,
      currency: row.currency,
      overtimeRate: parseFloat(row.overtime_rate),
      subscriptionPlan: row.subscription_plan
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

// PUT /api/settings - CEO only
router.put('/', requireRole('CEO'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { companyName, currency, overtimeRate, subscriptionPlan } = req.body;

    await query(
      `INSERT INTO settings (organization_id, company_name, currency, overtime_rate, subscription_plan)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id) DO UPDATE SET 
       company_name = EXCLUDED.company_name, currency = EXCLUDED.currency, 
       overtime_rate = EXCLUDED.overtime_rate, subscription_plan = EXCLUDED.subscription_plan`,
      [orgId, companyName || 'Staffly', currency || '₹', overtimeRate || 150, subscriptionPlan || 'Pro']
    );

    // Update organization name in organizations table
    if (companyName) {
      await query(`UPDATE organizations SET name = $1, currency = $2 WHERE id = $3`, [companyName, currency || '₹', orgId]);
    }

    if (req.logAudit) {
      await req.logAudit('UPDATE_SETTINGS', 'Settings', `Updated workspace settings for ${companyName}`);
    }

    return res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// POST /api/settings/reset - CEO only
router.post('/reset', requireRole('CEO'), async (req, res) => {
  try {
    await seed();
    return res.json({ message: 'Workspace database reset to initial multi-tenant state cleanly.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to reset workspace database.' });
  }
});

export default router;
