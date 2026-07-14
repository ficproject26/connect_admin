const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Task = require('./models/Task');
const User = require('./models/User');

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const tasks = await Task.find();
        console.log("ALL TASKS:", tasks);
        
        const agents = await User.find({ role: 'agent' });
        console.log("AGENTS:", agents.map(a => ({ id: a._id, name: a.name, email: a.email })));
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
