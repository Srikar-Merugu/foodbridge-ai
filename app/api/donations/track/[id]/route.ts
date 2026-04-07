import { authMiddleware } from '@/middleware/authMiddleware';
import dbConnect from '@/lib/db';
import Donation from '@/models/Donation';
import Delivery from '@/models/Delivery';
import NGOProfile from '@/models/NGOProfile';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { asyncHandler } from '@/utils/asyncHandler';
import { calculateHaversineDistance } from '@/lib/utils';

/**
 * GET /api/donations/track/[id]
 * Purpose: Initial state provider + Fallback Polling endpoint with Synthetic ETA Intelligence
 */
export const GET = asyncHandler(async (req: Request, { params }: { params: { id: string } }) => {
    const authGate = await authMiddleware(req);
    if (authGate.status !== 200) return authGate;

    const donationId = params.id;
    if (!donationId) return errorResponse('Donation ID is required', 400);

    await dbConnect();

    // 1. Fetch the donation (Pickup Context)
    const donation = await Donation.findById(donationId)
        .populate('donorId', 'name email');

    if (!donation) return errorResponse('Donation record not found', 404);

    // 2. Fetch the active delivery (Transit & Destination Context)
    const delivery = await Delivery.findOne({ donationId })
        .populate('ngoId', 'name email')
        .populate('hungerSpotId');

    // 3. NGO Profile for contact details
    let ngoProfile = null;
    if (delivery?.ngoId) {
        const ngoUserId = (delivery.ngoId as { _id: string })._id || delivery.ngoId;
        ngoProfile = await NGOProfile.findOne({ userId: ngoUserId });
    }

    // --- ZOMATO GRADE: SYNTHETIC ETA ENGINE ---
    let etaMinutes = null;
    let targetLabel = "Arriving";
    
    if (donation.liveLatitude && donation.liveLongitude) {
        const currentPos = { lat: donation.liveLatitude, lng: donation.liveLongitude };
        let targetPos = null;

        // Phase A: Identify Target (Pickup vs Delivery)
        const isPreparing = ['accepted', 'on_the_way', 'arrived'].includes(donation.status);
        const isInTransit = ['collected'].includes(donation.status);

        if (isPreparing) {
            targetPos = { lat: donation.latitude, lng: donation.longitude };
            targetLabel = "Arriving to Pickup";
        } else if (isInTransit) {
            if (delivery?.hungerSpotId) {
                targetPos = { 
                    lat: (delivery.hungerSpotId as unknown as { lat: number }).lat, 
                    lng: (delivery.hungerSpotId as unknown as { lng: number }).lng 
                };
            } else {
                // Fallback: If no hunger spot, simulate a destination 3km away
                targetPos = { lat: donation.latitude + 0.02, lng: donation.longitude + 0.02 };
            }
            targetLabel = "Out for Delivery";
        }

        if (targetPos) {
            const distKm = calculateHaversineDistance(
                currentPos.lat, currentPos.lng,
                targetPos.lat, targetPos.lng
            );

            // Calculation: 25km/h avg speed + 3min buffer for prep/handoff
            const transitTime = (distKm / 25) * 60;
            const buffer = isPreparing ? 5 : 2; 
            etaMinutes = Math.max(1, Math.round(transitTime + buffer));
        }
    }

    const trackingData = {
        ngoLocation: donation.liveLatitude && donation.liveLongitude ? {
            lat: donation.liveLatitude,
            lng: donation.liveLongitude
        } : null,
        status: donation.status,
        etaMinutes,
        targetLabel,
        lastUpdated: donation.liveLocationUpdatedAt,
        donation: {
            foodType: donation.foodType,
            quantity: donation.quantity,
            pickupAddress: donation.pickupAddress,
            city: donation.city,
            latitude: donation.latitude,
            longitude: donation.longitude,
            donorName: (donation.donorId as unknown as { name: string })?.name || 'Donor'
        },
        ngo: delivery?.ngoId ? {
            name: (delivery.ngoId as unknown as { name: string }).name,
            email: (delivery.ngoId as unknown as { email: string }).email,
            phone: ngoProfile?.contactPhone || '—',
            rating: ngoProfile ? (ngoProfile.trustScore / 20).toFixed(1) : "4.8",
            image: null
        } : null
    };

    return successResponse(trackingData, 'Zomato-grade tracking state synced');
});
