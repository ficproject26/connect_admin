const mongoose = require('mongoose');
require('dotenv').config();

async function checkMissingVendors() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('./models/User');
  const Vendor = require('./models/Vendor');

  const userDocs = await User.find({}).lean();
  const vendorDocs = await Vendor.find({}).lean();

  console.log(`=== ALL USERS IN DB (${userDocs.length}) ===`);
  userDocs.forEach(u => {
    if (u.businessName || u.name?.includes('Ammu') || u.email?.includes('ammu') || u.role?.toLowerCase().includes('vendor')) {
      console.log("User doc:", {
        _id: u._id,
        name: u.name,
        businessName: u.businessName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        joiningType: u.joiningType,
        createdVia: u.createdVia,
        agentId: u.agentId,
        assignedAgent: u.assignedAgent,
        onboardedBy: u.onboardedBy,
        referredBy: u.referredBy
      });
    }
  });

  console.log(`\n=== ALL VENDORS IN VENDOR COLLECTION (${vendorDocs.length}) ===`);
  vendorDocs.forEach(v => {
    console.log("Vendor collection doc:", {
      _id: v._id,
      name: v.businessName || v.name || v.storeName,
      ownerName: v.ownerName,
      email: v.email,
      phone: v.phone,
      status: v.status,
      joiningType: v.joiningType,
      createdVia: v.createdVia,
      agentId: v.agentId,
      assignedAgent: v.assignedAgent,
      onboardedBy: v.onboardedBy,
      referredBy: v.referredBy
    });
  });

  process.exit(0);
}

checkMissingVendors().catch(console.error);
