import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'staffly_jwt_secret_key_super_secure_2026';

// Normalize role names for consistent checking
export function normalizeRole(role) {
  if (!role) return 'Employee';
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'ceo' || r === 'owner') return 'CEO';
  if (r === 'hr' || r === 'manager') return 'HR';
  if (r === 'finance' || r === 'finance_manager') return 'Finance';
  return 'Employee';
}

// Authenticate JWT Token
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token.' });
    }
    
    req.user = {
      ...user,
      organization_id: user.organization_id || 'ORG_STAFFLY',
      normalizedRole: normalizeRole(user.role)
    };

    // Helper to log audit actions securely
    req.logAudit = async (action, resource, details = '') => {
      try {
        const logId = `AUD_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        await query(
          `INSERT INTO audit_logs (id, organization_id, user_id, user_name, action, resource, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [logId, req.user.organization_id, req.user.id, req.user.name, action, resource, typeof details === 'object' ? JSON.stringify(details) : details]
        );
      } catch (auditErr) {
        console.warn('Audit log write error:', auditErr.message);
      }
    };

    next();
  });
}

// Enforce Organization Tenant Isolation
export function enforceTenantIsolation(req, res, next) {
  if (!req.user || !req.user.organization_id) {
    return res.status(403).json({ error: 'Access Denied: No active organization context found.' });
  }
  next();
}

// Authorize specific roles (CEO, HR, Finance, Employee)
export function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const userRole = req.user.normalizedRole;

    // CEO has access to everything within their organization
    if (userRole === 'CEO') {
      return next();
    }

    if (normalizedAllowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ 
      error: `Access Denied: '${userRole}' role does not have permission to access this resource.` 
    });
  };
}

// Authorize if accessing own record OR having an elevated role
export function requireSelfOrRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const userRole = req.user.normalizedRole;
    const targetEmpId = req.params.employeeId || req.params.id || req.body.employee_id;

    // Allow if acting on own employee record
    if (targetEmpId && req.user.employee_id === targetEmpId) {
      return next();
    }

    // CEO access
    if (userRole === 'CEO') {
      return next();
    }

    if (normalizedAllowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ 
      error: `Access Denied: You cannot modify or access records belonging to another employee.` 
    });
  };
}
