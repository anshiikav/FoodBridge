import { Router, Response } from 'express';
import { User } from '../models/User';
import { Donation } from '../models/Donation';
import { Notification } from '../models/Notification';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Protect all admin routes: strictly requires authenticated administrator
router.use(authenticate, requireRole('admin'));

/**
 * GET /api/admin/users or /api/admin/organizations
 * Returns list of registered organizations (restaurants and NGOs) with filter & search
 */
const getOrganizationsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, status, search } = req.query;
    const filter: Record<string, any> = { role: { $ne: 'admin' } };

    if (role && role !== 'all') {
      filter.role = role;
    }

    if (status && status !== 'all') {
      if (status === 'suspended') {
        filter.status = 'suspended';
      } else {
        filter.$or = [
          { verificationStatus: status },
          { status: status }
        ];
      }
    }

    if (search) {
      const q = String(search).trim();
      filter.$and = [
        {
          $or: [
            { orgName: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
            { city: { $regex: q, $options: 'i' } },
            { fssaiLicense: { $regex: q, $options: 'i' } },
            { ngoRegNumber: { $regex: q, $options: 'i' } },
            { firstName: { $regex: q, $options: 'i' } },
            { lastName: { $regex: q, $options: 'i' } },
          ]
        }
      ];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch organizations.' });
  }
};

router.get('/users', getOrganizationsHandler);
router.get('/organizations', getOrganizationsHandler);

/**
 * PUT /api/admin/users/:id/verify
 * Administrator approves or rejects an organization's verification
 */
router.put('/users/:id/verify', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, rejectionReason } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, message: 'Action must be "approve" or "reject".' });
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'Organization not found.' });
      return;
    }

    if (user.role === 'admin') {
      res.status(400).json({ success: false, message: 'Cannot verify administrator accounts.' });
      return;
    }

    if (action === 'approve') {
      user.verificationStatus = 'verified';
      user.status = 'verified';
      user.rejectionReason = undefined;
      await user.save();

      // Create confirmation notification for organization
      await Notification.create({
        recipient: user._id,
        title: 'Organization Verified! 🎉',
        message: 'Congratulations! Your organization has been verified by the administrator. You can now participate in food donations.',
        type: 'general',
      });

      res.json({
        success: true,
        message: `${user.orgName} has been approved and verified successfully.`,
        user,
      });
    } else {
      const reason = (rejectionReason || 'Submitted documentation could not be validated.').trim();
      user.verificationStatus = 'rejected';
      user.status = 'rejected';
      user.rejectionReason = reason;
      await user.save();

      // Create notification with rejection reason
      await Notification.create({
        recipient: user._id,
        title: 'Verification Request Update',
        message: `Your organization verification was not approved. Reason: ${reason}. Please update your credentials or contact administrator.`,
        type: 'general',
      });

      res.json({
        success: true,
        message: `${user.orgName} has been marked as rejected.`,
        user,
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update verification status.' });
  }
});

/**
 * PUT /api/admin/users/:id/suspend
 * Administrator suspends or reactivates an organization
 */
router.put('/users/:id/suspend', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { suspend, reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'Organization not found.' });
      return;
    }

    if (user.role === 'admin') {
      res.status(400).json({ success: false, message: 'Cannot suspend administrator accounts.' });
      return;
    }

    if (suspend === true || suspend === 'true') {
      user.status = 'suspended';
      await user.save();

      await Notification.create({
        recipient: user._id,
        title: 'Account Suspended',
        message: `Your organization account has been suspended by an administrator.${reason ? ' Reason: ' + reason : ''}`,
        type: 'general',
      });

      res.json({ success: true, message: `${user.orgName} has been suspended.`, user });
    } else {
      // Reactivate: restore previous verification status
      user.status = user.verificationStatus === 'verified' ? 'verified' : (user.verificationStatus === 'rejected' ? 'rejected' : 'pending');
      await user.save();

      await Notification.create({
        recipient: user._id,
        title: 'Account Reactivated',
        message: 'Your organization account has been reactivated by the administrator.',
        type: 'general',
      });

      res.json({ success: true, message: `${user.orgName} has been reactivated.`, user });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update suspension status.' });
  }
});

/**
 * PUT /api/admin/users/:id/status
 * Legacy status update endpoint for backward compatibility
 */
router.put('/users/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['verified', 'pending', 'rejected', 'suspended'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status.' });
      return;
    }

    const updates: Record<string, any> = { status };
    if (status === 'verified') {
      updates.verificationStatus = 'verified';
      updates.rejectionReason = '';
    } else if (status === 'rejected') {
      updates.verificationStatus = 'rejected';
      updates.rejectionReason = rejectionReason || 'Verification rejected by administrator.';
    } else if (status === 'pending') {
      updates.verificationStatus = 'pending';
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.json({ success: true, message: `User status updated to ${status}.`, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
});

/**
 * GET /api/admin/stats
 * Overview stats for the admin dashboard
 */
router.get('/stats', async (_req, res): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const totalRestaurants = await User.countDocuments({ role: 'restaurant' });
    const totalNgos = await User.countDocuments({ role: 'ngo' });
    const pendingVerification = await User.countDocuments({
      role: { $ne: 'admin' },
      $or: [{ verificationStatus: 'pending' }, { status: 'pending' }]
    });
    const verifiedOrganizations = await User.countDocuments({
      role: { $ne: 'admin' },
      $or: [{ verificationStatus: 'verified' }, { status: 'verified' }]
    });
    const rejectedOrganizations = await User.countDocuments({
      role: { $ne: 'admin' },
      $or: [{ verificationStatus: 'rejected' }, { status: 'rejected' }]
    });
    const suspendedOrganizations = await User.countDocuments({
      role: { $ne: 'admin' },
      status: 'suspended'
    });
    const totalDonations = await Donation.countDocuments();
    const completedDonations = await Donation.countDocuments({ status: 'completed' });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalRestaurants,
        totalNgos,
        pendingVerification,
        verifiedOrganizations,
        rejectedOrganizations,
        suspendedOrganizations,
        totalDonations,
        completedDonations,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin statistics.' });
  }
});

/**
 * GET /api/admin/reports
 * Returns system reports and donation incidents
 */
router.get('/reports', async (_req, res): Promise<void> => {
  const sampleReports = [
    {
      id: 'REP-101',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      reporter: 'Feeding Hope Foundation',
      type: 'Pickup Delay',
      description: 'Minor 15-minute coordination delay at kitchen loading bay. Resolved amicably.',
      status: 'Resolved',
    },
  ];

  res.json({ success: true, reports: sampleReports });
});

export default router;
