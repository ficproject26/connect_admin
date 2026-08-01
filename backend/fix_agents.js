const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function fixAndSeed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB:', mongoose.connection.name);
    const db = mongoose.connection.db;

    // Remove rejected test entries that were created for testing
    const deletedUsers = await db.collection('users').deleteMany({
      email: { $in: ['newagent.test12345@example.com', 'anish.kumar5605@forge.in'] }
    });
    const deletedAgents = await db.collection('agents').deleteMany({
      email: { $in: ['newagent.test12345@example.com', 'anish.kumar5605@forge.in'] }
    });
    console.log(`Deleted ${deletedUsers.deletedCount} old test records from users`);
    console.log(`Deleted ${deletedAgents.deletedCount} old test records from agents`);

    // Final check
    const remainingUsers = await db.collection('users').find({ role: { $in: ['agent', 'Agent'] } }).toArray();
    const remainingAgents = await db.collection('agents').find().toArray();
    console.log('\nRemaining users (agent):', remainingUsers.length);
    console.log('Remaining agents:', remainingAgents.length);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixAndSeed();
