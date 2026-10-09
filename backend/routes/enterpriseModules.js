const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Pincode = require('../models/Pincode');
const MembershipRequest = require('../models/MembershipRequest');
const PayrollRecord = require('../models/PayrollRecord');
const SupportTeam = require('../models/SupportTeam');
const Transaction = require('../models/Transaction');
const DeliveryPartner = require('../models/DeliveryPartner');
const CardHolder = require('../models/CardHolder');
const SecuritySession = require('../models/SecuritySession');
const UserSession = require('../models/UserSession');
const AuditLog = require('../models/AuditLog');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Manager = require('../models/Manager');
const Payment = require('../models/Payment');
const PaymentAuditLog = require('../models/PaymentAuditLog');
const cacheService = require('../utils/cacheService');

// Helper to get Socket.IO instance
const getIo = (req) => req.app.get('io');

// =========================================================
// 1. VENDOR DIRECTORY & AUTO ASSIGN PINCODE AGENT
// =========================================================

// Helper to sanitize and format clean vendor addresses without placeholder strings (e.g. City, State, 111111, dfghjkhj)
const sanitizeVendorAddressObj = (vObj) => {
    const isPlaceholder = (val) => {
        if (!val || typeof val !== 'string') return true;
        const clean = val.trim().toLowerCase();
        return ['city', 'state', '111111', '111', '000000', 'n/a', 'none', 'undefined', 'null', 'dfghjkhj', 'asdf', 'qwerty', '—', '-', '--'].includes(clean) || /^(.)\1+$/.test(clean);
    };

    const toStr = (val) => {
        if (!val) return '';
        if (typeof val === 'string') return val.trim();
        if (typeof val === 'number') return String(val).trim();
        if (typeof val === 'object') {
            return (val.street || val.address || val.line1 || val.full || val.formatted || '').trim();
        }
        return String(val).trim();
    };

    let street = toStr(vObj.businessAddress || vObj.street || vObj.address || vObj.streetAddress);
    let city = toStr(vObj.city || vObj.district || vObj.addressCity);
    let state = toStr(vObj.state || vObj.addressState);
    let pin = toStr(vObj.postalCode || vObj.pincode || vObj.zipCode);
    let area = toStr(vObj.assignedArea);

    if (isPlaceholder(street)) street = '';
    if (isPlaceholder(city)) city = '';
    if (isPlaceholder(state)) state = '';
    if (isPlaceholder(pin)) pin = '';

    if (area && area.includes('/') && (!state || !city)) {
        const parts = area.split('/').map(p => p.trim());
        if (!state && parts[0] && !isPlaceholder(parts[0])) state = parts[0];
        if (!city && parts[1] && !isPlaceholder(parts[1])) city = parts[1];
    }

    const addressParts = [];
    if (street && !isPlaceholder(street)) addressParts.push(street);
    const streetLower = street ? street.toLowerCase() : '';
    if (city && !isPlaceholder(city) && !streetLower.includes(city.toLowerCase())) addressParts.push(city);
    if (state && !isPlaceholder(state) && !streetLower.includes(state.toLowerCase()) && state.toLowerCase() !== city.toLowerCase()) addressParts.push(state);

    let baseAddr = addressParts.join(', ');
    baseAddr = baseAddr.replace(/,\s*[—\-]+(?:\s*\(\d+\))?$/g, '').replace(/,\s*—\s*,/g, ', ').replace(/,\s*$/, '').trim();

    const hasPin = pin && baseAddr.includes(pin);
    vObj.fullAddress = baseAddr ? (pin && !hasPin ? `${baseAddr} (${pin})` : baseAddr) : (pin ? `Pincode: ${pin}` : '—');
    vObj.assignedArea = (state && city) ? `${state} / ${city}` : (state || city || '—');
    vObj.pincode = pin || '—';
    vObj.city = city || '—';
    vObj.state = state || '—';
    vObj.address = street || baseAddr || 'Address not provided';
    return vObj;
};

const batchEnrichVendors = async (vendorsList = []) => {
    if (!Array.isArray(vendorsList) || vendorsList.length === 0) return [];

    const agentIdsSet = new Set();
    const pincodeCodesSet = new Set();

    vendorsList.forEach(v => {
        const vObj = typeof v.toObject === 'function' ? v.toObject() : v;
        const possibleAgentId = (vObj.assignedAgent && typeof vObj.assignedAgent === 'object' ? (vObj.assignedAgent._id || vObj.assignedAgent) : vObj.assignedAgent) || vObj.agentId || vObj.onboardedBy || vObj.referredBy || vObj.onboardedByAgentId;
        if (possibleAgentId) {
            agentIdsSet.add(possibleAgentId.toString());
        }

        sanitizeVendorAddressObj(vObj);
        const pinCode = vObj.fullAddress?.match(/\b\d{6}\b/)?.[0] || vObj.pincode;
        if (pinCode && /^\d{6}$/.test(pinCode)) {
            pincodeCodesSet.add(pinCode);
        }
    });

    const agentIdsArr = Array.from(agentIdsSet);
    const validObjectIds = agentIdsArr.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
    const stringKeys = agentIdsArr;

    const agentDocsMap = new Map();
    const pincodeMap = new Map();

    const db = mongoose.connection.db;
    const fetchPromises = [];

    if (validObjectIds.length > 0 || stringKeys.length > 0) {
        fetchPromises.push(
            User.find({
                $or: [
                    ...(validObjectIds.length > 0 ? [{ _id: { $in: validObjectIds } }] : []),
                    ...(stringKeys.length > 0 ? [{ registrationId: { $in: stringKeys } }, { email: { $in: stringKeys } }] : [])
                ]
            }).select('name registrationId pincode assignedArea level role').lean().then(users => {
                users.forEach(u => {
                    if (u._id) agentDocsMap.set(u._id.toString(), u);
                    if (u.registrationId) agentDocsMap.set(u.registrationId.toString(), u);
                    if (u.email) agentDocsMap.set(u.email.toLowerCase().trim(), u);
                });
            })
        );

        if (db) {
            fetchPromises.push(
                db.collection('agents').find({
                    $or: [
                        ...(validObjectIds.length > 0 ? [{ _id: { $in: validObjectIds } }] : []),
                        ...(stringKeys.length > 0 ? [{ registrationId: { $in: stringKeys } }, { email: { $in: stringKeys } }] : [])
                    ]
                }, {
                    projection: {
                        name: 1,
                        registrationId: 1,
                        pincode: 1,
                        assignedArea: 1,
                        territory: 1,
                        level: 1,
                        role: 1,
                        email: 1
                    }
                }).toArray().then(rawAgents => {
                    rawAgents.forEach(a => {
                        if (a._id && !agentDocsMap.has(a._id.toString())) agentDocsMap.set(a._id.toString(), a);
                        if (a.registrationId && !agentDocsMap.has(a.registrationId.toString())) agentDocsMap.set(a.registrationId.toString(), a);
                    });
                }).catch(() => {})
            );
        }
    }

    if (pincodeCodesSet.size > 0) {
        const pinCodesArr = Array.from(pincodeCodesSet);
        pinCodesArr.forEach(c => pincodeMap.set(c, null));
        fetchPromises.push(
            Pincode.find({ code: { $in: pinCodesArr } })
                .populate('activeAgentId', 'name phone email level')
                .lean()
                .then(pins => {
                    pins.forEach(p => {
                        if (p.code) pincodeMap.set(p.code.toString(), p);
                    });
                })
        );
    }

    await Promise.all(fetchPromises);

    return Promise.all(vendorsList.map(v => enrichVendorData(v, agentDocsMap, pincodeMap)));
};

