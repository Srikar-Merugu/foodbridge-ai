import { authMiddleware } from '@/middleware/authMiddleware';
import dbConnect from '@/lib/db';
import Donation from '@/models/Donation';
import Delivery from '@/models/Delivery';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

export const GET = asyncHandler(async (req: Request) => {
    const authGate = await authMiddleware(req);
    if (authGate.status !== 200) return authGate;

    const userId = authGate.headers.get('x-user-id');
    const userRole = authGate.headers.get('x-user-role');

    await dbConnect();

    // Helper to parse quantity (e.g., "10kg" or "50 units" -> 10 or 50)
    const parseQuantity = (q: string) => {
        const val = parseFloat(q.replace(/[^0-9.]/g, ''));
        return isNaN(val) ? 0 : val;
    };

    if (userRole === 'donor') {
        const donations = await Donation.find({ donorId: userId });
        const totalDonations = donations.length;
        
        // Calculate meals (approx 2 meals per kg)
        const totalKg = donations
            .filter(d => d.status === 'delivered' || d.status === 'completed')
            .reduce((acc, d) => acc + parseQuantity(d.quantity), 0);
        
        const mealsServed = Math.round(totalKg * 2);
        const activeMissions = donations.filter(d => ['accepted', 'on_the_way', 'arrived', 'collected'].includes(d.status)).length;
        
        // Carbon formula: meals * average CO2 per meal (e.g., 2.5kg)
        const carbonSaved = (mealsServed * 2.5).toFixed(1);

        return successResponse({
            totalDonations,
            mealsServed,
            activeMissions,
            carbonSaved,
            successRate: totalDonations > 0 ? ((donations.filter(d => d.status === 'completed').length / totalDonations) * 100).toFixed(1) : "0"
        }, 'Donor analytics retrieved');
    }

    if (userRole === 'ngo') {
        const deliveries = await Delivery.find({ ngoId: userId }).populate('donationId');
        const totalDonations = deliveries.length;
        
        const totalKg = deliveries
            .filter(d => d.status === 'completed' || d.status === 'delivered')
            .reduce((acc, d: { donationId?: { quantity?: string } }) => acc + parseQuantity(d.donationId?.quantity || "0"), 0);
        
        const mealsServed = Math.round(totalKg * 2);
        const activeMissions = deliveries.filter(d => ['accepted', 'on_the_way', 'arrived', 'collected'].includes(d.status)).length;
        const carbonSaved = (mealsServed * 2.5).toFixed(1);

        const completed = deliveries.filter(d => d.status === 'completed' || d.status === 'delivered').length;
        const successRate = totalDonations > 0 ? ((completed / totalDonations) * 100).toFixed(1) : "0";

        return successResponse({
            totalDonations,
            mealsServed,
            activeMissions,
            carbonSaved,
            successRate,
            totalRecovered: totalKg
        }, 'NGO analytics retrieved');
    }

    return errorResponse('Invalid role for analytics', 400);
});
