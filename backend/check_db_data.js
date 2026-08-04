const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function checkDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB:', mongoose.connection.name);
    const db = mongoose.connection.db;

    const agents = await db.collection('agents').find().toArray();
    const users = await db.collection('users').find({ role: { $in: ['agent', 'Agent'] } }).toArray();

    console.log('\n========================================');
    console.log(`AGENTS collection count: ${agents.length}`);
    console.log('========================================');
    agents.forEach(a => {
      console.log(`Agent: ${a.name} | Email: ${a.email} | Role: ${a.role} | KYC: ${a.kycStatus} | RegID: ${a.registrationId}`);
      console.log(`  Territory:`, a.territory);
    });

    console.log('\n========================================');
    console.log(`USERS collection (role: agent) count: ${users.length}`);
    console.log('========================================');
    users.forEach(u => {
      console.log(`User: ${u.name} | Email: ${u.email} | Level: ${u.level} | Status: ${u.status} | RegID: ${u.registrationId}`);
      console.log(`  Area: ${u.assignedArea}`);
    });

    console.log('\n========================================');
    console.log('MISMATCH AUDIT');
    console.log('========================================');
    for (const a of agents) {
      const email = (a.email || '').toLowerCase().trim();
      const u = users.find(x => (x.email || '').toLowerCase().trim() === email);
      if (!u) {
        console.log(`❌ Agent '${email}' is in 'agents' but MISSING in 'users'!`);
      } else {
        if (a.role !== u.level) console.log(`⚠️ Mismatch Role/Level for '${email}': agents.role='${a.role}' vs users.level='${u.level}'`);
        const aKyc = a.kycStatus || a.status;
        if (aKyc !== u.status) console.log(`⚠️ Mismatch Status for '${email}': agents.kycStatus='${a.kycStatus}' vs users.status='${u.status}'`);
        if (a.registrationId !== u.registrationId) console.log(`⚠️ Mismatch RegID for '${email}': agents='${a.registrationId}' vs users='${u.registrationId}'`);
        if (a.name !== u.name) console.log(`⚠️ Mismatch Name for '${email}': agents='${a.name}' vs users='${u.name}'`);
      }
    }
    for (const u of users) {
      const email = (u.email || '').toLowerCase().trim();
      const a = agents.find(x => (x.email || '').toLowerCase().trim() === email);
      if (!a) console.log(`❌ User '${email}' is in 'users' but MISSING in 'agents'!`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDb();
