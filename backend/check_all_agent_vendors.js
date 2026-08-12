const mongoose = require('mongoose');
require('dotenv').config();

async function checkAllAgentVendors() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const users = await db.collection('users').find({}).toArray();
  const vendors = await db.collection('vendors').find({}).toArray();

  console.log(`=== USERS COLLECTION (${users.length} docs) ===`);
  users.forEach((u, i) => {
    console.log(`[User ${i+1}]`, {
      _id: u._id,
      name: u.name || u.businessName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      joiningType: u.joiningType,
      createdVia: u.createdVia,
      assignedAgent: u.assignedAgent,
      agentId: u.agentId,
      onboardedBy: u.onboardedBy,
      registrationId: u.registrationId,
      pincode: u.pincode || u.assignedArea
    });
  });

  console.log(`\n=== VENDORS COLLECTION (${vendors.length} docs) ===`);
  vendors.forEach((v, i) => {
    console.log(`[Vendor ${i+1}]`, {
      _id: v._id,
      businessName: v.businessName || v.name,
      ownerName: v.ownerName,
      email: v.email,
      phone: v.phone,
      status: v.status,
      joiningType: v.joiningType,
      createdVia: v.createdVia,
      assignedAgent: v.assignedAgent,
      agentId: v.agentId,
      onboardedBy: v.onboardedBy,
      registrationId: v.registrationId,
      pincode: v.pincode
    });
  });

  process.exit(0);
}

checkAllAgentVendors().catch(console.error);
