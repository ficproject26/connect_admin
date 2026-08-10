const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';
const User = require('./models/User');

async function testTwoLevelSuspension() {
    console.log('--- STARTING TWO-LEVEL VENDOR SUSPENSION TEST ---');
    await mongoose.connect(uri);

    const vendor = await User.findOne({ role: { $in: ['vendor', 'Vendor'] } });
    if (!vendor) {
        console.error('No vendor user found in database!');
        await mongoose.disconnect();
        return;
    }

    const vId = vendor._id;
    console.log(`Target Vendor: ${vendor.businessName || vendor.name} (${vId})`);

    const bizList = [
        { _id: new mongoose.Types.ObjectId().toString(), businessName: 'Main Store', category: 'Stores', status: 'Active', isActive: true },
        { _id: new mongoose.Types.ObjectId().toString(), businessName: 'Restaurant Branch', category: 'Restaurants', status: 'Active', isActive: true }
    ];

    await User.updateOne(
        { _id: vId },
        { $set: { status: 'Approved', isActive: true, businesses: bizList } }
    );

    console.log('✅ Initialized vendor with 2 sub-businesses.');

    // 1. TEST INDIVIDUAL BUSINESS SUSPENSION
    console.log('\n--- TEST 1: INDIVIDUAL BUSINESS SUSPENSION ---');
    console.log('Suspending Business 1 ("Main Store")...');

    bizList[0].status = 'Suspended';
    bizList[0].isActive = false;

    await User.updateOne(
        { _id: vId },
        { $set: { businesses: bizList } }
    );

    const vDoc1 = await User.findById(vId).lean();

    if (!vDoc1) {
        console.error('Could not fetch vendor document!');
        await mongoose.disconnect();
        return;
    }

    console.log(`Vendor Account Status: ${vDoc1.status} (isActive: ${vDoc1.isActive}) -> SHOULD REMAIN APPROVED`);
    console.log(`Business 1 ("${vDoc1.businesses[0].businessName}") Status: ${vDoc1.businesses[0].status}`);
    console.log(`Business 2 ("${vDoc1.businesses[1].businessName}") Status: ${vDoc1.businesses[1].status}`);

    if (vDoc1.status === 'Approved' && vDoc1.isActive === true && vDoc1.businesses[0].status === 'Suspended' && vDoc1.businesses[1].status === 'Active') {
        console.log('✅ TEST 1 PASSED: Vendor account remained Approved while Business 1 was suspended.');
    } else {
        console.error('❌ TEST 1 FAILED');
    }

    // Restore Business 1
    bizList[0].status = 'Active';
    bizList[0].isActive = true;
    await User.updateOne({ _id: vId }, { $set: { businesses: bizList } });

    // 2. TEST TOTAL VENDOR SUSPENSION
    console.log('\n--- TEST 2: TOTAL VENDOR SUSPENSION ---');
    console.log('Suspending entire Vendor account...');
    bizList.forEach(b => { b.status = 'Suspended'; b.isActive = false; });

    await User.updateOne(
        { _id: vId },
        { $set: { status: 'Suspended', isActive: false, businesses: bizList } }
    );

    const vDoc2 = await User.findById(vId).lean();

    console.log(`Vendor Account Status: ${vDoc2.status} (isActive: ${vDoc2.isActive}) -> SHOULD BE SUSPENDED`);
    console.log(`All sub-businesses set to Suspended: ${vDoc2.businesses.every(b => b.status === 'Suspended')}`);

    if (vDoc2.status === 'Suspended' && vDoc2.isActive === false) {
        console.log('✅ TEST 2 PASSED: Entire vendor account and all businesses suspended.');
    } else {
        console.error('❌ TEST 2 FAILED');
    }

    // Restore Vendor to Active
    console.log('\nRestoring Vendor to Approved/Active...');
    bizList.forEach(b => { b.status = 'Active'; b.isActive = true; });
    await User.updateOne(
        { _id: vId },
        { $set: { status: 'Approved', isActive: true, businesses: bizList } }
    );

    console.log('✅ Restored vendor to Approved/Active.');

    await mongoose.disconnect();
    console.log('--- TEST SUITE COMPLETE ---');
}

testTwoLevelSuspension().catch(console.error);
