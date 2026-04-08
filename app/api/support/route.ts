import { authMiddleware } from '@/middleware/authMiddleware';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { asyncHandler } from '@/utils/asyncHandler';
import SupportTicket from '@/models/SupportTicket';
import dbConnect from '@/lib/db';

export const POST = asyncHandler(async (req: Request) => {
    const authGate = await authMiddleware(req);
    if (authGate.status !== 200) return authGate;

    const body = await req.json();
    const { donationId, userId, issueType, description } = body;

    if (!donationId || !issueType || !description) {
        return errorResponse('Donation ID, issue type, and description are required', 400);
    }

    await dbConnect();

    const ticket = await SupportTicket.create({
        donationId,
        userId: userId || authGate.headers.get('x-user-id'),
        issueType,
        description,
        status: 'open'
    });

    return successResponse(ticket, 'Support ticket created successfully', 201);
});
