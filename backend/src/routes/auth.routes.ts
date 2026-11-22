import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'foodbridge-dev-secret-key-2024';

// Helper to sign JWT token
const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '7d' });
};

/**
 * POST /api/auth/register
 * Registers a new Restaurant or NGO
 */
router.post('/register', async (req, res): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      orgName,
      email,
      password,
      phone,
      address,
      city,
      pincode,
      role,
      restaurantType,
      fssaiLicense,
      avgSurplus,
      ngoRegNumber,
      beneficiaries,
      foodPreferences,
      operatingAreas,
      pickupVehicle,
      preferredPickupTimes,
    } = req.body;

    // Validation
    if (!firstName || !lastName || !orgName || !email || !password || !phone || !address || !city || !pincode) {
      res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(400).json({ success: false, message: 'An account with this email address already exists.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      firstName,
      lastName,
      orgName,
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      address,
      city,
      pincode,
      role: role === 'ngo' ? 'ngo' : 'restaurant',
      status: 'pending',
      verificationStatus: 'pending',
      supportingDocument: (req.body.supportingDocument || req.body.fssaiDoc || req.body.ngoDoc || '').trim(),
      restaurantType,
      fssaiLicense,
      avgSurplus,
      ngoRegNumber,
      beneficiaries: Number(beneficiaries) || 0,
      foodPreferences: Array.isArray(foodPreferences) ? foodPreferences : [foodPreferences].filter(Boolean),
      operatingAreas,
      pickupVehicle: pickupVehicle === 'yes' ? 'yes' : 'no',
      preferredPickupTimes,
    });

    const token = generateToken(user._id.toString(), user.role);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error during registration.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user credentials and issues a JWT token
 */
router.post('/login', async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide both email and password.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ success: false, message: 'Your account is currently suspended. Please contact support.' });
      return;
    }

    const token = generateToken(user._id.toString(), user.role);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

/**
 * GET /api/auth/me
 * Gets profile of current authenticated user
 */
router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  res.json({ success: true, user: req.user });
});

/**
 * PUT /api/auth/profile
 * Updates profile details
 */
router.put('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedUpdates = [
      'firstName',
      'lastName',
      'orgName',
      'phone',
      'address',
      'city',
      'pincode',
      'restaurantType',
      'fssaiLicense',
      'avgSurplus',
      'ngoRegNumber',
      'beneficiaries',
      'foodPreferences',
      'operatingAreas',
      'pickupVehicle',
      'preferredPickupTimes',
    ];

    const updates: Record<string, any> = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const user = await User.findByIdAndUpdate(req.user!._id, updates, { new: true });

    res.json({ success: true, message: 'Profile updated successfully!', user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error updating profile.' });
  }
});

export default router;
