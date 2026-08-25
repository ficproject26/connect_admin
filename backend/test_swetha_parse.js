const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
    "Uttarakhand", "West Bengal", "Delhi", "Puducherry"
];

function resolveVendorLocation(vObj) {
    const isInvalid = (val) => {
        if (!val || typeof val !== 'string') return true;
        const clean = val.trim().toLowerCase();
        return ['city', 'state', '111111', '111', '000000', 'n/a', 'none', 'undefined', 'null', 'dfghjkhj', 'asdf', 'qwerty'].includes(clean) || /^(.)\1+$/.test(clean);
    };

    let city = (!isInvalid(vObj.city) ? vObj.city : !isInvalid(vObj.district) ? vObj.district : '').trim();
    let state = (!isInvalid(vObj.state) ? vObj.state : '').trim();
    let pin = (vObj.pincode || vObj.postalCode || '').trim();
    let addr = (vObj.address || vObj.fullAddress || vObj.businessAddress || '').trim();

    // Parse comma-separated address parts
    if ((!city || !state) && addr) {
        const parts = addr.split(',').map(p => p.trim()).filter(p => p && !isInvalid(p));
        
        for (const part of parts) {
            // Check state match
            const matchedState = INDIAN_STATES.find(s => s.toLowerCase() === part.toLowerCase() || part.toLowerCase().includes(s.toLowerCase()));
            if (matchedState && !state) {
                state = matchedState;
                continue;
            }

            // Check district/taluk match (e.g. "SALEM DISTRICT", "THALAIVASAL TALUK")
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

    // Pincode based State / District fallback
    if (pin && pin.length === 6) {
        const prefix2 = pin.substring(0, 2);
        const prefix3 = pin.substring(0, 3);

        if (!state) {
            if (['60', '61', '62', '63', '64'].includes(prefix2)) state = "Tamil Nadu";
            else if (['56', '57', '58', '59'].includes(prefix2)) state = "Karnataka";
            else if (['50', '51', '52', '53'].includes(prefix2)) state = "Andhra Pradesh / Telangana";
            else if (['67', '68', '69'].includes(prefix2)) state = "Kerala";
            else if (['40', '41', '42', '43', '44'].includes(prefix2)) state = "Maharashtra";
            else if (['11'].includes(prefix2)) state = "Delhi";
        }

        if (!city && prefix3 === '636') {
            city = "Salem";
        }
    }

    return {
        city: city || 'Salem',
        district: city || 'Salem',
        state: state || 'Tamil Nadu',
        pincode: pin || '636112'
    };
}

async function testParse() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const userDoc = await db.collection('users').findOne({ email: 'swetha@gmail.com' });
    const location = resolveVendorLocation(userDoc);

    console.log('=== RESOLVED LOCATION FOR SWETHA ===');
    console.log(JSON.stringify(location, null, 2));

    await mongoose.disconnect();
}

testParse().catch(console.error);
