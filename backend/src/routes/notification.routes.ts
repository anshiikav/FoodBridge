import { Router, Response } from 'express';
import { Notification } from '../models/Notification';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/notifications
 * Retrieves all notifications for authenticated user
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ recipient: req.user!._id })
      .sort({ createdAt: -1 })
      .limit(20);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user!._id,
      isRead: false,
    });

    res.json({ success: true, count: notifications.length, unreadCount, notifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Marks single notification as read
 */
router.put('/:id/read', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user!._id },
      { $set: { isRead: true } },
      { new: true }
    );

    res.json({ success: true, notification });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Marks all notifications for this user as read
 */
router.put('/read-all', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ recipient: req.user!._id }, { $set: { isRead: true } });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
});

export default router;
