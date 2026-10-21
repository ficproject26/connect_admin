/**
 * Helper to determine if a record matches active territory filter criteria
 * (State -> District -> Division -> Pincode)
 * Handles customer addresses, vendor territories, assigned territories, and legacy text formats.
 */
export const matchesTerritoryFilter = (
  item,
  selectedState = 'All',
  selectedDistrict = 'All',
  selectedDivision = 'All',
  selectedPincode = 'All'
) => {
  if (!item) return false;

  // Allow passing filter object as second argument e.g. matchesTerritoryFilter(item, territoryFilter)
  if (selectedState && typeof selectedState === 'object') {
    selectedDistrict = selectedState.district || 'All';
    selectedDivision = selectedState.division || 'All';
    selectedPincode = selectedState.pincode || 'All';
    selectedState = selectedState.state || 'All';
  }

  // If no filters active, return true immediately
  const stateActive = selectedState && selectedState !== 'All';
  const districtActive = selectedDistrict && selectedDistrict !== 'All';
  const divisionActive = selectedDivision && selectedDivision !== 'All';
  const pincodeActive = selectedPincode && selectedPincode !== 'All';

  if (!stateActive && !districtActive && !divisionActive && !pincodeActive) {
    return true;
  }

  // Helper string matcher
  const containsOrEquals = (fieldVal, target) => {
    if (!fieldVal || !target) return false;
    const fStr = String(fieldVal).toLowerCase().trim();
    const tStr = String(target).toLowerCase().trim();
    return fStr === tStr || fStr.includes(tStr);
  };

  // 1. STATE MATCH
  if (stateActive) {
    const candidateStates = [
      item.state,
      item.assignedState,
      item.territory?.state,
      item.vendorId?.state,
      item.customerId?.state,
      item.addresses?.[0]?.state,
      item.customer_address,
      item.address,
      item.jobLocation,
      item.location
    ].filter(Boolean);

    const matchesState = candidateStates.some(val => containsOrEquals(val, selectedState));
    if (!matchesState) return false;
  }

  // 2. DISTRICT MATCH
  if (districtActive) {
    const candidateDistricts = [
      item.district,
      item.assignedDistrict,
      item.city,
      item.territory?.district,
      item.vendorId?.district,
      item.customerId?.district,
      item.customerId?.city,
      item.addresses?.[0]?.city,
      item.addresses?.[0]?.district,
      item.customer_address,
      item.address,
      item.jobLocation,
      item.location
    ].filter(Boolean);

    const matchesDistrict = candidateDistricts.some(val => containsOrEquals(val, selectedDistrict));
    if (!matchesDistrict) return false;
  }

  // 3. DIVISION MATCH
  if (divisionActive) {
    const candidateDivisions = [
      item.division,
      item.assignedDivision,
      item.territory?.division,
      item.vendorId?.division,
      item.customerId?.division,
      item.assignedArea,
      item.area,
      item.customer_address,
      item.address
    ].filter(Boolean);

    const matchesDivision = candidateDivisions.some(val => containsOrEquals(val, selectedDivision));
    if (!matchesDivision) return false;
  }

  // 4. PINCODE MATCH
  if (pincodeActive) {
    const candidatePincodes = [
      item.pincode,
      item.assignedPincode,
      item.code,
      item.territory?.pincode,
      item.vendorId?.pincode,
      item.customerId?.pincode,
      item.addresses?.[0]?.pincode,
      item.customer_address,
      item.address
    ].filter(Boolean);

    const pinStr = String(selectedPincode).trim();
    const matchesPincode = candidatePincodes.some(val => {
      const vStr = String(val).trim();
      return vStr === pinStr || vStr.includes(pinStr);
    });
    if (!matchesPincode) return false;
  }

  return true;
};
