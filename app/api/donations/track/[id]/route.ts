import { authMiddleware } from '@/middleware/authMiddleware';
import dbConnect from '@/lib/db';
import Donation from '@/models/Donation';
import Delivery from '@/models/Delivery';
import User from '@/models/User';
import NGOProfile from '@/models/NGOProfile';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

/**
 * GET /api/donations/track/[id]
 * Purpose: Initial state provider + Fallback Polling endpoint
 */
export const GET = asyncHandler(async (req: Request, { params }: { params: { id: string } }) => {
    const authGate = await authMiddleware(req);
    if (authGate.status !== 200) return authGate;

    const donationId = params.id;
    if (!donationId) return errorResponse('Donation ID is required', 400);

    await dbConnect();

    // 1. Fetch the donation which holds the persistent NGO location pulses
    const donation = await Donation.findById(donationId)
        .populate('donorId', 'name email');

    if (!donation) return errorResponse('Donation record not found', 404);

    // 2. Fetch the active delivery for NGO info
    const delivery = await Delivery.findOne({ donationId })
        .populate('ngoId', 'name email');

    // 3. Optional NGO Profile for contact details
    let ngoProfile = null;
    if (delivery?.ngoId) {
        const ngoUserId = (delivery.ngoId as any)._id || delivery.ngoId;
        ngoProfile = await NGOProfile.findOne({ userId: ngoUserId });
    }

    const trackingData = {
        ngoLocation: donation.liveLatitude && donation.liveLongitude ? {
            lat: donation.liveLatitude,
            lng: donation.liveLongitude
        } : null,
        status: donation.status,
        lastUpdated: donation.liveLocationUpdatedAt,
        donation: {
            foodType: donation.foodType,
            quantity: donation.quantity,
            pickupAddress: donation.pickupAddress,
            city: donation.city,
            latitude: donation.latitude,
            longitude: donation.longitude,
            donorName: (donation.donorId as any)?.name || 'Donor'
        },
        ngo: delivery?.ngoId ? {
            name: (delivery.ngoId as any).name,
            email: (delivery.ngoId as any).email,
            phone: ngoProfile?.contactPhone || '—'
        } : null
    };

    return successResponse(trackingData, 'Production tracking state retrieved');
});
