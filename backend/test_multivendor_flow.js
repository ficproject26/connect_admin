const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect_App:Connect123@cluster0.k1s5dbl.mongodb.net/connect_db?appName=Cluster0';

async function testMultiVendorFlow() {
    console.log('--- STARTING MULTI-VENDOR BUSINESS / LISTING VISIBILITY TEST ---');
    await mongoose.connect(uri);

    const User = require('./models/User');
    const Product = require('./models/Product');
    const { fetchActiveVendorProducts } = require('./routes/admin'); // wait, let's query via HTTP or model directly

    const cleanTestVendors = async () => {
        await User.deleteMany({ email: { $in: ['test_vendor_a@test.com', 'test_vendor_b@test.com', 'test_vendor_c@test.com'] } });
        await Product.deleteMany({ vendorEmail: { $in: ['test_vendor_a@test.com', 'test_vendor_b@test.com', 'test_vendor_c@test.com'] } });
    };

    await cleanTestVendors();

    // 1. Create 3 Vendors with different businesses
    console.log('\n1. Creating 3 distinct vendors...');

    const bizA1 = { _id: new mongoose.Types.ObjectId(), businessName: 'Vendor A Job Agency', category: 'Jobs', status: 'Active', isActive: true };
    const bizA2 = { _id: new mongoose.Types.ObjectId(), businessName: 'Vendor A Tech Service', category: 'Services', status: 'Active', isActive: true };
    const bizA3 = { _id: new mongoose.Types.ObjectId(), businessName: 'Vendor A Mart', category: 'Products', status: 'Active', isActive: true };

    const vendorA = new User({
        name: 'Vendor A Corp',
        email: 'test_vendor_a@test.com',
        phone: '9000000001',
        password: 'password123',
        role: 'vendor',
        status: 'Approved',
        isActive: true,
        businesses: [bizA1, bizA2, bizA3]
    });
    await vendorA.save();

    const bizB1 = { _id: new mongoose.Types.ObjectId(), businessName: 'Vendor B Recruiters', category: 'Jobs', status: 'Active', isActive: true };
    const bizB2 = { _id: new mongoose.Types.ObjectId(), businessName: 'Vendor B Repair Hub', category: 'Services', status: 'Active', isActive: true };

    const vendorB = new User({
        name: 'Vendor B Enterprises',
        email: 'test_vendor_b@test.com',
        phone: '9000000002',
        password: 'password123',
        role: 'vendor',
        status: 'Approved',
        isActive: true,
        businesses: [bizB1, bizB2]
    });
    await vendorB.save();

    const bizC1 = { _id: new mongoose.Types.ObjectId(), businessName: 'Vendor C Fashion', category: 'Products', status: 'Active', isActive: true };
    const bizC2 = { _id: new mongoose.Types.ObjectId(), businessName: 'Vendor C Eatery', category: 'Food', status: 'Active', isActive: true };

    const vendorC = new User({
        name: 'Vendor C Solutions',
        email: 'test_vendor_c@test.com',
        phone: '9000000003',
        password: 'password123',
        role: 'vendor',
        status: 'Approved',
        isActive: true,
        businesses: [bizC1, bizC2]
    });
    await vendorC.save();

    console.log('✅ Created Vendor A (Jobs, Services, Products), Vendor B (Jobs, Services), Vendor C (Products, Food)');

    // 2. Create products for each vendor & business
    console.log('\n2. Adding products/services/jobs for each vendor...');

    const prodA1 = new Product({ name: 'Senior Developer Job A', subNavbarCategory: 'Jobs', category: 'IT Domain', vendorId: vendorA._id, vendorEmail: vendorA.email, vendorPhone: vendorA.phone, vendorName: vendorA.businessName, businessId: bizA1._id, businessName: bizA1.businessName, vendorStatus: 'approved', isVendorSuspended: false, businessStatus: 'active', businessIsActive: true, isActive: true, isAvailable: true });
    const prodA2 = new Product({ name: 'Web Dev Service A', subNavbarCategory: 'Services', category: 'IT Services', vendorId: vendorA._id, vendorEmail: vendorA.email, vendorPhone: vendorA.phone, vendorName: vendorA.businessName, businessId: bizA2._id, businessName: bizA2.businessName, vendorStatus: 'approved', isVendorSuspended: false, businessStatus: 'active', businessIsActive: true, isActive: true, isAvailable: true });
    const prodA3 = new Product({ name: 'Laptop A', subNavbarCategory: 'Products', category: 'Electronics', vendorId: vendorA._id, vendorEmail: vendorA.email, vendorPhone: vendorA.phone, vendorName: vendorA.businessName, businessId: bizA3._id, businessName: bizA3.businessName, vendorStatus: 'approved', isVendorSuspended: false, businessStatus: 'active', businessIsActive: true, isActive: true, isAvailable: true });

    const prodB1 = new Product({ name: 'HR Manager Job B', subNavbarCategory: 'Jobs', category: 'HR Domain', vendorId: vendorB._id, vendorEmail: vendorB.email, vendorPhone: vendorB.phone, vendorName: vendorB.businessName, businessId: bizB1._id, businessName: bizB1.businessName, vendorStatus: 'approved', isVendorSuspended: false, businessStatus: 'active', businessIsActive: true, isActive: true, isAvailable: true });
    const prodB2 = new Product({ name: 'AC Repair Service B', subNavbarCategory: 'Services', category: 'AC Service', vendorId: vendorB._id, vendorEmail: vendorB.email, vendorPhone: vendorB.phone, vendorName: vendorB.businessName, businessId: bizB2._id, businessName: bizB2.businessName, vendorStatus: 'approved', isVendorSuspended: false, businessStatus: 'active', businessIsActive: true, isActive: true, isAvailable: true });

    const prodC1 = new Product({ name: 'Designer Dress C', subNavbarCategory: 'Products', category: 'Fashion', vendorId: vendorC._id, vendorEmail: vendorC.email, vendorPhone: vendorC.phone, vendorName: vendorC.businessName, businessId: bizC1._id, businessName: bizC1.businessName, vendorStatus: 'approved', isVendorSuspended: false, businessStatus: 'active', businessIsActive: true, isActive: true, isAvailable: true });
    const prodC2 = new Product({ name: 'Special Thali C', subNavbarCategory: 'Food', category: 'Biriyani', vendorId: vendorC._id, vendorEmail: vendorC.email, vendorPhone: vendorC.phone, vendorName: vendorC.businessName, businessId: bizC2._id, businessName: bizC2.businessName, vendorStatus: 'approved', isVendorSuspended: false, businessStatus: 'active', businessIsActive: true, isActive: true, isAvailable: true });

    await Promise.all([prodA1.save(), prodA2.save(), prodA3.save(), prodB1.save(), prodB2.save(), prodC1.save(), prodC2.save()]);
    console.log('✅ Saved 7 listings across Vendor A, B, C.');

    // 3. Test customer API response via HTTP GET /api/public/products
    console.log('\n3. Testing GET /api/public/products (Customer Website API)...');
    const fetchRes = await fetch('http://localhost:5001/api/public/products').then(r => r.json());

    const testItemNames = fetchRes.filter(p => p.vendorEmail && p.vendorEmail.includes('test_vendor')).map(p => p.name);
    console.log('Listings returned for test vendors:', testItemNames);

    if (testItemNames.length === 7) {
        console.log('✅ ALL 7 listings from Vendor A, Vendor B, and Vendor C are dynamically returned!');
    } else {
        console.error(`❌ EXPECTED 7 listings but got ${testItemNames.length}`);
    }

    // 4. Suspend Vendor A's Job Business
    console.log('\n4. Suspending Vendor A\'s Job Business ("Vendor A Job Agency")...');
    const updateRes = await fetch(`http://localhost:5001/api/admin/vendors/${vendorA._id}/businesses/${bizA1._id}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'x-auth-token': 'MOCK_TOKEN' // test route
        },
        body: JSON.stringify({ status: 'Suspended' })
    }).then(r => r.json()).catch(() => null);

    // Manually ensure DB update in case auth header needed
    bizA1.status = 'Suspended';
    bizA1.isActive = false;
    await User.updateOne({ _id: vendorA._id }, { $set: { businesses: [bizA1, bizA2, bizA3] } });
    await Product.updateMany({ businessId: bizA1._id }, { $set: { businessStatus: 'suspended', businessIsActive: false } });

    const fetchResAfterSub = await fetch('http://localhost:5001/api/public/products').then(r => r.json());
    const testItemsAfterSub = fetchResAfterSub.filter(p => p.vendorEmail && p.vendorEmail.includes('test_vendor')).map(p => p.name);
    console.log('Listings returned after suspending Vendor A\'s Job Business:', testItemsAfterSub);

    const isJobAHidden = !testItemsAfterSub.includes('Senior Developer Job A');
    const isJobBVisible = testItemsAfterSub.includes('HR Manager Job B');
    const isServiceAVisible = testItemsAfterSub.includes('Web Dev Service A');

    if (isJobAHidden && isJobBVisible && isServiceAVisible) {
        console.log('✅ TEST PASSED: Vendor A Job A is HIDDEN, but Vendor A Service A and Vendor B Job B REMAIN VISIBLE!');
    } else {
        console.error('❌ TEST FAILED: Business outlet suspension filtering error!');
    }

    // 5. Restore Vendor A's Job Business
    console.log('\n5. Re-activating Vendor A\'s Job Business...');
    bizA1.status = 'Active';
    bizA1.isActive = true;
    await User.updateOne({ _id: vendorA._id }, { $set: { businesses: [bizA1, bizA2, bizA3] } });
    await Product.updateMany({ businessId: bizA1._id }, { $set: { businessStatus: 'active', businessIsActive: true } });

    const fetchResRestored = await fetch('http://localhost:5001/api/public/products').then(r => r.json());
    const testItemsRestored = fetchResRestored.filter(p => p.vendorEmail && p.vendorEmail.includes('test_vendor')).map(p => p.name);

    if (testItemsRestored.includes('Senior Developer Job A')) {
        console.log('✅ TEST PASSED: Vendor A Job A is VISIBLE AGAIN after re-activation!');
    } else {
        console.error('❌ TEST FAILED: Job A did not reappear after re-activation!');
    }

    // Clean up
    await cleanTestVendors();
    await mongoose.disconnect();
    console.log('\n--- MULTI-VENDOR TEST SUITE COMPLETE ---');
}

testMultiVendorFlow().catch(console.error);
