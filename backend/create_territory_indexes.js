const mongoose = require('mongoose');
require('dotenv').config();

async function createOptimizedIndexes() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log('--- Creating Optimized Indexes ---');

    // 1. States
    try {
        await db.collection('states').createIndex({ status: 1, name: 1 }, { name: 'idx_states_status_name', background: true });
        console.log('✅ States index created');
    } catch (e) { console.log('States index:', e.message); }

    // 2. Districts
    try {
        await db.collection('districts').createIndex({ stateId: 1, status: 1 }, { name: 'idx_districts_stateId_status', background: true });
        console.log('✅ Districts index created');
    } catch (e) { console.log('Districts index:', e.message); }

    // 3. Divisions
    try {
        await db.collection('divisions').createIndex({ stateId: 1, status: 1 }, { name: 'idx_divisions_stateId_status', background: true });
        await db.collection('divisions').createIndex({ districtId: 1, status: 1 }, { name: 'idx_divisions_districtId_status', background: true });
        console.log('✅ Divisions indexes created');
    } catch (e) { console.log('Divisions index:', e.message); }

    // 4. Pincodes
    try {
        await db.collection('pincodes').createIndex({ stateId: 1, status: 1 }, { name: 'idx_pincodes_stateId_status', background: true });
        await db.collection('pincodes').createIndex({ districtId: 1, status: 1 }, { name: 'idx_pincodes_districtId_status', background: true });
        await db.collection('pincodes').createIndex({ divisionId: 1, status: 1 }, { name: 'idx_pincodes_divisionId_status', background: true });
        console.log('✅ Pincodes indexes created');
    } catch (e) { console.log('Pincodes index:', e.message); }

    await mongoose.disconnect();
}

createOptimizedIndexes().catch(console.error);
