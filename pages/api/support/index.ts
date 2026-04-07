import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/db';
import SupportTicket from '@/models/SupportTicket';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();
    const { donationId, userId, issueType, description } = req.body;

    if (!donationId || !userId || !issueType || !description) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const ticket = await SupportTicket.create({
      donationId,
      userId,
      issueType,
      description,
      status: 'open'
    });

    return res.status(201).json({ success: true, message: 'Support ticket created successfully', data: ticket });
    } catch (err: unknown) {
        return res.status(500).json({ success: false, message: (err as Error).message });
    }
}
