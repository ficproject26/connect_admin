const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
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
    if (!options.force && stateCount >= 4 && districtCount >= 58 && divisionCount >= 370 && pincodeCount >= 2000) {
        console.log('✅ Territory data already populated and intact.');
        return { success: true, message: 'Data already intact', counts: { stateCount, districtCount, divisionCount, pincodeCount } };
    }

    console.log('🚀 Restoring canonical territory data...');

    // 1. RESTORE STATES (Karnataka, Tamil Nadu, Pondicherry, Gujarat)
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
        },
        {
            _id: '6acc8895488562fc701f6dd5',
            stateId: 'ST-GJ',
            name: 'Gujarat',
            code: 'GJ',
            status: 'Active',
            description: 'State of Gujarat'
        }
    ];

    for (const s of statesData) {
        const { _id: stateDbId, ...stateFields } = s;
        await State.updateOne(
            { $or: [{ _id: s._id }, { name: s.name }, { code: s.code }] },
            { 
                $setOnInsert: { _id: stateDbId },
                $set: stateFields 
            },
            { upsert: true }
        );
    }
    console.log('✅ States synchronized: Karnataka, Tamil Nadu, Pondicherry, Gujarat');

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

    const activeTnDoc = await State.findOne({ $or: [{ name: 'Tamil Nadu' }, { code: 'TN' }] });
    const activeTnId = String(activeTnDoc ? activeTnDoc._id : '6aa10f70ca0932e6eaec1f5c');

    const gujStateDoc = await State.findOne({ $or: [{ name: 'Gujarat' }, { code: 'GJ' }] });
    const gujStateId = String(gujStateDoc ? gujStateDoc._id : '6acc8895488562fc701f6dd5');

    // 2a. Tamil Nadu & Pondicherry districts from JSON
    for (const d of districtsJson) {
        const id = String(d._id || d.id);
        const name = d.name.trim();
        const code = (d.code || name.substring(0, 4)).trim().toUpperCase();
        let stateId = String(d.stateId?._id || d.stateId || '6aa10f70ca0932e6eaec1f5c');
        if (stateId === '6aa10f70ca0932e6eaec1f5c' && activeTnId) {
            stateId = activeTnId;
        }
        const districtId = d.districtId || `DIST-${code}`;
        usedDistrictIds.add(districtId);

        districtOps.push({
            updateOne: {
                filter: { _id: id },
                update: {
                    $setOnInsert: { _id: id },
                    $set: {
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

    // 2b. Gujarat district (Ahmedabad) from verified audit log
    districtOps.push({
        updateOne: {
            filter: { $or: [{ _id: '6acc8d72cbff842930bdf7aa' }, { districtId: 'DIST-GUJ-AHMD' }, { name: 'Ahmedabad', stateId: gujStateId }] },
            update: {
                $setOnInsert: { _id: '6acc8d72cbff842930bdf7aa' },
                $set: {
                    districtId: 'DIST-GUJ-AHMD',
                    stateId: gujStateId,
                    name: 'Ahmedabad',
                    code: 'AHMD',
                    headquarters: 'Ahmedabad',
                    description: 'District of Gujarat',
                    notes: '',
                    status: 'Active'
                }
            },
            upsert: true
        }
    });

    // 2c. Karnataka districts from locationData
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
                    $setOnInsert: { _id: conf.id },
                    $set: {
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
    const usedDivNames = new Set();

    // 3a. Canonical divisions from JSON (covers Tamil Nadu, Pondicherry, and Karnataka)
    for (const v of divisionsJson) {
        const id = String(v._id || v.id);
        const name = v.name.trim();
        const code = (v.code || name.substring(0, 4)).trim().toUpperCase();
        let divisionId = v.divisionId || `DIV-${id}`;

        let divStateId = String(v.stateId?._id || v.stateId || '6aa10f70ca0932e6eaec1f5c');
        if (divStateId === '6aa10f70ca0932e6eaec1f5c' && activeTnId) {
            divStateId = activeTnId;
        }
        const distId = String(v.districtId?._id || v.districtId);
        const nameKey = `${distId}_${name.toLowerCase()}`;

        if (!usedDivIds.has(id) && !usedDivNames.has(nameKey)) {
            usedDivIds.add(id);
            usedDivNames.add(nameKey);
            divisionOps.push({
                updateOne: {
                    filter: { _id: id },
                    update: {
                        $setOnInsert: { _id: id },
                        $set: {
                            divisionId: divisionId,
                            stateId: divStateId,
                            districtId: distId,
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
    }

    // 3b. Gujarat division (Navrangpura) from verified audit log
    const navrId = '6acc8d73cbff842930bdf7ac';
    const navrNameKey = '6acc8d72cbff842930bdf7aa_navrangpura';
    if (!usedDivIds.has(navrId) && !usedDivNames.has(navrNameKey)) {
        usedDivIds.add(navrId);
        usedDivNames.add(navrNameKey);
        divisionOps.push({
            updateOne: {
                filter: { _id: navrId },
                update: {
                    $setOnInsert: { _id: navrId },
                    $set: {
                        divisionId: 'DIV-AHMD-NAVR',
                        stateId: gujStateId,
                        districtId: '6acc8d72cbff842930bdf7aa',
                        name: 'Navrangpura',
                        code: 'NAVR',
                        divisionType: 'Administrative',
                        talukInfo: '',
                        description: 'Division in Gujarat',
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

    // Fix existing Tamil Nadu pincodes in database with temporary stateId 6accb91c0ae5178fae481dee
    if (activeTnId) {
        try {
            await Pincode.updateMany(
                { stateId: '6accb91c0ae5178fae481dee' },
                { $set: { stateId: activeTnId, state: 'Tamil Nadu' } }
            );
        } catch (tnErr) {
            console.warn('TN stateId pincode normalization warning:', tnErr.message);
        }
    }

    const pincodeOps = [];
    const processedCodes = new Set();

    // 4a. Karnataka pincodes from locationData
    const kaDivisions = locationData.divisions.filter(d => d.stateId === 'state_ka');
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
                    $setOnInsert: { _id: `pin_${code}` },
                    $set: {
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
                    $setOnInsert: { _id: String(p._id || p.id || `pin_${code}`) },
                    $set: {
                        code: code,
                        pincodeId: p.pincodeId || `PIN-${code}`,
                        name: p.name || p.areaName || p.area || p.taluk || `PIN ${code}`,
                        postOffice: p.postOffice || p.name || '',
                        taluk: p.taluk || '',
                        area: p.area || p.areaName || '',
                        district: p.district || '',
                        state: p.state || '',
                        division: p.division || '',
                        stateId: (p.stateId ? String(p.stateId?._id || p.stateId) : null) === '6aa10f70ca0932e6eaec1f5c' && activeTnId ? activeTnId : (p.stateId ? String(p.stateId?._id || p.stateId) : null),
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

    // 4c. Gujarat Pincode (380009) from verified audit log
    if (!processedCodes.has('380009')) {
        processedCodes.add('380009');
        pincodeOps.push({
            updateOne: {
                filter: { code: '380009' },
                update: {
                    $setOnInsert: { _id: '6acc8d75cbff842930bdf7ae' },
                    $set: {
                        code: '380009',
                        pincodeId: 'PIN-380009',
                        name: 'Navrangpura',
                        postOffice: 'Navrangpura',
                        taluk: '',
                        area: 'Navrangpura Post Office',
                        district: 'Ahmedabad',
                        state: 'Gujarat',
                        division: 'Navrangpura',
                        deliveryStatus: 'Delivery',
                        status: 'Active',
                        description: '',
                        notes: '',
                        stateId: gujStateId,
                        districtId: '6acc8d72cbff842930bdf7aa',
                        divisionId: '6acc8d73cbff842930bdf7ac',
                        joiningFee: 100000,
                        isBlocked: false
                    }
                },
                upsert: true
            }
        });
    }

    // 4d. Extra unique pincodes from territoryauditlogs (if available in DB)
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
                            $setOnInsert: { _id: String(p._id || `pin_${code}`) },
                            $set: {
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
                    const updateObj = { isAssigned: true };
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

    try {
        const territoryRoute = require('../routes/territory');
        if (territoryRoute && territoryRoute.invalidateHierarchyCache) {
            territoryRoute.invalidateHierarchyCache();
        }
    } catch (e) {}

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
