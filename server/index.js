import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import fs from 'fs';
import Record from './record.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// ==================== EXCEL UPLOAD ====================
app.post('/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    if (jsonData.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'الملف فارغ أو لا يحتوي على بيانات' });
    }

    // Get existing columnColors from any record
    const existingRecord = await Record.findOne();
    const currentColumnColors = existingRecord ? existingRecord.columnColors : {};

    let importedCount = 0;

for (let i = 0; i < jsonData.length; i++) {

  const row = jsonData[i];

  const number = row['رقم'] ? String(row['رقم']).trim() : '';
  const fullName = row['الاسم و اللقب'] ? String(row['الاسم و اللقب']).trim() : '';

  const recordData = {
    number,
    fullName,
    birthInfo: row['تاريخ و مكان الميلاد'] || '',
    specialization: row['الاختصاص'] || '',
    cycle: row['دورة'] || '',
    group: row['الفوج'] || '',
    fileAmount: parseFloat(row['مبلغ الملف']) || 0,
    intermediary: row['الوسيط'] || '',
    payment1: parseFloat(row['الدفعة 1']) || 0,
    paymentDate1: row['تاريخ الدفعة 1'] ,
    payment2: parseFloat(row['الدفعة 2']) || 0,
    paymentDate2: row['تاريخ الدفعة 2'] ,
    diploma: row['الديبلوم'] || '',
    note: row['ملاحظة'] || '',
    columnColors: { ...currentColumnColors },
    rowColor: ''
  };

  await new Record(recordData).save();
  importedCount++;
}



    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(200).json({ 
      message: `تم استيراد ${importedCount} سجل بنجاح (بما في ذلك الحقول الفارغة)` 
    });

  } catch (error) {
    console.error('Excel upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || 'فشل في معالجة الملف' });
  }
});

// ==================== REST OF ENDPOINTS (unchanged except minor safety) ====================

app.get('/records', async (req, res) => {
  try {
    const records = await Record.find().sort({ createdAt: 1 });
    res.json(records);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/records', async (req, res) => {
  try {
    const existingRecord = await Record.findOne();
    const columnColors = existingRecord ? existingRecord.columnColors : {};

    const safeBody = {
      ...req.body,
      number: req.body.number || '',
      fullName: req.body.fullName || '',
      fileAmount: Number(req.body.fileAmount) || 0,
      payment1: Number(req.body.payment1) || 0,
      payment2: Number(req.body.payment2) || 0,
      paymentDate1: req.body.paymentDate1 ? String(req.body.paymentDate1) : '',
      paymentDate2: req.body.paymentDate2 ? String(req.body.paymentDate2) : '',
      columnColors
    };

    const record = new Record(safeBody);
    await record.save();

    res.status(201).json(record);
  } catch (error) {
    console.error('Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/records/:id', async (req, res) => {
  try {
    const record = await Record.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });

    Object.assign(record, {
      ...req.body,
      fileAmount: Number(req.body.fileAmount) || record.fileAmount,
      payment1: Number(req.body.payment1) || record.payment1,
      payment2: Number(req.body.payment2) || record.payment2,
      paymentDate1: req.body.paymentDate1 !== undefined ? String(req.body.paymentDate1 || '') : record.paymentDate1,
      paymentDate2: req.body.paymentDate2 !== undefined ? String(req.body.paymentDate2 || '') : record.paymentDate2,
    });

    await record.save();
    res.json(record);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/records/:id', async (req, res) => {
  try {
    const record = await Record.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Record deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/update-column-color', async (req, res) => {
  try {
    const { field, color } = req.body;
    await Record.updateMany({}, { $set: { [`columnColors.${field}`]: color } });
    res.json({ message: 'Column color updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/update-row-colors', async (req, res) => {
  try {
    const { ids, color } = req.body;
    await Record.updateMany({ _id: { $in: ids } }, { $set: { rowColor: color } });
    res.json({ message: 'Row colors updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));