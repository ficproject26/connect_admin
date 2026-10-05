const mongoose = require('mongoose');
const User = require('../models/User');
const Manager = require('../models/Manager');
const PincodeAssignment = require('../models/PincodeAssignment');

// Helper to normalize strings for comparison
const norm = (val) => String(val || '').trim().toLowerCase();

/**
 * Strict Hierarchical Assignment Service
 * Resolves only states, districts, divisions, and pincodes that contain
 * at least one real active/assigned Admin, Manager, or Agent.
 */
class TerritoryAssignmentService {
    /**
     * Fetch all active assigned users based on entity type and scope
     */
    static async getRawAssignedEntities(entityType = 'all', scope = {}) {
        const adminRoles = [
            'admin', 'super-admin', 'superadmin', 'main-admin',
            'State Admin', 'District Admin', 'Division Admin', 'Pincode Admin',
            'state-admin', 'district-admin', 'division-admin', 'pincode-admin',
            'branch-admin', 'state_admin', 'district_admin', 'division_admin', 'pincode_admin'
        ];

        const adminQuery = {
            $or: [
                { role: { $in: adminRoles } },
                { adminRole: { $in: adminRoles } },
                { adminLevel: { $in: ['main', 'state', 'district', 'division', 'pincode'] } },
                { level: { $in: ['state', 'district', 'division', 'pincode', 1, 2, 3, 4, '1', '2', '3', '4'] } }
            ],
            role: { $nin: ['Vendor', 'vendor', 'Member', 'member', 'customer', 'Customer', 'agent', 'state_manager', 'district_manager', 'division_manager', 'pincode_manager'] },
            status: { $in: ['approved', 'Active', 'active'] },
            isActive: { $ne: false },
            $and: [
                {
                    $or: [
                        { assignedState: { $exists: true, $ne: '', $ne: null, $nin: ['General State', 'General', 'State'] } },
                        { state: { $exists: true, $ne: '', $ne: null, $nin: ['General State', 'General', 'State'] } }
                    ]
                }
            ]
        };

        const managerQuery = {
            status: 'Active',
            assignedState: { $exists: true, $ne: '', $ne: null, $nin: ['General State', 'General', 'State'] }
        };

        const agentQuery = {
            role: 'agent',
            status: { $in: ['approved', 'Active', 'active'] },
            isActive: { $ne: false },
            $or: [
                { assignedState: { $exists: true, $ne: '', $ne: null, $nin: ['General State', 'General', 'State'] } },
                { state: { $exists: true, $ne: '', $ne: null, $nin: ['General State', 'General', 'State'] } }
            ]
        };

        // Apply territory scoping if not Super Admin
        if (scope && !scope.isSuperAdmin) {
            if (scope.assignedState) {
                const stateRegex = new RegExp(`^${scope.assignedState.trim()}$`, 'i');
                adminQuery.$and = (adminQuery.$and || []).concat([{
                    $or: [{ assignedState: stateRegex }, { state: stateRegex }]
                }]);
                managerQuery.assignedState = stateRegex;
                agentQuery.$and = (agentQuery.$and || []).concat([{
                    $or: [{ assignedState: stateRegex }, { state: stateRegex }]
                }]);
            }
            if (scope.assignedDistrict) {
                const distRegex = new RegExp(`^${scope.assignedDistrict.trim()}$`, 'i');
                adminQuery.$and = (adminQuery.$and || []).concat([{
                    $or: [{ assignedDistrict: distRegex }, { district: distRegex }]
                }]);
                managerQuery.assignedDistrict = distRegex;
                agentQuery.$and = (agentQuery.$and || []).concat([{
                    $or: [{ assignedDistrict: distRegex }, { district: distRegex }]
                }]);
            }
            if (scope.assignedDivision) {
                const divRegex = new RegExp(`^${scope.assignedDivision.trim()}$`, 'i');
                adminQuery.$and = (adminQuery.$and || []).concat([{
                    $or: [{ assignedDivision: divRegex }, { division: divRegex }]
                }]);
                managerQuery.assignedDivision = divRegex;
                agentQuery.$and = (agentQuery.$and || []).concat([{
                    $or: [{ assignedDivision: divRegex }, { division: divRegex }]
                }]);
            }
            if (scope.assignedPincode) {
                const pinStr = String(scope.assignedPincode).trim();
                adminQuery.$and = (adminQuery.$and || []).concat([{
                    $or: [{ assignedPincode: pinStr }, { pincode: pinStr }]
                }]);
                managerQuery.assignedPincode = pinStr;
                agentQuery.$and = (agentQuery.$and || []).concat([{
                    $or: [{ assignedPincode: pinStr }, { pincode: pinStr }]
                }]);
            }
        }

        let admins = [];
        let managers = [];
        let agents = [];
        let pincodeAssignments = [];

        const queries = [];
        if (entityType === 'all' || entityType === 'admins') {
            queries.push(
                User.find(adminQuery)
                    .select('_id name email phone mobile altPhone role adminRole adminLevel level assignedState state stateId assignedDistrict district districtId assignedDivision division divisionId assignedPincode pincode pincodeId postOffice fullAddress status isActive registrationId createdAt')
                    .lean()
                    .then(res => { admins = res; })
            );
        }
        if (entityType === 'all' || entityType === 'managers') {
            queries.push(
                Manager.find(managerQuery)
                    .select('_id name email phone altPhone level assignedState assignedDistrict assignedDivision assignedPincode status createdAt')
                    .lean()
                    .then(res => { managers = res; })
            );
        }
        if (entityType === 'all' || entityType === 'agents') {
            queries.push(
                User.find(agentQuery)
                    .select('_id name email phone role level assignedState assignedDistrict assignedDivision assignedPincode state district division pincode territory status isActive registrationId createdAt')
                    .lean()
                    .then(res => { agents = res; })
            );
        }

        queries.push(
            PincodeAssignment.find({ status: 'Active' }).lean().then(res => { pincodeAssignments = res; }).catch(() => [])
        );

        await Promise.all(queries);

        return { admins, managers, agents, pincodeAssignments };
    }

