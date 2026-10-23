const path = require('path');
const backendDir = path.resolve(__dirname, '..');
const mongoose = require(path.join(backendDir, 'node_modules/mongoose'));
const jwt = require(path.join(backendDir, 'node_modules/jsonwebtoken'));
const bcrypt = require(path.join(backendDir, 'node_modules/bcryptjs'));
const dotenv = require(path.join(backendDir, 'node_modules/dotenv'));
dotenv.config({ path: path.join(backendDir, '.env') });

const express = require(path.join(backendDir, 'node_modules/express'));
const http = require('http');

let app, server, baseUrl;

async function runTests() {
    console.log('===============================================================');
    console.log('  STARTING ADMIN CREDENTIALS MANAGEMENT TEST SUITE');
    console.log('===============================================================');

    await mongoose.connect(process.env.MONGODB_URI);
    const User = require(path.join(backendDir, 'models/User'));
    const AuditLog = require(path.join(backendDir, 'models/AuditLog'));
    const SecuritySession = require(path.join(backendDir, 'models/SecuritySession'));

    // Setup mock server
    app = express();
    app.use(express.json());
    app.use('/api/admin/accounts', require(path.join(backendDir, 'routes/adminAccountRoutes')));

    const port = 8097;
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(port, resolve));
    baseUrl = `http://127.0.0.1:${port}/api/admin/accounts`;

    let passedCount = 0;
    const assert = (condition, testName) => {
        if (!condition) {
            console.error(`  ✖ FAIL - ${testName}`);
            throw new Error(`Test failed: ${testName}`);
        }
        passedCount++;
        console.log(`  ✔ PASS - ${testName}`);
    };

    try {
        // Find existing Super Admin User 1 and User 2
        let user1 = await User.findOne({ email: 'admin@connect.com' }).select('+password +passwordHash');
        if (!user1) throw new Error('admin@connect.com not found');

        let user2 = await User.findOne({ email: 'admin@example.com' }).select('+password +passwordHash');
        if (!user2) throw new Error('admin@example.com not found');

        const token1 = jwt.sign(
            { user: { id: String(user1._id), role: user1.role, adminRole: user1.adminRole } },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const token2 = jwt.sign(
            { user: { id: String(user2._id), role: user2.role, adminRole: user2.adminRole } },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // 1. Unauthenticated request rejected
        const resUnauth = await fetch(`${baseUrl}/credentials`);
        assert(resUnauth.status === 401, '1. Unauthenticated request without token is rejected (401)');

        // 2. GET /credentials returns exactly 3 accounts with safe fields
        const resCreds = await fetch(`${baseUrl}/credentials`, {
            headers: { 'x-auth-token': token1 }
        });
        const credsData = await resCreds.json();
        assert(resCreds.status === 200 && credsData.success === true, '2. GET /credentials returns success 200');
        assert(Array.isArray(credsData.accounts) && credsData.accounts.length === 3, '3. Exactly 3 Super Admin account slots returned');
        assert(credsData.accounts[0].slot === 1 && credsData.accounts[0].isPrimary === true, '4. Slot 1 is Primary Super Admin');
        assert(credsData.accounts[1].slot === 2 && credsData.accounts[1].isPrimary === false, '5. Slot 2 is Additional Super Admin');
        assert(credsData.accounts[2].slot === 3 && credsData.accounts[2].isPrimary === false, '6. Slot 3 is Additional Super Admin');
        
        // Ensure no plaintext password or hash is exposed
        const allSerialized = JSON.stringify(credsData);
        assert(!allSerialized.includes('passwordHash') && !allSerialized.includes('$2a$') && !allSerialized.includes('$2b$'), '7. Stored passwords and hashes are never exposed in API responses');

        // 8. Incorrect old password check
        const resBadOld = await fetch(`${baseUrl}/update-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token1 },
            body: JSON.stringify({
                slot: 1,
                email: 'admin@connect.com',
                oldPassword: 'completelyWrongPassword!',
                newPassword: 'CorrectPassword@2026',
                confirmPassword: 'CorrectPassword@2026'
            })
        });
        const badOldData = await resBadOld.json();
        assert(resBadOld.status === 400 && badOldData.message === 'Incorrect old password.', '8. Incorrect old password returns exact message "Incorrect old password."');

        // 9. Email format validation test suite
        const invalidEmails = ['adminexample.com', 'admin@', '@example.com', 'admin space@example.com'];
        for (const badEmail of invalidEmails) {
            const resBadEmail = await fetch(`${baseUrl}/update-credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token1 },
                body: JSON.stringify({
                    slot: 1,
                    email: badEmail,
                    oldPassword: 'admin123',
                    newPassword: 'CorrectPassword@2026',
                    confirmPassword: 'CorrectPassword@2026'
                })
            });
            const badEmailData = await resBadEmail.json();
            assert(resBadEmail.status === 400 && badEmailData.message === 'Invalid email format.', `9. Invalid email "${badEmail}" rejected with "Invalid email format."`);
        }

        // 10. Confirmation password mismatch
        const resMismatch = await fetch(`${baseUrl}/update-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token1 },
            body: JSON.stringify({
                slot: 1,
                email: 'admin@connect.com',
                oldPassword: 'admin123',
                newPassword: 'CorrectPassword@2026',
                confirmPassword: 'DifferentPassword@2026'
            })
        });
        const mismatchData = await resMismatch.json();
        assert(resMismatch.status === 400 && mismatchData.message === 'Confirmation password does not match.', '10. Confirmation password mismatch rejected with "Confirmation password does not match."');

        // 11. Password Strength tests (8+ chars, upper, lower, num, special)
        const weakPasswords = [
            'Short1!',        // Less than 8 chars
            'lowercase123!@#', // No uppercase
            'UPPERCASE123!@#', // No lowercase
            'NoNumbersHere!@', // No number
            'NoSpecialChars12' // No special char
        ];
        for (const weakPwd of weakPasswords) {
            const resWeak = await fetch(`${baseUrl}/update-credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token1 },
                body: JSON.stringify({
                    slot: 1,
                    email: 'admin@connect.com',
                    oldPassword: 'admin123',
                    newPassword: weakPwd,
                    confirmPassword: weakPwd
                })
            });
            const weakData = await resWeak.json();
            assert(resWeak.status === 400 && weakData.message === 'New password does not meet the security requirements.', `11. Weak password "${weakPwd}" rejected with "New password does not meet the security requirements."`);
        }

        // 12. Duplicate email rejection
        const resDuplicate = await fetch(`${baseUrl}/update-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token1 },
            body: JSON.stringify({
                slot: 1,
                email: 'admin@example.com', // already used by Slot 2
                oldPassword: 'admin123',
                newPassword: 'CorrectPassword@2026',
                confirmPassword: 'CorrectPassword@2026'
            })
        });
        const dupData = await resDuplicate.json();
        assert(resDuplicate.status === 400 && dupData.message === 'Email already registered.', '12. Duplicate email rejected with "Email already registered."');

        // 13. Role Isolation: User 2 cannot modify Slot 1
        const resRoleIso1 = await fetch(`${baseUrl}/update-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token2 },
            body: JSON.stringify({
                slot: 1,
                email: 'hacked@connect.com',
                oldPassword: 'admin123',
                newPassword: 'HackedPassword@2026',
                confirmPassword: 'HackedPassword@2026'
            })
        });
        const roleIsoData1 = await resRoleIso1.json();
        assert(resRoleIso1.status === 403 && roleIsoData1.message === 'Unauthorized action.', '13. User 2 blocked from modifying Slot 1 ("Unauthorized action.")');

        // 14. Role Isolation: User 2 cannot modify Slot 3
        const resRoleIso3 = await fetch(`${baseUrl}/update-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token2 },
            body: JSON.stringify({
                slot: 3,
                email: 'hacked3@connect.com',
                oldPassword: 'admin123',
                newPassword: 'HackedPassword@2026',
                confirmPassword: 'HackedPassword@2026'
            })
        });
        const roleIsoData3 = await resRoleIso3.json();
        assert(resRoleIso3.status === 403 && roleIsoData3.message === 'Unauthorized action.', '14. User 2 blocked from modifying Slot 3 ("Unauthorized action.")');

        // 15. Valid password update for Slot 2 by User 2 (independent self-service)
        const resSelfUpdate = await fetch(`${baseUrl}/update-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token2 },
            body: JSON.stringify({
                slot: 2,
                email: 'admin@example.com',
                oldPassword: 'admin123',
                newPassword: 'NewSecurePass@2026',
                confirmPassword: 'NewSecurePass@2026'
            })
        });
        const selfUpdateData = await resSelfUpdate.json();
        assert(resSelfUpdate.status === 200 && selfUpdateData.message === 'Password updated successfully.', '15. User 2 successfully updates own password with "Password updated successfully."');

        // Verify in DB that User 2's password hash was updated
        const updatedUser2 = await User.findOne({ email: 'admin@example.com' }).select('+password +passwordHash');
        const isMatchNew = await bcrypt.compare('NewSecurePass@2026', updatedUser2.password || updatedUser2.passwordHash);
        assert(isMatchNew, '16. New password verified in MongoDB with bcrypt');

        // Reset User 2 back to admin123 for regression test consistency
        const resetSalt = await bcrypt.genSalt(10);
        const resetHash = await bcrypt.hash('admin123', resetSalt);
        await User.updateOne({ email: 'admin@example.com' }, { $set: { password: resetHash, passwordHash: resetHash } });
        assert(true, '17. Reset User 2 password back to admin123 for test environment consistency');

        console.log('===============================================================');
        console.log(`  ADMIN CREDENTIALS AUDIT RESULTS: ${passedCount} PASSED, 0 FAILED`);
        console.log('===============================================================');

        server.close();
        process.exit(0);
    } catch (err) {
        console.error('Test suite error:', err);
        if (server) server.close();
        process.exit(1);
    }
}

runTests();
