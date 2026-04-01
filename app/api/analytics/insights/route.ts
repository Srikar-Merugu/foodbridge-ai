import { authMiddleware } from '@/middleware/authMiddleware';
import dbConnect from '@/lib/db';
import OperationalLog from '@/models/OperationalLog';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

export const GET = asyncHandler(async (req: Request) => {
    const authGate = await authMiddleware(req);
    if (authGate.status !== 200) return authGate;

    const userId = authGate.headers.get('x-user-id');
    const userRole = authGate.headers.get('x-user-role');

    if (userRole !== 'ngo' && userRole !== 'admin') {
        return errorResponse('Unauthorized access to operational insights', 403);
    }

    await dbConnect();

    // Fetch the 10 most recent logs for this NGO (or all if admin)
    const query = userRole === 'admin' ? {} : { ngoId: userId };
    const logs = await OperationalLog.find(query)
        .sort({ createdAt: -1 })
        .limit(10);

    return successResponse(logs, 'Insights retrieved successfully');
});