    /**
     * Builds strict assignment hierarchy tree
     * Only nodes with assigned users are returned.
     */
    static async getAssignedHierarchyTree(entityType = 'all', scope = {}) {
        const { admins, managers, agents } = await this.getRawAssignedEntities(entityType, scope);

        // Normalize each entity
        const entities = [];

        // 1. Admins
        admins.forEach(a => {
            const state = (a.assignedState || a.state || '').trim();
            const district = (a.assignedDistrict || a.district || '').trim();
            const division = (a.assignedDivision || a.division || '').trim();
            const pincode = a.assignedPincode ? String(a.assignedPincode).trim() : (a.pincode ? String(a.pincode).trim() : '');

            // Ignore Super Admin or unassigned accounts
            if (!state || norm(state) === 'general state' || norm(state) === 'state') return;
            if (a.role === 'super-admin' && !district && !division && a.email === 'admin@example.com') return;

            const rawLvl = a.adminLevel || a.level;
            const rawRole = (a.role || a.adminRole || '').toLowerCase();
            let level = 'pincode';
            if (rawLvl === 1 || rawLvl === '1' || rawLvl === 'state' || rawRole.includes('state')) level = 'state';
            else if (rawLvl === 2 || rawLvl === '2' || rawLvl === 'district' || rawRole.includes('district') || rawRole.includes('branch')) level = 'district';
            else if (rawLvl === 3 || rawLvl === '3' || rawLvl === 'division' || rawRole.includes('division')) level = 'division';
            else if (rawLvl === 4 || rawLvl === '4' || rawLvl === 'pincode' || rawRole.includes('pincode')) level = 'pincode';

            entities.push({
                _id: a._id,
                entityType: 'Admin',
                level,
                role: a.adminRole || `${level}-admin`,
                name: a.name,
                email: a.email,
                phone: a.phone || a.mobile || '',
                altPhone: a.altPhone || '',
                state,
                district: district || '',
                division: division || '',
                pincode: pincode || '',
                status: a.status || 'Active',
                raw: a
            });
        });

        // 2. Managers
        managers.forEach(m => {
            const state = (m.assignedState || '').trim();
            const district = (m.assignedDistrict || '').trim();
            const division = (m.assignedDivision || '').trim();
            const pincode = m.assignedPincode ? String(m.assignedPincode).trim() : '';
            if (!state || norm(state) === 'general state' || norm(state) === 'state') return;

            const lvl = norm(m.level || '');
            let level = 'pincode';
            if (lvl === 'state' || lvl === '1' || (!district && !division && !pincode)) level = 'state';
            else if (lvl === 'district' || lvl === '2' || (!division && !pincode)) level = 'district';
            else if (lvl === 'division' || lvl === '3' || !pincode) level = 'division';

            entities.push({
                _id: m._id,
                entityType: 'Manager',
                level,
                role: `${level}-manager`,
                name: m.name,
                email: m.email,
                phone: m.phone || '',
                altPhone: m.altPhone || '',
                state,
                district: district || '',
                division: division || '',
                pincode: pincode || '',
                status: m.status || 'Active',
                raw: m
            });
        });

        // 3. Agents
        agents.forEach(ag => {
            const state = (ag.assignedState || ag.state || ag.territory?.state || '').trim();
            const district = (ag.assignedDistrict || ag.district || ag.territory?.district || '').trim();
            const division = (ag.assignedDivision || ag.division || ag.territory?.division || '').trim();
            const pincode = (ag.assignedPincode?.code || ag.assignedPincode || ag.pincode || ag.territory?.pincode || '').toString().trim();
            if (!state || norm(state) === 'general state' || norm(state) === 'state') return;

            const lvl = norm(ag.level || '');
            let level = 'pincode';
            if (lvl === 'state' || (!district && !division && !pincode)) level = 'state';
            else if (lvl === 'district' || (!division && !pincode)) level = 'district';
            else if (lvl === 'division' || !pincode) level = 'division';

            entities.push({
                _id: ag._id,
                entityType: 'Agent',
                level,
                role: `${level}-agent`,
                name: ag.name,
                email: ag.email,
                phone: ag.phone || '',
                state,
                district: district || '',
                division: division || '',
                pincode: pincode || '',
                status: ag.status || 'Active',
                raw: ag
            });
        });

        // Assemble into hierarchical map
        const stateMap = {};

        entities.forEach(ent => {
            const sKey = ent.state;
            if (!stateMap[sKey]) {
                stateMap[sKey] = {
                    name: sKey,
                    state: sKey,
                    admins: [],
                    managers: [],
                    agents: [],
                    districts: {}
                };
            }

            if (ent.level === 'state') {
                if (ent.entityType === 'Admin') stateMap[sKey].admins.push(ent);
                else if (ent.entityType === 'Manager') stateMap[sKey].managers.push(ent);
                else if (ent.entityType === 'Agent') stateMap[sKey].agents.push(ent);
                return;
            }

            // District Level
            const dKey = ent.district;
            if (!dKey) return; // Ignore if no district specified for lower levels

            if (!stateMap[sKey].districts[dKey]) {
                stateMap[sKey].districts[dKey] = {
                    name: dKey,
                    district: dKey,
                    state: sKey,
                    admins: [],
                    managers: [],
                    agents: [],
                    divisions: {}
                };
            }

            if (ent.level === 'district') {
                if (ent.entityType === 'Admin') stateMap[sKey].districts[dKey].admins.push(ent);
                else if (ent.entityType === 'Manager') stateMap[sKey].districts[dKey].managers.push(ent);
                else if (ent.entityType === 'Agent') stateMap[sKey].districts[dKey].agents.push(ent);
                return;
            }

            // Division Level
            const vKey = ent.division;
            if (!vKey) return;

            if (!stateMap[sKey].districts[dKey].divisions[vKey]) {
                stateMap[sKey].districts[dKey].divisions[vKey] = {
                    name: vKey,
                    division: vKey,
                    district: dKey,
                    state: sKey,
                    admins: [],
                    managers: [],
                    agents: [],
                    pincodes: {}
                };
            }

            if (ent.level === 'division') {
                if (ent.entityType === 'Admin') stateMap[sKey].districts[dKey].divisions[vKey].admins.push(ent);
                else if (ent.entityType === 'Manager') stateMap[sKey].districts[dKey].divisions[vKey].managers.push(ent);
                else if (ent.entityType === 'Agent') stateMap[sKey].districts[dKey].divisions[vKey].agents.push(ent);
                return;
            }

            // Pincode Level
            const pKey = ent.pincode;
            if (!pKey) return;

            if (!stateMap[sKey].districts[dKey].divisions[vKey].pincodes[pKey]) {
                stateMap[sKey].districts[dKey].divisions[vKey].pincodes[pKey] = {
                    code: pKey,
                    pincode: pKey,
                    division: vKey,
                    district: dKey,
                    state: sKey,
                    admins: [],
                    managers: [],
                    agents: []
                };
            }

            if (ent.entityType === 'Admin') stateMap[sKey].districts[dKey].divisions[vKey].pincodes[pKey].admins.push(ent);
            else if (ent.entityType === 'Manager') stateMap[sKey].districts[dKey].divisions[vKey].pincodes[pKey].managers.push(ent);
            else if (ent.entityType === 'Agent') stateMap[sKey].districts[dKey].divisions[vKey].pincodes[pKey].agents.push(ent);
        });

        // Convert maps to sorted arrays with exact counts
        const resultStates = Object.values(stateMap).map(st => {
            const districtList = Object.values(st.districts).map(dt => {
                const divisionList = Object.values(dt.divisions).map(dv => {
                    const pincodeList = Object.values(dv.pincodes).map(pin => ({
                        ...pin,
                        totalAssigned: pin.admins.length + pin.managers.length + pin.agents.length
                    })).sort((a, b) => a.code.localeCompare(b.code));

                    return {
                        ...dv,
                        pincodes: pincodeList,
                        pincodesCount: pincodeList.length,
                        totalAssigned: dv.admins.length + dv.managers.length + dv.agents.length + pincodeList.reduce((acc, p) => acc + p.totalAssigned, 0)
                    };
                }).sort((a, b) => a.name.localeCompare(b.name));

                return {
                    ...dt,
                    divisions: divisionList,
                    divisionsCount: divisionList.length,
                    pincodesCount: divisionList.reduce((acc, v) => acc + v.pincodesCount, 0),
                    totalAssigned: dt.admins.length + dt.managers.length + dt.agents.length + divisionList.reduce((acc, v) => acc + v.totalAssigned, 0)
                };
            }).sort((a, b) => a.name.localeCompare(b.name));

            return {
                ...st,
                districts: districtList,
                districtsCount: districtList.length,
                divisionsCount: districtList.reduce((acc, d) => acc + d.divisionsCount, 0),
                pincodesCount: districtList.reduce((acc, d) => acc + d.pincodesCount, 0),
                totalAssigned: st.admins.length + st.managers.length + st.agents.length + districtList.reduce((acc, d) => acc + d.totalAssigned, 0)
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        return resultStates;
    }

    /**
     * Get assigned states only
     */
    static async getAssignedStates(scope = {}, entityType = 'all') {
        const tree = await this.getAssignedHierarchyTree(entityType, scope);
        return tree.map(s => ({
            name: s.name,
            state: s.name,
            districtsCount: s.districtsCount,
            divisionsCount: s.divisionsCount,
            pincodesCount: s.pincodesCount,
            adminsCount: s.admins.length,
            managersCount: s.managers.length,
            agentsCount: s.agents.length,
            totalAssigned: s.totalAssigned,
            admins: s.admins,
            managers: s.managers,
            agents: s.agents
        }));
    }

    /**
     * Get assigned districts under a state
     */
    static async getAssignedDistricts(stateName, scope = {}, entityType = 'all') {
        const tree = await this.getAssignedHierarchyTree(entityType, scope);
        const match = tree.find(s => norm(s.name) === norm(stateName));
        if (!match) return [];
        return match.districts.map(d => ({
            name: d.name,
            district: d.name,
            state: match.name,
            divisionsCount: d.divisionsCount,
            pincodesCount: d.pincodesCount,
            adminsCount: d.admins.length,
            managersCount: d.managers.length,
            agentsCount: d.agents.length,
            totalAssigned: d.totalAssigned,
            admins: d.admins,
            managers: d.managers,
            agents: d.agents
        }));
    }

    /**
     * Get assigned divisions under a district
     */
    static async getAssignedDivisions(stateName, districtName, scope = {}, entityType = 'all') {
        const districts = await this.getAssignedDistricts(stateName, scope, entityType);
        const match = districts.find(d => norm(d.name) === norm(districtName));
        if (!match) return [];
        const tree = await this.getAssignedHierarchyTree(entityType, scope);
        const stMatch = tree.find(s => norm(s.name) === norm(stateName));
        const dtMatch = stMatch?.districts.find(d => norm(d.name) === norm(districtName));
        if (!dtMatch) return [];
        return dtMatch.divisions.map(v => ({
            name: v.name,
            division: v.name,
            district: dtMatch.name,
            state: stMatch.name,
            pincodesCount: v.pincodesCount,
            adminsCount: v.admins.length,
            managersCount: v.managers.length,
            agentsCount: v.agents.length,
            totalAssigned: v.totalAssigned,
            admins: v.admins,
            managers: v.managers,
            agents: v.agents
        }));
    }

    /**
     * Get assigned pincodes under a division
     */
    static async getAssignedPincodes(stateName, districtName, divisionName, scope = {}, entityType = 'all') {
        const tree = await this.getAssignedHierarchyTree(entityType, scope);
        const stMatch = tree.find(s => norm(s.name) === norm(stateName));
        const dtMatch = stMatch?.districts.find(d => norm(d.name) === norm(districtName));
        const dvMatch = dtMatch?.divisions.find(v => norm(v.name) === norm(divisionName));
        if (!dvMatch) return [];
        return dvMatch.pincodes.map(p => ({
            code: p.code,
            pincode: p.code,
            division: dvMatch.name,
            district: dtMatch.name,
            state: stMatch.name,
            adminsCount: p.admins.length,
            managersCount: p.managers.length,
            agentsCount: p.agents.length,
            totalAssigned: p.totalAssigned,
            admins: p.admins,
            managers: p.managers,
            agents: p.agents
        }));
    }
}

module.exports = TerritoryAssignmentService;
