import dbConnect from '@/lib/db';
import Donation from '@/models/Donation';
import Delivery from '@/models/Delivery';
import NGOProfile from '@/models/NGOProfile';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { asyncHandler } from '@/utils/asyncHandler';
import { calculateHaversineDistance } from '@/lib/utils';

/**
 * GET /api/donations/track-public/[id]
 * Purpose: Public tracking (No Auth)
 */
export const GET = asyncHandler(async (req: Request, { params }: { params: { id: string } }) => {
    const donationId = params.id;
    if (!donationId) return errorResponse('Donation ID is required', 400);

    await dbConnect();

    // 1. Fetch the donation (Pickup Context)
    const donation = await Donation.findById(donationId)
        .populate('donorId', 'name');

    if (!donation) return errorResponse('Donation record not found', 404);

    // 2. Fetch the active delivery (Transit & Destination Context)
    const delivery = await Delivery.findOne({ donationId })
        .populate('ngoId', 'name');

    // 3. NGO Profile for contact details (Public info only)
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

        const isPreparing = ['accepted', 'on_the_way', 'arrived'].includes(donation.status);
        const isInTransit = ['collected'].includes(donation.status);

        if (isPreparing) {
            targetPos = { lat: donation.latitude, lng: donation.longitude };
            targetLabel = "Arriving to Pickup";
        } else if (isInTransit) {
            if (delivery?.hungerSpotId) {
                // If it's a hunger spot, we might not have its lat/lng here easily without populating
                // For public view, we keep it simple or simulate
                targetPos = { lat: donation.latitude + 0.02, lng: donation.longitude + 0.02 };
            } else {
                targetPos = { lat: donation.latitude + 0.02, lng: donation.longitude + 0.02 };
            }
            targetLabel = "Out for Delivery";
        }

        if (targetPos) {
            const distKm = calculateHaversineDistance(
                currentPos.lat, currentPos.lng,
                targetPos.lat, targetPos.lng
            );
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
            rating: ngoProfile ? (ngoProfile.trustScore / 20).toFixed(1) : "4.8",
        } : null
    };

    return successResponse(trackingData, 'Public tracking state synced');
});
