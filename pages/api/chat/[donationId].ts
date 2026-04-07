import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/db';
import ChatMessage from '@/models/ChatMessage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { donationId } = req.query;

  await dbConnect();

  // GET — fetch message history for a donation room
  if (req.method === 'GET') {
    try {
      const messages = await ChatMessage.find({ donationId })
        .sort({ timestamp: 1 })
        .limit(200);
      return res.status(200).json({ success: true, count: messages.length, data: messages });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, message: (err as Error).message });
    }
  }

  // PATCH — mark messages as seen (called by the socket server or client fallback)
  if (req.method === 'PATCH') {
    try {
      const { seenBy } = req.body as { seenBy: 'donor' | 'ngo' };
      if (!seenBy) return res.status(400).json({ success: false, message: 'seenBy is required' });

      const senderOfMessages = seenBy === 'donor' ? 'ngo' : 'donor';
      const result = await ChatMessage.updateMany(
        { donationId, sender: senderOfMessages, seen: false },
        { $set: { seen: true } }
      );

      return res.status(200).json({ success: true, updated: result.modifiedCount });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, message: (err as Error).message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
