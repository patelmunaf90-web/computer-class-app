import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, deleteDoc, updateDoc, getDocs, query, where, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import AdminLayout from '../components/AdminLayout';
import { printElement } from '../lib/PrintService';

interface Student {
  id: string;
  name: string;
  phone: string;
  rollNo: string;
  course: string;
  batch?: string;
  address: string;
  photoURL?: string;
  feesPaid?: number;
  feesTotal?: number;
  status?: 'active' | 'inactive';
}

export default function StudentList() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(true);

  // Edit and Delete states
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<Student | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Student>>({});
  const [actionError, setActionError] = useState('');
  const [instituteSettings, setInstituteSettings] = useState<any>(null);
  const [reportStudent, setReportStudent] = useState<Student | null>(null);
  const [reportPayments, setReportPayments] = useState<any[]>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [docToPrint, setDocToPrint] = useState<{ type: 'id-card' | 'admission-form', student: Student } | null>(null);
  const reportPrintRef = useRef<HTMLDivElement>(null);
  const docPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'institute'));
        if (docSnap.exists()) {
          setInstituteSettings(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching institute settings:", error);
      }
    };
    fetchSettings();

    const unsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({
        id: doc.id,
        status: 'active', // Default status
        ...doc.data()
      })) as Student[];
      setStudents(studentData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      (student.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.rollNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.phone || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleToggleStatus = (student: Student) => {
    setTogglingStatus(student);
  };

  const confirmToggleStatus = async () => {
    if (!togglingStatus) return;
    
    const newStatus = togglingStatus.status === 'inactive' ? 'active' : 'inactive';
    setIsUpdating(true);
    setActionError('');

    try {
      const studentRef = doc(db, 'students', togglingStatus.id);
      const updates: any = { status: newStatus };
      
      if (newStatus === 'inactive') {
        updates.feesTotal = togglingStatus.feesPaid || 0;
      }

      await updateDoc(studentRef, updates);
      setTogglingStatus(null);
    } catch (error: any) {
      console.error("Error toggling student status:", error);
      setActionError(error.message || "Failed to update student status.");
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingStudent) return;
    setActionError('');
    try {
      await deleteDoc(doc(db, 'students', deletingStudent.id));
      setDeletingStudent(null);
    } catch (error: any) {
      console.error("Error deleting student:", error);
      setActionError(error.message || "Failed to delete student.");
    }
  };

  const handleEditClick = (student: Student) => {
    setActionError('');
    setEditingStudent(student);
    setEditFormData({
      name: student.name,
      phone: student.phone,
      course: student.course,
      batch: student.batch || 'A',
      address: student.address,
      feesTotal: student.feesTotal || 0,
      feesPaid: student.feesPaid || 0,
    });
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsUpdating(true);
    setActionError('');
    try {
      const studentRef = doc(db, 'students', editingStudent.id);
      await updateDoc(studentRef, {
        name: editFormData.name,
        phone: editFormData.phone,
        course: editFormData.course,
        batch: editFormData.batch,
        address: editFormData.address,
        feesTotal: Number(editFormData.feesTotal) || 0,
        feesPaid: Number(editFormData.feesPaid) || 0,
      });
      setEditingStudent(null);
    } catch (error: any) {
      console.error("Error updating student:", error);
      setActionError(error.message || "Failed to update student.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePrintReport = async (student: Student) => {
    setIsGeneratingReport(true);
    try {
      const paymentsQuery = query(collection(db, 'payments'), where('studentId', '==', student.id));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const payments = paymentsSnapshot.docs.map(doc => doc.data());
      
      setReportStudent(student);
      setReportPayments(payments);
      
      // Wait for state update and render
      setTimeout(() => {
        if (reportPrintRef.current) {
          printElement(reportPrintRef.current, `${student.name} Report`);
        }
        setIsGeneratingReport(false);
      }, 500);
    } catch (error) {
      console.error("Error generating report:", error);
      setIsGeneratingReport(false);
    }
  };

  const handlePrintDocument = (student: Student, type: 'id-card' | 'admission-form') => {
    setDocToPrint({ type, student });
    
    // Wait for state update and render
    setTimeout(() => {
      if (docPrintRef.current) {
        printElement(docPrintRef.current, type === 'id-card' ? 'Student ID Card' : 'Admission Form');
      }
      setDocToPrint(null);
    }, 1000);
  };

  const handleExportCSV = () => {
    if (students.length === 0) return;

    const headers = ['Roll No', 'Name', 'Course', 'Batch', 'Phone', 'Address', 'Total Fees', 'Paid Fees', 'Balance'];
    const csvContent = [
      headers.join(','),
      ...filteredStudents.map(s => {
        const balance = (s.feesTotal || 0) - (s.feesPaid || 0);
        return [
          `"${s.rollNo || ''}"`,
          `"${s.name || ''}"`,
          `"${s.course || ''}"`,
          `"${s.batch || ''}"`,
          `"${s.phone || ''}"`,
          `"${(s.address || '').replace(/"/g, '""')}"`,
          s.feesTotal || 0,
          s.feesPaid || 0,
          balance
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-slate-900">Student List</h1>
          <div className="flex items-center gap-3">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
            >
              <option value="active">Active Students</option>
              <option value="inactive">Inactive Students</option>
              <option value="all">All Students</option>
            </select>
            <button 
              onClick={handleExportCSV}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Export CSV
            </button>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search name, roll no..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold whitespace-nowrap">
              Total: {filteredStudents.length}
            </span>
          </div>
        </div>
        
        {/* Modals */}
        {togglingStatus && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-100">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${togglingStatus.status === 'inactive' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {togglingStatus.status === 'inactive' ? 'Reactivate Student?' : 'Deactivate Student?'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {togglingStatus.status === 'inactive' 
                  ? `Are you sure you want to reactivate ${togglingStatus.name}?`
                  : `Are you sure you want to deactivate ${togglingStatus.name}? Their pending fees will be set to 0.`
                }
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setTogglingStatus(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">Cancel</button>
                <button 
                  onClick={confirmToggleStatus} 
                  disabled={isUpdating}
                  className={`px-6 py-2 text-white rounded-xl font-bold transition-colors shadow-lg disabled:opacity-50 ${togglingStatus.status === 'inactive' ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-100'}`}
                >
                  {isUpdating ? 'Updating...' : togglingStatus.status === 'inactive' ? 'Reactivate' : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {deletingStudent && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Student</h3>
              <p className="text-slate-600 mb-6">Are you sure you want to delete <strong>{deletingStudent.name}</strong>? This action cannot be undone.</p>
              
              {actionError && (
                <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                  {actionError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={() => setDeletingStudent(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">Cancel</button>
                <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        )}

        {editingStudent && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-xl my-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Edit Student</h3>
                <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {actionError && (
                <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleUpdateStudent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                    <input type="text" value={editFormData.name || ''} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input type="tel" value={editFormData.phone || ''} onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Course</label>
                    <select value={editFormData.course || ''} onChange={(e) => setEditFormData({...editFormData, course: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="DCA">DCA</option>
                      <option value="CCC">CCC</option>
                      <option value="DICA">DICA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Batch</label>
                    <select value={editFormData.batch || ''} onChange={(e) => setEditFormData({...editFormData, batch: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="A">Batch A</option>
                      <option value="B">Batch B</option>
                      <option value="C">Batch C</option>
                      <option value="D">Batch D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Total Fees (₹)</label>
                    <input type="number" value={editFormData.feesTotal || ''} onChange={(e) => setEditFormData({...editFormData, feesTotal: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Fees Paid (₹)</label>
                    <input type="number" value={editFormData.feesPaid || ''} onChange={(e) => setEditFormData({...editFormData, feesPaid: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Address</label>
                  <textarea value={editFormData.address || ''} onChange={(e) => setEditFormData({...editFormData, address: e.target.value})} rows={2} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                </div>
                
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setEditingStudent(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">Cancel</button>
                  <button type="submit" disabled={isUpdating} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2">
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map(student => (
                <div key={student.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center hover:shadow-md transition-all group relative">
                  
                  {/* Action Buttons (Edit/Delete/Print) */}
                  <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={() => handleToggleStatus(student)} className={`p-2 rounded-lg transition-colors ${student.status === 'inactive' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`} title={student.status === 'inactive' ? "Reactivate" : "Deactivate"}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.366zm1.414-1.414L6.525 5.11a6 6 0 018.366 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button onClick={() => handlePrintReport(student)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Print Report">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => navigate(`/admin/documents/${student.id}?type=id-card`)} 
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" 
                      title="View ID Card"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                    <button 
                      onClick={() => handlePrintDocument(student, 'id-card')} 
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" 
                      title="Print ID Card"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => navigate(`/admin/documents/${student.id}?type=admission-form`)} 
                      className="p-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors" 
                      title="View Admission Form"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                    <button 
                      onClick={() => handlePrintDocument(student, 'admission-form')} 
                      className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors" 
                      title="Print Admission Form"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button onClick={() => handleEditClick(student)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Edit">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button onClick={() => setDeletingStudent(student)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Delete">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className="relative mb-4">
                    {student.photoURL ? (
                      <img 
                        src={student.photoURL} 
                        alt={student.name} 
                        className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 shadow-sm group-hover:border-blue-100 transition-all"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-3xl font-bold border-4 border-slate-50 group-hover:border-blue-100 transition-all">
                        {(student.name || '?')[0]}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 flex flex-col gap-1 items-end">
                      <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm uppercase">
                        {student.course}
                      </div>
                      {student.batch && (
                        <div className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm uppercase">
                          Batch {student.batch}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-mono text-blue-600 font-semibold">Roll No: {student.rollNo || 'N/A'}</p>
                    {student.status === 'inactive' && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full uppercase">Inactive</span>
                    )}
                  </div>
                  
                  <div className="w-full mt-6 pt-6 border-t border-slate-50 space-y-3 text-sm text-slate-600 text-left">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-400">Phone</span>
                      <span className="font-semibold text-slate-700">{student.phone || 'N/A'}</span>
                    </div>
                    
                    {/* Fees Section */}
                    <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Total Fees</span>
                        <span className="font-bold text-slate-700">₹{student.feesTotal || 0}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Paid</span>
                        <span className="font-bold text-green-600">₹{student.feesPaid || 0}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                        <div 
                          className="bg-green-500 h-full rounded-full" 
                          style={{ width: `${Math.min(100, ((student.feesPaid || 0) / (student.feesTotal || 1)) * 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] pt-1">
                        <span className="text-slate-400 font-medium">Balance</span>
                        <span className="font-bold text-red-500">₹{(student.feesTotal || 0) - (student.feesPaid || 0)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <span className="font-medium text-slate-400 mb-1">Address</span>
                      <span className="text-xs leading-relaxed line-clamp-2 text-slate-500">{student.address || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredStudents.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400">No students found matching your search.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hidden Printable Documents */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={docPrintRef}>
          {docToPrint && (
            <div className="min-h-screen bg-white p-0 flex justify-center">
              {docToPrint.type === 'id-card' ? (
                /* Professional ID Card Design */
                <div className="w-[3.375in] h-[2.125in] bg-white rounded-xl overflow-hidden relative border border-slate-300 flex flex-col m-4">
                  {/* Header */}
                  <div className="bg-blue-700 text-white p-2 flex items-center gap-2">
                    {instituteSettings?.logoUrl && (
                      <img src={instituteSettings.logoUrl} alt="Logo" className="w-8 h-8 object-contain bg-white rounded-full p-0.5" />
                    )}
                    <div className="leading-tight">
                      <h2 className="text-[10px] font-black uppercase tracking-tight">{instituteSettings?.name || 'IKHAR COMPUTER ACADEMY'}</h2>
                      <p className="text-[6px] opacity-80 truncate w-40">{instituteSettings?.address || '123 Education Hub, Tech City'}</p>
                    </div>
                  </div>
                  
                  {/* Body */}
                  <div className="flex-grow p-3 flex gap-3">
                    <div className="w-20 h-24 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden flex-shrink-0">
                      {docToPrint.student.photoURL ? (
                        <img 
                          src={docToPrint.student.photoURL} 
                          alt={docToPrint.student.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-grow space-y-1.5">
                      <div>
                        <p className="text-[6px] text-slate-400 uppercase font-bold">Student Name</p>
                        <p className="text-[11px] font-black text-slate-900 uppercase leading-none">{docToPrint.student.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[6px] text-slate-400 uppercase font-bold">Roll No</p>
                          <p className="text-[9px] font-bold text-slate-800">{docToPrint.student.rollNo}</p>
                        </div>
                        <div>
                          <p className="text-[6px] text-slate-400 uppercase font-bold">Course</p>
                          <p className="text-[9px] font-bold text-slate-800">{docToPrint.student.course}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[6px] text-slate-400 uppercase font-bold">Phone</p>
                        <p className="text-[9px] font-bold text-slate-800">{docToPrint.student.phone}</p>
                      </div>
                      <div>
                        <p className="text-[6px] text-slate-400 uppercase font-bold">Batch</p>
                        <p className="text-[9px] font-bold text-slate-800">{docToPrint.student.batch || 'A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="bg-slate-900 text-white p-1 text-center">
                    <p className="text-[6px] font-bold uppercase tracking-widest">Student Identity Card</p>
                  </div>
                </div>
              ) : (
                /* Professional Admission Form Design */
                <div className="w-[210mm] min-h-[297mm] bg-white p-8 relative overflow-hidden">
                  {/* Watermark */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none rotate-[-45deg]">
                    <span className="text-[150px] font-black tracking-tighter">ICA</span>
                  </div>

                  {/* Header */}
                  <div className="flex justify-between items-start border-b-2 border-blue-600 pb-6 mb-8 relative z-10">
                    <div className="flex items-center gap-6">
                      {instituteSettings?.logoUrl && (
                        <img src={instituteSettings.logoUrl} alt="Logo" className="w-24 h-24 object-contain" />
                      )}
                      <div>
                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{instituteSettings?.name || 'IKHAR COMPUTER ACADEMY'}</h2>
                        <p className="text-slate-500 mt-1 font-medium">{instituteSettings?.address || '123 Education Hub, Tech City, 400001'}</p>
                        <p className="text-slate-500 font-medium">Phone: {instituteSettings?.phone || '+91 98765 43210'} | Email: info@ikhar.com</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-blue-600 text-white px-4 py-2 font-black uppercase tracking-widest text-sm rounded-lg mb-2">
                        Admission Form
                      </div>
                      <p className="text-slate-500 font-bold">Form No: <span className="text-slate-900">ADM-{docToPrint.student.rollNo}</span></p>
                      <p className="text-slate-500 font-bold">Date: <span className="text-slate-900">{docToPrint.student.createdAt?.toDate ? docToPrint.student.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}</span></p>
                    </div>
                  </div>

                  {/* Form Content */}
                  <div className="relative z-10 space-y-8">
                    <div className="flex justify-between items-start gap-8">
                      <div className="flex-grow space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          <div className="border-b border-slate-200 pb-2">
                            <p className="text-xs font-bold text-blue-600 uppercase mb-1">Student Full Name</p>
                            <p className="text-xl font-bold text-slate-900 uppercase">{docToPrint.student.name}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="border-b border-slate-200 pb-2">
                              <p className="text-xs font-bold text-blue-600 uppercase mb-1">Roll Number</p>
                              <p className="text-lg font-bold text-slate-900">{docToPrint.student.rollNo}</p>
                            </div>
                            <div className="border-b border-slate-200 pb-2">
                              <p className="text-xs font-bold text-blue-600 uppercase mb-1">Course Applied</p>
                              <p className="text-lg font-bold text-slate-900">{docToPrint.student.course}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="border-b border-slate-200 pb-2">
                              <p className="text-xs font-bold text-blue-600 uppercase mb-1">Mobile Number</p>
                              <p className="text-lg font-bold text-slate-900">{docToPrint.student.phone}</p>
                            </div>
                            <div className="border-b border-slate-200 pb-2">
                              <p className="text-xs font-bold text-blue-600 uppercase mb-1">Batch Assigned</p>
                              <p className="text-lg font-bold text-slate-900">Batch {docToPrint.student.batch || 'A'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="w-40 h-48 border-2 border-slate-200 rounded-xl overflow-hidden flex-shrink-0 bg-slate-50 flex items-center justify-center">
                        {docToPrint.student.photoURL ? (
                          <img 
                            src={docToPrint.student.photoURL} 
                            alt={docToPrint.student.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-slate-300 text-center p-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <p className="text-[10px] font-bold uppercase">Paste Photo Here</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-b border-slate-200 pb-2">
                      <p className="text-xs font-bold text-blue-600 uppercase mb-1">Permanent Address</p>
                      <p className="text-lg font-medium text-slate-800">{docToPrint.student.address || 'N/A'}</p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <h4 className="text-sm font-bold text-slate-900 uppercase mb-4 border-b border-slate-200 pb-2">Fee Structure</h4>
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Fees</p>
                          <p className="text-xl font-black text-slate-900">₹{docToPrint.student.feesTotal?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Paid Amount</p>
                          <p className="text-xl font-black text-green-600">₹{docToPrint.student.feesPaid?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Balance Due</p>
                          <p className="text-xl font-black text-red-600">₹{( (docToPrint.student.feesTotal || 0) - (docToPrint.student.feesPaid || 0) ).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-8">
                      <h4 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2">Declaration</h4>
                      <p className="text-sm text-slate-600 leading-relaxed italic">
                        I hereby declare that all the information provided above is true and correct to the best of my knowledge. I agree to abide by the rules and regulations of the institute. I understand that fees once paid are non-refundable.
                      </p>
                    </div>

                    <div className="flex justify-between items-end pt-20">
                      <div className="text-center">
                        <div className="w-48 border-b-2 border-slate-900 mb-2"></div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-900">Student Signature</p>
                      </div>
                      <div className="text-center">
                        <div className="w-48 border-b-2 border-slate-900 mb-2"></div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-900">Authorized Signatory</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="absolute bottom-8 left-12 right-12 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-4">
                    <span>{instituteSettings?.name || 'IKHAR COMPUTER ACADEMY'}</span>
                    <span>Generated on {new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div ref={reportPrintRef} className="bg-white p-8">
          <div className="max-w-4xl mx-auto border border-slate-200 p-8 rounded-xl">
            <div className="flex justify-between items-start mb-8 border-b pb-6">
              <div className="flex items-center gap-4">
                {instituteSettings?.logoUrl && (
                  <img src={instituteSettings.logoUrl} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                )}
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wider">{instituteSettings?.name || 'Institute of Technology'}</h2>
                  <p className="text-slate-500 text-sm">{instituteSettings?.address || '123 Education Hub, Tech City'}</p>
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-xl font-bold text-slate-900">STUDENT PROGRESS REPORT</h1>
                <p className="text-slate-500 text-sm">Generated on: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {reportStudent && (
              <>
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Personal Details</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-slate-500">Name:</span>
                      <span className="font-bold text-slate-900">{reportStudent.name}</span>
                      <span className="text-slate-500">Roll No:</span>
                      <span className="font-bold text-slate-900">{reportStudent.rollNo}</span>
                      <span className="text-slate-500">Course:</span>
                      <span className="font-bold text-slate-900">{reportStudent.course}</span>
                      <span className="text-slate-500">Phone:</span>
                      <span className="font-bold text-slate-900">{reportStudent.phone}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Fee Summary</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-slate-500">Total Fees:</span>
                      <span className="font-bold text-slate-900">₹{(reportStudent.feesTotal || 0).toLocaleString()}</span>
                      <span className="text-slate-500">Paid Amount:</span>
                      <span className="font-bold text-green-600">₹{(reportStudent.feesPaid || 0).toLocaleString()}</span>
                      <span className="text-slate-500">Balance:</span>
                      <span className="font-bold text-red-600">₹{((reportStudent.feesTotal || 0) - (reportStudent.feesPaid || 0)).toLocaleString()}</span>
                      <span className="text-slate-500">Status:</span>
                      <span className={`font-bold ${(reportStudent.status || 'active') === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                        {(reportStudent.status || 'active').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Payment History</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200">
                        <th className="text-left py-3 px-4 text-slate-600 font-bold text-xs uppercase">Date</th>
                        <th className="text-left py-3 px-4 text-slate-600 font-bold text-xs uppercase">Receipt No</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-bold text-xs uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportPayments.length > 0 ? reportPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-3 px-4 text-sm text-slate-700">{new Date(p.date).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-sm font-mono font-bold text-slate-900">{p.receiptNo}</td>
                          <td className="py-3 px-4 text-right text-sm font-bold text-slate-900">₹{p.amount.toLocaleString()}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400 text-sm italic">No payment records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-end">
              <div className="text-center">
                <div className="w-32 border-b border-slate-300 mb-1"></div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Office Assistant</p>
              </div>
              <div className="text-center">
                <div className="w-32 border-b border-slate-300 mb-1"></div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Director Signature</p>
              </div>
            </div>
          </div>
          <style>{`
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4 portrait; margin: 10mm; }
            }
          `}</style>
        </div>
      </div>
    </AdminLayout>
  );
}
