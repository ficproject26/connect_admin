# Project Guidelines & Architectural Rules

## Strict Workflow Preservation & Admin Portal Stability

### Core Directive (NEVER ALTER WITHOUT EXPLICIT USER INSTRUCTION)
1. **Preserve Current Admin Flow**:
   - The overall workflow, UI layouts, navigation structures, and data handling of the Admin Portal are fully correct and locked.
   - NEVER refactor, remove, or modify existing working features, modals, navigation tabs, directory flows, or backend handlers unless explicitly asked by the USER for a targeted bug fix or new requirement.

## Territory Hierarchy & Multi-Agent Directory Flow

### Mandatory Principles (NEVER CHANGE THIS WORKFLOW)

1. **Array-Based Multi-Agent Hierarchy Mapping**:
   - In the Agent Directory (`App.jsx`), the Territory Hierarchy Tree View (`agentViewMode === 'tree'`) MUST map state, district, and division nodes using **arrays** (`stateAgents: []`, `districtAgents: []`, `divisionAgents: []`, `pincodeAgents: []`).
   - NEVER store state, district, or division agents as single object fields (`stateAgent: null`, `districtAgent: null`, `divisionAgent: null`) in `hierarchyMap`. Doing so causes agents sharing the same territory (such as multiple District Agents in the same district) to overwrite each other and disappear from the UI.

2. **Complete Territory & Agent Rendering**:
   - All agents present in the filtered list (`filteredAgents`) MUST be rendered in the Territory Hierarchy Tree View without exception.
   - For every state, district, and division group, iterate over the agent arrays (`stObj.stateAgents.map`, `distObj.districtAgents.map`, `divObj.divisionAgents.map`, `divObj.pincodeAgents.map`) so each assigned agent displays their own distinct agent card and profile actions.

3. **Fallback & Unassigned Territory Grouping**:
   - Agents without explicit territory fields (`assignedState`, `assignedDistrict`, `assignedArea`) MUST be grouped into clean, explicit fallback headers (e.g. `General State`, `General District`, `General Division`) rather than hardcoded to a single specific region.
   - Every level count header (e.g. `DISTRICT AGENTS (N)`, `DIVISIONAL AGENTS (N)`) MUST dynamically reflect the sum of all agents in that sub-hierarchy (`reduce((sum, item) => sum + item.agents.length, 0)`).

4. **Multi-View Parity**:
   - All 3 directory view modes — **Tree View** (`tree`), **Grid View** (`grid`), and **List View** (`list`) — MUST remain 100% synchronized and display the exact same total count of non-rejected agents.

5. **Approved Agent Directory Scoping & Safe Territory Resolution**:
   - The active Agent Directory (`Tree View`, `Grid View`, `List View`) and level filter tabs MUST strictly show approved/active agents (`isApprovedAgent(agent)`). Unapproved, pending, or under-verification agents MUST NOT render in active directory views until approved by Admin.
   - `getAgentTerritoryDetail(agent)` MUST safely return a valid `{ label: string, value: string }` object for all agent levels (State, District, Division, Pincode) and default fallbacks with optional chaining (`terrInfo?.label`, `terrInfo?.value`) to prevent portal rendering errors.

## Direct Registration Requests & Onboarding Approval Flow

### Mandatory Principles (NEVER CHANGE THIS WORKFLOW)
1. **Unified Registration Requests & Status Compatibility**:
   - Direct registration requests (Vendors and Agents) submitted from registration portals MUST be queried and rendered without dropping records due to status string formatting.
   - All pending status variants (`pending`, `pending_approval`, `pending approval`, `under_verification`, `under verification`, `in_review`, `pending_verification`, `requested`) MUST be captured by backend endpoints (`GET /api/admin/vendors/requests`, `GET /api/admin/agents`) and displayed in the Admin Direct Registration Requests modal.

2. **Multi-Role Onboarding Support**:
   - The Direct Registration Requests modal MUST display both incoming Vendor applications and Agent onboarding applications (State Agent, District Agent, Divisional Agent, Pincode Agent) with role badges and 1-click Direct Approval/Reject actions.

3. **Suspended Vendor & Product Isolation**:
   - Suspended, inactive, or rejected vendors MUST NOT have their products, services, or category items rendered across customer dashboard, category pages, or public API endpoints (`/api/public/products`, `/api/products`).
   - When a vendor's status is modified in the Admin panel, matching product documents in MongoDB MUST automatically synchronize `vendorStatus`, `isVendorSuspended`, and `isActive` properties.

## Multi-Vendor Business & Listing Visibility Flow

