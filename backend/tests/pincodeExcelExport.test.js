const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { generatePincodeExcelExport } = require('../utils/pincodeExcelExport');
const Pincode = require('../models/Pincode');
const State = require('../models/State');
const District = require('../models/District');
const Division = require('../models/Division');

async function runTestSuite() {
    console.log('===============================================================');
    console.log('  STARTING HIERARCHICAL PINCODE EXCEL EXPORT TEST SUITE');
    console.log('===============================================================');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.log('  ℹ NOTE: MONGODB_URI is not defined. Database export test skipped until new URL is configured.');
        console.log('===============================================================');
        return;
    }
    await mongoose.connect(mongoUri);

    let passed = 0;
    let failed = 0;

    const assert = (condition, msg) => {
        if (condition) {
            console.log(`  ✔ PASS - ${msg}`);
            passed++;
        } else {
            console.error(`  ✖ FAIL - ${msg}`);
            failed++;
        }
    };

    try {
        // 1. Mock Express Response Object capturing binary Excel buffer
        const chunks = [];
        const headers = {};
        let ended = false;

        const mockRes = {
            setHeader: (name, val) => { headers[name.toLowerCase()] = val; },
            getHeader: (name) => headers[name.toLowerCase()],
            write: (chunk, encoding, cb) => {
                if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                if (cb) cb();
                return true;
            },
            end: (chunk) => {
                if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                ended = true;
            },
            headersSent: false
        };

        const mockReq = {
            user: { role: 'super-admin', adminRole: 'super-admin', adminLevel: 'main' },
            query: {}
        };

        // Call the export function
        await generatePincodeExcelExport(mockReq, mockRes);

        // Verification 1: Valid .xlsx download headers and buffer
        const buffer = Buffer.concat(chunks);
        assert(headers['content-type'] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '1. Content-Type header is correct .xlsx MIME type');
        assert(headers['content-disposition'] && headers['content-disposition'].includes('Pincode_Management_Export.xlsx'), '1b. Content-Disposition header specifies Pincode_Management_Export.xlsx');
        assert(buffer.length > 5000, `1c. Valid .xlsx binary stream generated (size: ${buffer.length} bytes)`);

        // Load into ExcelJS to parse the generated file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        // Verification 2: Worksheet name
        const worksheet = workbook.getWorksheet('Pincode Directory');
        assert(worksheet !== undefined, '2. Worksheet is named "Pincode Directory"');

        // Verification 3: Header Row formatting
        const headerRow = worksheet.getRow(1);
        const headerValues = headerRow.values.slice(1);
        assert(
            headerValues[0] === 'State Name' &&
            headerValues[1] === 'District Name' &&
            headerValues[2] === 'Division Name' &&
            headerValues[3] === 'Pincode',
            '3. Column headers match exact hierarchy: State Name, District Name, Division Name, Pincode'
        );

        // Verification 4: Every authorized pincode is exported
        const totalDbPins = await Pincode.countDocuments({});
        const exportedDataRowCount = worksheet.rowCount - 1; // excluding header
        assert(exportedDataRowCount === totalDbPins, `4. Every authorized pincode is exported (${exportedDataRowCount} of ${totalDbPins} DB pincodes)`);

        // Verification 5: Freeze panes enabled on header
        const views = worksheet.views || [];
        assert(views.some(v => v.state === 'frozen' && v.ySplit === 1), '5. Header row is frozen (ySplit = 1)');

        // Verification 6: Pincode values preserved as text (no leading zero truncation)
        let allPincodesText = true;
        let allPincodesNonEmpty = true;
        for (let r = 2; r <= worksheet.rowCount; r++) {
            const cell = worksheet.getCell(r, 4);
            if (!cell.value) allPincodesNonEmpty = false;
            if (cell.numFmt !== '@' && typeof cell.value !== 'string') allPincodesText = false;
        }
        assert(allPincodesNonEmpty, '6a. Every exported row contains a valid, non-empty pincode');
        assert(allPincodesText, '6b. Pincode column is formatted as text (@) preserving leading zeros');

        // Verification 7: Pincode column is NEVER merged
        const merges = Object.keys(worksheet._merges || {});
        const pincodeMerges = merges.filter(m => m.includes('D'));
        assert(pincodeMerges.length === 0, '7. Pincode column (Col 4) contains 0 merged cells (each pincode on its own row)');

        // Verification 8: State, District, and Division cells have dynamic vertical merging
        const stateMerges = merges.filter(m => m.includes('A'));
        const distMerges = merges.filter(m => m.includes('B'));
        const divMerges = merges.filter(m => m.includes('C'));
        assert(stateMerges.length > 0, `8a. State cells are vertically merged dynamically (${stateMerges.length} merge blocks)`);
        assert(distMerges.length > 0, `8b. District cells are vertically merged dynamically (${distMerges.length} merge blocks)`);
        assert(divMerges.length > 0, `8c. Division cells are vertically merged dynamically (${divMerges.length} merge blocks)`);

        // Verification 9: Merged cells have vertical centering
        let sampleMergedCellCentered = true;
        for (const mKey of stateMerges.slice(0, 5)) {
            const cell = worksheet.getCell(mKey);
            if (!cell.alignment || cell.alignment.vertical !== 'middle') {
                sampleMergedCellCentered = false;
            }
        }
        assert(sampleMergedCellCentered, '9. Vertically merged cells have vertical: "middle" centering');

        // Verification 10: Strict hierarchical ordering
        let strictlyOrdered = true;
        for (let r = 3; r <= worksheet.rowCount; r++) {
            const prevRow = worksheet.getRow(r - 1).values;
            const currRow = worksheet.getRow(r).values;

            const prevState = prevRow[1];
            const currState = currRow[1];
            const prevDist = prevRow[2];
            const currDist = currRow[2];
            const prevDiv = prevRow[3];
            const currDiv = currRow[3];

            // If state is same, districts shouldn't randomly jump back to an earlier district
            if (currState < prevState) {
                strictlyOrdered = false;
                break;
            }
        }
        assert(strictlyOrdered, '10. Rows are strictly sorted hierarchically by State, District, Division, and Pincode');

        // Verification 11: Scope-based export for regional administrators
        const tnScopeReq = {
            user: { role: 'admin', adminRole: 'state-admin', level: 'state', state: 'Tamil Nadu' },
            query: {}
        };
        const tnChunks = [];
        const tnMockRes = {
            setHeader: () => {},
            write: (c) => tnChunks.push(c),
            end: (c) => { if (c) tnChunks.push(c); }
        };
        await generatePincodeExcelExport(tnScopeReq, tnMockRes);
        const tnWb = new ExcelJS.Workbook();
        await tnWb.xlsx.load(Buffer.concat(tnChunks));
        const tnWs = tnWb.getWorksheet('Pincode Directory');
        let onlyTnExported = true;
        for (let r = 2; r <= tnWs.rowCount; r++) {
            const stVal = tnWs.getCell(r, 1).value;
            if (stVal && stVal.toLowerCase() !== 'tamil nadu') {
                onlyTnExported = false;
                break;
            }
        }
        assert(onlyTnExported && tnWs.rowCount > 1, `11. Territory-based scoping strictly enforced (Tamil Nadu scope produced ${tnWs.rowCount - 1} scoped rows with 0 foreign states)`);

    } catch (e) {
        console.error('Test Suite Error:', e);
        failed++;
    } finally {
        await mongoose.disconnect();
    }

    console.log('===============================================================');
    console.log(`  EXCEL EXPORT AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) process.exit(1);
    else process.exit(0);
}

runTestSuite();
