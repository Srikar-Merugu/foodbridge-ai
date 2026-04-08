import dbConnect from '../lib/db';
import SupportTicket from '../models/SupportTicket';
import mongoose from 'mongoose';

async function verifySupportFlow() {
  console.log('--- Starting Support API Verification ---');
  
  await dbConnect();
  
  const testDonationId = new mongoose.Types.ObjectId();
  const testUserId = new mongoose.Types.ObjectId();
  const testIssueType = 'NGO not responding';
  const testDescription = 'Verification test description';

  try {
    // 1. Manually create a ticket
    console.log('1. Creating test ticket...');
    const ticket = await SupportTicket.create({
      donationId: testDonationId,
      userId: testUserId,
      issueType: testIssueType,
      description: testDescription
    });
    console.log('Ticket created:', ticket._id);

    // 2. Fetch the ticket
    console.log('2. Fetching test ticket...');
    const fetchedTicket = await SupportTicket.findById(ticket._id);
    if (fetchedTicket && fetchedTicket.description === testDescription) {
      console.log('Verification successful: Ticket found and matches description.');
    } else {
      console.error('Verification failed: Ticket not found or description mismatch.');
    }

    // 3. Cleanup
    console.log('3. Cleaning up...');
    await SupportTicket.findByIdAndDelete(ticket._id);
    console.log('Cleanup complete.');

  } catch (err) {
    console.error('An error occurred during verification:', err);
  } finally {
    await mongoose.connection.close();
    console.log('--- Verification Finished ---');
  }
}

verifySupportFlow();
