import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema({
  number: { type: String },
  fullName: { type: String },
  birthInfo: { type: String },
  specialization: { type: String },
  cycle: { type: String },
  group: { type: String },
  fileAmount: { type: Number, default: 0 },
  intermediary: { type: String },
  payment1: { type: Number, default: 0 },
  paymentDate1: { type: String },           // ← Changed to String
  payment2: { type: Number, default: 0 },
  paymentDate2: { type: String },           // ← Changed to String
  remaining: { type: Number, default: 0 },
  diploma: { type: String },
  note: { type: String },
  rowColor: { type: String, default: '' },
  columnColors: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

// Pre-save hook: calculate remaining and note
recordSchema.pre('save', function (next) {
  this.remaining = (this.fileAmount || 0) - ((this.payment1 || 0) + (this.payment2 || 0));
  this.updatedAt = Date.now();
});

export default mongoose.model('Record', recordSchema);