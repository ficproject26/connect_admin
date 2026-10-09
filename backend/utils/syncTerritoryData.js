const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const State = require('../models/State');
const District = require('../models/District');
const Division = require('../models/Division');
const Pincode = require('../models/Pincode');
const Manager = require('../models/Manager');
const PincodeAssignment = require('../models/PincodeAssignment');

/**
 * Robust Canonical Territory Synchronization & Auto-Healing
 * Ensures Karnataka, Tamil Nadu, and Pondicherry hierarchies are completely restored
 * and synced with tasks, managers, and pincode assignments.
 */
async function syncTerritoryData(options = { force: false }) {
    console.log('🔄 Checking territory database state...');

    const [stateCount, districtCount, divisionCount, pincodeCount] = await Promise.all([
        State.countDocuments(),
        District.countDocuments(),
        Division.countDocuments(),
        Pincode.countDocuments()
    ]);

    console.log(`Current territory counts: States: ${stateCount}, Districts: ${districtCount}, Divisions: ${divisionCount}, Pincodes: ${pincodeCount}`);

    // If counts are already complete and not force mode, nothing to do
    if (!options.force && districtCount >= 50 && divisionCount >= 300 && pincodeCount >= 600) {
        console.log('✅ Territory data already populated and intact.');
        return { success: true, message: 'Data already intact', counts: { stateCount, districtCount, divisionCount, pincodeCount } };
    }

    console.log('🚀 Restoring canonical territory data...');

    // 1. RESTORE STATES
    const statesData = [
        {
            _id: 'state_ka',
            stateId: 'ST-KAR-0001',
            name: 'Karnataka',
            code: 'KAR',
            status: 'Active',
            description: 'State of Karnataka'
        },
        {
            _id: '6aa10f70ca0932e6eaec1f5c',
            stateId: 'ST-TAM-4607',
            name: 'Tamil Nadu',
            code: 'TN',
            status: 'Active',
            description: 'State of Tamil Nadu'
        },
        {
            _id: '6abb46c1305af8d5cc1abed8',
            stateId: 'ST-PY',
            name: 'Pondicherry',
            code: 'PY',
            status: 'Active',
            description: 'Union Territory of Pondicherry'
        }
    ];

    for (const s of statesData) {
        await State.updateOne(
            { $or: [{ _id: s._id }, { name: s.name }, { code: s.code }] },
            { $set: s },
            { upsert: true }
        );
    }
    console.log('✅ States synchronized: Karnataka, Tamil Nadu, Pondicherry');

    // 2. RESTORE DISTRICTS
    const dataDir = path.join(__dirname, '..', 'data');
    const seedDir = path.join(__dirname, '..', 'seed');

    let districtsJson = [];
    if (fs.existsSync(path.join(dataDir, 'districts.json'))) {
        districtsJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'districts.json'), 'utf8'));
    }

    let locationData = { districts: [], divisions: [], pincodes: [] };
    if (fs.existsSync(path.join(seedDir, 'locationData.js'))) {
        locationData = require(path.join(seedDir, 'locationData.js'));
    }

    const districtOps = [];
    const usedDistrictIds = new Set();

    // 2a. Tamil Nadu & Pondicherry districts from JSON
    for (const d of districtsJson) {
        const id = String(d._id || d.id);
        const name = d.name.trim();
        const code = (d.code || name.substring(0, 4)).trim().toUpperCase();
        const stateId = String(d.stateId?._id || d.stateId || '6aa10f70ca0932e6eaec1f5c');
        const districtId = d.districtId || `DIST-${code}`;
        usedDistrictIds.add(districtId);

        districtOps.push({
            updateOne: {
                filter: { _id: id },
                update: {
                    $set: {
                        _id: id,
                        districtId: districtId,
                        stateId: stateId,
                        name: name,
                        code: code,
                        headquarters: d.headquarters || '',
                        description: d.description || '',
                        notes: d.notes || '',
                        status: d.status || 'Active'
                    }
                },
                upsert: true
            }
        });
    }

    // 2b. Karnataka districts from locationData
    const kaDistrictConfig = {
        'dist_blr_u': { id: 'dist_bengaluru_urban', code: 'BLRU', districtId: 'DIST-KAR-BLRU', name: 'Bengaluru Urban' },
        'dist_blr_r': { id: 'dist_blr_r', code: 'BLRR', districtId: 'DIST-KAR-BLRR', name: 'Bengaluru Rural' },
        'dist_mys': { id: 'dist_mys', code: 'MYS', districtId: 'DIST-KAR-MYS', name: 'Mysuru' },
        'dist_mandya': { id: 'dist_mandya', code: 'MAND', districtId: 'DIST-KAR-MAND', name: 'Mandya' },
        'dist_hassan': { id: 'dist_hassan', code: 'HASS', districtId: 'DIST-KAR-HASS', name: 'Hassan' },
        'dist_belagavi': { id: 'dist_belagavi', code: 'BELA', districtId: 'DIST-KAR-BELA', name: 'Belagavi' },
        'dist_hubballi': { id: 'dist_hubballi', code: 'DHAR', districtId: 'DIST-KAR-DHAR', name: 'Dharwad' },
        'dist_kalaburagi': { id: 'dist_kalaburagi', code: 'KALA', districtId: 'DIST-KAR-KALA', name: 'Kalaburagi' },
        'dist_vijayapura': { id: 'dist_vijayapura', code: 'VIJA', districtId: 'DIST-KAR-VIJA', name: 'Vijayapura' },
        'dist_bidar': { id: 'dist_bidar', code: 'BIDA', districtId: 'DIST-KAR-BIDA', name: 'Bidar' },
        'dist_ballari': { id: 'dist_ballari', code: 'BALL', districtId: 'DIST-KAR-BALL', name: 'Ballari' },
        'dist_davanagere': { id: 'dist_davanagere', code: 'DAVA', districtId: 'DIST-KAR-DAVA', name: 'Davanagere' },
        'dist_kolar': { id: 'dist_kolar', code: 'KOLA', districtId: 'DIST-KAR-KOLA', name: 'Kolar' },
        'dist_chitradurga': { id: 'dist_chitradurga', code: 'CHIT', districtId: 'DIST-KAR-CHIT', name: 'Chitradurga' },
        'dist_mangaluru': { id: 'dist_mangaluru', code: 'DAKS', districtId: 'DIST-KAR-DAKS', name: 'Dakshina Kannada' },
        'dist_udupi': { id: 'dist_udupi', code: 'UDUP', districtId: 'DIST-KAR-UDUP', name: 'Udupi' },
        'dist_shivamogga': { id: 'dist_shivamogga', code: 'SHIV', districtId: 'DIST-KAR-SHIV', name: 'Shivamogga' },
        'dist_karwar': { id: 'dist_karwar', code: 'UTTA', districtId: 'DIST-KAR-UTTA', name: 'Uttara Kannada' },
        'dist_tumakuru': { id: 'dist_tumakuru', code: 'TUMA', districtId: 'DIST-KAR-TUMA', name: 'Tumakuru' },
        'dist_raichur': { id: 'dist_raichur', code: 'RAIC', districtId: 'DIST-KAR-RAIC', name: 'Raichur' }
    };

    const kaDistricts = locationData.districts.filter(d => d.stateId === 'state_ka');
    for (const d of kaDistricts) {
        const key = d.id || d._id;
        const conf = kaDistrictConfig[key] || {
            id: key,
            code: (d.code || d.name.substring(0, 4)).toUpperCase(),
            districtId: `DIST-KAR-${key.toUpperCase()}`,
            name: d.name.trim()
        };

        districtOps.push({
            updateOne: {
                filter: { $or: [{ _id: conf.id }, { name: conf.name, stateId: 'state_ka' }] },
                update: {
                    $set: {
                        _id: conf.id,
                        districtId: conf.districtId,
                        stateId: 'state_ka',
                        name: conf.name,
                        code: conf.code,
                        headquarters: conf.name,
                        description: `District of Karnataka`,
                        notes: '',
                        status: 'Active'
                    }
                },
                upsert: true
            }
        });
    }

    if (districtOps.length > 0) {
        await District.bulkWrite(districtOps);
        console.log(`✅ Districts synchronized: ${districtOps.length} districts`);
    }

    // 3. RESTORE DIVISIONS
    let divisionsJson = [];
    if (fs.existsSync(path.join(dataDir, 'divisions.json'))) {
        divisionsJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'divisions.json'), 'utf8'));
    }

    const divisionOps = [];
    const usedDivIds = new Set();

    // 3a. Tamil Nadu & Pondicherry divisions from JSON
    for (const v of divisionsJson) {
        const id = String(v._id || v.id);
        const name = v.name.trim();
        const code = (v.code || name.substring(0, 4)).trim().toUpperCase();
        let divisionId = v.divisionId || `DIV-${id}`;
        if (usedDivIds.has(divisionId)) {
            divisionId = `${divisionId}-${id.slice(-4)}`;
        }
        usedDivIds.add(divisionId);

        divisionOps.push({
            updateOne: {
                filter: { _id: id },
                update: {
                    $set: {
                        _id: id,
                        divisionId: divisionId,
                        stateId: String(v.stateId?._id || v.stateId || '6aa10f70ca0932e6eaec1f5c'),
                        districtId: String(v.districtId?._id || v.districtId),
                        name: name,
                        code: code,
                        divisionType: v.divisionType || 'Administrative',
                        talukInfo: v.talukInfo || name,
                        description: v.description || '',
                        notes: v.notes || '',
                        status: v.status || 'Active'
                    }
                },
                upsert: true
            }
        });
    }

    // 3b. Karnataka divisions from locationData
    const kaDivisions = locationData.divisions.filter(d => d.stateId === 'state_ka');
    for (const v of kaDivisions) {
        let rawId = String(v._id || v.id);
        let id = rawId;
        if (id === 'div_blr_s') id = 'div_blr_south';

        let districtId = String(v.districtId);
        if (districtId === 'dist_blr_u') districtId = 'dist_bengaluru_urban';

        const name = v.name.trim();
        const code = (v.code || name.substring(0, 4)).replace(/\s+/g, '').toUpperCase();
        const divisionId = `DIV-KA-${id.replace('div_', '').toUpperCase()}`;

        divisionOps.push({
            updateOne: {
                filter: { $or: [{ _id: id }, { name: name, districtId: districtId }] },
                update: {
                    $set: {
                        _id: id,
                        divisionId: divisionId,
                        stateId: 'state_ka',
                        districtId: districtId,
                        name: name,
                        code: code,
                        divisionType: 'Administrative',
                        talukInfo: name,
                        description: 'Division in Karnataka',
                        notes: '',
                        status: 'Active'
                    }
                },
                upsert: true
            }
        });
    }

    if (divisionOps.length > 0) {
        await Division.bulkWrite(divisionOps);
        console.log(`✅ Divisions synchronized: ${divisionOps.length} divisions`);
    }

    // 4. RESTORE PINCODES
    let pincodesJson = [];
    if (fs.existsSync(path.join(dataDir, 'pincodes.json'))) {
        pincodesJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'pincodes.json'), 'utf8'));
    }

    const pincodeOps = [];
    const processedCodes = new Set();

    // 4a. Karnataka pincodes from locationData
    const kaPincodes = locationData.pincodes.filter(p => p.stateId === 'state_ka');
    for (const p of kaPincodes) {
        const code = String(p.code).trim();
        if (processedCodes.has(code)) continue;
        processedCodes.add(code);

        let divisionId = String(p.divisionId);
        if (divisionId === 'div_blr_s') divisionId = 'div_blr_south';

        let districtId = String(p.districtId);
        if (districtId === 'dist_blr_u') districtId = 'dist_bengaluru_urban';

        let divName = 'Division';
        const divMatch = kaDivisions.find(d => d._id === p.divisionId || d.id === p.divisionId);
        if (divMatch) divName = divMatch.name;

        let distName = 'Bengaluru Urban';
        const distMatch = kaDistricts.find(d => d.id === p.districtId || d._id === p.districtId);
        if (distMatch) distName = distMatch.name;

        pincodeOps.push({
            updateOne: {
                filter: { code: code },
                update: {
                    $set: {
                        _id: `pin_${code}`,
                        code: code,
                        pincodeId: `PIN-${code}`,
                        name: p.areaName || `PIN ${code}`,
                        postOffice: p.areaName || '',
                        taluk: divName,
                        area: p.areaName || '',
                        district: distName,
                        state: 'Karnataka',
                        division: divName,
                        stateId: 'state_ka',
                        districtId: districtId,
                        divisionId: divisionId,
                        status: 'Active',
                        deliveryStatus: 'Delivery',
                        joiningFee: 100000,
                        isBlocked: false
                    }
                },
                upsert: true
            }
        });
    }

    // 4b. Tamil Nadu & Pondicherry pincodes from JSON
    for (const p of pincodesJson) {
        const code = String(p.code || p.pincode).trim();
        if (processedCodes.has(code)) continue;
        processedCodes.add(code);

        pincodeOps.push({
            updateOne: {
                filter: { code: code },
                update: {
                    $set: {
                        _id: String(p._id || p.id || `pin_${code}`),
                        code: code,
                        pincodeId: p.pincodeId || `PIN-${code}`,
                        name: p.name || p.areaName || p.area || p.taluk || `PIN ${code}`,
                        postOffice: p.postOffice || p.name || '',
                        taluk: p.taluk || '',
                        area: p.area || p.areaName || '',
                        district: p.district || '',
                        state: p.state || '',
                        division: p.division || '',
                        stateId: p.stateId ? String(p.stateId?._id || p.stateId) : null,
                        districtId: p.districtId ? String(p.districtId?._id || p.districtId) : null,
                        divisionId: p.divisionId ? String(p.divisionId?._id || p.divisionId) : null,
                        status: p.status || 'Active',
                        deliveryStatus: p.deliveryStatus || 'Delivery',
                        joiningFee: p.joiningFee || 100000,
                        isBlocked: p.isBlocked || false
                    }
                },
                upsert: true
            }
        });
    }

    // 4c. Extra unique pincodes from territoryauditlogs (if available in DB)
    try {
        const db = mongoose.connection.db;
        if (db) {
            const auditLogs = await db.collection('territoryauditlogs').find({
                action: 'Pincode Created'
            }).toArray();

            for (const l of auditLogs) {
                const p = l.newValue;
                if (!p || !p.code) continue;
                const code = String(p.code).trim();
                if (processedCodes.has(code)) continue;
                processedCodes.add(code);

                pincodeOps.push({
                    updateOne: {
                        filter: { code: code },
                        update: {
                            $set: {
                                _id: String(p._id || `pin_${code}`),
                                code: code,
                                pincodeId: p.pincodeId || `PIN-${code}`,
                                name: p.name || `PIN ${code}`,
                                postOffice: p.postOffice || p.name || '',
                                taluk: p.taluk || '',
                                area: p.area || '',
                                district: p.district || '',
                                state: p.state || '',
                                division: p.division || '',
                                stateId: p.stateId ? String(p.stateId?._id || p.stateId) : null,
                                districtId: p.districtId ? String(p.districtId?._id || p.districtId) : null,
                                divisionId: p.divisionId ? String(p.divisionId?._id || p.divisionId) : null,
                                status: p.status || 'Active',
                                deliveryStatus: p.deliveryStatus || 'Delivery',
                                joiningFee: p.joiningFee || 100000,
                                isBlocked: p.isBlocked || false
                            }
                        },
                        upsert: true
                    }
                });
            }
        }
    } catch (auditErr) {
        console.warn('Audit logs extra pincode recovery note:', auditErr.message);
    }

    if (pincodeOps.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < pincodeOps.length; i += batchSize) {
            const batch = pincodeOps.slice(i, i + batchSize);
            await Pincode.bulkWrite(batch);
        }
        console.log(`✅ Pincodes synchronized: ${pincodeOps.length} unique pincodes`);
    }

    // 5. SYNC PINCODE ASSIGNMENTS WITH ACTIVE MANAGERS & AGENTS
    try {
        const assignments = await PincodeAssignment.find({}).lean();
        if (assignments.length > 0) {
            console.log(`Linking ${assignments.length} existing pincode assignments...`);
            for (const a of assignments) {
                if (a.pincode) {
                    const updateObj = {};
                    if (a.assignedAgentId) updateObj.activeAgentId = a.assignedAgentId;
                    if (a.stateId) updateObj.stateId = a.stateId;
                    if (a.districtId) updateObj.districtId = a.districtId;
                    if (a.divisionId) updateObj.divisionId = a.divisionId;
                    if (Object.keys(updateObj).length > 0) {
                        await Pincode.updateOne({ code: String(a.pincode).trim() }, { $set: updateObj });
                    }
                }
            }
        }
    } catch (assignErr) {
        console.warn('Pincode assignment linking warning:', assignErr.message);
    }

    const [finalStates, finalDistricts, finalDivisions, finalPincodes] = await Promise.all([
        State.countDocuments(),
        District.countDocuments(),
        Division.countDocuments(),
        Pincode.countDocuments()
    ]);

    console.log(`🎉 Territory Synchronization Complete!`);
    console.log(`   States: ${finalStates}`);
    console.log(`   Districts: ${finalDistricts}`);
    console.log(`   Divisions: ${finalDivisions}`);
    console.log(`   Pincodes: ${finalPincodes}`);

    return {
        success: true,
        counts: {
            states: finalStates,
            districts: finalDistricts,
            divisions: finalDivisions,
            pincodes: finalPincodes
        }
    };
}

// Allow standalone CLI execution: node backend/utils/syncTerritoryData.js
if (require.main === module) {
    const connectDB = require('../config/db');
    (async () => {
        try {
            await connectDB();
            await syncTerritoryData({ force: true });
            process.exit(0);
        } catch (err) {
            console.error('Territory sync execution failed:', err);
            process.exit(1);
        }
    })();
}

module.exports = syncTerritoryData;