const enrichVendorData = async (v, preloadedAgentMap = null, preloadedPincodeMap = null) => {
    const vObj = typeof v.toObject === 'function' ? v.toObject() : v;

    if (Array.isArray(vObj.categories) && vObj.categories.length > 0) {
        vObj.category = vObj.categories.join(', ');
    } else if (vObj.categories) {
        vObj.category = vObj.categories;
    } else if (!vObj.category) {
        vObj.category = vObj.vendorType || vObj.businessCategory || vObj.shopType || 'Retail & Stores';
    }

    vObj.phone = vObj.mobileNumber || vObj.mobileContact || vObj.mobile || vObj.phone || vObj.phoneNumber || vObj.contactNumber || vObj.telephone || vObj.contactPersonPhone || vObj.mobileNo || vObj.phoneNo || '—';
    vObj.mobileNumber = vObj.mobileNumber || (vObj.phone !== '—' ? vObj.phone : '');

    const isInvalidLoc = (val) => {
        if (!val || typeof val !== 'string') return true;
        const clean = val.trim().toLowerCase();
        return ['city', 'state', '111111', '111', '000000', 'n/a', 'none', 'undefined', 'null', 'dfghjkhj', 'asdf', 'qwerty'].includes(clean) || /^(.)\1+$/.test(clean);
    };

    let city = (!isInvalidLoc(vObj.city) ? vObj.city : !isInvalidLoc(vObj.district) ? vObj.district : '').trim();
    let state = (!isInvalidLoc(vObj.state) ? vObj.state : '').trim();
    let pin = (vObj.pincode || vObj.postalCode || '').trim();
    let addr = (vObj.address || vObj.fullAddress || vObj.businessAddress || vObj.street || '').trim();

    if ((!city || !state) && addr) {
        const parts = addr.split(',').map(p => p.trim()).filter(p => p && !isInvalidLoc(p));
        for (const part of parts) {
            if (part.toUpperCase().includes('DISTRICT') || part.toUpperCase().includes('DIST')) {
                const cleanDist = part.replace(/DISTRICT|DIST/gi, '').trim();
                if (!city && cleanDist) city = cleanDist;
            } else if (part.toUpperCase().includes('TALUK') || part.toUpperCase().includes('TK') || part.toUpperCase().includes('TOWN')) {
                const cleanTaluk = part.replace(/TALUK|TK|TOWN/gi, '').trim();
                if (!city && cleanTaluk) city = cleanTaluk;
            } else if (!city && parts.length > 1 && part !== parts[0] && !part.match(/^\d+$/)) {
                city = part;
            }
        }
    }

    vObj.city = city || '—';
    vObj.district = city || '—';
    vObj.state = state || '—';
    vObj.pincode = pin || '—';
    vObj.postalCode = pin || '—';
    if (addr) vObj.address = addr;

    // Normalize Agent Onboarded status
    const isAgentOnboarded = vObj.joiningType === 'agent' ||
        !!vObj.onboardedByAgent ||
        !!vObj.onboardedBy ||
        !!vObj.agentId ||
        !!vObj.assignedAgent ||
        !!vObj.onboardedByAgentId ||
        !!vObj.referredBy ||
        !!vObj.agentName ||
        (vObj.createdVia && String(vObj.createdVia).toLowerCase() === 'agent') ||
        (vObj.registrationSource && String(vObj.registrationSource).toLowerCase() === 'agent');

    if (isAgentOnboarded) {
        vObj.joiningType = 'agent';
        
        let agentDoc = null;
        const possibleAgentId = (vObj.assignedAgent && typeof vObj.assignedAgent === 'object' ? (vObj.assignedAgent._id || vObj.assignedAgent) : vObj.assignedAgent) || vObj.agentId || vObj.onboardedBy || vObj.referredBy || vObj.onboardedByAgentId;

        if (possibleAgentId) {
            const keyStr = possibleAgentId.toString();
            if (preloadedAgentMap && preloadedAgentMap.has(keyStr)) {
                agentDoc = preloadedAgentMap.get(keyStr);
            } else if (mongoose.Types.ObjectId.isValid(possibleAgentId)) {
                agentDoc = await User.findById(possibleAgentId).select('name registrationId pincode assignedArea level role').lean();
            }
            if (!agentDoc) {
                const db = mongoose.connection.db;
                if (db) {
                    try {
                        const filter = mongoose.Types.ObjectId.isValid(possibleAgentId)
                            ? { _id: new mongoose.Types.ObjectId(possibleAgentId) }
                            : { $or: [{ registrationId: possibleAgentId }, { email: possibleAgentId }] };
                        agentDoc = await db.collection('agents').findOne(filter, {
                            projection: {
                                name: 1,
                                registrationId: 1,
                                pincode: 1,
                                assignedArea: 1,
                                territory: 1,
                                level: 1,
                                role: 1
                            }
                        });
                    } catch (e) {}
                }
            }
        }

        const rawAgentLvl = agentDoc?.level ?? agentDoc?.role ?? 'PIN';
        let agentLvlCode = 'PIN';
        if (rawAgentLvl === 1 || rawAgentLvl === '1' || String(rawAgentLvl).toLowerCase().includes('state')) {
            agentLvlCode = 'STA';
        } else if (rawAgentLvl === 2 || rawAgentLvl === '2' || String(rawAgentLvl).toLowerCase().includes('dist')) {
            agentLvlCode = 'DIS';
        } else if (rawAgentLvl === 3 || rawAgentLvl === '3' || String(rawAgentLvl).toLowerCase().includes('div')) {
            agentLvlCode = 'DIV';
        } else if (rawAgentLvl === 4 || rawAgentLvl === '4' || String(rawAgentLvl).toLowerCase().includes('pin')) {
            agentLvlCode = 'PIN';
        } else if (typeof rawAgentLvl === 'string' && rawAgentLvl.trim()) {
            agentLvlCode = rawAgentLvl.trim().slice(0, 4).toUpperCase();
        }

        const agentName = agentDoc?.name || (typeof vObj.assignedAgent === 'object' ? vObj.assignedAgent?.name : null) || (typeof vObj.onboardedBy === 'object' ? vObj.onboardedBy?.name : null) || (typeof vObj.agentId === 'object' ? vObj.agentId?.name : null) || (typeof vObj.referredBy === 'object' ? vObj.referredBy?.name : null) || (typeof vObj.onboardedBy === 'string' ? vObj.onboardedBy : null) || vObj.agentName || 'Field Agent';

        const regId = agentDoc?.registrationId || (typeof vObj.assignedAgent === 'object' ? vObj.assignedAgent?.registrationId : null) || (typeof vObj.onboardedBy === 'object' ? vObj.onboardedBy?.registrationId : null) || (typeof vObj.agentId === 'object' ? vObj.agentId?.registrationId : null) || `AG-${agentLvlCode}-${String(agentDoc?._id || '1001').slice(-4)}`;

        const pinCode = agentDoc?.pincode || (agentDoc?.territory && typeof agentDoc.territory === 'object' ? agentDoc.territory.pincode : null) || '—';

        vObj.onboardedByAgent = {
            name: agentName,
            registrationId: regId,
            pincode: pinCode
        };
    } else {
        const isManagerOnboarded = vObj.joiningType === 'manager' ||
            !!vObj.onboardedByManager ||
            !!vObj.managerId ||
            !!vObj.assignedManager ||
            !!vObj.onboardedByManagerId ||
            !!vObj.managerName ||
            (vObj.createdVia && String(vObj.createdVia).toLowerCase() === 'manager') ||
            (vObj.registrationSource && String(vObj.registrationSource).toLowerCase() === 'manager') ||
            (vObj.addedBy && vObj.addedBy.role && String(vObj.addedBy.role).toLowerCase().includes('manager'));

        if (isManagerOnboarded) {
            vObj.joiningType = 'manager';
            
            let managerDoc = null;
            const possibleManagerId = (vObj.assignedManager && typeof vObj.assignedManager === 'object' ? (vObj.assignedManager._id || vObj.assignedManager) : vObj.assignedManager) || vObj.managerId || vObj.onboardedByManager || vObj.onboardedByManagerId || (vObj.addedBy && vObj.addedBy.id);

            if (possibleManagerId) {
                const db = mongoose.connection.db;
                if (db) {
                    try {
                        const filter = mongoose.Types.ObjectId.isValid(possibleManagerId)
                            ? { _id: new mongoose.Types.ObjectId(possibleManagerId) }
                            : { $or: [{ managerId: possibleManagerId }, { registrationId: possibleManagerId }, { email: possibleManagerId }] };
                        managerDoc = await db.collection('managers').findOne(filter, {
                            projection: {
                                name: 1,
                                managerId: 1,
                                registrationId: 1,
                                phone: 1,
                                email: 1,
                                level: 1,
                                assignedPincode: 1,
                                assignedDistrict: 1,
                                assignedState: 1
                            }
                        });
                        if (!managerDoc) {
                            if (mongoose.Types.ObjectId.isValid(possibleManagerId)) {
                                managerDoc = await User.findById(possibleManagerId).select('name registrationId phone email level role').lean();
                            } else {
                                managerDoc = await User.findOne({
                                    $or: [
                                        { _id: possibleManagerId },
                                        { managerId: possibleManagerId },
                                        { registrationId: possibleManagerId },
                                        { email: possibleManagerId }
                                    ]
                                }).select('name registrationId phone email level role').lean();
                            }
                        }
                    } catch (e) {}
                }
            }

            const managerName = managerDoc?.name || (typeof vObj.assignedManager === 'object' ? vObj.assignedManager?.name : null) || (typeof vObj.onboardedByManager === 'object' ? vObj.onboardedByManager?.name : null) || vObj.managerName || (vObj.addedBy && vObj.addedBy.name) || 'Territory Manager';

            const rawMgrLvl = managerDoc?.level ?? 'GEN';
            let mgrLvlCode = 'GEN';
            if (rawMgrLvl === 1 || rawMgrLvl === '1' || String(rawMgrLvl).toLowerCase().includes('state')) {
                mgrLvlCode = 'STM';
            } else if (rawMgrLvl === 2 || rawMgrLvl === '2' || String(rawMgrLvl).toLowerCase().includes('dist')) {
                mgrLvlCode = 'DTM';
            } else if (rawMgrLvl === 3 || rawMgrLvl === '3' || String(rawMgrLvl).toLowerCase().includes('div')) {
                mgrLvlCode = 'DIV';
            } else if (rawMgrLvl === 4 || rawMgrLvl === '4' || String(rawMgrLvl).toLowerCase().includes('pin')) {
                mgrLvlCode = 'PIN';
            } else if (typeof rawMgrLvl === 'string' && rawMgrLvl.trim()) {
                mgrLvlCode = rawMgrLvl.trim().slice(0, 3).toUpperCase();
            }

            const formatManagerLevel = (lvl) => {
                if (lvl === 1 || lvl === '1') return 'State Manager';
                if (lvl === 2 || lvl === '2') return 'District Manager';
                if (lvl === 3 || lvl === '3') return 'Division Manager';
                if (lvl === 4 || lvl === '4') return 'Pincode Manager';
                if (typeof lvl === 'string' && lvl.trim()) {
                    const s = lvl.trim().toLowerCase();
                    if (s === 'state' || s === 'state_manager') return 'State Manager';
                    if (s === 'district' || s === 'district_manager') return 'District Manager';
                    if (s === 'division' || s === 'division_manager') return 'Division Manager';
                    if (s === 'pincode' || s === 'pincode_manager') return 'Pincode Manager';
                    return lvl.charAt(0).toUpperCase() + lvl.slice(1);
                }
                return 'Manager';
            };

            const regId = managerDoc?.managerId || managerDoc?.registrationId || (typeof vObj.assignedManager === 'object' ? vObj.assignedManager?.registrationId : null) || (vObj.managerId) || `MGR-${mgrLvlCode}-${String(managerDoc?._id || '1001').slice(-4)}`;

            const pinCode = managerDoc?.assignedPincode || managerDoc?.pincode || '—';

            vObj.onboardedByManager = {
                name: managerName,
                registrationId: regId,
                pincode: pinCode,
                level: formatManagerLevel(managerDoc?.level)
            };
        } else {
            vObj.joiningType = vObj.joiningType || 'direct';
        }
    }

    sanitizeVendorAddressObj(vObj);

    const pincodeCode = vObj.fullAddress?.match(/\b\d{6}\b/)?.[0] || vObj.pincode;
    if (pincodeCode) {
        if (preloadedPincodeMap && preloadedPincodeMap.has(pincodeCode.toString())) {
            const pinDoc = preloadedPincodeMap.get(pincodeCode.toString());
            if (pinDoc && pinDoc.activeAgentId) {
                vObj.assignedPincodeAgent = pinDoc.activeAgentId;
            }
        } else {
            const pinDoc = await Pincode.findOne({ code: pincodeCode }).populate('activeAgentId', 'name phone email level').lean();
            if (pinDoc && pinDoc.activeAgentId) {
                vObj.assignedPincodeAgent = pinDoc.activeAgentId;
            }
        }
    }
    return sanitizeVendorPayload(vObj);
};

// HELPER: Deep sanitize heavy fields in vendor payload (Buffers, base64 data, large attachments)
function sanitizeVendorPayload(vObj) {
    if (!vObj || typeof vObj !== 'object') return vObj;

    // Sanitize kycDocs
    if (vObj.kycDocs && typeof vObj.kycDocs === 'object') {
        const cleanDocs = {};
        for (const [k, val] of Object.entries(vObj.kycDocs)) {
            if (Buffer.isBuffer(val) || (val && val.type === 'Buffer') || (val && val._bsontype === 'Binary')) {
                cleanDocs[k] = '[Binary Document]';
            } else if (typeof val === 'string') {
                if (val.startsWith('data:') || (val.length > 500 && !val.startsWith('http'))) {
                    cleanDocs[k] = '[Uploaded Document]';
                } else {
                    cleanDocs[k] = val;
                }
            } else if (typeof val === 'number' || typeof val === 'boolean') {
                cleanDocs[k] = val;
            }
        }
        vObj.kycDocs = cleanDocs;
    }

    // Sanitize kyc
    if (vObj.kyc && typeof vObj.kyc === 'object') {
        const cleanKyc = {};
        for (const [k, val] of Object.entries(vObj.kyc)) {
            if (Buffer.isBuffer(val) || (val && val.type === 'Buffer') || (val && val._bsontype === 'Binary')) {
                cleanKyc[k] = '[Binary Document]';
            } else if (typeof val === 'string') {
                if (val.startsWith('data:') || (val.length > 500 && !val.startsWith('http'))) {
                    cleanKyc[k] = '[Uploaded Document]';
                } else {
                    cleanKyc[k] = val;
                }
            } else if (typeof val === 'number' || typeof val === 'boolean') {
                cleanKyc[k] = val;
            }
        }
        vObj.kyc = cleanKyc;
    }

    // Sanitize businesses array
    if (Array.isArray(vObj.businesses)) {
        vObj.businesses = vObj.businesses.map(b => {
            if (!b || typeof b !== 'object') return b;
            const cleanB = { ...b };
            delete cleanB.documents;
            delete cleanB.images;
            delete cleanB.photos;
            return cleanB;
        });
    }

    // Strip top-level heavy string / binary / buffer properties
    for (const [k, val] of Object.entries(vObj)) {
        if (Buffer.isBuffer(val) || (val && val.type === 'Buffer') || (val && val._bsontype === 'Binary')) {
            delete vObj[k];
        } else if (typeof val === 'string' && (val.startsWith('data:') || (val.length > 500 && !val.startsWith('http') && (k.toLowerCase().includes('doc') || k.toLowerCase().includes('image') || k.toLowerCase().includes('photo') || k.toLowerCase().includes('file') || k.toLowerCase().includes('proof') || k.toLowerCase().includes('resume'))))) {
            vObj[k] = '[Uploaded Document]';
        }
    }

    return vObj;
}

