import { Router, Response } from 'express';
import QRCode from 'qrcode';
import { Donation } from '../models/Donation';
import { Notification } from '../models/Notification';
import { authenticate, requireRole, requireVerified, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// Helper to generate unique donation ID (e.g. DON-4819)
const generateDonationId = (): string => {
  return 'DON-' + Math.floor(1000 + Math.random() * 9000);
};

// Helper to generate 6-digit pickup code
const generatePickupCode = (): string => {
  return 'FB-' + Math.floor(1000 + Math.random() * 9000);
};

/**
 * GET /api/donations
 * Retrieves donations with optional query filters
 */
router.get('/', async (req, res): Promise<void> => {
  try {
    const {
      search,
      category,
      dietType,
      status,
      mine,
      accepted,
      sort,
      minQuantity,
    } = req.query;

    const query: Record<string, any> = {};

    // Filter by status (default to 'available' if public search, or custom if requested)
    if (status) {
      if (status !== 'all') {
        query.status = status;
      }
    } else if (!mine && !accepted) {
      query.status = 'available';
    }

    // Don't show expired donations in available feed
    if (query.status === 'available') {
      query.pickupDeadline = { $gt: new Date() };
    }

    if (category) query.category = category;
    if (dietType) query.dietType = dietType;
    if (minQuantity) query.quantity = { $gte: Number(minQuantity) };

    if (search) {
      query.$or = [
        { foodName: { $regex: String(search), $options: 'i' } },
        { description: { $regex: String(search), $options: 'i' } },
        { city: { $regex: String(search), $options: 'i' } },
        { pickupAddress: { $regex: String(search), $options: 'i' } },
      ];
    }

    // Sorting
    let sortOptions: Record<string, any> = { createdAt: -1 };
    if (sort === 'deadline') sortOptions = { pickupDeadline: 1 };
    if (sort === 'quantity') sortOptions = { quantity: -1 };
    if (sort === 'newest') sortOptions = { createdAt: -1 };

    const donations = await Donation.find(query)
      .populate('restaurant', 'orgName firstName lastName phone email address city location')
      .populate('acceptedBy', 'orgName phone email operatingAreas')
      .sort(sortOptions);

    res.json({ success: true, count: donations.length, donations });
  } catch (error: any) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch donations.' });
  }
});

/**
 * GET /api/donations/my-donations
 * For restaurant users: gets their created donations
 */
router.get('/my/created', authenticate, requireRole('restaurant'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Auto-expire any unclaimed donations past pickup deadline
    await Donation.updateMany(
      { restaurant: req.user!._id, status: 'available', pickupDeadline: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    );

    const status = req.query.status as string;
    const filter: Record<string, any> = { restaurant: req.user!._id };
    if (status && status !== 'all') filter.status = status;

    const donations = await Donation.find(filter)
      .populate('acceptedBy', 'orgName phone email contactPerson')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: donations.length, donations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch restaurant donations.' });
  }
});

/**
 * GET /api/donations/my-accepted
 * For NGO users: gets donations accepted by this NGO
 */
