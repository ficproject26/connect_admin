const mongoose = require('mongoose');
require('dotenv').config();

async function fixExistingVendors() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Fix existing vendors in vendors collection that have assignedAgent but missing joiningType/createdVia
  const result = await db.collection('vendors').updateMany(
    {
      assignedAgent: { $exists: true, $ne: null },
      $or: [
        { joiningType: { $exists: false } },
        { joiningType: null },
        { createdVia: { $exists: false } },
        { createdVia: null }
      ]
    },
    {
      $set: {
        joiningType: 'agent',
        createdVia: 'agent',
        registrationSource: 'agent',
        role: 'Vendor'
      }
    }
  );
  console.log(`Fixed ${result.modifiedCount} vendor docs in vendors collection`);

  // Now sync those vendors to users collection too
  const agentVendors = await db.collection('vendors').find({
    assignedAgent: { $exists: true, $ne: null }
  }).toArray();

  for (const v of agentVendors) {
    const email = (v.email || '').toLowerCase().trim();
    if (!email) continue;

    const existsInUsers = await db.collection('users').findOne({ email });
    if (!existsInUsers) {
      console.log(`Syncing vendor ${v.businessName || v.name} (${email}) to users collection...`);
      await db.collection('users').insertOne({
        name: v.businessName || v.name || 'Vendor',
        businessName: v.businessName || v.name || 'Vendor Store',
        contactPerson: v.ownerName || v.name || 'Owner',
        email: email,
        phone: v.phone || '',
        role: 'Vendor',
        vendorType: v.category || 'Supermarket & Retail',
        category: v.category || 'Supermarket & Retail',
        status: v.status || 'pending',
        kycStatus: v.kycStatus || 'pending',
        joiningType: 'agent',
        createdVia: 'agent',
        registrationSource: 'agent',
        assignedAgent: v.assignedAgent,
        agentId: v.assignedAgent,
        onboardedBy: v.assignedAgent,
        assignedState: v.state || '',
        assignedDistrict: v.district || '',
        assignedDivision: v.division || '',
        pincode: v.pincode || '',
        address: v.location?.address || '',
        registrationId: v.registrationId || `REG-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
        createdAt: v.createdAt || new Date()
      });
      console.log(`  -> Synced successfully`);
    } else {
      // Update existing user doc to have agent fields
      await db.collection('users').updateOne(
        { email },
        {
          $set: {
            joiningType: 'agent',
            createdVia: 'agent',
            registrationSource: 'agent',
            assignedAgent: v.assignedAgent,
            agentId: v.assignedAgent,
            onboardedBy: v.assignedAgent
          }
        }
      );
      console.log(`Updated existing user ${email} with agent fields`);
    }
  }

  // Verify
  const finalCount = await db.collection('users').countDocuments({
    $or: [
      { joiningType: 'agent' },
      { createdVia: 'agent' },
      { registrationSource: 'agent' }
    ]
  });
  console.log(`\nTotal agent-onboarded vendors in users collection: ${finalCount}`);

  const vendorCount = await db.collection('vendors').countDocuments({
    $or: [
      { joiningType: 'agent' },
      { createdVia: 'agent' },
      { assignedAgent: { $exists: true, $ne: null } }
    ]
  });
  console.log(`Total agent-onboarded vendors in vendors collection: ${vendorCount}`);

  process.exit(0);
}

fixExistingVendors().catch(console.error);
