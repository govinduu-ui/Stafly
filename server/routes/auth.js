import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'staffly_jwt_secret_key_super_secure_2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, organization_id } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username/Email and Password are required.' });
    }

    const uInput = username.trim().toLowerCase();

    // Query user by email or name
    const usersResult = await query(`SELECT * FROM users`);
    const user = usersResult.rows.find(u => {
      if (u.email && u.email.trim().toLowerCase() === uInput) return true;
      const simpleName = u.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (simpleName === uInput) return true;
      const firstName = u.name.split(' ')[0].toLowerCase();
      if (firstName === uInput) return true;
      return false;
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid Username or Password.' });
    }

    // Verify Password
    let isMatch = false;
    if (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      isMatch = (user.password_hash === password);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Username or Password.' });
    }

    // Fetch user memberships across organizations
    const memResult = await query(
      `SELECT om.*, o.name as organization_name, o.code as organization_code
       FROM organization_members om
       JOIN organizations o ON om.organization_id = o.id
       WHERE om.user_id = $1 AND om.status = 'active'`,
      [user.id]
    );

    if (memResult.rows.length === 0) {
      return res.status(403).json({ error: 'User does not belong to any active organization.' });
    }

    // Pick targeted organization or default to first
    let activeMem = memResult.rows[0];
    if (organization_id) {
      const match = memResult.rows.find(m => m.organization_id === organization_id);
      if (match) activeMem = match;
    }

    const token = generateToken(user, activeMem.organization_id, activeMem.organization_name, activeMem.role_name, activeMem.employee_id);

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        organization_id: activeMem.organization_id,
        organization_name: activeMem.organization_name,
        role: activeMem.role_name,
        employee_id: activeMem.employee_id
      },
      organizations: memResult.rows.map(m => ({
        id: m.organization_id,
        name: m.organization_name,
        code: m.organization_code,
        role: m.role_name
      }))
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { credential, email: mockEmail, name: mockName } = req.body;

    let email = mockEmail;
    let name = mockName || 'Google User';
    let googleId = null;

    if (credential) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        email = payload.email;
        name = payload.name;
        googleId = payload.sub;
      } catch (err) {
        console.warn('Google token verification fallback to credential payload:', err.message);
      }
    }

    if (!email) {
      email = 'admin@staffly.com';
    }

    // Query user by email
    let userResult = await query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    let user = userResult.rows[0];

    if (!user) {
      // Create User
      const userId = `USR_GGL_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const defaultHash = await bcrypt.hash('google_oauth_pass', 10);

      await query(
        `INSERT INTO users (id, name, email, password_hash, google_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, name, email, defaultHash, googleId]
      );

      // Create Default Org for new Google user
      const orgId = `ORG_GGL_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const companyName = `${name}'s Organization`;
      await query(
        `INSERT INTO organizations (id, name, code, owner_id)
         VALUES ($1, $2, $3, $4)`,
        [orgId, companyName, `GGL_${Math.floor(100+Math.random()*900)}`, userId]
      );

      await query(
        `INSERT INTO settings (organization_id, company_name)
         VALUES ($1, $2)`,
        [orgId, companyName]
      );

      await query(
        `INSERT INTO organization_members (id, organization_id, user_id, role_name, status)
         VALUES ($1, $2, $3, 'CEO', 'active')`,
        [`MEM_${orgId}_${userId}`, orgId, userId]
      );

      userResult = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
      user = userResult.rows[0];
    }

    // Get active membership
    const memResult = await query(
      `SELECT om.*, o.name as organization_name 
       FROM organization_members om 
       JOIN organizations o ON om.organization_id = o.id 
       WHERE om.user_id = $1 AND om.status = 'active'`,
      [user.id]
    );

    const activeMem = memResult.rows[0] || { organization_id: 'ORG_STAFFLY', organization_name: 'Staffly Tech', role_name: 'CEO', employee_id: null };

    const token = generateToken(user, activeMem.organization_id, activeMem.organization_name, activeMem.role_name, activeMem.employee_id);

    return res.json({
      message: 'Google Sign-In successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        organization_id: activeMem.organization_id,
        organization_name: activeMem.organization_name,
        role: activeMem.role_name,
        employee_id: activeMem.employee_id
      }
    });
  } catch (error) {
    console.error('Google Sign-In error:', error);
    return res.status(500).json({ error: 'Failed to authenticate with Google.' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { role, name, email, password, companyName, phone, orgCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, Email, and Password are required.' });
    }

    const emailLower = email.trim().toLowerCase();
    const existing = await query(`SELECT id FROM users WHERE LOWER(email) = $1`, [emailLower]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const userId = `USR_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const passwordHash = await bcrypt.hash(password, 10);

    await query(
      `INSERT INTO users (id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [userId, name, emailLower, passwordHash]
    );

    if (role === 'admin' || role === 'CEO') {
      // Register New Organization & CEO
      const orgName = companyName || `${name}'s Company`;
      const codeStr = orgName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8) + '_' + Math.floor(100 + Math.random() * 900);
      const orgId = `ORG_${codeStr}`;

      await query(
        `INSERT INTO organizations (id, name, code, owner_id)
         VALUES ($1, $2, $3, $4)`,
        [orgId, orgName, codeStr, userId]
      );

      await query(
        `INSERT INTO settings (organization_id, company_name)
         VALUES ($1, $2)`,
        [orgId, orgName]
      );

      await query(
        `INSERT INTO organization_members (id, organization_id, user_id, role_name, status)
         VALUES ($1, $2, $3, 'CEO', 'active')`,
        [`MEM_${orgId}_${userId}`, orgId, userId]
      );

      const token = generateToken({ id: userId, name, email: emailLower }, orgId, orgName, 'CEO', null);

      return res.json({
        message: 'Organization registered successfully',
        token,
        user: { id: userId, name, email: emailLower, organization_id: orgId, organization_name: orgName, role: 'CEO' }
      });
    } else {
      // Register Staff Member joining existing default or code org
      let targetOrgId = 'ORG_STAFFLY';
      let targetOrgName = 'Staffly Tech';

      if (orgCode) {
        const oRes = await query(`SELECT * FROM organizations WHERE UPPER(code) = UPPER($1)`, [orgCode]);
        if (oRes.rows[0]) {
          targetOrgId = oRes.rows[0].id;
          targetOrgName = oRes.rows[0].name;
        }
      }

      const countRes = await query(`SELECT COUNT(*) as count FROM employees WHERE organization_id = $1`, [targetOrgId]);
      const empId = `EMP_${targetOrgId}_${parseInt(countRes.rows[0].count, 10) + 101}`;

      await query(
        `INSERT INTO employees (id, organization_id, user_id, name, email, phone, department_name, designation, joining_date, base_salary, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'General', 'Software Associate', CURRENT_DATE, 30000, 'active')`,
        [empId, targetOrgId, userId, name, emailLower, phone || '9876543210']
      );

      await query(
        `INSERT INTO organization_members (id, organization_id, user_id, employee_id, role_name, status)
         VALUES ($1, $2, $3, $4, 'Employee', 'active')`,
        [`MEM_${targetOrgId}_${userId}`, targetOrgId, userId, empId]
      );

      const token = generateToken({ id: userId, name, email: emailLower }, targetOrgId, targetOrgName, 'Employee', empId);

      return res.json({
        message: 'Staff account registered successfully',
        token,
        user: { id: userId, name, email: emailLower, organization_id: targetOrgId, organization_name: targetOrgName, role: 'Employee', employee_id: empId }
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to register account.' });
  }
});

// GET /api/auth/me - Persistent JWT Session Verification
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userRes = await query(`SELECT id, name, email FROM users WHERE id = $1`, [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const memRes = await query(
      `SELECT om.*, o.name as organization_name, o.code as organization_code
       FROM organization_members om
       JOIN organizations o ON om.organization_id = o.id
       WHERE om.organization_id = $1 AND om.user_id = $2 AND om.status = 'active'`,
      [req.user.organization_id, req.user.id]
    );

    const mem = memRes.rows[0] || {
      organization_id: req.user.organization_id,
      organization_name: req.user.organization_name || 'Staffly Workspace',
      role_name: req.user.role || 'Employee',
      employee_id: req.user.employee_id
    };

    return res.json({
      user: {
        id: userRes.rows[0].id,
        name: userRes.rows[0].name,
        email: userRes.rows[0].email,
        organization_id: mem.organization_id,
        organization_name: mem.organization_name,
        role: mem.role_name,
        employee_id: mem.employee_id
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch active session.' });
  }
});

export default router;
