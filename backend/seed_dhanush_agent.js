const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();

async function seedDhanush() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB:', mongoose.connection.name);
    const db = mongoose.connection.db;

    const email = 'dhanush.antigraviity@gmail.com';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    const registrationId = `REG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const kycDocs = {
      aadhaarCard: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
      panCard: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
      passportPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
      signature: '',
      cancelledCheque: '',
      educationalCertificates: ''
    };

    const territory = {
      state: 'Tamil Nadu',
      district: 'Krishnagiri District',
      division: 'Hosur Division',
      pincode: '635109'
    };

    // Ensure Pincode document exists for 635109
    let pinDoc = await db.collection('pincodes').findOne({ code: '635109' });
    if (!pinDoc) {
      const pinResult = await db.collection('pincodes').insertOne({
        code: '635109',
        name: 'Hosur',
        district: 'Krishnagiri District',
        state: 'Tamil Nadu',
        deliveryStatus: 'Active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      pinDoc = { _id: pinResult.insertedId };
    }

    // 1. Save / Update in agents collection
    await db.collection('agents').updateOne(
      { email: email },
      {
        $set: {
          name: 'Dhanush Agent',
          email: email,
          password: hashedPassword,
          phone: '+91 98765 43210',
          role: 'pincode',
          registrationId: registrationId,
          territory: territory,
          kycStatus: 'pending',
          kycDocs: kycDocs,
          registrationFeePaid: true,
          performanceScore: 85,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    // 2. Save / Update in users collection (for Admin Website)
    await db.collection('users').updateOne(
      { email: email },
      {
        $set: {
          name: 'Dhanush Agent',
          email: email,
          phone: '+91 98765 43210',
          password: hashedPassword,
          role: 'agent',
          level: 'pincode',
          assignedArea: 'Tamil Nadu / Krishnagiri District',
          assignedPincode: pinDoc._id,
          registrationId: registrationId,
          status: 'pending',
          isActive: false,
          kyc: {
            aadhaarImage: kycDocs.aadhaarCard,
            panImage: kycDocs.panCard,
            selfie: kycDocs.passportPhoto
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`✅ Successfully created/synced agent '${email}' with status 'pending'!`);

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seedDhanush();
