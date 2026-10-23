const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Pincode = require('../models/Pincode');
const State = require('../models/State');
const District = require('../models/District');
const Division = require('../models/Division');

// Helper to extract territory scope from user
const getTerritoryScope = (user) => {
    if (!user) return null;

    const role = (user.role || '').toLowerCase().trim();
    const adminRole = (user.adminRole || '').toLowerCase().trim();
    const adminLevel = (user.adminLevel || '').toLowerCase().trim();
    const level = (user.level || '').toLowerCase().trim();

    const isSuperOrMainAdmin = (
        ['admin', 'super-admin', 'superadmin', 'super admin'].includes(role) ||
        ['admin', 'super-admin', 'superadmin', 'super admin'].includes(adminRole) ||
        adminLevel === 'main' || adminLevel === 'all'
    ) && (
        !role.includes('state') && !role.includes('district') && !role.includes('division') && !role.includes('pincode') &&
        !adminRole.includes('state') && !adminRole.includes('district') && !adminRole.includes('division') && !adminRole.includes('pincode') &&
        level !== 'district' && level !== 'division' && level !== 'pincode'
    );

    if (isSuperOrMainAdmin) {
        return { isSuperAdmin: true };
    }

    const state = (user.state || user.assignedState || '').trim();
    const district = (user.district || user.assignedDistrict || '').trim();
    const division = (user.division || user.assignedDivision || user.assignedArea || '').trim();
    const pincode = user.pincode || user.assignedPincode || null;

    if (role.includes('state') || adminRole.includes('state') || level === 'state') {
        return { role: 'state', state };
    }
    if (role.includes('district') || adminRole.includes('district') || level === 'district') {
        return { role: 'district', state, district };
    }
    if (role.includes('division') || adminRole.includes('division') || level === 'division') {
        return { role: 'division', state, district, division };
    }
    if (role.includes('pincode') || adminRole.includes('pincode') || level === 'pincode') {
        return { role: 'pincode', state, district, division, pincode: pincode ? String(pincode).trim() : null };
    }
    if (role === 'agent') {
        if (level === 'state') return { role: 'state', state };
        if (level === 'district') return { role: 'district', state, district };
        if (level === 'division') return { role: 'division', state, district, division };
        return { role: 'pincode', state, district, division, pincode: pincode ? String(pincode).trim() : null };
    }

    return null;
};

/**
 * Generates and streams a professional Excel (.xlsx) file containing all authorized pincodes
 * structured in the exact State -> District -> Division -> Pincode hierarchy
 * with dynamic vertical cell merging for State, District, and Division.
 */
