const fs = require('fs');
const path = require('path');

const managerDataDir = 'D:/Connect App Project/Website/Manager/backend/data';

if (fs.existsSync(managerDataDir)) {
    // 1. Keep only genuine admin in users.json
    const usersPath = path.join(managerDataDir, 'users.json');
    if (fs.existsSync(usersPath)) {
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
        const genuineUsers = users.filter(u => u.email === 'admin@example.com');
        fs.writeFileSync(usersPath, JSON.stringify(genuineUsers, null, 2), 'utf-8');
        console.log(`✅ Preserved ${genuineUsers.length} admin user(s) in Manager users.json`);
    }

    // 2. Clear obsolete records from agents, managers, tasks, tickets, manager_onboardings
    const filesToClear = [
        'agents.json',
        'managers.json',
        'manager_onboardings.json',
        'tasks.json',
        'tickets.json',
        'vendors.json',
        'shop_visits.json',
        'submitted_reports.json',
        'notifications.json',
        'audit_logs.json'
    ];

    for (const f of filesToClear) {
        const filePath = path.join(managerDataDir, f);
        fs.writeFileSync(filePath, '[]\n', 'utf-8');
        console.log(`✅ Emptied obsolete mock/legacy file: ${f}`);
    }

    // 3. Verify Pincode Management data in Manager data is preserved
    for (const p of ['states.json', 'districts.json', 'divisions.json', 'pincodes.json']) {
        const pPath = path.join(managerDataDir, p);
        if (fs.existsSync(pPath)) {
            const items = JSON.parse(fs.readFileSync(pPath, 'utf-8'));
            console.log(`🔒 PRESERVED Manager ${p}: ${items.length} records`);
        }
    }
}