// CANONICAL DEDUPLICATION & MERGE HELPER FOR VENDORS
const deduplicateVendorsList = (list = []) => {
    if (!Array.isArray(list) || list.length === 0) return [];

    const regMap = new Map();
    const phoneMap = new Map();
    const emailMap = new Map();
    const idMap = new Map();

    const canonicalVendors = [];

    const getCleanPhone = (v) => {
        const p = String(v.mobileNumber || v.mobile || v.phone || v.contactNumber || v.phoneNumber || '').replace(/\D/g, '');
        return p.length >= 10 ? p.slice(-10) : '';
    };

    const getCleanEmail = (v) => {
        const e = String(v.email || '').toLowerCase().trim();
        return (e && !e.includes('vendor_') && !e.includes('@connect.app') && e.includes('@')) ? e : '';
    };

    const getCleanRegId = (v) => {
        const r = String(v.registrationId || v.regId || v.vendorId || '').trim();
        return (r && r !== 'undefined' && r !== 'null' && r !== '—') ? r.toUpperCase() : '';
    };

    const isAgentCheck = (v) => {
        if (!v) return false;
        const j = String(v.joiningType || '').toLowerCase();
        const c = String(v.createdVia || '').toLowerCase();
        const r = String(v.registrationSource || '').toLowerCase();
        return j === 'agent' || c === 'agent' || r === 'agent' || Boolean(v.onboardedByAgent) || Boolean(v.onboardedBy) || Boolean(v.agentId) || Boolean(v.agentName) || Boolean(v.assignedAgent);
    };

    const isManagerCheck = (v) => {
        if (!v) return false;
        const j = String(v.joiningType || '').toLowerCase();
        const c = String(v.createdVia || '').toLowerCase();
        const r = String(v.registrationSource || '').toLowerCase();
        return j === 'manager' || c === 'manager' || r === 'manager' || Boolean(v.onboardedByManager) || Boolean(v.managerId) || Boolean(v.assignedManager) || Boolean(v.managerName);
    };

    for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const v = typeof item.toObject === 'function' ? item.toObject() : { ...item };

        const regId = getCleanRegId(v);
        const phone = getCleanPhone(v);
        const email = getCleanEmail(v);
        const idStr = v._id ? String(v._id) : '';

        let existing = null;
        if (regId && regMap.has(regId)) existing = regMap.get(regId);
        else if (phone && phoneMap.has(phone)) existing = phoneMap.get(phone);
        else if (email && emailMap.has(email)) existing = emailMap.get(email);
        else if (idStr && idMap.has(idStr)) existing = idMap.get(idStr);

        if (existing) {
            // Merge records: prefer active/approved status
            const existingStatus = String(existing.status || '').toLowerCase().trim();
            const currentStatus = String(v.status || '').toLowerCase().trim();
            if (['active', 'approved'].includes(currentStatus) && !['active', 'approved'].includes(existingStatus)) {
                existing.status = v.status;
                existing.isActive = true;
            }

            // Determine and preserve Joining Type
            if (isAgentCheck(v) || isAgentCheck(existing)) {
                existing.joiningType = 'agent';
                existing.onboardedByAgent = existing.onboardedByAgent || v.onboardedByAgent;
                existing.assignedAgent = existing.assignedAgent || v.assignedAgent;
                existing.agentId = existing.agentId || v.agentId;
                existing.agentName = existing.agentName || v.agentName;
                existing.agentRegistrationId = existing.agentRegistrationId || v.agentRegistrationId;
                existing.onboardedBy = existing.onboardedBy || v.onboardedBy;
            } else if (isManagerCheck(v) || isManagerCheck(existing)) {
                existing.joiningType = 'manager';
                existing.onboardedByManager = existing.onboardedByManager || v.onboardedByManager;
                existing.assignedManager = existing.assignedManager || v.assignedManager;
                existing.managerId = existing.managerId || v.managerId;
                existing.managerName = existing.managerName || v.managerName;
            } else {
                existing.joiningType = existing.joiningType || v.joiningType || 'direct';
            }

            // Fill non-empty properties
            if (!existing.businessName && (v.businessName || v.name)) existing.businessName = v.businessName || v.name;
            if (!existing.contactPerson && (v.contactPerson || v.ownerName || v.contactName)) existing.contactPerson = v.contactPerson || v.ownerName || v.contactName;
            if ((!existing.phone || existing.phone === '—') && v.phone && v.phone !== '—') existing.phone = v.phone;
            if (!existing.email && v.email) existing.email = v.email;
            if ((!existing.category || existing.category === '—') && v.category && v.category !== '—') existing.category = v.category;
            if (!existing.fullAddress && (v.fullAddress || v.address)) existing.fullAddress = v.fullAddress || v.address;
            if (!existing.pincode && v.pincode) existing.pincode = v.pincode;
            if (!existing.state && v.state) existing.state = v.state;
            if (!existing.district && v.district) existing.district = v.district;

            // Update cross-reference indexes
            if (regId && !regMap.has(regId)) regMap.set(regId, existing);
            if (phone && !phoneMap.has(phone)) phoneMap.set(phone, existing);
            if (email && !emailMap.has(email)) emailMap.set(email, existing);
            if (idStr && !idMap.has(idStr)) idMap.set(idStr, existing);
        } else {
            const vendorCopy = { ...v };
            if (regId) vendorCopy.registrationId = regId;
            if (isAgentCheck(vendorCopy)) vendorCopy.joiningType = 'agent';
            else if (isManagerCheck(vendorCopy)) vendorCopy.joiningType = 'manager';
            else vendorCopy.joiningType = vendorCopy.joiningType || 'direct';

            canonicalVendors.push(vendorCopy);

            if (regId) regMap.set(regId, vendorCopy);
            if (phone) phoneMap.set(phone, vendorCopy);
            if (email) emailMap.set(email, vendorCopy);
            if (idStr) idMap.set(idStr, vendorCopy);
        }
    }

    return canonicalVendors;
};

// GET Vendor Directory with filters, pagination, and direct requests / agent-onboarded requests
router.get('/vendors', auth, async (req, res) => {
    try {
        const { search, category, state, status, isDirectRequest, isAgentOnboarded, isManagerOnboarded, page = 1, limit = 20 } = req.query;

        if (isAgentOnboarded === 'true') {
            const [agentVendorsFromUser, agentVendorsFromVendor] = await Promise.all([
                User.find({
                    $or: [
                        { joiningType: 'agent' },
                        { createdVia: 'agent' },
                        { registrationSource: 'agent' },
                        { onboardedBy: { $exists: true, $ne: null } },
                        { agentId: { $exists: true, $ne: null } },
                        { assignedAgent: { $exists: true, $ne: null } },
                        { onboardedByAgentId: { $exists: true, $ne: null } },
                        { referredBy: { $exists: true, $ne: null } }
                    ]
                }).select('-password -__v').sort({ createdAt: -1 }).lean(),
                Vendor.find({
                    $or: [
                        { joiningType: 'agent' },
                        { createdVia: 'agent' },
                        { registrationSource: 'agent' },
                        { onboardedBy: { $exists: true, $ne: null } },
                        { agentId: { $exists: true, $ne: null } },
                        { assignedAgent: { $exists: true, $ne: null } },
                        { onboardedByAgentId: { $exists: true, $ne: null } },
                        { referredBy: { $exists: true, $ne: null } }
                    ]
                }).select('-__v').sort({ createdAt: -1 }).lean()
            ]);

            const rawAgent = [...agentVendorsFromUser, ...agentVendorsFromVendor];
            const dedupedAgent = deduplicateVendorsList(rawAgent);
            let enriched = await batchEnrichVendors(dedupedAgent);

            if (search) {
                const s = search.toLowerCase();
                enriched = enriched.filter(v =>
                    (v.businessName || v.name || '').toLowerCase().includes(s) ||
                    (v.onboardedByAgent?.name || v.agentName || '').toLowerCase().includes(s) ||
                    (v.onboardedByAgent?.registrationId || '').toLowerCase().includes(s) ||
                    (v.pincode || '').includes(s) ||
                    (v.email || '').toLowerCase().includes(s)
                );
            }

            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.max(1, parseInt(limit, 10) || 20);
            const total = enriched.length;
            const paginated = (req.query.limit && limitNum < total)
                ? enriched.slice((pageNum - 1) * limitNum, pageNum * limitNum)
                : enriched;

            return res.json({
                vendors: paginated,
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum) || 1
            });
        }

        if (isManagerOnboarded === 'true') {
            const [managerVendorsFromUser, managerVendorsFromVendor] = await Promise.all([
                User.find({
                    $or: [
                        { joiningType: 'manager' },
                        { createdVia: 'manager' },
                        { registrationSource: 'manager' },
                        { onboardedByManager: { $exists: true, $ne: null } },
                        { managerId: { $exists: true, $ne: null } },
                        { assignedManager: { $exists: true, $ne: null } },
                        { onboardedByManagerId: { $exists: true, $ne: null } },
                        { 'addedBy.role': { $regex: /manager/i } }
                    ]
                }).select('-password -__v').sort({ createdAt: -1 }).lean(),
                Vendor.find({
                    $or: [
                        { joiningType: 'manager' },
                        { createdVia: 'manager' },
                        { registrationSource: 'manager' },
                        { onboardedByManager: { $exists: true, $ne: null } },
                        { managerId: { $exists: true, $ne: null } },
                        { assignedManager: { $exists: true, $ne: null } },
                        { onboardedByManagerId: { $exists: true, $ne: null } },
                        { 'addedBy.role': { $regex: /manager/i } }
                    ]
                }).select('-__v').sort({ createdAt: -1 }).lean()
            ]);

            const rawManager = [...managerVendorsFromUser, ...managerVendorsFromVendor];
            const dedupedManager = deduplicateVendorsList(rawManager);
            let enriched = await batchEnrichVendors(dedupedManager);

            if (search) {
                const s = search.toLowerCase();
                enriched = enriched.filter(v =>
                    (v.businessName || v.name || '').toLowerCase().includes(s) ||
                    (v.onboardedByManager?.name || v.managerName || '').toLowerCase().includes(s) ||
                    (v.onboardedByManager?.registrationId || v.managerRegistrationId || v.managerId || '').toLowerCase().includes(s) ||
                    (v.pincode || '').includes(s) ||
                    (v.email || '').toLowerCase().includes(s)
                );
            }

            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.max(1, parseInt(limit, 10) || 20);
            const total = enriched.length;
            const paginated = (req.query.limit && limitNum < total)
                ? enriched.slice((pageNum - 1) * limitNum, pageNum * limitNum)
                : enriched;

            return res.json({
                vendors: paginated,
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum) || 1
            });
        }

        if (isDirectRequest === 'true') {
            const [directVendors, directVendorDocs] = await Promise.all([
                User.find({
                    $or: [
                        { role: { $regex: /vendor|merchant/i } },
                        { userType: { $regex: /vendor|merchant/i } },
                        { isDirectRequest: true }
                    ],
                    status: { $nin: ['approved', 'Approved', 'APPROVED', 'rejected', 'Rejected', 'REJECTED', 'assigned', 'Assigned', 'ASSIGNED', 'active', 'Active', 'ACTIVE', 'suspended', 'Suspended', 'SUSPENDED'] }
                }).select('-password -__v').sort({ createdAt: -1 }).lean(),
                Vendor.find({
                    status: { $nin: ['approved', 'Approved', 'APPROVED', 'rejected', 'Rejected', 'REJECTED', 'assigned', 'Assigned', 'ASSIGNED', 'active', 'Active', 'ACTIVE', 'suspended', 'Suspended', 'SUSPENDED'] }
                }).select('-__v').sort({ createdAt: -1 }).lean()
            ]);

            const rawDirect = deduplicateVendorsList([...directVendors, ...directVendorDocs]);
            let allDirect = await batchEnrichVendors(rawDirect);

            const handledStatuses = new Set(['approved', 'rejected', 'assigned', 'active', 'suspended']);
            let pendingDirect = allDirect.filter(v => {
                const s = String(v.status || '').toLowerCase().trim();
                const isHandled = handledStatuses.has(s);
                const isAgentOnboarded = v.joiningType === 'agent' || !!v.onboardedByAgent || !!v.onboardedBy || !!v.agentId || !!v.onboardedByAgentId || !!v.referredBy || (v.createdVia && String(v.createdVia).toLowerCase() === 'agent');
                const isManagerOnboarded = v.joiningType === 'manager' || !!v.onboardedByManager || !!v.managerId || (v.createdVia && String(v.createdVia).toLowerCase() === 'manager');
                return !isHandled && !isAgentOnboarded && !isManagerOnboarded;
            });

            if (search) {
                const s = search.toLowerCase();
                pendingDirect = pendingDirect.filter(v =>
                    (v.businessName || v.name || '').toLowerCase().includes(s) ||
                    (v.contactPerson || '').toLowerCase().includes(s) ||
                    (v.email || '').toLowerCase().includes(s) ||
                    (v.phone || '').toLowerCase().includes(s)
                );
            }

            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.max(1, parseInt(limit, 10) || 20);
            const total = pendingDirect.length;
            const paginated = (req.query.limit && limitNum < total)
                ? pendingDirect.slice((pageNum - 1) * limitNum, pageNum * limitNum)
                : pendingDirect;

            return res.json({
                vendors: paginated,
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum) || 1
            });
        }

        const query = { role: { $in: ['Vendor', 'vendor', 'merchant', 'Merchant'] } };

        if (category && category !== 'all') query.category = category;
        if (state && state !== 'all') query.assignedArea = { $regex: new RegExp(state, 'i') };
        if (status && status !== 'all') query.status = status;

        if (search) {
            query.$or = [
                { businessName: { $regex: new RegExp(search, 'i') } },
                { contactPerson: { $regex: new RegExp(search, 'i') } },
                { email: { $regex: new RegExp(search, 'i') } },
                { phone: { $regex: new RegExp(search, 'i') } },
                { registrationId: { $regex: new RegExp(search, 'i') } }
            ];
        }

        const [userVendors, docVendors] = await Promise.all([
            User.find(query).select('-password -__v').sort({ createdAt: -1 }).lean(),
            Vendor.find(query).select('-__v').sort({ createdAt: -1 }).lean()
        ]);
        const rawVendors = [...userVendors, ...docVendors];

        // Deduplicate vendors canonically by registrationId / phone / email / ID
        const dedupedVendors = deduplicateVendorsList(rawVendors);

        // Attach Pincode Agent information & normalize profile fields
        let enrichedVendors = await batchEnrichVendors(dedupedVendors);

        // Compute authoritative stats across all unique vendors
        const stats = {
            total: enrichedVendors.length,
            active: enrichedVendors.filter(v => ['active', 'approved'].includes(String(v.status || '').toLowerCase())).length,
            pending: enrichedVendors.filter(v => ['pending', 'under_verification', 'requested', 'in_review'].includes(String(v.status || '').toLowerCase())).length,
            suspended: enrichedVendors.filter(v => ['suspended', 'revoked', 'rejected'].includes(String(v.status || '').toLowerCase())).length,
            agentOnboarded: enrichedVendors.filter(v => v.joiningType === 'agent').length,
            managerOnboarded: enrichedVendors.filter(v => v.joiningType === 'manager').length,
            directRequests: enrichedVendors.filter(v => v.joiningType === 'direct' && !['active', 'approved'].includes(String(v.status || '').toLowerCase())).length
        };

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const total = enrichedVendors.length;
        const paginated = (req.query.limit && limitNum < total)
            ? enrichedVendors.slice((pageNum - 1) * limitNum, pageNum * limitNum)
            : enrichedVendors;

        res.json({
            vendors: paginated,
            total,
            stats,
            page: pageNum,
            pages: Math.ceil(total / limitNum) || 1
        });
    } catch (err) {
        console.error('Vendor directory error:', err);
        res.status(500).send('Server error');
    }
});

