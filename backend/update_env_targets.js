const fs = require('fs');

const envFiles = [
    'D:/vendor/backend/.env',
    "D:/Agent App/Rithvik's Agent app/backend/.env",
    'D:/Customer Application/Connect-Mobile/.env',
    'D:/Customer Application/Connect-Mobile/backend/.env',
    'D:/Connect App Project/Application/Vendor- Mobile/.env'
];

const targetUri = 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/connect_db?retryWrites=true&w=majority';

for (const f of envFiles) {
    if (fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf-8');
        let updated = content.replace(/MONGODB_URI=[^\r\n]*/g, 'MONGODB_URI=' + targetUri);
        if (updated.includes('DB_NAME=')) {
            updated = updated.replace(/DB_NAME=[^\r\n]*/g, 'DB_NAME=connect_db');
        }
        fs.writeFileSync(f, updated, 'utf-8');
        console.log('✅ Updated ' + f);
    } else {
        console.log('⚠️ Not found: ' + f);
    }
}
