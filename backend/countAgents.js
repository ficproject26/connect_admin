const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const countAgents = async () => {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://Connect-App:Dhanush123@cluster0.riukwbj.mongodb.net/connect_db?retryWrites=true&w=majority';
        await mongoose.connect(uri);
        const agentCount = await User.countDocuments({ role: 'agent' });
        console.log(`TOTAL_AGENTS_IN_DB:${agentCount}`);
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

countAgents();
