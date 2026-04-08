import { authMiddleware } from '@/middleware/authMiddleware';
import { allowRoles } from '@/middleware/roleMiddleware';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { asyncHandler } from '@/utils/asyncHandler';
import SupportTicket from '@/models/SupportTicket';
import dbConnect from '@/lib/db';

// Get all support tickets (Admin only)
export const GET = asyncHandler(async (req: Request) => {
    const authGate = await authMiddleware(req);
    if (authGate.status !== 200) return authGate;

    const roleGate = await allowRoles('admin')(authGate);
    if (roleGate.status !== 200) return roleGate;

    await dbConnect();

    const tickets = await SupportTicket.find({})
        .populate({
            path: 'donationId',
            select: 'foodType quantity foodImage expiryTime status city pickupAddress description donorId',
            populate: {
                path: 'donorId',
                select: 'name email phone'
            }
        })
        .populate('userId', 'name email phone role')
        .sort({ createdAt: -1 });

    return successResponse(tickets, 'Support tickets retrieved successfully', 200);
});

// Update ticket status (Admin only)
export const PATCH = asyncHandler(async (req: Request) => {
    const authGate = await authMiddleware(req);
    if (authGate.status !== 200) return authGate;

    const roleGate = await allowRoles('admin')(authGate);
    if (roleGate.status !== 200) return roleGate;

    const body = await req.json();
    const { ticketId, status } = body;

    if (!ticketId || !status) {
        return errorResponse('Ticket ID and status are required', 400);
    }

    await dbConnect();

    const ticket = await SupportTicket.findByIdAndUpdate(
        ticketId,
        { status },
        { new: true }
    ).populate('userId', 'name email phone');

    if (!ticket) {
        return errorResponse('Ticket not found', 404);
    }

    return successResponse(ticket, `Ticket marked as ${status}`, 200);
});
