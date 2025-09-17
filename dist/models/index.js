"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Voucher = exports.Session = exports.Payment = exports.Plan = exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    macAddress: { type: String, required: true, index: true },
    ipAddress: { type: String, required: true, index: true },
    deviceId: { type: String, sparse: true },
    sessionToken: { type: String, sparse: true },
}, { timestamps: true });
const planSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: Number, required: true }, // in minutes
    description: String,
}, { timestamps: true });
const paymentSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
    transactionId: { type: String, sparse: true },
    phoneNumber: { type: String, sparse: true },
}, { timestamps: true });
const sessionSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Plan', required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ['active', 'expired', 'terminated'], default: 'active', index: true },
    bandwidth: Number, // in Mbps
    dataUsed: Number, // in MB
}, { timestamps: true });
const voucherSchema = new mongoose_1.default.Schema({
    code: { type: String, required: true, unique: true, index: true },
    planId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Plan', required: true },
    status: { type: String, enum: ['active', 'used', 'expired'], default: 'active', index: true },
    usedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', sparse: true },
    usedAt: Date,
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
exports.User = mongoose_1.default.model('User', userSchema);
exports.Plan = mongoose_1.default.model('Plan', planSchema);
exports.Payment = mongoose_1.default.model('Payment', paymentSchema);
exports.Session = mongoose_1.default.model('Session', sessionSchema);
exports.Voucher = mongoose_1.default.model('Voucher', voucherSchema);
