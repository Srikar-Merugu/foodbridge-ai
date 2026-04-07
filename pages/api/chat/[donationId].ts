import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/db';
import ChatMessage from '@/models/ChatMessage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { donationId } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();
    const messages = await ChatMessage.find({ donationId })
      .sort({ timestamp: 1 })
      .limit(100);

    return res.status(200).json({ success: true, count: messages.length, data: messages });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
