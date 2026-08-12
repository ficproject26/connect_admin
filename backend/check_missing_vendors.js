const mongoose = require('mongoose');
require('dotenv').config();

async function verifyAgentOnboardedQuery() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // This replicates the exact query the Admin backend uses for isAgentOnboarded=true
  const agentVendorsFromUsers = await db.collection('users').find({
    $or: [
      { joiningType: 'agent' },
      { createdVia: 'agent' },
      { registrationSource: 'agent' },
      { onboardedBy: { $exists: true, $ne: null } },
      { agentId: { $exists: true, $ne: null } },
      { assignedAgent: { $exists: true, $ne: null } },
      { onboardedByAgentId: { $exists: true, $ne: null } },
      { referredBy: { $exists: true, $ne: null } }
    ]
  }).sort({ createdAt: -1 }).toArray();

  console.log(`\n=== AGENT ONBOARDED VENDORS FROM USERS COLLECTION (${agentVendorsFromUsers.length}) ===`);
  agentVendorsFromUsers.forEach(v => {
    console.log({
      _id: v._id,
      name: v.name,
      businessName: v.businessName,
      email: v.email,
      phone: v.phone,
      role: v.role,
      status: v.status,
      joiningType: v.joiningType,
      createdVia: v.createdVia,
      registrationSource: v.registrationSource,
      agentId: v.agentId,
      assignedAgent: v.assignedAgent,
      onboardedBy: v.onboardedBy,
      registrationId: v.registrationId,
      pincode: v.pincode
    });
  });

  const agentVendorsFromVendors = await db.collection('vendors').find({
    $or: [
      { joiningType: 'agent' },
      { createdVia: 'agent' },
      { registrationSource: 'agent' },
      { onboardedBy: { $exists: true, $ne: null } },
      { agentId: { $exists: true, $ne: null } },
      { assignedAgent: { $exists: true, $ne: null } },
      { onboardedByAgentId: { $exists: true, $ne: null } },
      { referredBy: { $exists: true, $ne: null } }
    ]
  }).sort({ createdAt: -1 }).toArray();

  console.log(`\n=== AGENT ONBOARDED VENDORS FROM VENDORS COLLECTION (${agentVendorsFromVendors.length}) ===`);
  agentVendorsFromVendors.forEach(v => {
    console.log({
      _id: v._id,
      name: v.name || v.businessName,
      email: v.email,
      phone: v.phone,
      status: v.status,
      joiningType: v.joiningType,
      createdVia: v.createdVia,
      registrationSource: v.registrationSource,
      agentId: v.agentId,
      assignedAgent: v.assignedAgent,
      onboardedBy: v.onboardedBy,
      registrationId: v.registrationId,
      pincode: v.pincode
    });
  });

  process.exit(0);
}

verifyAgentOnboardedQuery().catch(console.error);
