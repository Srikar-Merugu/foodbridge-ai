import dbConnect from '@/lib/db';
import Donation from '@/models/Donation';
import HungerReport from '@/models/HungerReport';
import { successResponse } from '@/lib/apiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

export const GET = asyncHandler(async () => {
    await dbConnect();

    // Fetch latest 10 donations
    const latestDonations = await Donation.find({})
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('donorId', 'name')
        .populate('ngoId', 'name');

    // Fetch latest 5 hunger reports
    const latestHungerReports = await HungerReport.find({})
        .sort({ createdAt: -1 })
        .limit(5);

    interface Activity {
        _id: string;
        type: string;
        title: string;
        description: string;
        timestamp: Date | string;
        id: string;
    }

    const activities: Activity[] = [];

    // Map Hunger Reports
    latestHungerReports.forEach(report => {
        activities.push({
            _id: `hunger-${report._id}`,
            type: 'HUNGER_REPORT',
            title: 'Hunger Request Raised',
            description: `A new request for ${report.peopleCount} people at ${report.locationName}`,
            timestamp: report.createdAt,
            id: report._id
        });
    });

    // Map Donations & Their Statuses
    latestDonations.forEach(d => {
        // Most recent status-based activity
        let type = 'NEW_DONATION';
        let title = 'New Donation Posted';
        let description = `${d.foodType} posted at ${d.city}`;

        if (d.status === 'accepted') {
            type = 'MISSION_ACCEPTED';
            title = 'NGO Accepted Request';
            description = `${d.ngoId?.name || 'An NGO'} accepted the ${d.foodType} mission`;
        } else if (d.status === 'on_the_way') {
            type = 'PICKUP_STARTED';
            title = 'Pickup Started';
            description = `Vehicle is on the way for ${d.foodType} pickup`;
        } else if (d.status === 'arrived') {
            type = 'ARRIVED_AT_PICKUP';
            title = 'NGO Arrived';
            description = `NGO is at the pickup location for ${d.foodType}`;
        } else if (d.status === 'collected') {
            type = 'FOOD_COLLECTED';
            title = 'Batch Collected';
            description = `${d.foodType} has been secured and is in transit`;
        } else if (d.status === 'completed' || d.status === 'delivered') {
            type = 'DELIVERY_COMPLETED';
            title = 'Food Delivered';
            description = `Successfully delivered ${d.foodType} assets`;
        }

        activities.push({
            _id: d._id,
            type,
            title,
            description,
            timestamp: d.updatedAt,
            id: d._id
        });
    });

    // Sort combined activities by timestamp desc
    const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

    return successResponse(sortedActivities, 'Recent platform activity retrieved');
});
