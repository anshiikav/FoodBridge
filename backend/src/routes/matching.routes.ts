import { Router, Response } from 'express';
import { Donation } from '../models/Donation';
import { User } from '../models/User';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { getTopMatchingDonations, getTopMatchingNgos } from '../utils/matching';

const router = Router();

/**
 * GET /api/matching/recommendations
 * For NGO users: returns available donations ranked by smart match algorithm
 */
router.get('/recommendations', authenticate, requireRole('ngo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ngo = req.user!;
    const availableDonations = await Donation.find({
      status: 'available',
      pickupDeadline: { $gt: new Date() },
    }).populate('restaurant', 'orgName phone email address city location');

    const recommendations = getTopMatchingDonations(ngo, availableDonations, 8);

    res.json({
      success: true,
      count: recommendations.length,
      recommendations: recommendations.map((item) => ({
        donation: item.donation,
        matchScore: item.match.totalScore,
        distanceKm: item.match.distanceKm,
        breakdown: item.match.breakdown,
        explanation: item.match.explanation,
      })),
    });
  } catch (error: any) {
    console.error('Matching recommendation error:', error);
    res.status(500).json({ success: false, message: 'Failed to compute matching recommendations.' });
  }
});

/**
 * GET /api/matching/donation/:id/top-ngos
 * For Restaurant users: returns top 3 suitable NGOs for a given donation
 */
router.get('/donation/:id/top-ngos', authenticate, requireRole('restaurant'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      res.status(404).json({ success: false, message: 'Donation not found.' });
      return;
    }

    const ngos = await User.find({ role: 'ngo', status: 'verified' });
    const topNgos = getTopMatchingNgos(donation, ngos, 3);

    res.json({
      success: true,
      donationId: donation.donationId,
      foodName: donation.foodName,
      topNgos,
    });
  } catch (error: any) {
    console.error('Matching top NGOs error:', error);
    res.status(500).json({ success: false, message: 'Failed to compute matching NGOs.' });
  }
});

export default router;