router.get('/my/accepted', authenticate, requireRole('ngo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string;
    const filter: Record<string, any> = { acceptedBy: req.user!._id };
    if (status && status !== 'all') filter.status = status;

    const donations = await Donation.find(filter)
      .populate('restaurant', 'orgName firstName lastName phone email address city')
      .sort({ updatedAt: -1 });

    res.json({ success: true, count: donations.length, donations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch accepted donations.' });
  }
});

/**
 * GET /api/donations/:id
 * Single donation details
 */
router.get('/:id', async (req, res): Promise<void> => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate('restaurant', 'orgName firstName lastName phone email address city location')
      .populate('acceptedBy', 'orgName phone email contactPerson operatingAreas');

    if (!donation) {
      res.status(404).json({ success: false, message: 'Donation not found.' });
      return;
    }

    res.json({ success: true, donation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error fetching donation.' });
  }
});

/**
 * POST /api/donations
 * Restaurant creates a new surplus food donation
 */
router.post('/', authenticate, requireRole('restaurant'), requireVerified, upload.single('foodImage'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      foodName,
      description,
      category,
      dietType,
      quantity,
      preparedAt,
      pickupDeadline,
      pickupAddress,
      city,
      contactPerson,
      contactPhone,
      foodSafetyConfirmed,
    } = req.body;

    // Strict validation
    if (!foodName || !category || !dietType || !quantity || !preparedAt || !pickupDeadline || !pickupAddress) {
      res.status(400).json({ success: false, message: 'Please provide all required donation fields.' });
      return;
    }

    if (Number(quantity) < 1) {
      res.status(400).json({ success: false, message: 'Quantity must be at least 1 serving.' });
      return;
    }

    const prepDate = new Date(preparedAt);
    const deadlineDate = new Date(pickupDeadline);
    const now = new Date();

    if (deadlineDate <= now) {
      res.status(400).json({ success: false, message: 'Pickup deadline must be in the future.' });
      return;
    }

    if (prepDate >= deadlineDate) {
      res.status(400).json({ success: false, message: 'Preparation time must be earlier than the pickup deadline.' });
      return;
    }

    // Food safety confirmation check
    const isSafetyConfirmed = foodSafetyConfirmed === 'true' || foodSafetyConfirmed === true;
    if (!isSafetyConfirmed) {
      res.status(400).json({
        success: false,
        message: 'You must confirm the food safety checklist before publishing a donation.',
      });
      return;
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const donation = await Donation.create({
      donationId: generateDonationId(),
      restaurant: req.user!._id,
      foodName: foodName.trim(),
      description: description ? description.trim() : undefined,
      category,
      dietType,
      quantity: Number(quantity),
      preparedAt: prepDate,
      pickupDeadline: deadlineDate,
      pickupAddress: pickupAddress.trim(),
      city: city ? city.trim() : req.user!.city || 'Mumbai',
      contactPerson: contactPerson ? contactPerson.trim() : `${req.user!.firstName} ${req.user!.lastName}`,
      contactPhone: contactPhone ? contactPhone.trim() : req.user!.phone,
      imageUrl,
      foodSafetyConfirmed: true,
      status: 'available',
      location: req.user!.location || { lat: 19.076, lng: 72.8777 },
      timeline: [
        {
          status: 'available',
          timestamp: new Date(),
          note: 'Donation published and verified with food safety checklist.',
          actorId: req.user!._id,
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Food donation published successfully! Nearby NGOs will be notified.',
      donation,
    });
  } catch (error: any) {
    console.error('Error creating donation:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create donation.' });
  }
});

/**
 * PUT /api/donations/:id
 * Restaurant edits donation (only while still available)
 */
router.put('/:id', authenticate, requireRole('restaurant'), requireVerified, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      res.status(404).json({ success: false, message: 'Donation not found.' });
      return;
    }

    if (donation.restaurant.toString() !== req.user!._id.toString()) {
      res.status(403).json({ success: false, message: 'You are not authorized to edit this donation.' });
      return;
    }

    if (donation.status !== 'available') {
      res.status(400).json({
        success: false,
        message: `Cannot edit this donation because it is already marked as "${donation.status}".`,
      });
      return;
    }

    const allowed = ['foodName', 'description', 'category', 'dietType', 'quantity', 'pickupDeadline', 'pickupAddress', 'contactPerson', 'contactPhone'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (donation as any)[key] = req.body[key];
      }
    }

    donation.timeline.push({
      status: 'available',
      timestamp: new Date(),
      note: 'Donation details updated by restaurant.',
      actorId: req.user!._id,
    });

    await donation.save();
    res.json({ success: true, message: 'Donation updated successfully.', donation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update donation.' });
  }
});

/**
 * DELETE /api/donations/:id
 * Restaurant cancels donation (only while still available)
 */
