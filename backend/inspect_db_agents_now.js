const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const db = mongoose.connection.db;

  const users = await User.find({}).lean();
  const agentUsers = users.filter(u => ['agent', 'state', 'district', 'division', 'pincode'].includes((u.role || '').toLowerCase()));
  
  console.log('=== ALL USERS IN USER COLLECTION ===');
  console.log('Total users:', users.length);
  console.log('Agent role users count:', agentUsers.length);
  
  agentUsers.forEach(u => {
    console.log(`[User] ID: ${u._id} | Name: ${u.name} | Role: ${u.role} | Level: ${u.level} | Status: ${u.status} | KYC: ${u.kycStatus} | Approved: ${u.isApproved} | State: ${u.assignedState || u.state} | Dist: ${u.assignedDistrict || u.district} | Div: ${u.assignedDivision || u.division} | Pin: ${u.assignedPincode || u.pincode}`);
  });

  console.log('\n=== ALL AGENTS IN RAW AGENTS COLLECTION ===');
  const rawAgents = await db.collection('agents').find({}).toArray();
  console.log('Raw agents collection count:', rawAgents.length);
  rawAgents.forEach(a => {
    console.log(`[RawAgent] ID: ${a._id} | Name: ${a.name} | Role: ${a.role} | Level: ${a.level} | Status: ${a.status} | KYC: ${a.kycStatus} | Approved: ${a.isApproved} | State: ${a.assignedState || a.state} | Dist: ${a.assignedDistrict || a.district} | Div: ${a.assignedDivision || a.division} | Pin: ${a.assignedPincode || a.pincode}`);
  });

  process.exit(0);
}).catch(e => {
  console.error('DB Error:', e);
  process.exit(1);
});
