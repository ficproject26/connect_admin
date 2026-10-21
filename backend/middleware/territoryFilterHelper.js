const Pincode = require('../models/Pincode');

/**
 * Builds a safe MongoDB filter for State -> District -> Division -> Pincode
 * Supports querying directly on record fields or nested fields like `territory.state`
 */
function buildTerritoryFilter(query = {}, options = {}) {
    const {
        stateKey = 'state',
        districtKey = 'district',
        divisionKey = 'division',
        pincodeKey = 'pincode',
        includeNestedTerritory = true
    } = options;

    const filter = {};
    const state = (query.state || query.selectedState || '').trim();
    const district = (query.district || query.selectedDistrict || '').trim();
    const division = (query.division || query.selectedDivision || '').trim();
    const pincode = (query.pincode || query.selectedPincode || '').trim();

    if (state && state.toLowerCase() !== 'all') {
        const regex = new RegExp(`^${state}$`, 'i');
        if (includeNestedTerritory) {
            filter.$and = filter.$and || [];
            filter.$and.push({
                $or: [
                    { [stateKey]: regex },
                    { [`territory.${stateKey}`]: regex },
                    { assignedState: regex }
                ]
            });
        } else {
            filter[stateKey] = regex;
        }
    }

    if (district && district.toLowerCase() !== 'all') {
        const regex = new RegExp(`^${district}$`, 'i');
        if (includeNestedTerritory) {
            filter.$and = filter.$and || [];
            filter.$and.push({
                $or: [
                    { [districtKey]: regex },
                    { [`territory.${districtKey}`]: regex },
                    { city: regex },
                    { assignedDistrict: regex }
                ]
            });
        } else {
            filter[districtKey] = regex;
        }
    }

    if (division && division.toLowerCase() !== 'all') {
        const regex = new RegExp(`^${division}$`, 'i');
        if (includeNestedTerritory) {
            filter.$and = filter.$and || [];
            filter.$and.push({
                $or: [
                    { [divisionKey]: regex },
                    { [`territory.${divisionKey}`]: regex },
                    { assignedDivision: regex },
                    { assignedArea: regex }
                ]
            });
        } else {
            filter[divisionKey] = regex;
        }
    }

    if (pincode && pincode.toLowerCase() !== 'all') {
        const pinRegex = new RegExp(`^${pincode}$`, 'i');
        if (includeNestedTerritory) {
            filter.$and = filter.$and || [];
            filter.$and.push({
                $or: [
                    { [pincodeKey]: pincode },
                    { [pincodeKey]: pinRegex },
                    { [`territory.${pincodeKey}`]: pincode },
                    { assignedPincode: pincode }
                ]
            });
        } else {
            filter[pincodeKey] = pincode;
        }
    }

    return filter;
}

module.exports = {
    buildTerritoryFilter
};
