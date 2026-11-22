import { Router, Response } from 'express';
import { Volunteer } from '../models/Volunteer';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/volunteers
 * Retrieves all volunteers for the authenticated NGO
 */
router.get('/', authenticate, requireRole('ngo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const volunteers = await Volunteer.find({ ngo: req.user!._id })
      .populate('assignedDonation', 'foodName pickupAddress status')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: volunteers.length, volunteers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch volunteers.' });
  }
});

/**
 * POST /api/volunteers
 * NGO adds a new volunteer
 */
router.post('/', authenticate, requireRole('ngo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, email } = req.body;

    if (!name || !phone) {
      res.status(400).json({ success: false, message: 'Name and phone number are required.' });
      return;
    }

    const volunteer = await Volunteer.create({
      ngo: req.user!._id,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : undefined,
      status: 'available',
    });

    res.status(201).json({ success: true, message: 'Volunteer registered successfully.', volunteer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to register volunteer.' });
  }
});

/**
 * PUT /api/volunteers/:id/assign
 * Assign volunteer to an accepted donation or update status
 */
router.put('/:id/assign', authenticate, requireRole('ngo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { donationId, status } = req.body;
    const volunteer = await Volunteer.findOne({ _id: req.params.id, ngo: req.user!._id });
    if (!volunteer) {
      res.status(404).json({ success: false, message: 'Volunteer not found.' });
      return;
    }
    volunteer.assignedDonation = donationId || undefined;
    volunteer.status = status || (donationId ? 'assigned' : 'available');
    await volunteer.save();
    res.json({ success: true, message: 'Volunteer assignment updated.', volunteer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update volunteer assignment.' });
  }
});

/**
 * DELETE /api/volunteers/:id
 * Remove volunteer
 */
router.delete('/:id', authenticate, requireRole('ngo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Volunteer.findOneAndDelete({ _id: req.params.id, ngo: req.user!._id });
    res.json({ success: true, message: 'Volunteer deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete volunteer.' });
  }
});

export default router;