// POST Agent Onboard New Vendor (Creates Pending Vendor linked to Agent and Territory)
router.post('/vendors/agent-onboard', async (req, res) => {
    try {
        const {
            businessName, name, contactPerson, email, phone, category, subCategory,
            assignedState, assignedDistrict, assignedDivision, pincode, assignedArea,
            address, kycDocs, agentId
        } = req.body;

        const targetAgentId = agentId || req.user?.id;
        let agentDoc = null;
        if (targetAgentId && mongoose.Types.ObjectId.isValid(targetAgentId)) {
            agentDoc = await User.findById(targetAgentId).lean();
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randDigits = Math.floor(1000 + Math.random() * 9000);
        const registrationId = req.body.registrationId || `REG-${dateStr}-${randDigits}`;

        const lowerEmail = (email || `vendor_${randDigits}@connect.app`).toLowerCase().trim();
        const cleanPhone = (phone || '').replace(/\D/g, '');

        const existingVendorUser = await User.findOne({
            $or: [
                { email: lowerEmail },
                ...(cleanPhone ? [{ phone: cleanPhone }, { phone: phone }] : []),
                ...(businessName ? [{ businessName: new RegExp(`^${businessName.trim()}$`, 'i') }] : [])
            ]
        }) || await Vendor.findOne({
            $or: [
                { email: lowerEmail },
                ...(cleanPhone ? [{ phone: cleanPhone }, { phone: phone }] : []),
                ...(businessName ? [{ businessName: new RegExp(`^${businessName.trim()}$`, 'i') }] : [])
            ]
        });

        if (existingVendorUser) {
            const isPhoneMatch = cleanPhone && (existingVendorUser.phone === cleanPhone || existingVendorUser.phone === phone);
            const isBizMatch = businessName && (existingVendorUser.businessName || existingVendorUser.name || '').toLowerCase() === businessName.trim().toLowerCase();
            const errorMsg = isPhoneMatch ? 'A user with this phone number already exists.' : (isBizMatch ? 'A vendor with this business name already exists.' : 'A vendor with this email address already exists.');
            return res.status(400).json({
                success: false,
                msg: errorMsg,
                message: errorMsg
            });
        }

        const territoryParts = [
            assignedState || agentDoc?.state || agentDoc?.assignedState || '',
            assignedDistrict || agentDoc?.district || agentDoc?.assignedDistrict || '',
            assignedDivision || agentDoc?.division || agentDoc?.assignedDivision || '',
            pincode || agentDoc?.pincode || ''
        ].filter(Boolean);

        const territoryStr = assignedArea || (territoryParts.length > 0 ? territoryParts.join(' / ') : (agentDoc?.assignedArea || ''));

        const bcrypt = require('bcryptjs');
        const defaultSalt = await bcrypt.genSalt(10);
        const defaultHashedPassword = await bcrypt.hash('Vendor@12345', defaultSalt);

        const vendorData = {
            name: name || contactPerson || businessName || 'Vendor Merchant',
            businessName: businessName || name || 'Vendor Business',
            contactPerson: contactPerson || name || businessName || 'Contact Person',
            email: lowerEmail,
            phone: cleanPhone || undefined,
            password: defaultHashedPassword,
            role: 'Vendor',
            vendorType: category || 'General Store',
            category: category || 'General Store',
            subCategory: subCategory || '',
            status: 'pending',
            kycStatus: 'Pending KYC',
            joiningType: 'agent',
            createdVia: 'agent',
            registrationSource: 'agent',
            onboardedBy: targetAgentId,
            agentId: targetAgentId,
            onboardedByAgentId: targetAgentId,
            agentName: agentDoc?.name || 'Field Agent',
            agentRegistrationId: (() => {
                if (agentDoc?.registrationId) return agentDoc.registrationId;
                const rawAgentLvl = agentDoc?.level ?? 'PIN';
                let agentLvlCode = 'PIN';
                if (rawAgentLvl === 1 || rawAgentLvl === '1' || String(rawAgentLvl).toLowerCase().includes('state')) agentLvlCode = 'STA';
                else if (rawAgentLvl === 2 || rawAgentLvl === '2' || String(rawAgentLvl).toLowerCase().includes('dist')) agentLvlCode = 'DIS';
                else if (rawAgentLvl === 3 || rawAgentLvl === '3' || String(rawAgentLvl).toLowerCase().includes('div')) agentLvlCode = 'DIV';
                else if (rawAgentLvl === 4 || rawAgentLvl === '4' || String(rawAgentLvl).toLowerCase().includes('pin')) agentLvlCode = 'PIN';
                else if (typeof rawAgentLvl === 'string' && rawAgentLvl.trim()) agentLvlCode = rawAgentLvl.trim().slice(0, 4).toUpperCase();
                return `AG-${agentLvlCode}-1001`;
            })(),
            assignedArea: territoryStr,
            assignedState: assignedState || agentDoc?.state || agentDoc?.assignedState || '',
            assignedDistrict: assignedDistrict || agentDoc?.district || agentDoc?.assignedDistrict || '',
            assignedDivision: assignedDivision || agentDoc?.division || agentDoc?.assignedDivision || '',
            pincode: pincode || agentDoc?.pincode || '',
            address: address || territoryStr,
            registrationId,
            createdAt: new Date()
        };

        const newVendorUser = new User(vendorData);
        try {
            await newVendorUser.save();
        } catch (saveErr) {
            if (saveErr.code === 11000 || (saveErr.message && saveErr.message.includes('E11000'))) {
                const isPhoneDup = saveErr.message && (saveErr.message.includes('phone') || saveErr.message.includes('phone_1'));
                return res.status(400).json({
                    success: false,
                    msg: isPhoneDup ? 'A user with this phone number already exists.' : 'A vendor with this email address already exists.',
                    message: isPhoneDup ? 'A user with this phone number already exists.' : 'A vendor with this email address already exists.'
                });
            }
            throw saveErr;
        }

        const newVendorDoc = new Vendor({
            ...vendorData,
            _id: newVendorUser._id
        });
        await newVendorDoc.save().catch(() => {});

        const enriched = await enrichVendorData(newVendorUser);

        // Real-time Socket.IO emission to admin room
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('vendor_onboarded_by_agent', enriched);
            io.emit('vendor_onboarded_by_agent', enriched);
        }

        res.status(201).json({
            success: true,
            message: 'Vendor onboarded successfully by agent and submitted for Admin approval',
            vendor: enriched
        });
    } catch (err) {
        console.error('Agent vendor onboarding error:', err);
        res.status(500).json({ success: false, message: 'Server error onboarding vendor', error: err.message });
    }
});

// POST Auto-Assign Pincode Agent for Vendor Verification
router.post('/vendors/auto-assign-agent', auth, async (req, res) => {
    try {
        const { vendorId } = req.body;
        let vendor = await User.findById(vendorId);
        if (!vendor) {
            vendor = await User.findOne({ email: 'dhanushiyasri@gmail.com' });
        }
        if (!vendor) return res.status(404).json({ msg: 'Vendor not found' });

        const pincodeCode = vendor.address?.match(/\b\d{6}\b/)?.[0] || vendor.pincode;
        let assignedAgent = null;

        if (pincodeCode) {
            const pinDoc = await Pincode.findOne({ code: pincodeCode }).populate('activeAgentId');
            if (pinDoc && pinDoc.activeAgentId) {
                assignedAgent = pinDoc.activeAgentId;
            }
        }

        if (!assignedAgent) {
            // Fallback: Find any pincode agent in the district/state
            assignedAgent = await User.findOne({ role: 'agent', level: 'pincode', status: 'approved' });
        }

        vendor.status = 'Assigned';
        await vendor.save();

        const io = getIo(req);
        if (io) {
            io.emit('vendor_verification_assigned', {
                vendorId: vendor._id,
                businessName: vendor.businessName,
                assignedAgent: assignedAgent ? { id: assignedAgent._id, name: assignedAgent.name } : null,
                timestamp: new Date()
            });
        }

        res.json({ success: true, assignedAgent });
    } catch (err) {
        console.error('Auto assign error:', err);
        res.status(500).send('Server error');
    }
});

