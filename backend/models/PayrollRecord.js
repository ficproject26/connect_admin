const mongoose = require('mongoose');

const PayrollRecordSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeName: { type: String, required: true },
    employeeCode: { type: String, required: true },
    role: { type: String, default: 'Staff' },
    department: { type: String, default: 'Customer Support' },
    employeeType: { type: String, enum: ['Employee', 'Agent', 'Commission Based'], default: 'Employee' },
    salary: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 },
    pf: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    deduction: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Processing'], default: 'Pending' },
    month: { type: String, required: true }, // e.g. "August"
    year: { type: Number, required: true },   // e.g. 2026
    createdAt: { type: Date, default: Date.now }
});

PayrollRecordSchema.index({ employeeCode: 1, month: 1, year: 1 });

module.exports = mongoose.model('PayrollRecord', PayrollRecordSchema);
