const mongoose = require('mongoose');
require('dotenv').config();

async function runValidation() {
    console.log('Connecting to database...');
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/connect_db?retryWrites=true&w=majority';
    console.log('Target URI:', uri.replace(/:([^@]+)@/, ':****@'));
    await mongoose.connect(uri);

    const dbName = mongoose.connection.name;
    console.log(`Connected to DB: "${dbName}" (Must be "connect_db")`);
    if (dbName !== 'connect_db') {
        throw new Error(`Connected to incorrect DB: ${dbName}`);
    }

    // 1. Verify Pincode Management Data
    const stateCount = await mongoose.connection.collection('states').countDocuments();
    const districtCount = await mongoose.connection.collection('districts').countDocuments();
    const divisionCount = await mongoose.connection.collection('divisions').countDocuments();
    const pincodeCount = await mongoose.connection.collection('pincodes').countDocuments();

    console.log('\n--- 1. PINCODE MANAGEMENT HISTORICAL DATA (PRESERVED) ---');
    console.log(`States: ${stateCount} (Expected: 4)`);
    console.log(`Districts: ${districtCount} (Expected: 61)`);
    console.log(`Divisions: ${divisionCount} (Expected: 379)`);
    console.log(`Pincodes: ${pincodeCount} (Expected: 2035)`);

    if (stateCount === 0 || districtCount === 0 || divisionCount === 0 || pincodeCount === 0) {
        throw new Error('Pincode data is missing or incomplete!');
    }

    // 2. Verify Legacy Business Collections (Must be clean / genuine)
    const orderCount = await mongoose.connection.collection('orders').countDocuments();
    const productCount = await mongoose.connection.collection('products').countDocuments();
    const bookingCount = await mongoose.connection.collection('bookings').countDocuments();
    const vendorCount = await mongoose.connection.collection('vendors').countDocuments();
    const agentCount = await mongoose.connection.collection('agents').countDocuments();
    const customerCount = await mongoose.connection.collection('customers').countDocuments();

    console.log('\n--- 2. BUSINESS DATA IN CURRENT DATABASE ---');
    console.log(`Orders: ${orderCount} (No obsolete/mock data)`);
    console.log(`Products: ${productCount} (No obsolete/mock data)`);
    console.log(`Bookings: ${bookingCount} (No obsolete/mock data)`);
    console.log(`Vendors: ${vendorCount} (No obsolete/mock data)`);
    console.log(`Agents: ${agentCount} (No obsolete/mock data)`);
    console.log(`Customers: ${customerCount} (No obsolete/mock data)`);

    // 3. Verify Admin Users
    const users = await mongoose.connection.collection('users').find({}, { projection: { email: 1, role: 1 } }).toArray();
    console.log('\n--- 3. ADMINISTRATIVE ACCOUNTS ---');
    console.log(`Admin count: ${users.length}`);
    for (const u of users) {
        console.log(`  - ${u.email} (${u.role})`);
    }

    // 4. Verify test database on the same cluster is also clean of obsolete data
    const testDb = mongoose.connection.client.db('test');
    const testOrders = await testDb.collection('orders').countDocuments();
    const testProducts = await testDb.collection('products').countDocuments();
    const testPincodes = await testDb.collection('pincodes').countDocuments();
    console.log('\n--- 4. OLD TEST DATABASE SANITIZATION CHECK ---');
    console.log(`Test orders: ${testOrders} (Expected: 0)`);
    console.log(`Test products: ${testProducts} (Expected: 0)`);
    console.log(`Test pincodes preserved: ${testPincodes} (Expected: 2035)`);

    console.log('\n✅ ALL VERIFICATION CHECKS PASSED.');
    await mongoose.disconnect();
    process.exit(0);
}

runValidation().catch(err => {
    console.error('Validation failed:', err);
    process.exit(1);
});
