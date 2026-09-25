const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    paymentType: {
        type: String,
        enum: ['received', 'paid'],
        required: true,
        index: true
    },
    paymentCategory: {
        type: String,
        enum: [
            // Received
            'customer_payment',
            'vendor_reg_fee',
            'vendor_tieup_fee',
            'membership_payment',
            'other_received',
            // Paid
            'agent_payment',
            'vendor_payment',
            'technician_payment',
            'delivery_partner_payment',
            'payroll_payment'
        ],
        required: true,
        index: true
    },
    recipientType: {
        type: String,
        required: true,
        enum: [
            'Customer',
            'Agent',
            'Vendor',
            'Technician',
            'Delivery Partner',
            'Admin Staff',
            'Manager',
            'KYC Team',
            'Payment Team',
            'Customer Support',
            'HR',
            'Logistics',
            'Employee'
        ]
    },
    recipientId: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    recipientName: {
        type: String,
        required: true
    },
    recipientEmail: {
        type: String,
        default: ''
    },
    recipientPhone: {
        type: String,
        default: ''
    },

    // For Payroll / Staff
    department: {
        type: String,
        default: ''
    },
    designation: {
        type: String,
        default: ''
    },
    employeeId: {
        type: String,
        default: ''
    },
    salaryPeriod: {
        type: String,
        default: ''
    },
    basicSalary: {
        type: Number,
        default: 0
    },
    allowances: {
        type: Number,
        default: 0
    },
    deductions: {
        type: Number,
        default: 0
    },
    netSalary: {
        type: Number,
        default: 0
    },

    // Amount & Currency
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'INR'
    },
    status: {
        type: String,
        enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'],
        default: 'PENDING',
        index: true
    },
    paymentPeriod: {
        type: String,
        default: 'September 2026'
    },
    dueDate: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    paymentDate: {
        type: Date,
        default: null
    },

    // Bank Details
    bankAccountHolder: {
        type: String,
        default: ''
    },
    bankAccountNumber: {
        type: String,
        default: ''
    },
    bankIfsc: {
        type: String,
        default: ''
    },
    bankName: {
        type: String,
        default: ''
    },

    // Territory Details
    territory: {
        state: { type: String, default: '' },
        district: { type: String, default: '' },
        division: { type: String, default: '' },
        pincode: { type: String, default: '' }
    },
    stateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'State',
        default: null
    },
    districtId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'District',
        default: null
    },
    divisionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Division',
        default: null
    },
    pincodeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pincode',
        default: null
    },

    // Delegation to State Admin
    assignedAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assignedAdminName: {
        type: String,
        default: ''
    },
    assignedAdminRole: {
        type: String,
        default: ''
    },
    assignedTerritory: {
        type: String,
        default: ''
    },
    assignedAt: {
        type: Date,
        default: null
    },
    assignedBy: {
        type: String,
        default: ''
    },

    // Processing & Cancellation Auditing
    createdBy: {
        type: String,
        default: 'System'
    },
    processedBy: {
        type: String,
        default: ''
    },
    processedById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    cancelledBy: {
        type: String,
        default: ''
    },
    cancelledById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    cancellationReason: {
        type: String,
        default: ''
    },

    // Reference & Protection
    transactionReference: {
        type: String,
        default: ''
    },
    idempotencyKey: {
        type: String,
        sparse: true,
        index: true
    },
    failureReason: {
        type: String,
        default: ''
    },
    previousHistory: {
        type: [Object],
        default: []
    },
    notes: {
        type: String,
        default: ''
    },
    sourceModel: {
        type: String,
        default: ''
    },
    sourceId: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, {
    timestamps: true
});

PaymentSchema.index({ paymentType: 1, paymentCategory: 1, status: 1 });
PaymentSchema.index({ 'territory.state': 1, 'territory.district': 1, status: 1 });
PaymentSchema.index({ recipientType: 1, status: 1 });
PaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', PaymentSchema);