async function generatePincodeExcelExport(req, res) {
    try {
        const scope = getTerritoryScope(req.user);

        // Load reference dictionaries from backend/data for robust multi-source mapping
        const dataDir = path.join(__dirname, '..', 'data');
        let dJson = [];
        let vJson = [];
        let sJson = [];

        try {
            if (fs.existsSync(path.join(dataDir, 'districts.json'))) {
                dJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'districts.json'), 'utf8'));
            }
            if (fs.existsSync(path.join(dataDir, 'divisions.json'))) {
                vJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'divisions.json'), 'utf8'));
            }
            if (fs.existsSync(path.join(dataDir, 'states.json'))) {
                sJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'states.json'), 'utf8'));
            }
        } catch (jsonErr) {
            console.warn('[Excel Export] Reference JSON read note:', jsonErr.message);
        }

        // Query database collections
        const [dbStates, dbDistricts, dbDivisions, dbPins] = await Promise.all([
            State.find().lean(),
            District.find().lean(),
            Division.find().lean(),
            Pincode.find().lean()
        ]);

        // Build comprehensive lookup maps
        const stateMap = new Map();
        sJson.forEach(s => {
            if (s._id) stateMap.set(String(s._id), s.name);
            if (s.id) stateMap.set(String(s.id), s.name);
            if (s.code) stateMap.set(String(s.code), s.name);
        });
        dbStates.forEach(s => {
            if (s._id) stateMap.set(String(s._id), s.name);
            if (s.id) stateMap.set(String(s.id), s.name);
            if (s.code) stateMap.set(String(s.code), s.name);
            if (s.stateId) stateMap.set(String(s.stateId), s.name);
        });

        const distMap = new Map();
        dJson.forEach(d => {
            if (d._id) distMap.set(String(d._id), d.name);
            if (d.id) distMap.set(String(d.id), d.name);
            if (d.districtId) distMap.set(String(d.districtId), d.name);
        });
        dbDistricts.forEach(d => {
            if (d._id) distMap.set(String(d._id), d.name);
            if (d.id) distMap.set(String(d.id), d.name);
            if (d.districtId) distMap.set(String(d.districtId), d.name);
        });

        const divMap = new Map();
        vJson.forEach(v => {
            if (v._id) divMap.set(String(v._id), v.name);
            if (v.id) divMap.set(String(v.id), v.name);
            if (v.divisionId) divMap.set(String(v.divisionId), v.name);
        });
        dbDivisions.forEach(v => {
            if (v._id) divMap.set(String(v._id), v.name);
            if (v.id) divMap.set(String(v.id), v.name);
            if (v.divisionId) divMap.set(String(v.divisionId), v.name);
        });

        // Resolve and filter records according to user's authorization
        const rows = [];
        const seenPincodes = new Set();

        for (const pin of dbPins) {
            if (!pin.code) continue;
            const codeStr = String(pin.code).trim();
            if (seenPincodes.has(codeStr)) continue;

            const stId = pin.stateId ? String(pin.stateId?._id || pin.stateId) : '';
            const dtId = pin.districtId ? String(pin.districtId?._id || pin.districtId) : '';
            const dvId = pin.divisionId ? String(pin.divisionId?._id || pin.divisionId) : '';

            let stateName = (pin.state || stateMap.get(stId) || 'General State').trim();
            let districtName = (pin.district || distMap.get(dtId) || 'General District').trim();
            let divisionName = (pin.division || divMap.get(dvId) || 'General Division').trim();

            // Apply territory-based authorization scope
            if (scope && !scope.isSuperAdmin) {
                if (scope.state && stateName.toLowerCase() !== scope.state.toLowerCase()) {
                    continue;
                }
                if (scope.district && districtName.toLowerCase() !== scope.district.toLowerCase()) {
                    continue;
                }
                if (scope.division && divisionName.toLowerCase() !== scope.division.toLowerCase() && !divisionName.toLowerCase().includes(scope.division.toLowerCase())) {
                    continue;
                }
                if (scope.pincode && codeStr !== String(scope.pincode).trim()) {
                    continue;
                }
            }

            // Optional status filtering if specified by caller
            if (req.query.status && req.query.status.toLowerCase() !== 'all') {
                const pinStatus = (pin.status || 'Active').toLowerCase();
                if (pinStatus !== req.query.status.toLowerCase()) {
                    continue;
                }
            }

            seenPincodes.add(codeStr);
            rows.push({
                stateName,
                districtName,
                divisionName,
                pincode: codeStr
            });
        }

        // Exact hierarchical sort: State -> District -> Division -> Pincode
        rows.sort((a, b) => {
            const sCmp = a.stateName.localeCompare(b.stateName);
            if (sCmp !== 0) return sCmp;
            const dCmp = a.districtName.localeCompare(b.districtName);
            if (dCmp !== 0) return dCmp;
            const vCmp = a.divisionName.localeCompare(b.divisionName);
            if (vCmp !== 0) return vCmp;
            return a.pincode.localeCompare(b.pincode, undefined, { numeric: true });
        });

        // Initialize ExcelJS Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Connect App Admin Portal';
        workbook.lastModifiedBy = req.user?.name || 'Connect App Admin';
        workbook.created = new Date();
        workbook.modified = new Date();

        const worksheet = workbook.addWorksheet('Pincode Directory', {
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        worksheet.columns = [
            { header: 'State Name', key: 'stateName', width: 28 },
            { header: 'District Name', key: 'districtName', width: 28 },
            { header: 'Division Name', key: 'divisionName', width: 32 },
            { header: 'Pincode', key: 'pincode', width: 18 }
        ];

        // Format Header Row
        const headerRow = worksheet.getRow(1);
        headerRow.height = 32;
        headerRow.eachCell((cell) => {
            cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E293B' } // Connect App Slate-900 theme
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF0F172A' } },
                left: { style: 'thin', color: { argb: 'FF334155' } },
                bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                right: { style: 'thin', color: { argb: 'FF334155' } }
            };
        });

        // Standard border for data cells
        const dataBorder = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Populate Data Rows
        rows.forEach((r) => {
            const dataRow = worksheet.addRow([r.stateName, r.districtName, r.divisionName, r.pincode]);
            dataRow.height = 22;
            dataRow.eachCell((cell, colNumber) => {
                cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
                cell.border = dataBorder;
                if (colNumber === 4) {
                    // Pincode column: preserve as string to prevent loss of leading zeros
                    cell.numFmt = '@';
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            });
        });

        // Dynamic Hierarchical Vertical Cell Merging:
        // - State: merged vertically across rows of that state
        // - District: merged vertically across rows of that district (strictly within state)
        // - Division: merged vertically across rows of that division (strictly within district)
        // - Pincode: NEVER merged (each pincode on its own row)
        const totalRows = rows.length;
        let stateStart = 2;
        let distStart = 2;
        let divStart = 2;

        for (let i = 0; i < totalRows; i++) {
            const currentRowNum = i + 2;
            const isLast = (i === totalRows - 1);
            const curr = rows[i];
            const next = isLast ? null : rows[i + 1];

            const stateChanges = isLast || next.stateName !== curr.stateName;
            const distChanges = stateChanges || next.districtName !== curr.districtName;
            const divChanges = distChanges || next.divisionName !== curr.divisionName;

            // Merge Division
            if (divChanges) {
                if (currentRowNum > divStart) {
                    worksheet.mergeCells(divStart, 3, currentRowNum, 3);
                    const cell = worksheet.getCell(divStart, 3);
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                }
                divStart = currentRowNum + 1;
            }

            // Merge District
            if (distChanges) {
                if (currentRowNum > distStart) {
                    worksheet.mergeCells(distStart, 2, currentRowNum, 2);
                    const cell = worksheet.getCell(distStart, 2);
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                }
                distStart = currentRowNum + 1;
            }

            // Merge State
            if (stateChanges) {
                if (currentRowNum > stateStart) {
                    worksheet.mergeCells(stateStart, 1, currentRowNum, 1);
                    const cell = worksheet.getCell(stateStart, 1);
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                }
                stateStart = currentRowNum + 1;
            }
        }

        // Enable column autofilter on header row
        worksheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: 4 }
        };

        // Stream workbook as downloadable attachment
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Pincode_Management_Export.xlsx"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('[Excel Export Error]:', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, msg: 'Error generating Pincode Excel export', error: err.message });
        }
    }
}

module.exports = {
    generatePincodeExcelExport,
    getTerritoryScope
};