// Helper to construct robust query filters matching String _id, ObjectId _id, registrationId, vendorId, email, or businessName
const buildVendorQuery = (vId, em, regId, bizName) => {
    const orList = [];
    if (vId && vId !== 'undefined' && vId !== 'null') {
        orList.push({ _id: String(vId) });
        orList.push({ registrationId: String(vId) });
        orList.push({ vendorId: String(vId) });
        orList.push({ id: String(vId) });
        if (mongoose.Types.ObjectId.isValid(vId)) {
            orList.push({ _id: new mongoose.Types.ObjectId(vId) });
        }
    }
    if (regId && regId !== 'undefined' && regId !== 'null') {
        orList.push({ registrationId: String(regId) });
        orList.push({ vendorId: String(regId) });
    }
    if (em && em !== 'undefined' && em !== 'null') {
        const cleanEmail = String(em).toLowerCase().trim();
        if (cleanEmail) {
            orList.push({ email: cleanEmail });
            orList.push({ email: { $regex: new RegExp(`^${cleanEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } });
        }
    }
    if (bizName && bizName !== 'undefined' && bizName !== 'null') {
        const cleanBiz = String(bizName).trim();
        if (cleanBiz) {
            orList.push({ businessName: { $regex: new RegExp(`^${cleanBiz.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } });
            orList.push({ name: { $regex: new RegExp(`^${cleanBiz.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } });
        }
    }
    return { $or: orList.length > 0 ? orList : [{ _id: null }] };
};

// POST Update Vendor Status (Active, Inactive, Suspended, Pending, Rejected)
router.post('/vendors/update-status', auth, async (req, res) => {
    try {
        const { vendorId, registrationId, _id, email, businessName, name, status, reason = '' } = req.body;
        if (!status) return res.status(400).json({ msg: 'Status is required' });

        const rawStatus = status.trim();
        const formattedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
        const isCurrentlyActive = ['Active', 'Approved'].includes(formattedStatus);

        const targetId = _id || vendorId;
        const targetEmail = email ? String(email).toLowerCase().trim() : '';
        const targetBizName = businessName || name || '';
        const updateFilter = buildVendorQuery(targetId, targetEmail, registrationId, targetBizName);

        const existingVendor = await User.findOne(updateFilter) || await Vendor.findOne(updateFilter);
        const oldStatus = existingVendor ? (existingVendor.status || 'Pending') : 'Pending';

        const mainUpdatePayload = { 
            status: formattedStatus, 
            isActive: isCurrentlyActive, 
            isApproved: isCurrentlyActive, 
            isLocked: !isCurrentlyActive 
        };

        // 1. Update top-level status on User collection
        await User.collection.updateMany(updateFilter, { $set: mainUpdatePayload }).catch(e => console.error('User.collection update error:', e));
        await User.updateMany(updateFilter, { $set: mainUpdatePayload }).catch(e => console.error('User.updateMany error:', e));

        // 2. Update top-level status on Vendor collection
        await Vendor.collection.updateMany(updateFilter, { $set: { status: formattedStatus, isActive: isCurrentlyActive } }).catch(() => {});
        await Vendor.updateMany(updateFilter, { $set: { status: formattedStatus, isActive: isCurrentlyActive } }).catch(() => {});

        // 2b. Update all products associated with this vendor across all matching identifiers
        const matchedVendors = await User.find(updateFilter).select('_id email phone registrationId businessName name primaryBusinessId businesses');
        const matchedVendorCols = await Vendor.find(updateFilter).select('_id email phone registrationId businessName primaryBusinessId businesses');

        const validObjectIds = [];
        const stringKeys = [];

        if (targetId) {
            stringKeys.push(targetId.toString());
            if (mongoose.Types.ObjectId.isValid(targetId)) validObjectIds.push(new mongoose.Types.ObjectId(targetId));
        }
        if (registrationId) stringKeys.push(registrationId.toString());
        if (targetEmail) stringKeys.push(targetEmail.toLowerCase().trim());

        [...matchedVendors, ...matchedVendorCols].forEach(v => {
            if (v._id) {
                const idStr = v._id.toString();
                stringKeys.push(idStr);
                if (mongoose.Types.ObjectId.isValid(idStr)) validObjectIds.push(new mongoose.Types.ObjectId(idStr));
            }
            if (v.registrationId) stringKeys.push(v.registrationId.toString());
            if (v.vendorId) stringKeys.push(v.vendorId.toString());
            if (v.primaryBusinessId) {
                const pIdStr = v.primaryBusinessId.toString();
                stringKeys.push(pIdStr);
                if (mongoose.Types.ObjectId.isValid(pIdStr)) validObjectIds.push(new mongoose.Types.ObjectId(pIdStr));
            }
            if (Array.isArray(v.businesses)) {
                v.businesses.forEach(b => {
                    if (b._id) {
                        const bIdStr = b._id.toString();
                        stringKeys.push(bIdStr);
                        if (mongoose.Types.ObjectId.isValid(bIdStr)) validObjectIds.push(new mongoose.Types.ObjectId(bIdStr));
                    }
                });
            }
            if (v.email) stringKeys.push(v.email.toLowerCase().trim());
            if (v.phone) stringKeys.push(v.phone.replace(/\D/g, ''));
            if (v.businessName) stringKeys.push(v.businessName.toLowerCase().trim());
            if (v.name) stringKeys.push(v.name.toLowerCase().trim());
        });

        const rawProductColl = mongoose.connection.db.collection('products');
        await rawProductColl.updateMany(
            {
                $or: [
                    { vendorId: { $in: [...validObjectIds, ...stringKeys] } },
                    { vendor: { $in: [...validObjectIds, ...stringKeys] } },
                    { businessId: { $in: [...validObjectIds, ...stringKeys] } },
                    { vendorEmail: { $in: stringKeys.map(e => e.toLowerCase()) } },
                    { vendorPhone: { $in: stringKeys } },
                    { vendorName: { $in: stringKeys } }
                ]
            },
            {
                $set: {
                    isActive: isCurrentlyActive,
                    isAvailable: isCurrentlyActive,
                    vendorStatus: formattedStatus,
                    isVendorSuspended: !isCurrentlyActive,
                    isSuspended: !isCurrentlyActive
                }
            }
        ).catch(e => console.error('Product updateMany error on vendor status change:', e));

        // 3. Update nested businesses array with arrayFilters for documents where businesses array is non-empty
        await User.collection.updateMany(
            { ...updateFilter, "businesses": { $type: "array", $ne: [] } },
            { 
                $set: { 
                    "businesses.$[elem].status": formattedStatus,
                    "businesses.$[elem].isActive": isCurrentlyActive
                } 
            },
            { arrayFilters: [{ "elem": { $exists: true } }] }
        ).catch(e => console.error('Businesses array update error:', e));

        // 4. Update each matched vendor user document explicitly
        const vendorUsers = await User.find(updateFilter).catch(() => []);
        for (const vUser of vendorUsers) {
            vUser.status = formattedStatus;
            vUser.isActive = isCurrentlyActive;
            vUser.isApproved = isCurrentlyActive;
            vUser.isLocked = !isCurrentlyActive;
            if (!isCurrentlyActive) {
                vUser.rejectionReason = reason || `Account ${formattedStatus} by Administrator`;
            } else {
                vUser.rejectionReason = '';
            }
            if (vUser.businesses && Array.isArray(vUser.businesses)) {
                vUser.businesses.forEach(b => {
                    b.status = formattedStatus;
                    b.isActive = isCurrentlyActive;
                });
                if (typeof vUser.markModified === 'function') {
                    vUser.markModified('businesses');
                }
            }
            await vUser.save().catch(e => console.error('vUser.save error:', e));

            if (!isCurrentlyActive) {
                await SecuritySession.deleteMany({ userId: vUser._id }).catch(() => {});
                await UserSession.deleteMany({ userId: vUser._id }).catch(() => {});
                try {
                    securityManager.revokeAllUserSessions(vUser._id.toString());
                    if (vUser.email) securityManager.revokeAllUserSessions(vUser.email.toLowerCase());
                } catch (e) {}
            }
        }

        // 2. RECORD ENTERPRISE AUDIT LOG
        try {
            const adminUser = req.user ? await User.findById(req.user.id) : null;
            let actionType = 'vendor_status_changed';
            if (formattedStatus === 'Inactive') actionType = 'vendor_deactivated';
            else if (formattedStatus === 'Active' || formattedStatus === 'Approved') actionType = 'vendor_activated';
            else if (formattedStatus === 'Suspended') actionType = 'vendor_suspended';

            await AuditLog.create({
                userId: req.user ? req.user.id : null,
                userEmail: adminUser?.email || 'admin@connect.com',
                userRole: adminUser?.role || 'admin',
                action: actionType,
                ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
                status: 'success',
                details: `Admin changed status for vendor "${existingVendor?.businessName || existingVendor?.name || targetBizName || vendorId}" from "${oldStatus}" to "${formattedStatus}". Reason: ${reason || 'Status updated by Administrator'}`,
                metadata: {
                    adminId: req.user ? req.user.id : null,
                    adminName: adminUser?.name || 'Admin',
                    vendorId: existingVendor?._id || targetId,
                    vendorName: existingVendor?.businessName || existingVendor?.name || targetBizName || 'Vendor',
                    oldStatus,
                    newStatus: formattedStatus,
                    reason: reason || 'Status updated by Administrator',
                    timestamp: new Date()
                }
            });
        } catch (auditErr) {
            console.error('Audit log creation error:', auditErr);
        }

        // 3. EMIT REAL-TIME SOCKET.IO NOTIFICATIONS
        const io = getIo(req);
        if (io) {
            io.emit('vendor_status_changed', {
                vendorId: existingVendor?._id || targetId,
                email: existingVendor?.email || targetEmail,
                status: formattedStatus,
                isActive: isCurrentlyActive,
                reason,
                timestamp: new Date()
            });

            if (['Inactive', 'Suspended'].includes(formattedStatus)) {
                io.emit('session_terminated', {
                    userId: existingVendor?._id || targetId,
                    reason: 'Your vendor account has been suspended. Please contact the administrator.',
                    timestamp: new Date()
                });
            }
        }

        res.json({
            success: true,
            msg: `Vendor status updated to ${formattedStatus} successfully`,
            vendor: {
                id: existingVendor?._id || targetId,
                status: formattedStatus,
                isActive: isCurrentlyActive
            }
        });
    } catch (err) {
        console.error('Vendor update status error:', err);
        res.status(500).send('Server error');
    }
});

// POST Update Status of a Specific Business Outlet / Store
router.post('/vendors/update-business-status', auth, async (req, res) => {
    try {
        const { vendorId, email, registrationId, businessId, businessName, status, reason } = req.body;

        if (!status) {
            return res.status(400).json({ msg: 'Status is required' });
        }

        const rawStatus = status.trim();
        const formattedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
        const isCurrentlyActive = ['Active', 'Approved'].includes(formattedStatus);

        const targetId = vendorId;
        const targetEmail = email ? String(email).toLowerCase().trim() : '';
        const updateFilter = buildVendorQuery(targetId, targetEmail, registrationId, '');

        let vendorUser = await User.findOne(updateFilter);
        let legacyVendor = await Vendor.findOne(updateFilter);

        let targetBizName = businessName || '';
        const vendorIdentifiers = new Set();

        [vendorUser, legacyVendor].forEach(v => {
            if (!v) return;
            if (v._id) vendorIdentifiers.add(v._id.toString());
            if (v.registrationId) vendorIdentifiers.add(v.registrationId.toString());
            if (v.vendorId) vendorIdentifiers.add(v.vendorId.toString());
            if (v.email) vendorIdentifiers.add(v.email.toLowerCase().trim());
            if (v.phone) vendorIdentifiers.add(v.phone.replace(/\D/g, ''));
            if (v.businessName) vendorIdentifiers.add(v.businessName.toLowerCase().trim());
            if (v.name) vendorIdentifiers.add(v.name.toLowerCase().trim());

            if (Array.isArray(v.businesses)) {
                let matched = false;
                v.businesses.forEach(b => {
                    const bIdStr = b._id ? b._id.toString() : '';
                    const bNameStr = (b.businessName || b.name || '').toLowerCase().trim();
                    const targetBizIdStr = businessId ? String(businessId) : '';
                    const targetBizNameStr = targetBizName ? String(targetBizName).toLowerCase().trim() : '';

                    if ((targetBizIdStr && (bIdStr === targetBizIdStr || (bIdStr.length >= 16 && targetBizIdStr.startsWith(bIdStr.substring(0, 16))))) || (targetBizNameStr && bNameStr === targetBizNameStr)) {
                        b.status = formattedStatus;
                        b.isActive = isCurrentlyActive;
                        if (!targetBizName) targetBizName = b.businessName || b.name || '';
                        matched = true;
                    }
                });
                if (matched && typeof v.markModified === 'function') {
                    v.markModified('businesses');
                }
            }
        });

        if (vendorUser) await vendorUser.save().catch(e => console.error('vendorUser.save error:', e));
        if (legacyVendor) await legacyVendor.save().catch(e => console.error('legacyVendor.save error:', e));

        const vIdArr = Array.from(vendorIdentifiers);

        const vendorMatch = {
            $or: [
                { vendorId: { $in: vIdArr } },
                { vendorEmail: { $in: vIdArr.map(v => v.toLowerCase()) } },
                { vendorPhone: { $in: vIdArr } }
            ]
        };

        const bizMatchConds = [];
        if (businessId) {
            bizMatchConds.push({ businessId });
            bizMatchConds.push({ 'business._id': businessId });
            if (mongoose.Types.ObjectId.isValid(businessId)) {
                bizMatchConds.push({ businessId: new mongoose.Types.ObjectId(businessId) });
            }
        }
        if (targetBizName) {
            const escapedBizName = targetBizName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            bizMatchConds.push({ businessName: new RegExp('^' + escapedBizName + '$', 'i') });
            bizMatchConds.push({ subNavbarCategory: new RegExp('^' + escapedBizName + '$', 'i') });
        }

        if (bizMatchConds.length > 0) {
            await Product.updateMany(
                { $and: [vendorMatch, { $or: bizMatchConds }] },
                { $set: { businessStatus: formattedStatus.toLowerCase(), businessIsActive: isCurrentlyActive, isAvailable: isCurrentlyActive } }
            ).catch(e => console.error('Product update error for business status change:', e));
        }

        // Record Audit Log
        try {
            const adminUser = req.user ? await User.findById(req.user.id) : null;
            await AuditLog.create({
                action: 'vendor_business_status_changed',
                details: `Admin changed status of business outlet "${targetBizName || businessId}" to "${formattedStatus}" for vendor (${targetEmail || targetId})`,
                adminEmail: adminUser ? adminUser.email : 'System Admin',
                ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
                userAgent: req.headers['user-agent'] || 'System',
                metadata: { vendorId: targetId, businessId, businessName: targetBizName, newStatus: formattedStatus }
            }).catch(() => {});
        } catch (e) {}

        // Emit Socket.IO event for real-time customer app catalog update
        const io = req.app.get('io');
        if (io) {
            io.emit('vendor_status_changed', {
                vendorId: targetId,
                businessId,
                businessName: targetBizName,
                status: formattedStatus,
                isActive: isCurrentlyActive
            });
        }

        return res.json({
            success: true,
            msg: `Business outlet status successfully updated to ${formattedStatus}`,
            vendor: vendorUser || legacyVendor,
            businessId,
            businessName: targetBizName,
            status: formattedStatus,
            isActive: isCurrentlyActive
        });
    } catch (err) {
        console.error('Update business status error:', err);
        return res.status(500).send('Server error');
    }
});

// POST Approve & Activate Direct Vendor Request
router.post('/vendors/approve', auth, async (req, res) => {
    try {
        const { vendorId, registrationId, _id, email, businessName, name, phone, mobile } = req.body;
        const targetId = _id || vendorId;
        const targetEmail = email ? String(email).toLowerCase().trim() : '';
        const targetBizName = businessName || name || '';
        const targetPhone = phone || mobile || '';
        const updateFilter = buildVendorQuery(targetId, targetEmail, registrationId, targetBizName);

        await User.collection.updateMany(
            updateFilter,
            { $set: { status: 'Approved', isActive: true, isApproved: true, isLocked: false, rejectionReason: '' } }
        ).catch(() => {});

        await User.updateMany(
            updateFilter,
            { $set: { status: 'Approved', isActive: true, isApproved: true, isLocked: false, rejectionReason: '' } }
        ).catch(() => {});

        await Vendor.collection.updateMany(
            updateFilter,
            { $set: { status: 'Approved', isActive: true } }
        ).catch(() => {});

        await Vendor.updateMany(
            updateFilter,
            { $set: { status: 'Approved', isActive: true } }
        ).catch(() => {});

        let user = await User.findOne(updateFilter);
        if (!user && (targetEmail || targetPhone || targetBizName)) {
            const orFind = [];
            if (targetEmail) orFind.push({ email: targetEmail });
            if (targetPhone) orFind.push({ phone: targetPhone });
            if (targetBizName) orFind.push({ businessName: new RegExp(`^${targetBizName}$`, 'i') });
            if (orFind.length > 0) user = await User.findOne({ $or: orFind });
        }

        if (user) {
            user.status = 'Approved';
            user.isActive = true;
            user.isApproved = true;
            user.isLocked = false;
            user.rejectionReason = '';
            if (!user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash('Vendor@12345', salt);
            }
            await user.save().catch(() => {});
        } else {
            const rawVendor = await Vendor.findOne(updateFilter);
            if (rawVendor || targetEmail || targetBizName) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('Vendor@12345', salt);
                user = new User({
                    _id: rawVendor?._id || new mongoose.Types.ObjectId(),
                    name: (rawVendor && rawVendor.name) || name || targetBizName || 'Vendor Partner',
                    businessName: (rawVendor && rawVendor.businessName) || targetBizName || name || 'Vendor Partner',
                    email: (rawVendor && rawVendor.email) || targetEmail || `vendor_${Date.now()}@connect.com`,
                    phone: (rawVendor && rawVendor.phone) || targetPhone || undefined,
                    password: hashedPassword,
                    role: 'Vendor',
                    category: (rawVendor && rawVendor.category) || 'General Store',
                    status: 'Approved',
                    isActive: true,
                    isApproved: true,
                    isLocked: false,
                    registrationId: rawVendor?.registrationId || registrationId,
                    createdAt: (rawVendor && rawVendor.createdAt) || new Date()
                });
                await user.save().catch((err) => {
                    console.error("Vendor auto-user creation warning:", err.message);
                });
            }
        }

        // Record Audit Log
        try {
            const adminUser = req.user ? await User.findById(req.user.id) : null;
            await AuditLog.create({
                userId: req.user ? req.user.id : null,
                userEmail: adminUser?.email || 'admin@connect.com',
                userRole: adminUser?.role || 'admin',
                action: 'vendor_activated',
                ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
                status: 'success',
                details: `Admin approved vendor "${user?.businessName || user?.name || targetBizName}" (${user?.email || targetEmail})`,
                metadata: {
                    adminId: req.user ? req.user.id : null,
                    adminName: adminUser?.name || 'Admin',
                    vendorId: user?._id || targetId,
                    vendorName: user?.businessName || user?.name || targetBizName,
                    oldStatus: 'Pending',
                    newStatus: 'Approved',
                    reason: 'Direct registration approved',
                    timestamp: new Date()
                }
            });
        } catch (e) {}

        const io = getIo(req);
        if (io) {
            io.emit('vendor_approved', {
                vendorId: user?._id || targetId,
                email: user?.email || targetEmail,
                status: 'Approved',
                timestamp: new Date()
            });
        }

        res.json({ success: true, msg: 'Vendor approved and activated successfully', user: { id: user?._id || targetId, email: user?.email || targetEmail, status: 'Approved' } });
    } catch (err) {
        console.error('Approve vendor error:', err);
        res.status(500).send('Server error');
    }
});

// POST Reject Direct Vendor Request
router.post('/vendors/reject', auth, async (req, res) => {
    try {
        const { vendorId, registrationId, _id, email, businessName, name, reason = 'Registration application rejected' } = req.body;
        const targetId = _id || vendorId;
        const targetEmail = email ? String(email).toLowerCase().trim() : '';
        const targetBizName = businessName || name || '';
        const updateFilter = buildVendorQuery(targetId, targetEmail, registrationId, targetBizName);

        await User.collection.updateMany(
            updateFilter,
            { $set: { status: 'Rejected', isActive: false, isLocked: true, rejectionReason: reason } }
        ).catch(() => {});

        await User.updateMany(
            updateFilter,
            { $set: { status: 'Rejected', isActive: false, isLocked: true, rejectionReason: reason } }
        ).catch(() => {});

        await Vendor.collection.updateMany(
            updateFilter,
            { $set: { status: 'Rejected', isActive: false } }
        ).catch(() => {});

        await Vendor.updateMany(
            updateFilter,
            { $set: { status: 'Rejected', isActive: false } }
        ).catch(() => {});

        let existingVendor = await User.findOne(updateFilter);
        if (existingVendor) {
            await SecuritySession.deleteMany({ userId: existingVendor._id }).catch(() => {});
            await UserSession.deleteMany({ userId: existingVendor._id }).catch(() => {});
        }

        // Record Audit Log
        try {
            const adminUser = req.user ? await User.findById(req.user.id) : null;
            await AuditLog.create({
                userId: req.user ? req.user.id : null,
                userEmail: adminUser?.email || 'admin@connect.com',
                userRole: adminUser?.role || 'admin',
                action: 'vendor_status_changed',
                ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
                status: 'success',
                details: `Admin rejected vendor "${existingVendor?.businessName || existingVendor?.name || vendorId}". Reason: ${reason}`,
                metadata: {
                    adminId: req.user ? req.user.id : null,
                    adminName: adminUser?.name || 'Admin',
                    vendorId: existingVendor?._id || vendorId,
                    vendorName: existingVendor?.businessName || existingVendor?.name || 'Vendor',
                    oldStatus: 'Pending',
                    newStatus: 'Rejected',
                    reason,
                    timestamp: new Date()
                }
            });
        } catch (e) {}

        const io = getIo(req);
        if (io) {
            io.emit('vendor_rejected', {
                vendorId,
                status: 'Rejected',
                timestamp: new Date()
            });
            if (existingVendor) {
                io.emit('session_terminated', {
                    userId: existingVendor._id,
                    reason: 'Your vendor account registration was rejected by the administrator.',
                    timestamp: new Date()
                });
            }
        }

        res.json({ success: true, msg: 'Vendor rejected successfully' });
    } catch (err) {
        console.error('Reject vendor error:', err);
        res.status(500).send('Server error');
    }
});

// DELETE Vendor by ID or Email
router.delete('/vendors/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.query;
        const deleteFilter = buildVendorQuery(id, email);

        await User.collection.deleteMany(deleteFilter).catch(() => {});
        await User.deleteMany(deleteFilter).catch(() => {});
        await Vendor.collection.deleteMany(deleteFilter).catch(() => {});
        await Vendor.deleteMany(deleteFilter).catch(() => {});

        const io = getIo(req);
        if (io) {
            io.emit('vendor_deleted', { vendorId: id, email, timestamp: new Date() });
        }

        res.json({ success: true, msg: 'Vendor deleted successfully' });
    } catch (err) {
        console.error('Delete vendor error:', err);
        res.status(500).send('Server error');
    }
});

router.post('/vendors/delete', auth, async (req, res) => {
    try {
        const { vendorId, email } = req.body;
        const deleteFilter = buildVendorQuery(vendorId, email);

        await User.collection.deleteMany(deleteFilter).catch(() => {});
        await User.deleteMany(deleteFilter).catch(() => {});
        await Vendor.collection.deleteMany(deleteFilter).catch(() => {});
        await Vendor.deleteMany(deleteFilter).catch(() => {});

        const io = getIo(req);
        if (io) {
            io.emit('vendor_deleted', { vendorId, email, timestamp: new Date() });
        }

        res.json({ success: true, msg: 'Vendor deleted successfully' });
    } catch (err) {
        console.error('Delete vendor error:', err);
        res.status(500).send('Server error');
    }
});


// =========================================================
// 2. MEMBERSHIP CARD MANAGEMENT
// =========================================================

// GET Membership Requests
router.get('/membership-requests', auth, async (req, res) => {
    try {
        const { membershipType, paymentMode, paymentStatus, status, search, refresh } = req.query;

        // Auto-sync real payments from membership_payments into MembershipRequest & CardHolder
        // Throttled to at most once per 5 seconds, or immediately if refresh is requested
        const cooldownKey = 'membership_sync_cooldown';
        const isCooldown = await cacheService.get(cooldownKey);
        const shouldSync = Boolean(refresh === 'true' || !isCooldown);
        if (shouldSync) {
            await cacheService.set(cooldownKey, true, 5);
            try {
                const paymentsCol = mongoose.connection.collection('membership_payments');
                const usersCol = mongoose.connection.collection('users');
                const custCol = mongoose.connection.collection('customers');

                const payments = await paymentsCol.find({ status: 'SUCCESS' }).sort({ createdAt: 1 }).toArray();
                if (payments.length > 0) {
                    for (const p of payments) {
                        const orClauses = [];
                        if (p.userId) orClauses.push({ _id: p.userId }, { id: p.userId });
                        if (p.customerId) orClauses.push({ customerId: p.customerId });
                        if (p.customerEmail) orClauses.push({ email: p.customerEmail });
                        if (p.customerPhone) orClauses.push({ phone: p.customerPhone });

                        let dbUser = null;
                        if (orClauses.length > 0) {
                            dbUser = await usersCol.findOne({ $or: orClauses });
                            if (!dbUser) dbUser = await custCol.findOne({ $or: orClauses });
                        }

                        const realName = dbUser?.name || dbUser?.fullName || p.customerName || 'Customer Member';
                        const realEmail = dbUser?.email || p.customerEmail || '';
                        const realPhone = dbUser?.phone || dbUser?.mobile || p.customerPhone || '';
                        const realCustCode = dbUser?.customerId || p.customerId || '';
                        const realCustId = p.userId || dbUser?.id || dbUser?._id || null;

                        const planStr = (p.plan || p.planName || '').toLowerCase();
                        const normTier = planStr.includes('diamond') ? 'Diamond'
                            : planStr.includes('gold') ? 'Gold'
                            : 'Silver';

                        const rawMode = (p.paymentMethod || 'UPI').toString().toLowerCase();
                        const normMode = rawMode.includes('card') ? 'Card'
                            : rawMode.includes('wallet') ? 'Wallet'
                            : rawMode.includes('bank') ? 'Net Banking'
                            : 'UPI';

                        const isUpgrade = Boolean(p.previousPlan && p.previousPlan !== 'None' && p.previousPlan.toLowerCase() !== (p.plan || '').toLowerCase());
                        const prevPlanStr = (p.previousPlan || '').toLowerCase();
                        const normPrevTier = prevPlanStr.includes('diamond') ? 'Diamond'
                            : prevPlanStr.includes('gold') ? 'Gold'
                            : prevPlanStr.includes('silver') ? 'Silver'
                            : '';

                        const memId = p.membershipId || ('FIC-' + (normTier.toUpperCase().slice(0, 4)) + '-' + (p._id ? p._id.toString().slice(-6) : Date.now().toString().slice(-6)));
                        const txId = p.paymentId || (p._id ? p._id.toString() : '');
                        const historyArray = Array.isArray(dbUser?.membershipHistory) ? dbUser.membershipHistory : [];

                        // Match existing request by customer identity first (customerCode or customerId) to update in-place on upgrade
                        const customerFilterClauses = [];
                        if (realCustCode) customerFilterClauses.push({ customerCode: realCustCode });
                        if (realCustId) customerFilterClauses.push({ customerId: realCustId });
                        customerFilterClauses.push({ transactionId: txId });
                        customerFilterClauses.push({ membershipId: memId });

                        await MembershipRequest.findOneAndUpdate(
                            { $or: customerFilterClauses },
                            {
                                $set: {
                                    customerId: realCustId,
                                    customerCode: realCustCode,
                                    customerName: realName,
                                    customerEmail: realEmail,
                                    customerPhone: realPhone,
                                    customerPhoto: dbUser?.avatar || dbUser?.photo || '',
                                    membershipId: memId,
                                    membershipType: normTier,
                                    paymentMode: normMode,
                                    paymentStatus: 'Paid',
                                    validityStartDate: p.startDate ? new Date(p.startDate) : new Date(p.createdAt || Date.now()),
                                    validityExpiryDate: p.expiryDate ? new Date(p.expiryDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                    amount: Number(p.amount || 0),
                                    status: isUpgrade ? 'Upgraded' : 'Approved',
                                    isUpgraded: isUpgrade,
                                    previousTier: normPrevTier,
                                    upgradeDate: isUpgrade ? new Date(p.createdAt || Date.now()) : null,
                                    upgradeAmount: isUpgrade ? Number(p.amount || 0) : 0,
                                    upgradeTransactionId: isUpgrade ? txId : '',
                                    history: historyArray,
                                    orderId: p.orderId || '',
                                    updatedAt: new Date()
                                },
                                $setOnInsert: {
                                    transactionId: txId,
                                    createdAt: p.createdAt ? new Date(p.createdAt) : new Date()
                                }
                            },
                            { upsert: true, returnDocument: 'after' }
                        );

                        // Ensure cardholders collection has matching active card
                        const cardFilters = [{ cardNumber: memId }];
                        if (realEmail) cardFilters.push({ email: realEmail });
                        if (realPhone) cardFilters.push({ phone: realPhone });

                        await CardHolder.findOneAndUpdate(
                            { $or: cardFilters },
                            {
                                $set: {
                                    name: realName,
                                    email: realEmail,
                                    phone: realPhone,
                                    cardType: normTier === 'Diamond' ? 'Platinum' : normTier,
                                    cardNumber: memId,
                                    expiryDate: p.expiryDate ? new Date(p.expiryDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                    status: 'active'
                                },
                                $setOnInsert: {
                                    createdAt: p.createdAt ? new Date(p.createdAt) : new Date()
                                }
                            },
                            { upsert: true }
                        ).catch(() => {});
                    }

                    // Consolidate any duplicate records per customerCode so customer has strictly one active card
                    const allReqs = await MembershipRequest.find({}).sort({ updatedAt: -1, createdAt: -1 }).lean();
                    const seenCodes = new Set();
                    const duplicateIdsToDelete = [];
                    for (const reqItem of allReqs) {
                        const key = reqItem.customerCode || (reqItem.customerId ? reqItem.customerId.toString() : null);
                        if (key) {
                            if (seenCodes.has(key)) {
                                duplicateIdsToDelete.push(reqItem._id);
                            } else {
                                seenCodes.add(key);
                            }
                        }
                    }
                    if (duplicateIdsToDelete.length > 0) {
                        await MembershipRequest.deleteMany({ _id: { $in: duplicateIdsToDelete } });
                    }
                }
            } catch (syncErr) {
                console.warn('[Membership] Auto-sync membership_payments error:', syncErr.message);
            }
        }

        const filter = {};

        if (membershipType && membershipType !== 'all') {
            filter.membershipType = new RegExp(`^${membershipType.trim()}$`, 'i');
        }
        if (paymentMode && paymentMode !== 'all') {
            filter.paymentMode = new RegExp(`^${paymentMode.trim()}$`, 'i');
        }
        if (paymentStatus && paymentStatus !== 'all') {
            filter.paymentStatus = new RegExp(`^${paymentStatus.trim()}$`, 'i');
        }
        if (status && status !== 'all') {
            const st = status.trim().toLowerCase();
            if (st === 'approved' || st === 'active') {
                filter.status = { $in: ['Approved', 'approved', 'Active', 'active'] };
            } else if (st === 'upgraded') {
                filter.$or = [{ status: { $in: ['Upgraded', 'upgraded'] } }, { isUpgraded: true }];
            } else {
                filter.status = new RegExp(`^${status.trim()}$`, 'i');
            }
        }

        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            const searchConditions = [
                { customerName: searchRegex },
                { customerEmail: searchRegex },
                { customerPhone: searchRegex },
                { customerCode: searchRegex },
                { membershipId: searchRegex },
                { transactionId: searchRegex }
            ];
            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
                delete filter.$or;
            } else {
                filter.$or = searchConditions;
            }
        }

        const requests = await MembershipRequest.find(filter).sort({ createdAt: -1 }).lean();
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(requests);
    } catch (err) {
        console.error('Fetch membership requests error:', err);
        res.status(500).send('Server error');
    }
});

// POST Create Membership Card Request (simulates customer purchase)
router.post('/membership-requests/create', auth, async (req, res) => {
    try {
        const { customerName, customerEmail, customerPhone, membershipType, paymentMode, amount } = req.body;
        const membershipId = `MEM-${Date.now().toString().slice(-6)}`;
        const validityStartDate = new Date();
        const validityExpiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

        const newRequest = new MembershipRequest({
            customerName,
            customerEmail,
            customerPhone,
            membershipId,
            membershipType: membershipType || 'Silver',
            paymentMode: paymentMode || 'UPI',
            paymentStatus: 'Paid',
            validityStartDate,
            validityExpiryDate,
            amount: amount || 999,
            status: 'Pending'
        });

        await newRequest.save();

        const io = getIo(req);
        if (io) {
            io.emit('membership_purchased', newRequest);
            io.emit('payment_received', { amount: newRequest.amount, type: 'Membership Revenue' });
        }

        res.status(201).json(newRequest);
    } catch (err) {
        console.error('Create membership request error:', err);
        res.status(500).send('Server error');
    }
});

// POST Approve / Reject Membership Request
router.post('/membership-requests/action', auth, async (req, res) => {
    try {
        const { requestId, status } = req.body; // Approved or Rejected
        const request = await MembershipRequest.findById(requestId);
        if (!request) return res.status(404).json({ msg: 'Request not found' });

        request.status = status;
        await request.save();

        const io = getIo(req);
        if (io) {
            io.emit('membership_updated', request);
        }

        res.json({ msg: `Membership card ${status.toLowerCase()} successfully`, request });
    } catch (err) {
        console.error('Membership action error:', err);
        res.status(500).send('Server error');
    }
});


// =========================================================
// 3. ENTERPRISE PAYMENT DASHBOARD & PAYMENTS ROUTER
// =========================================================

// Mount unified production Payment & Security engine
router.use('/payments', require('./paymentRoutes'));

// GET 13 KPI Cards Payment Overview (Backward compatible)
router.get('/payments/kpi', auth, async (req, res) => {
    try {
        const cached = await cacheService.get('admin_payment_kpis');
        if (cached) {
            return res.json(cached);
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

        // Aggregate real transactions / payments from MongoDB concurrently with lean projections
        const [completedOrders, pendingOrders, membershipReqs, payrolls] = await Promise.all([
            Order.find({ status: { $nin: ['cancelled', 'Cancelled', 'rejected', 'Rejected'] } })
                .select('finalAmount totalAmount amount status createdAt').lean(),
            Order.find({ status: { $in: ['pending', 'Pending'] } })
                .select('finalAmount totalAmount amount status createdAt').lean(),
            MembershipRequest.find({ paymentStatus: 'Paid' })
                .select('amount paymentStatus createdAt').lean(),
            PayrollRecord.find({ paymentStatus: 'Paid' })
                .select('commission netSalary paymentStatus createdAt').lean()
        ]);

        const totalOrderRevenue = completedOrders.reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || o.amount || 0), 0);
        const membershipRevenue = membershipReqs.reduce((acc, m) => acc + Number(m.amount || 0), 0);

        const totalRevenue = totalOrderRevenue + membershipRevenue;

        const todayRevenue = completedOrders
            .filter(o => o.createdAt && new Date(o.createdAt) >= startOfToday)
            .reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || o.amount || 0), 0);

        const monthlyRevenue = completedOrders
            .filter(o => o.createdAt && new Date(o.createdAt) >= startOfMonth)
            .reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || o.amount || 0), 0);

        const customerPayments = totalOrderRevenue;
        const vendorRegFees = 0;
        const vendorTieupFees = 0;
        const agentFees = 0;
        const commissionPaid = payrolls.reduce((acc, p) => acc + Number(p.commission || 0), 0);
        const salaryPaid = payrolls.reduce((acc, p) => acc + Number(p.netSalary || 0), 0);
        const expenses = 0;
        const balance = totalRevenue - (commissionPaid + salaryPaid + expenses);
        const pendingPayments = pendingOrders.reduce((sum, o) => sum + Number(o.finalAmount || o.totalAmount || o.amount || 0), 0);

        const result = {
            totalRevenue,
            todayRevenue,
            monthlyRevenue,
            customerPayments,
            vendorRegFees,
            vendorTieupFees,
            membershipRevenue,
            agentFees,
            commissionPaid,
            salaryPaid,
            expenses,
            balance,
            pendingPayments
        };

        await cacheService.set('admin_payment_kpis', result, 30);
        res.json(result);
    } catch (err) {
        console.error('Payment KPI error:', err);
        res.status(500).send('Server error');
    }
});


// =========================================================
// 4. PAYROLL MANAGEMENT
// =========================================================

// GET Payroll Records (Aggregates Employees, Agents, Vendors, Delivery Partners, Technicians, Managers, Admin Staff, KYC, Payment Team)
router.get('/payroll', auth, async (req, res) => {
    try {
        const { department, role, employeeType, status, search, state, district, division, pincode, month } = req.query;

        // Build MongoDB filter query for PayrollRecord
        const filter = {};
        if (month && month !== 'all') {
            filter.month = new RegExp(`^${month.trim()}$`, 'i');
        }

        // Fetch explicitly saved PayrollRecords from database
        let payrolls = await PayrollRecord.find(filter).sort({ createdAt: -1 }).lean();

        // Also incorporate real SupportTeam employees if they have salary configured
        const supportEmps = await SupportTeam.find({ status: 'active', salary: { $gt: 0 } }).lean();
        const existingEmployeeIds = new Set(payrolls.map(p => (p.employeeId ? p.employeeId.toString() : p.employeeCode)));

        supportEmps.forEach((s) => {
            const empKey = s.employeeId || s._id.toString();
            if (!existingEmployeeIds.has(empKey) && !existingEmployeeIds.has(s._id.toString())) {
                const baseSal = Number(s.salary || 0);
                const pf = Math.round(baseSal * 0.05);
                const esi = Math.round(baseSal * 0.015);
                const pt = 200;
                const net = Math.max(0, baseSal - pf - esi - pt);
                payrolls.push({
                    _id: `sup-${s._id}`,
                    employeeId: s._id,
                    employeeName: s.name,
                    employeeCode: s.employeeId || `SUP-${s._id.toString().slice(-4)}`,
                    role: s.designation || 'Specialist',
                    department: s.department || 'Customer Support',
                    employeeType: 'Employee',
                    salary: baseSal,
                    bonus: 0,
                    commission: 0,
                    incentive: 0,
                    pf,
                    esi,
                    professionalTax: pt,
                    advance: 0,
                    deduction: 0,
                    netSalary: net,
                    paymentStatus: 'Pending',
                    month: month || new Date().toLocaleString('default', { month: 'long' }),
                    year: new Date().getFullYear(),
                    joiningDate: s.joiningDate || new Date(),
                    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                    bankAccountHolder: s.name,
                    bankAccountNumber: s.bankAccountNumber || '',
                    bankIfsc: s.bankIfsc || '',
                    bankName: s.bankName || '',
                    territory: {
                        state: s.state || '',
                        district: s.district || '',
                        division: s.division || '',
                        pincode: s.pincode || ''
                    }
                });
            }
        });

        // Apply filters
        if (department && department !== 'all') {
            const cleanDept = department.toLowerCase();
            payrolls = payrolls.filter(p => {
                const pDept = (p.department || '').toLowerCase();
                if (cleanDept === 'admin' || cleanDept === 'admin staff') return pDept.includes('admin');
                if (cleanDept === 'managers' || cleanDept === 'manager') return pDept.includes('manager');
                if (cleanDept === 'kyc' || cleanDept === 'kyc team') return pDept.includes('kyc');
                if (cleanDept === 'payment' || cleanDept === 'payment team') return pDept.includes('payment');
                if (cleanDept === 'customer support' || cleanDept === 'support') return pDept.includes('customer') || pDept.includes('support');
                if (cleanDept === 'hr') return pDept.includes('hr');
                return pDept === cleanDept;
            });
        }
        if (role && role !== 'all') {
            payrolls = payrolls.filter(p => (p.role || '').toLowerCase().includes(role.toLowerCase()));
        }
        if (employeeType && employeeType !== 'all') {
            payrolls = payrolls.filter(p => (p.employeeType || '').toLowerCase() === employeeType.toLowerCase());
        }
        if (status && status !== 'all') {
            payrolls = payrolls.filter(p => (p.paymentStatus || '').toLowerCase() === status.toLowerCase());
        }

        // Territory filtering
        if (state && state !== 'all') {
            payrolls = payrolls.filter(p => (p.territory?.state || '').toLowerCase() === state.toLowerCase());
        }
        if (district && district !== 'all') {
            payrolls = payrolls.filter(p => (p.territory?.district || '').toLowerCase() === district.toLowerCase());
        }
        if (division && division !== 'all') {
            payrolls = payrolls.filter(p => (p.territory?.division || '').toLowerCase() === division.toLowerCase());
        }
        if (pincode && pincode !== 'all') {
            payrolls = payrolls.filter(p => String(p.territory?.pincode || '').includes(pincode.trim()));
        }

        if (search) {
            const s = search.toLowerCase();
            payrolls = payrolls.filter(p =>
                (p.employeeName || '').toLowerCase().includes(s) ||
                (p.employeeCode || '').toLowerCase().includes(s) ||
                (p.department || '').toLowerCase().includes(s) ||
                (p.role || '').toLowerCase().includes(s)
            );
        }

        // Deduplicate records by canonical string ID
        const seenPayrollIds = new Set();
        payrolls = payrolls.filter(p => {
            const idKey = String(p._id || p.id || (p.employeeCode ? `${p.employeeCode}-${p.month}` : ''));
            if (!idKey || seenPayrollIds.has(idKey)) return false;
            seenPayrollIds.add(idKey);
            return true;
        });

        // Calculate KPI summaries dynamically
        const totalSalary = payrolls.reduce((acc, p) => acc + (p.salary || 0), 0);
        const commissionPaid = payrolls.reduce((acc, p) => acc + (p.commission || 0), 0);
        const pendingSalary = payrolls.filter(p => (p.paymentStatus || '').toLowerCase() === 'pending').reduce((acc, p) => acc + (p.netSalary || 0), 0);
        const currentMonthPayroll = payrolls.reduce((acc, p) => acc + (p.netSalary || 0), 0);

        res.json({
            payrolls,
            kpi: {
                totalSalary,
                commissionPaid,
                pendingSalary,
                currentMonthPayroll
            }
        });
    } catch (err) {
        console.error('Fetch payroll error:', err);
        res.status(500).send('Server error');
    }
});

// POST Single Payroll Payment (Section 21)
router.post('/payroll/pay', auth, async (req, res) => {
    try {
        const { payrollId, verificationToken, notes } = req.body;
        if (!payrollId) {
            return res.status(400).json({ success: false, msg: 'Payroll ID is required.' });
        }

        const txnRef = `TXN-PR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

        // Check if there is an explicit MongoDB PayrollRecord document
        if (mongoose.Types.ObjectId.isValid(payrollId)) {
            await PayrollRecord.findByIdAndUpdate(payrollId, {
                paymentStatus: 'Paid',
                paymentDate: new Date()
            });
        }

        // Also update matching Payment if exists
        await Payment.findOneAndUpdate(
            { $or: [{ paymentId: payrollId }, { recipientId: payrollId }, { _id: mongoose.Types.ObjectId.isValid(payrollId) ? payrollId : null }] },
            {
                status: 'PAID',
                paymentDate: new Date(),
                transactionReference: txnRef,
                processedBy: req.user.name || 'Super Admin'
            }
        );

        await PaymentAuditLog.create({
            paymentId: payrollId,
            action: 'payment_processed',
            user: req.user.name || 'Super Admin',
            userId: req.user.id || req.user._id,
            role: req.user.role || 'super-admin',
            details: `Payroll salary processed successfully. Reference: ${txnRef}`,
            metadata: { transactionReference: txnRef, notes }
        });

        res.json({
            success: true,
            msg: `Payroll salary disbursed successfully. Reference: ${txnRef}`,
            transactionReference: txnRef
        });

    } catch (err) {
        console.error('Error processing payroll salary payment:', err);
        res.status(500).json({ success: false, msg: 'Server error processing payroll salary.' });
    }
});

// POST Bulk Payroll Payment (Section 23)
router.post('/payroll/pay-bulk', auth, async (req, res) => {
    try {
        const { department, verificationToken } = req.body;

        const batchRef = `BULK-PR-${Date.now()}`;
        const deptLabel = department || 'All Staff';

        // Update any explicit MongoDB PayrollRecords for this department
        const filter = { paymentStatus: 'Pending' };
        if (department && department !== 'all' && department !== 'All Employees') {
            filter.department = new RegExp(department, 'i');
        }
        await PayrollRecord.updateMany(filter, {
            paymentStatus: 'Paid',
            paymentDate: new Date()
        });

        // Also update matching Payment records
        const paymentFilter = { paymentCategory: 'payroll_payment', status: 'PENDING' };
        if (department && department !== 'all' && department !== 'All Employees') {
            paymentFilter.department = new RegExp(department, 'i');
        }
        const updated = await Payment.updateMany(paymentFilter, {
            status: 'PAID',
            paymentDate: new Date(),
            transactionReference: batchRef,
            processedBy: req.user.name || 'Super Admin'
        });

        await PaymentAuditLog.create({
            paymentId: batchRef,
            action: 'payment_processed',
            user: req.user.name || 'Super Admin',
            userId: req.user.id || req.user._id,
            role: req.user.role || 'super-admin',
            details: `Bulk payroll disbursement processed for ${deptLabel}`,
            metadata: { department: deptLabel, batchRef }
        });

        res.json({
            success: true,
            msg: `Bulk payroll disbursement completed for ${deptLabel}. Batch Reference: ${batchRef}`,
            batchReference: batchRef
        });

    } catch (err) {
        console.error('Error processing bulk payroll:', err);
        res.status(500).json({ success: false, msg: 'Server error processing bulk payroll.' });
    }
});

// POST Cancel Payroll (Section 22)
router.post('/payroll/cancel', auth, async (req, res) => {
    try {
        const { payrollId, cancellationReason } = req.body;
        if (!payrollId) {
            return res.status(400).json({ success: false, msg: 'Payroll record ID is required.' });
        }
        if (!cancellationReason || !cancellationReason.trim()) {
            return res.status(400).json({ success: false, msg: 'Cancellation reason is mandatory.' });
        }

        if (mongoose.Types.ObjectId.isValid(payrollId)) {
            await PayrollRecord.findByIdAndUpdate(payrollId, {
                paymentStatus: 'Cancelled'
            });
        }

        await Payment.findOneAndUpdate(
            { $or: [{ paymentId: payrollId }, { recipientId: payrollId }, { _id: mongoose.Types.ObjectId.isValid(payrollId) ? payrollId : null }] },
            {
                status: 'CANCELLED',
                cancellationReason: cancellationReason.trim(),
                cancelledBy: req.user.name || 'Administrator',
                cancelledAt: new Date()
            }
        );

        await PaymentAuditLog.create({
            paymentId: payrollId,
            action: 'payment_cancelled',
            user: req.user.name || 'Administrator',
            userId: req.user.id || req.user._id,
            role: req.user.role || 'super-admin',
            details: `Payroll cancelled: ${cancellationReason.trim()}`,
            metadata: { cancellationReason: cancellationReason.trim() }
        });

        res.json({
            success: true,
            msg: 'Payroll record has been cancelled successfully.'
        });

    } catch (err) {
        console.error('Error cancelling payroll record:', err);
        res.status(500).json({ success: false, msg: 'Server error cancelling payroll record.' });
    }
});

// POST Hold Payroll Record
router.post('/payroll/hold', auth, async (req, res) => {
    try {
        const { payrollId, holdReason } = req.body;
        if (!payrollId) {
            return res.status(400).json({ success: false, msg: 'Payroll record ID is required.' });
        }
        if (!holdReason || !holdReason.trim()) {
            return res.status(400).json({ success: false, msg: 'Hold reason is mandatory.' });
        }

        if (mongoose.Types.ObjectId.isValid(payrollId)) {
            await PayrollRecord.findByIdAndUpdate(payrollId, {
                paymentStatus: 'Held',
                holdReason: holdReason.trim(),
                heldBy: req.user.name || 'Administrator',
                heldAt: new Date()
            });
        }

        await Payment.findOneAndUpdate(
            { $or: [{ paymentId: payrollId }, { recipientId: payrollId }, { _id: mongoose.Types.ObjectId.isValid(payrollId) ? payrollId : null }] },
            {
                status: 'HELD',
                holdReason: holdReason.trim(),
                heldBy: req.user.name || 'Administrator',
                heldAt: new Date()
            }
        );

        await PaymentAuditLog.create({
            paymentId: payrollId,
            action: 'payment_held',
            user: req.user.name || 'Administrator',
            userId: req.user.id || req.user._id,
            role: req.user.role || 'super-admin',
            details: `Payroll placed on hold: ${holdReason.trim()}`,
            metadata: { holdReason: holdReason.trim() }
        });

        res.json({
            success: true,
            msg: 'Payroll record has been placed on hold successfully.'
        });

    } catch (err) {
        console.error('Error holding payroll record:', err);
        res.status(500).json({ success: false, msg: 'Server error placing payroll record on hold.' });
    }
});

// POST Generate / Process Payroll Entry
router.post('/payroll/generate', auth, async (req, res) => {
    try {
        const {
            employeeName, employeeCode, role, department, employeeType,
            salary = 0, bonus = 0, commission = 0, incentive = 0,
            pf = 0, esi = 0, professionalTax = 0, advance = 0, deduction = 0,
            month = 'September', year = 2026
        } = req.body;

        const grossSalary = Number(salary) + Number(bonus) + Number(commission) + Number(incentive);
        const totalDeductions = Number(pf) + Number(esi) + Number(professionalTax) + Number(advance) + Number(deduction);
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        const newPayroll = new PayrollRecord({
            employeeName,
            employeeCode: employeeCode || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
            role: role || 'Staff',
            department: department || 'Customer Support',
            employeeType: employeeType || 'Employee',
            salary: Number(salary),
            bonus: Number(bonus),
            commission: Number(commission),
            incentive: Number(incentive),
            pf: Number(pf),
            esi: Number(esi),
            professionalTax: Number(professionalTax),
            advance: Number(advance),
            deduction: Number(deduction),
            netSalary,
            paymentStatus: 'Pending',
            month,
            year
        });

        await newPayroll.save();

        const io = getIo(req);
        if (io) {
            io.emit('payroll_generated', newPayroll);
        }

        res.status(201).json(newPayroll);
    } catch (err) {
        console.error('Generate payroll error:', err);
        res.status(500).send('Server error');
    }
});


// =========================================================
// 5. CUSTOMER SUPPORT TEAM (EMPLOYEE MANAGEMENT)
// =========================================================

// GET Support Team Hierarchy
router.get('/support-team/hierarchy', auth, async (req, res) => {
    try {
        const employees = await SupportTeam.find({}).sort({ createdAt: -1 });

        const grouped = {
            'Customer Support': { manager: null, teamLeaders: [], staff: [] },
            'KYC Team': { manager: null, teamLeaders: [], staff: [] },
            'Payment Team': { manager: null, teamLeaders: [], staff: [] }
        };

        employees.forEach(emp => {
            const dept = emp.department || 'Customer Support';
            if (!grouped[dept]) grouped[dept] = { manager: null, teamLeaders: [], staff: [] };

            if (emp.designation === 'Manager') grouped[dept].manager = emp;
            else if (emp.designation === 'Team Leader') grouped[dept].teamLeaders.push(emp);
            else grouped[dept].staff.push(emp);
        });

        res.json({ employees, hierarchy: grouped });
    } catch (err) {
        console.error('Fetch support team hierarchy error:', err);
        res.status(500).send('Server error');
    }
});

// POST Onboard New Support Employee
router.post('/support-team/onboard', auth, async (req, res) => {
    try {
        const {
            name, email, phone, department, designation,
            reportingManager, reportingTL, joiningDate, salary, photo
        } = req.body;

        const employeeId = `SUP-${Math.floor(1000 + Math.random() * 9000)}`;

        const newEmp = new SupportTeam({
            employeeId,
            name,
            email,
            phone,
            department: department || 'Customer Support',
            designation: designation || 'Staff',
            reportingManager: reportingManager || null,
            reportingTL: reportingTL || null,
            joiningDate: joiningDate || new Date(),
            salary: salary || 25000,
            photo: photo || '',
            status: 'active'
        });

        await newEmp.save();

        const io = getIo(req);
        if (io) {
            io.emit('employee_onboarded', newEmp);
        }

        res.status(201).json(newEmp);
    } catch (err) {
        console.error('Onboard support employee error:', err);
        res.status(500).send('Server error');
    }
});

module.exports = router;
