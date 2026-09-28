const mongoose = require('mongoose');

const PayrollRecordSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.Mixed, default: null },
    employeeName: { type: String, required: true },
    employeeCode: { type: String, required: true },
    role: { type: String, default: 'Staff' },
    department: { type: String, default: 'Customer Support' },
    employeeType: { type: String, enum: ['Employee', 'Agent', 'Commission Based', 'Manager', 'Admin Staff'], default: 'Employee' },
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
    paymentDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Processing', 'Held', 'Cancelled'], default: 'Pending' },
    month: { type: String, required: true }, // e.g. "September"
    year: { type: Number, required: true },   // e.g. 2026
    paidBy: { type: String, default: '' },
    holdReason: { type: String, default: '' },
    heldAt: { type: Date, default: null },
    heldBy: { type: String, default: '' },
    cancellationReason: { type: String, default: '' },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: '' },
    territory: {
        state: { type: String, default: '' },
        district: { type: String, default: '' },
        division: { type: String, default: '' },
        pincode: { type: String, default: '' }
    },
    bankDetails: {
        accountHolder: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        ifscCode: { type: String, default: '' },
        bankName: { type: String, default: '' }
    },
    createdAt: { type: Date, default: Date.now }
});

PayrollRecordSchema.index({ employeeCode: 1, month: 1, year: 1 });
PayrollRecordSchema.index({ month: 1, year: 1, paymentStatus: 1 });

module.exports = mongoose.model('PayrollRecord', PayrollRecordSchema);
