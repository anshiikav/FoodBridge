import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'foodbridge-dev-secret-key-2024';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found. Please log in again.' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
};

export const requireRole = (...allowedRoles: Array<'restaurant' | 'ngo' | 'admin'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. This action is restricted to ${allowedRoles.join(' or ')} accounts.`,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware: requireVerified
 * Enforces organization verification by an administrator.
 * Only verified organizations that are not suspended can publish, edit, or accept donations.
 */
export const requireVerified = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    return;
  }

  // Administrators have full access
  if (req.user.role === 'admin') {
    return next();
  }

  // Check if organization is suspended
  if (req.user.status === 'suspended') {
    res.status(403).json({
      success: false,
      code: 'ACCOUNT_SUSPENDED',
      message: 'Your organization account is suspended. You cannot participate in food donations.',
    });
    return;
  }

  const vStatus = req.user.verificationStatus || (req.user.status === 'verified' ? 'verified' : (req.user.status === 'rejected' ? 'rejected' : 'pending'));

  if (vStatus === 'pending') {
    res.status(403).json({
      success: false,
      code: 'VERIFICATION_PENDING',
      message: 'Your organization is awaiting verification. You will be able to participate in food donations once your account has been approved.',
    });
    return;
  }

  if (vStatus === 'rejected') {
    const reasonText = req.user.rejectionReason ? ` Reason: ${req.user.rejectionReason}` : '';
    res.status(403).json({
      success: false,
      code: 'VERIFICATION_REJECTED',
      message: `Your organization verification was rejected.${reasonText} Please contact an administrator.`,
      rejectionReason: req.user.rejectionReason,
    });
    return;
  }

  if (vStatus !== 'verified') {
    res.status(403).json({
      success: false,
      code: 'NOT_VERIFIED',
      message: 'Organization verification required before participating in food donations.',
    });
    return;
  }

  next();
};
