import { useEffect, useState, useMemo, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_BASE = 'http://localhost:8080';

const fields = [
  { label: 'رقم', key: 'number', required: true, minWidth: 100 },
  { label: 'دورة', key: 'cycle', minWidth: 120 },
  { label: 'الفوج', key: 'group', minWidth: 120 },
  { label: 'الاسم و اللقب', key: 'fullName', required: true, minWidth: 250 },
  { label: 'تاريخ الميلاد', key: 'birthInfo', type: 'date', minWidth: 180 },
  { label: 'الاختصاص', key: 'specialization', minWidth: 180 },
  { label: 'مبلغ الملف', key: 'fileAmount', type: 'number', minWidth: 150 },
  { label: 'الوسيط', key: 'intermediary', minWidth: 180 },
  { label: 'الدفعة 1', key: 'payment1', type: 'number', minWidth: 150 },
  { label: 'تاريخ الدفعة 1', key: 'paymentDate1', type: 'text', minWidth: 180 },
  { label: 'الدفعة 2', key: 'payment2', type: 'number', minWidth: 150 },
  { label: 'تاريخ الدفعة 2', key: 'paymentDate2', type: 'text', minWidth: 180 },
  { label: 'الباقي', key: 'remaining', readOnly: true, minWidth: 150 },
  { label: 'الديبلوم', key: 'diploma', minWidth: 180 },
  { label: 'ملاحظة', key: 'note', minWidth: 250 },
];

function App() {
  const [records, setRecords] = useState([]);
  const [originalRecords, setOriginalRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [sortOrder, setSortOrder] = useState('oldest'); // 'oldest' or 'newest'
  const tableBottomRef = useRef(null);

  // Filters
  const [filters, setFilters] = useState({
    specialization: '',
    cycle: '',
    group: '',
    diploma: '',
    note: ''
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newRow, setNewRow] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  // Fetch Data
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/records`);
      const data = res.data.map(calcRow);
      setRecords(data);
      setOriginalRecords(JSON.parse(JSON.stringify(data)));
      setSelectedRows(new Set());
      setSelectAll(false);
    } catch (err) {
      alert('خطأ في تحميل البيانات. تأكد من تشغيل السيرفر.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  // Calculation
  function calcRow(row) {
    const total = parseFloat(row.fileAmount) || 0;
    const p1 = parseFloat(row.payment1) || 0;
    const p2 = parseFloat(row.payment2) || 0;
    return { ...row, remaining: total - (p1 + p2) };
  }

  // Unique values for filters
  const uniqueValues = useMemo(() => {
    const sets = {
      specialization: new Set(),
      cycle: new Set(),
      group: new Set(),
      diploma: new Set(),
      note: new Set()
    };
    records.forEach(r => {
      if (r.specialization) sets.specialization.add(r.specialization.trim());
      if (r.cycle) sets.cycle.add(r.cycle.trim());
      if (r.group) sets.group.add(r.group.trim());
      if (r.diploma) sets.diploma.add(r.diploma.trim());
      if (r.note) sets.note.add(r.note.trim());
    });
    return {
      specialization: ['', ...Array.from(sets.specialization).sort()],
      cycle: ['', ...Array.from(sets.cycle).sort()],
      group: ['', ...Array.from(sets.group).sort()],
      diploma: ['', ...Array.from(sets.diploma).sort()],
      note: ['', ...Array.from(sets.note).sort()]
    };
  }, [records]);

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    let filtered = records;

    // Global search
    if (searchTerm) {
      filtered = filtered.filter(rec =>
        Object.values(rec).some(val =>
          String(val || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Advanced filters
    if (filters.specialization) filtered = filtered.filter(r => r.specialization === filters.specialization);
    if (filters.cycle) filtered = filtered.filter(r => r.cycle === filters.cycle);
    if (filters.group) filtered = filtered.filter(r => r.group === filters.group);
    if (filters.diploma) filtered = filtered.filter(r => r.diploma === filters.diploma);
    if (filters.note) filtered = filtered.filter(r => r.note === filters.note);

    // Sorting by date
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.updatedAt);
      const dateB = new Date(b.createdAt || b.updatedAt);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [records, searchTerm, filters, sortOrder]);

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedRows(new Set());
      setSelectAll(false);
    } else {
      setSelectedRows(new Set(filteredRecords.map(r => r._id)));
      setSelectAll(true);
    }
  };

  const toggleRowSelect = (id) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedRows(newSet);
    setSelectAll(newSet.size === filteredRecords.length && filteredRecords.length > 0);
  };

  // Delete Selected
  const deleteSelected = async () => {
    if (selectedRows.size === 0) return alert('لم يتم تحديد أي صف');
    if (!confirm(`هل أنت متأكد من حذف ${selectedRows.size} سجل؟`)) return;

    try {
      await Promise.all(Array.from(selectedRows).map(id => axios.delete(`${API_BASE}/records/${id}`)));
      await fetchRecords();
      alert('تم الحذف بنجاح');
    } catch (err) {
      alert('حدث خطأ أثناء الحذف');
    }
  };

  // Color Handlers
  const setColumnColor = async (fieldKey, color) => {
    if (!color) return;
    try {
      await axios.post(`${API_BASE}/update-column-color`, { field: fieldKey, color });
      await fetchRecords();
    } catch (err) {
      alert('خطأ في تلوين العمود');
    }
  };

  const setSelectedRowsColor = async (color) => {
    if (selectedRows.size === 0) return alert('اختر صفوفاً أولاً');
    if (!color) return;
    try {
      await axios.post(`${API_BASE}/update-row-colors`, { ids: Array.from(selectedRows), color });
      await fetchRecords();
    } catch (err) {
      alert('خطأ في تلوين الصفوف');
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    tableBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Save Changes
  const handleSaveAll = async () => {
    const changed = records.filter((rec, idx) =>
      JSON.stringify(rec) !== JSON.stringify(originalRecords.find(o => o._id === rec._id))
    );

    if (changed.length === 0) return alert('لا توجد تعديلات لحفظها');

    setSaving(true);
    try {
      await Promise.all(changed.map(r => axios.put(`${API_BASE}/records/${r._id}`, r)));
      setOriginalRecords(JSON.parse(JSON.stringify(records)));
      alert(`تم حفظ ${changed.length} سجل بنجاح`);
    } catch (err) {
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  // Cell Change
  const handleCellChange = (id, key, value) => {
    setRecords(prev => prev.map(r => {
      if (r._id === id) {
        let updated = { ...r, [key]: value };
        if (['fileAmount', 'payment1', 'payment2'].includes(key)) {
          updated = calcRow(updated);
        }
        return updated;
      }
      return r;
    }));
  };

  // Export & Upload (unchanged)
  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(records);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Records");
    XLSX.writeFile(workbook, "Data_Export.xlsx");
  };

  const handleFileUpload = async (event) => {
    // ... نفس الكود السابق (غير معدل)
    const file = event.target.files[0];
    if (!file) return;

    setUploadStatus('جاري قراءة الملف...');
    setShowUploadModal(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      if (jsonData.length === 0) {
        setUploadStatus('الملف فارغ!');
        return;
      }

      setUploadStatus(`تم قراءة ${jsonData.length} صف. جاري الرفع...`);

      const formData = new FormData();
      formData.append('file', file);

      await axios.post(`${API_BASE}/upload-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadStatus('تم الرفع بنجاح! جاري تحديث الجدول...');
      await fetchRecords();

      setTimeout(() => {
        setShowUploadModal(false);
        setUploadStatus('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 2000);

    } catch (err) {
      console.error(err);
      setUploadStatus('خطأ في رفع الملف: ' + (err.response?.data?.error || err.message));
    }
  };

  const isMissingRequired = (record) => !record.number || !record.fullName;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8" dir="rtl">
      {/* Header */}
      <div className="max-w-full mx-auto bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-200">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h1 className="text-3xl font-black text-gray-800">نظام إدارة الطلاب والمالية</h1>
            <p className="text-gray-500 mt-1">إدارة السجلات، المدفوعات، والتصدير</p>
          </div>

          <div className="w-full lg:w-auto flex flex-col gap-4">
            <div className="relative w-full lg:w-96">
              <span className="absolute inset-y-0 right-3 flex items-center pr-2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="بحث في جميع الحقول..."
                className="w-full pr-10 pl-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {['specialization', 'cycle', 'group', 'diploma', 'note'].map(key => (
                <select
                  key={key}
                  value={filters[key]}
                  onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">كل {fields.find(f => f.key === key)?.label}</option>
                  {uniqueValues[key].map(val => (
                    <option key={val} value={val}>{val || '(فارغ)'}</option>
                  ))}
                </select>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold transition">+ إضافة سجل</button>
              <label className="cursor-pointer">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                <span className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl font-bold transition inline-block">📤 رفع Excel</span>
              </label>
              <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl font-bold transition">📥 تصدير Excel</button>
              <button onClick={handleSaveAll} disabled={saving} className={`${saving ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-8 py-2 rounded-xl font-bold transition shadow-lg`}>
                {saving ? 'جاري الحفظ...' : '💾 حفظ التعديلات'}
              </button>
            </div>

            {/* Sort & Actions */}
            <div className="flex flex-wrap gap-3 items-center">
              <button onClick={() => setSortOrder('newest')} className={`px-4 py-2 rounded-lg font-bold transition ${sortOrder === 'newest' ? 'bg-orange-600 text-white' : 'bg-gray-200'}`}>الأحدث أولاً</button>
              <button onClick={() => setSortOrder('oldest')} className={`px-4 py-2 rounded-lg font-bold transition ${sortOrder === 'oldest' ? 'bg-orange-600 text-white' : 'bg-gray-200'}`}>الأقدم أولاً</button>
              <button onClick={scrollToBottom} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold transition">↓ أسفل الجدول</button>
              {selectedRows.size > 0 && (
                <>
                  <button onClick={deleteSelected} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition">🗑️ حذف المحدد ({selectedRows.size})</button>
                  <input type="color" onChange={(e) => setSelectedRowsColor(e.target.value)} className="w-12 h-10 cursor-pointer" title="تلوين الصفوف المحددة" />
                </>
              )}
            </div>

            {/* Column Coloring */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-bold">تلوين عمود:</span>
              {fields.filter(f => !f.readOnly).map(f => (
                <div key={f.key} className="flex items-center gap-1">
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">{f.label.slice(0, 6)}</span>
                  <input type="color" onChange={(e) => setColumnColor(f.key, e.target.value)} className="w-8 h-8 cursor-pointer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-800 text-white sticky top-0 z-10">
              <tr>
                <th className="p-4 border-b border-gray-700 w-12 text-center">
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="w-5 h-5 cursor-pointer" />
                </th>
                <th className="p-4 border-b border-gray-700 w-16 text-center">#</th>
                {fields.map(f => (
                  <th key={f.key} className="p-4 border-b border-gray-700 text-sm font-bold" style={{ minWidth: f.minWidth, backgroundColor: records[0]?.columnColors?.[f.key] || '' }}>
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.length > 0 ? filteredRecords.map((r, idx) => {
                const missingRequired = isMissingRequired(r);
                const isSelected = selectedRows.has(r._id);
                const rowStyle = { backgroundColor: r.rowColor || '' };

                return (
                  <tr key={r._id} style={rowStyle} className={`hover:bg-blue-50 transition-colors ${missingRequired ? 'bg-red-50' : ''} ${isSelected ? '!bg-blue-100' : ''}`}>
                    <td className="p-4 text-center bg-gray-50">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRowSelect(r._id)} className="w-5 h-5 cursor-pointer" />
                    </td>
                    <td className="p-4 text-center font-mono text-gray-400 bg-gray-50">{idx + 1}</td>
                    {fields.map(f => {
                      const columnBg = records[0]?.columnColors?.[f.key] || '';
                      const cellStyle = columnBg ? { backgroundColor: columnBg } : {};

                      return (
                        <td key={f.key} style={cellStyle} className={`p-1 border-l border-gray-50 ${missingRequired && f.required ? 'bg-red-200' : ''}`}>
                          {f.readOnly ? (
                            <div className={`px-3 py-2 font-bold ${f.key === 'remaining' && r[f.key] > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                              {r[f.key]?.toLocaleString()}
                            </div>
                          ) : (
                            <input
                              type={f.type === 'number' ? 'number' : 'text'}
                              className="w-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-blue-400 rounded-md outline-none transition"
                              value={r[f.key] || ''}
                              onChange={(e) => handleCellChange(r._id, f.key, e.target.value)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={fields.length + 2} className="p-12 text-center text-gray-400 text-xl">لا توجد نتائج مطابقة</td>
                </tr>
              )}
              <tr>
                <td colSpan={fields.length + 2} ref={tableBottomRef}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex justify-between text-sm text-gray-500 font-bold">
        <span>الموقع: متصل بالخادم ✅</span>
        <span>عدد السجلات الظاهرة: {filteredRecords.length} {selectedRows.size > 0 && `| محدد: ${selectedRows.size}`}</span>
      </div>

      {/* Modals remain the same */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <div className="text-2xl mb-4">⏳</div>
            <p className="text-lg font-bold">{uploadStatus}</p>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-6">إضافة طالب جديد</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.filter(f => !f.readOnly).map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-bold mb-2">{f.label}</label>
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-blue-500"
                    onChange={(e) => setNewRow({ ...newRow, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-8 flex gap-4">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-gray-200 rounded-xl font-bold">إلغاء</button>
              <button onClick={async () => {
                const calculated = calcRow(newRow);
                await axios.post(`${API_BASE}/records`, calculated);
                setShowAddModal(false);
                fetchRecords();
              }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">حفظ السجل</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;