const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const countAgents = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const agentCount = await User.countDocuments({ role: 'agent' });
        console.log(`TOTAL_AGENTS_IN_DB:${agentCount}`);
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

countAgents();
