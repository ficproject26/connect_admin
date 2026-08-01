const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function checkDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB:', mongoose.connection.name);
    const db = mongoose.connection.db;
    
    const users = await db.collection('users').find({ role: { $in: ['agent', 'Agent'] } }).toArray();
    console.log('\n--- USERS collection (role: agent) count:', users.length);
    users.forEach(u => console.log(`  User: ${u.name} | ${u.email} | status: ${u.status} | level: ${u.level} | regId: ${u.registrationId}`));

    const agents = await db.collection('agents').find().toArray();
    console.log('\n--- AGENTS collection count:', agents.length);
    agents.forEach(a => console.log(`  Agent: ${a.name} | ${a.email} | kycStatus: ${a.kycStatus} | regId: ${a.registrationId}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDb();
