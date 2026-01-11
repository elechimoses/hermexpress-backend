import jwt from 'jsonwebtoken';
import { error } from '../utils/reponse.js';
import { query } from '../db/index.js';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return error(res, 'No token provided', 401);

  const token = authHeader.split(' ')[1];
  if (!token) return error(res, 'Malformed token', 401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    
    // Check if user exists/active
    const result = await query('SELECT id, email, role, status, account_type FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) return error(res, 'User not found', 401);
    
    const user = result.rows[0];
    if (user.status !== 'active') return error(res, 'User account is not active', 403);
    
    req.user = user;
    next();
  } catch (err) {
    return error(res, 'Invalid token', 401);
  }
};
