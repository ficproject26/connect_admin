import ExcelJS from 'exceljs';

/**
 * Generates and triggers download of a hierarchical Pincode Management Excel (.xlsx) file
 * with dynamic vertical cell merging for State, District, and Division.
 * 
 * @param {Array} rows - Array of flat pincode records: [{ stateName, districtName, divisionName, pincode }]
 * @param {string} filename - Filename for download (default: 'Pincode_Management_Export.xlsx')
 */
export async function downloadPincodeExcel(rows, filename = 'Pincode_Management_Export.xlsx') {
  if (!rows || rows.length === 0) {
    throw new Error('No pincode records available to export');
  }

  // Exact hierarchical sort: State -> District -> Division -> Pincode
  const sortedRows = [...rows].sort((a, b) => {
    const sCmp = (a.stateName || '').localeCompare(b.stateName || '');
    if (sCmp !== 0) return sCmp;
    const dCmp = (a.districtName || '').localeCompare(b.districtName || '');
    if (dCmp !== 0) return dCmp;
    const vCmp = (a.divisionName || '').localeCompare(b.divisionName || '');
    if (vCmp !== 0) return vCmp;
    return String(a.pincode || '').localeCompare(String(b.pincode || ''), undefined, { numeric: true });
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Connect App Admin Portal';
  workbook.lastModifiedBy = 'Connect App Admin';
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

  // Header Row Formatting
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Connect App Slate-900 / Dark theme
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  const dataBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  // Add Data Rows
  sortedRows.forEach((r) => {
    const dataRow = worksheet.addRow([r.stateName, r.districtName, r.divisionName, String(r.pincode)]);
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
  const totalRows = sortedRows.length;
  let stateStart = 2;
  let distStart = 2;
  let divStart = 2;

  for (let i = 0; i < totalRows; i++) {
    const currentRowNum = i + 2;
    const isLast = (i === totalRows - 1);
    const curr = sortedRows[i];
    const next = isLast ? null : sortedRows[i + 1];

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

  // Generate binary buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);

  return true;
}

/**
 * Extracts flattened hierarchical pincode rows from the territory hierarchy tree structure
 * @param {Array} hierarchy - State hierarchy list returned by GET /admin/territory/hierarchy
 * @param {Array} rawPincodes - Optional raw pincodes array
 */
export function extractHierarchyRows(hierarchy = [], rawPincodes = []) {
  const rows = [];
  const seenPincodes = new Set();

  if (Array.isArray(hierarchy) && hierarchy.length > 0) {
    for (const st of hierarchy) {
      const stateName = (st.name || st.code || 'General State').trim();
      const districts = Array.isArray(st.districts) ? st.districts : [];

      for (const dst of districts) {
        const districtName = (dst.name || dst.code || 'General District').trim();
        const divisions = Array.isArray(dst.divisions) ? dst.divisions : [];

        for (const div of divisions) {
          const divisionName = (div.name || div.code || 'General Division').trim();
          const pincodes = Array.isArray(div.pincodes) ? div.pincodes : [];

          for (const pin of pincodes) {
            const codeStr = String(pin.code || '').trim();
            if (!codeStr || seenPincodes.has(codeStr)) continue;
            seenPincodes.add(codeStr);

            rows.push({
              stateName,
              districtName,
              divisionName,
              pincode: codeStr
            });
          }
        }
      }
    }
  }

  // If raw pincodes exist and had unnested items, add them
  if (Array.isArray(rawPincodes) && rawPincodes.length > 0) {
    for (const pin of rawPincodes) {
      const codeStr = String(pin.code || '').trim();
      if (!codeStr || seenPincodes.has(codeStr)) continue;
      seenPincodes.add(codeStr);

      rows.push({
        stateName: (pin.state || 'General State').trim(),
        districtName: (pin.district || 'General District').trim(),
        divisionName: (pin.division || 'General Division').trim(),
        pincode: codeStr
      });
    }
  }

  return rows;
}