router.delete('/:id', authenticate, requireRole('restaurant'), requireVerified, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      res.status(404).json({ success: false, message: 'Donation not found.' });
      return;
    }

    if (donation.restaurant.toString() !== req.user!._id.toString()) {
      res.status(403).json({ success: false, message: 'You are not authorized to cancel this donation.' });
      return;
    }

    if (donation.status !== 'available') {
      res.status(400).json({
        success: false,
        message: `Cannot cancel this donation because it has already been ${donation.status}.`,
      });
      return;
    }

    donation.status = 'cancelled';
    donation.timeline.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: 'Donation cancelled by restaurant.',
      actorId: req.user!._id,
    });
    await donation.save();

    res.json({ success: true, message: 'Donation cancelled successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to cancel donation.' });
  }
});

/**
 * POST /api/donations/:id/accept
 * NGO accepts an available donation
 * Generates unique pickup code & QR code
 * Prevents double acceptance through atomic query check
 */
router.post('/:id/accept', authenticate, requireRole('ngo'), requireVerified, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pickupCode = generatePickupCode();
    const qrCodeDataUrl = await QRCode.toDataURL(
      JSON.stringify({
        platform: 'FoodBridge',
        donationId: req.params.id,
        pickupCode,
        ngo: req.user!.orgName,
        issuedAt: new Date().toISOString(),
      })
    );

    // Atomic update preventing race condition where two NGOs accept simultaneously
    const donation = await Donation.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'available',
        pickupDeadline: { $gt: new Date() },
      },
      {
        $set: {
          status: 'accepted',
          acceptedBy: req.user!._id,
          pickupCode,
          qrCodeDataUrl,
        },
        $push: {
          timeline: {
            status: 'accepted',
            timestamp: new Date(),
            note: `Accepted by ${req.user!.orgName}. Pickup verification code generated.`,
            actorId: req.user!._id,
          },
        },
      },
      { new: true }
    ).populate('restaurant', 'orgName phone email');

    if (!donation) {
      res.status(400).json({
        success: false,
        message: 'This donation is no longer available or has already been accepted by another NGO.',
      });
      return;
    }

    // Send notifications to both parties
    await Notification.create({
      recipient: (donation.restaurant as any)._id,
      title: 'Donation Accepted!',
      message: `${req.user!.orgName} has accepted your donation (${donation.foodName}). Pickup code: ${pickupCode}`,
      type: 'donation_accepted',
      relatedDonation: donation._id,
    });

    await Notification.create({
      recipient: req.user!._id,
      title: 'Pickup Confirmed',
      message: `You accepted "${donation.foodName}". Present code ${pickupCode} or show the QR code at pickup.`,
      type: 'donation_accepted',
      relatedDonation: donation._id,
    });

    res.json({
      success: true,
      message: 'Donation accepted! Pickup code and QR code have been generated.',
      donation,
    });
  } catch (error: any) {
    console.error('Error accepting donation:', error);
    res.status(500).json({ success: false, message: 'Failed to accept donation.' });
  }
});

/**
 * POST /api/donations/:id/confirm-pickup
 * Verifies pickup code or QR code
 * Transitions donation to 'completed'
 */
router.post('/:id/confirm-pickup', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pickupCode } = req.body;
    const donation = await Donation.findById(req.params.id)
      .populate('restaurant', 'orgName')
      .populate('acceptedBy', 'orgName');

    if (!donation) {
      res.status(404).json({ success: false, message: 'Donation not found.' });
      return;
    }

    // Only the donor restaurant or the accepting NGO can confirm pickup
    const isRestaurant = req.user!._id.toString() === (donation.restaurant as any)._id?.toString();
    const isNgo = req.user!._id.toString() === (donation.acceptedBy as any)._id?.toString();
    const isAdmin = req.user!.role === 'admin';

    if (!isRestaurant && !isNgo && !isAdmin) {
      res.status(403).json({ success: false, message: 'You are not authorized to confirm this pickup.' });
      return;
    }

    if (donation.status === 'completed') {
      res.status(400).json({ success: false, message: 'This pickup has already been verified and completed.' });
      return;
    }

    // Verify code match
    if (pickupCode) {
      const normalizedProvided = String(pickupCode).trim().toUpperCase();
      const normalizedStored = String(donation.pickupCode).trim().toUpperCase();

      if (normalizedProvided !== normalizedStored) {
        res.status(400).json({ success: false, message: 'Invalid pickup verification code. Please check and try again.' });
        return;
      }
    }

    donation.status = 'completed';
    donation.timeline.push({
      status: 'completed',
      timestamp: new Date(),
      note: `Pickup verified by ${req.user!.orgName} using verification code ${donation.pickupCode}.`,
      actorId: req.user!._id,
    });
    await donation.save();

    // Create completion notifications
    await Notification.create({
      recipient: (donation.restaurant as any)._id,
      title: 'Donation Completed 🎉',
      message: `Pickup confirmed for "${donation.foodName}"! Thank you for reducing food waste.`,
      type: 'pickup_completed',
      relatedDonation: donation._id,
    });

    res.json({
      success: true,
      message: 'Pickup verified successfully! Donation marked as completed.',
      donation,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to confirm pickup.' });
  }
});

