import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import { success, error } from '../utils/reponse.js';

// ... (register and verifyEmail implementations remain the same) ...

export const login = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (!email || !password) {
    return error(res, 'Email and password are required', 400);
  }

  try {
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      await logLoginAttempt(null, email, ip, userAgent, 'failure', 'User not found');
      return error(res, 'Invalid credentials', 401);
    }

    const user = userResult.rows[0];

    // Status Check
    if (user.status === 'banned') {
      await logLoginAttempt(user.id, email, ip, userAgent, 'failure', 'User banned');
      return error(res, 'Your account has been banned. Please contact support.', 403);
    }

    if (user.status === 'locked') {
      await logLoginAttempt(user.id, email, ip, userAgent, 'failure', 'User locked');
      return error(res, 'Your account is locked due to suspicious activity.', 403);
    }

    if (!user.is_verified) {
      return error(res, 'Please verify your email before logging in.', 403);
    }

    // Password Check
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await logLoginAttempt(user.id, email, ip, userAgent, 'failure', 'Incorrect password');
      return error(res, 'Invalid credentials', 401);
    }

    // Success
    await logLoginAttempt(user.id, email, ip, userAgent, 'success', null);
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '1d' }
    );

    // Remove sensitive data
    delete user.password;
    delete user.verification_token;
    delete user.reset_password_token;

    return success(res, 'Login successful', { user, token });
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Server error during login', 500);
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) return error(res, 'Email is required', 400);

  try {
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      // Return success even if user not found to prevent enumeration
      return success(res, 'If an account exists, a reset code has been sent.', null, 200);
    }

    const user = userResult.rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await query(
      'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
      [otp, expiry, user.id]
    );

    await sendPasswordResetEmail(email, otp);

    return success(res, 'If an account exists, a reset code has been sent.', null, 200);
  } catch (err) {
    console.error('Forgot password error:', err);
    return error(res, 'Server error', 500);
  }
};

export const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return error(res, 'Email, code, and new password are required', 400);
  }

  if (newPassword.length < 6) {
    return error(res, 'Password must be at least 6 characters long', 400);
  }

  try {
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return error(res, 'Invalid request', 400);

    const user = userResult.rows[0];

    if (
      user.reset_password_token !== code ||
      new Date() > new Date(user.reset_password_expires)
    ) {
      return error(res, 'Invalid or expired reset code', 400);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await query(
      'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );

    return success(res, 'Password reset successful. You can now login.', null, 200);
  } catch (err) {
    console.error('Reset password error:', err);
    return error(res, 'Server error', 500);
  }
};

// Helper function for logging
const logLoginAttempt = async (userId, email, ip, userAgent, status, reason) => {
  try {
    await query(
      `INSERT INTO login_logs (user_id, email, ip_address, user_agent, status, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, email, ip, userAgent, status, reason]
    );
  } catch (err) {
    console.error('Error logging login attempt:', err);
  }
};

export const register = async (req, res) => {
  const { firstName, lastName, email, phone, password, accountType, countryCode } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !phone || !countryCode || !password || !accountType) {
    return error(res, 'All fields are required', 400);
  }

  // ... regex checks ...

  try {
    // 1. Check if user exists
    const userCheck = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return error(res, 'User already exists', 409);
    }

    // 2. Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    
    // Default country code if not provided
    const dialCode = countryCode || '+234';

    // 4. Insert user
    const newUser = await query(
      `INSERT INTO users (first_name, last_name, email, phone, country_dial_code, password, account_type, verification_token, verification_token_expires, last_otp_sent_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id, email`,
      [firstName, lastName, email, phone, dialCode, hashedPassword, accountType, otp, expiry]
    );

    // 5. Send verification email with OTP
    await sendVerificationEmail(email, otp);

    return success(res, 'User registered successfully. Please check your email for the verification code.', { user: newUser.rows[0] }, 201);
  } catch (err) {
    console.error('Registration error:', err);
    return error(res, 'Server error during registration', 500);
  }
};

export const verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return error(res, 'Email and verification code are required', 400);
  }

  try {
    const user = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (user.rows.length === 0) {
      return error(res, 'User not found', 404);
    }

    if (user.rows[0].is_verified) {
      return error(res, 'Email is already verified', 400);
    }

    if (user.rows[0].verification_token !== code) {
      return error(res, 'Invalid verification code', 400);
    }

    if (new Date() > new Date(user.rows[0].verification_token_expires)) {
      return error(res, 'Verification code has expired. Please request a new one.', 400);
    }

    await query(
      'UPDATE users SET is_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = $1',
      [user.rows[0].id]
    );

    return success(res, 'Email verified successfully. You can now login.', null, 200);
  } catch (err) {
    console.error('Verification error:', err);
    return error(res, 'Server error during verification', 500);
  }
};

export const resendVerificationCode = async (req, res) => {
  const { email } = req.body;

  if (!email) return error(res, 'Email is required', 400);

  try {
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
       return error(res, 'User not found', 404);
    }

    const user = userResult.rows[0];

    if (user.is_verified) {
      return error(res, 'Email is already verified', 400);
    }

    // Rate Limiting (1 minute)
    if (user.last_otp_sent_at) {
      const lastSent = new Date(user.last_otp_sent_at);
      const now = new Date();
      const diff = (now - lastSent) / 1000; // seconds

      if (diff < 60) {
        return error(res, `Please wait ${Math.ceil(60 - diff)} seconds before requesting a new code.`, 429);
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2, last_otp_sent_at = NOW() WHERE id = $3',
      [otp, expiry, user.id]
    );

    await sendVerificationEmail(email, otp);

    return success(res, 'Verification code resent successfully.', null, 200);
  } catch (err) {
    console.error('Resend error:', err);
    return error(res, 'Server error', 500);
  }
};