### Mandatory Principles (NEVER CHANGE THIS WORKFLOW)
1. **Dynamic Multi-Vendor & Business Relationship Binding**:
   - Every product, service, job, food item, or listing added by any vendor MUST be dynamically linked to `vendorId`, `vendorEmail`, `vendorPhone`, `vendorName`, `businessId`, `businessName`, `vendorStatus`, and `businessStatus`.
   - Never hardcode vendor IDs, business IDs, category IDs, or sample company names in backend endpoints or frontend filters.

2. **Customer Visibility Rule**:
   - A listing MUST appear on the Customer Website (`/api/public/products`, `/api/products`) ONLY when: `Vendor == ACTIVE` AND `Business Outlet == ACTIVE` AND `Listing == ACTIVE`.
   - If a specific business outlet of a vendor is suspended (`status: 'Suspended'`), ONLY items belonging to that suspended business outlet MUST be hidden. Other active business outlets of that same vendor and all other active vendors MUST remain completely unaffected and visible.
   
## Master Project Rule — Zero Regression / Safe Change Architecture

### Mandatory Principles (NEVER ALTER WITHOUT EXPLICIT USER INSTRUCTION)
1. **Additive & Backward Compatible Changes**:
   - All new features and bug fixes MUST be strictly additive, backward-compatible, and isolated to prevent regressions in existing working workflows across Customer, Vendor, Admin, and Agent portals.
2. **Impact Analysis Protocol**:
   - Before modifying any shared code, trace the complete data flow, identify all affected files, APIs, components, and models, and ensure zero breaking changes to existing production contracts.
3. **API & Database Contract Protection**:
   - Never repurpose existing database fields, modify existing API response structures, or delete fields relied upon by production workflows. Use isolated extensions or optional properties for new requirements.
4. **Empirical Verification & Git Checkpoints**:
   - Validate every change with production builds (`npx vite build`) and syntax checks before committing cleanly to Git.- When a suspended business outlet is re-activated by Admin, its listings MUST immediately become visible on the Customer Website again.

## Protected Module — Main Admin PIN Code Management (STRICT PERMANENT WORKFLOW LOCK)

### Mandatory Protected Invariant (NEVER ALTER WITHOUT EXPLICIT USER INSTRUCTION)

1. **Permanently Protected Module**:
   - The **Main Admin → Pin Code Management** module (`PincodeTerritoryManagement.jsx`, `routes/territory.js`, `routes/pincodes.js`, and associated database models) is **permanently protected**.
   - Its existing workflow, business logic, database structure, data relationships, UI behavior, and assignment rules MUST remain unchanged unless the USER explicitly authorizes a change.

2. **Absolute Hierarchy & Action Lock**:
   - The established administrative hierarchy order:
     $$\mathbf{State} \longrightarrow \mathbf{District} \longrightarrow \mathbf{Division} \longrightarrow \mathbf{Pincode}$$
     MUST be preserved without exception. Never reorder, skip, merge, or alter hierarchy tiers.
   - Preserve all existing actions and views exactly as implemented:
     - **Add, Edit, Remove, and Assign operations**.
     - **Hierarchy Flow View, Tree View, and Audit Logs**.
     - **National Overview metrics and States Directory cards**.
     - **Search, status filtering, drilldown navigation, and refresh behavior**.

3. **No Unauthorized Manual or Automatic Changes**:
   - Never modify, redesign, replace, simplify, restructure, or automatically alter the workflow when working on another module, fixing a bug, modifying an API, updating a model, or executing an agent task.
   - Never reset, clear, overwrite, recreate, seed over, or automatically migrate existing pincode data.
   - Never change existing state, district, division, pincode, or agent-assignment records.
   - Do not allow changes in other modules or global refactoring to silently alter this module.

4. **Bug-Fix-Only Scope (Zero Workflow Alteration)**:
   - When a bug fix is requested for Pin Code Management (e.g. data retrieval, query mapping, filtering, or display issues), correct ONLY the verified root cause while keeping the existing workflow, database relationships, and user interface flow 100% unchanged.
   - A bug fix request does NOT grant permission to redesign or alter the workflow.

5. **Mandatory Pre-Change Protection Protocol**:
   - Before implementing any task, check whether dependencies, shared APIs, models, or services could directly or indirectly touch Pin Code Management.
   - If a proposed change could alter this protected module or its data, STOP and do not apply it automatically. Isolate changes to the relevant module.
   - Only explicit, specific authorization from the USER allows any change to this protected workflow. General prompts (e.g. "fix all", "refactor all") do NOT authorize changes to Pin Code Management.