/**
 * POST /api/donations/:id/feedback
 * Submit rating and feedback for completed donation
 */
router.post('/:id/feedback', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rating, feedback } = req.body;
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      res.status(404).json({ success: false, message: 'Donation not found.' });
      return;
    }

    if (donation.status !== 'completed') {
      res.status(400).json({ success: false, message: 'Feedback can only be submitted for completed donations.' });
      return;
    }

    donation.rating = Math.max(1, Math.min(5, Number(rating) || 5));
    if (feedback) donation.feedback = String(feedback).trim();
    await donation.save();

    res.json({ success: true, message: 'Thank you for your feedback!', donation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to submit feedback.' });
  }
});

/**
 * GET /api/donations/:id/certificate
 * Generates certificate data for completed donation
 */
router.get('/:id/certificate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate('restaurant', 'orgName city')
      .populate('acceptedBy', 'orgName city');

    if (!donation || donation.status !== 'completed') {
      res.status(400).json({
        success: false,
        message: 'Certificates are only generated for completed donations.',
      });
      return;
    }

    const estimatedKg = Math.round(donation.quantity * 0.4 * 10) / 10;
    const co2SavedKg = Math.round(estimatedKg * 2.5 * 10) / 10;

    res.json({
      success: true,
      certificate: {
        certificateId: `CERT-${donation.donationId}`,
        restaurantName: (donation.restaurant as any)?.orgName || 'Partner Restaurant',
        ngoName: (donation.acceptedBy as any)?.orgName || 'Partner NGO',
        donationId: donation.donationId,
        foodName: donation.foodName,
        quantityServings: donation.quantity,
        estimatedKg,
        co2SavedKg,
        completedAt: donation.updatedAt,
        disclaimer: 'This certificate acknowledges food redistribution facilitated via the FoodBridge platform. It is an educational record and not an official tax exemption certificate.',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error generating certificate.' });
  }
});

/**
 * GET /api/donations/export/csv
 * Exports monthly donation report as downloadable CSV
 */
router.get('/export/csv', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isRestaurant = req.user!.role === 'restaurant';
    const filter: Record<string, any> = isRestaurant
      ? { restaurant: req.user!._id }
      : { acceptedBy: req.user!._id };

    const donations = await Donation.find(filter)
      .populate('restaurant', 'orgName')
      .populate('acceptedBy', 'orgName')
      .sort({ createdAt: -1 });

    let csv = 'Donation ID,Food Name,Category,Diet,Quantity (Servings),Status,Partner Org,Created Date,Completed Date\n';
    for (const d of donations) {
      const partner = isRestaurant
        ? ((d.acceptedBy as any)?.orgName || 'N/A')
        : ((d.restaurant as any)?.orgName || 'N/A');
      const completed = d.status === 'completed' ? new Date(d.updatedAt).toISOString().split('T')[0] : 'N/A';
      const created = new Date(d.createdAt).toISOString().split('T')[0];

      csv += `"${d.donationId}","${d.foodName.replace(/"/g, '""')}","${d.category}","${d.dietType}",${d.quantity},"${d.status}","${partner.replace(/"/g, '""')}","${created}","${completed}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="foodbridge-report-${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to generate CSV export.' });
  }
});

export default router;
