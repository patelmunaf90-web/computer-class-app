import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import AdminLayout from '../components/AdminLayout';
import { printElement } from '../lib/PrintService';

interface Student {
  id: string;
  name: string;
  rollNo: string;
  course: string;
  phone: string;
  feesTotal: number;
  feesPaid: number;
  status?: 'active' | 'inactive';
}

interface ReceiptData {
  id: string;
  studentName: string;
  rollNo: string;
  course: string;
  phone: string;
  amountPaid: number;
  date: string;
  totalFees: number;
  previousPaid: number;
  newTotalPaid: number;
  balance: number;
  receiptNo: string;
  isStatusReport?: boolean;
}

export default function Fees() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [loading, setLoading] = useState(true);

  // Payment Modal State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [instituteSettings, setInstituteSettings] = useState<any>(null);
  const [showPrintWarning, setShowPrintWarning] = useState(false);

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
      const studentData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          rollNo: data.rollNo || '',
          course: data.course || '',
          phone: data.phone || '',
          feesTotal: Number(data.feesTotal) || 0,
          feesPaid: Number(data.feesPaid) || 0,
          status: data.status || 'active',
        };
      }) as Student[];
      setStudents(studentData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      (student.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.rollNo || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleSendWhatsAppReminder = (student: Student) => {
    const balance = student.feesTotal - student.feesPaid;
    if (balance <= 0) return;

    const instituteName = instituteSettings?.name || 'IKHAR COMPUTER ACADEMY';
    const message = `Hello *${student.name}*,\n\nThis is a friendly reminder from *${instituteName}* regarding your pending course fees for *${student.course}*.\n\n*Due Amount: ₹${balance.toLocaleString()}*\n\nPlease clear your dues at the earliest to avoid any inconvenience.\n\nThank you!`;
    
    // Remove any non-digit characters from phone number
    const cleanPhone = student.phone.replace(/\D/g, '');
    
    // Add country code if missing (assuming India +91)
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setActionError('Please enter a valid positive amount.');
      return;
    }

    setIsProcessing(true);
    setActionError('');
    setActionSuccess('');

    try {
      const newPaidAmount = selectedStudent.feesPaid + amount;
      const studentRef = doc(db, 'students', selectedStudent.id);
      
      await updateDoc(studentRef, {
        feesPaid: newPaidAmount
      });

      const receiptNo = `REC-${Date.now().toString().slice(-6)}`;

      // Save payment record for history
      const paymentDoc = await addDoc(collection(db, 'payments'), {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        rollNo: selectedStudent.rollNo,
        course: selectedStudent.course,
        amount: amount,
        receiptNo: receiptNo,
        timestamp: serverTimestamp(),
        date: new Date().toISOString()
      });

      const receipt: ReceiptData = {
        id: paymentDoc.id,
        studentName: selectedStudent.name,
        rollNo: selectedStudent.rollNo,
        course: selectedStudent.course,
        phone: selectedStudent.phone,
        amountPaid: amount,
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        totalFees: selectedStudent.feesTotal,
        previousPaid: selectedStudent.feesPaid,
        newTotalPaid: newPaidAmount,
        balance: selectedStudent.feesTotal - newPaidAmount,
        receiptNo: receiptNo
      };
      
      setReceiptData(receipt);
      setSelectedStudent(null);
      setPaymentAmount('');
      setActionSuccess('');
    } catch (error: any) {
      console.error("Error updating fees:", error);
      setActionError(error.message || "Failed to process payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openPaymentModal = (student: Student) => {
    setSelectedStudent(student);
    setPaymentAmount('');
    setActionError('');
    setActionSuccess('');
  };

  const handlePrintStatus = (student: Student) => {
    const receipt: ReceiptData = {
      id: student.id,
      studentName: student.name,
      rollNo: student.rollNo,
      course: student.course,
      phone: student.phone,
      amountPaid: 0,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      totalFees: student.feesTotal,
      previousPaid: student.feesPaid,
      newTotalPaid: student.feesPaid,
      balance: student.feesTotal - student.feesPaid,
      receiptNo: `STAT-${Date.now().toString().slice(-6)}`,
      isStatusReport: true
    };
    setReceiptData(receipt);
  };

  const handlePrint = () => {
    const element = document.getElementById('printable-receipt');
    if (element) {
      printElement(element, receiptData?.isStatusReport ? 'Fee Status' : 'Receipt');
    }
  };

  return (
    <AdminLayout>
      <div className={`space-y-6 ${receiptData ? 'print:hidden' : ''}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Fee Management</h1>
            <p className="text-slate-500 mt-1">Track and update student payments</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <button 
                onClick={() => setStatusFilter('active')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'active' ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Active
              </button>
              <button 
                onClick={() => setStatusFilter('inactive')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'inactive' ? 'bg-slate-600 text-white shadow-md shadow-slate-100' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Inactive
              </button>
              <button 
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'all' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                All
              </button>
            </div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search student..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all shadow-sm"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Add Payment</h3>
                <button onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-lg">{selectedStudent.name}</p>
                <p className="text-sm text-slate-500 font-mono mb-3">Roll No: {selectedStudent.rollNo}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Total Fees</p>
                    <p className="font-bold text-slate-700">₹{selectedStudent.feesTotal}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Paid So Far</p>
                    <p className="font-bold text-green-600">₹{selectedStudent.feesPaid}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <p className="text-slate-400">Pending Balance</p>
                    <p className="font-bold text-red-500 text-lg">₹{selectedStudent.feesTotal - selectedStudent.feesPaid}</p>
                  </div>
                </div>
              </div>

              {actionError && (
                <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                  {actionError}
                </div>
              )}
              
              {actionSuccess && (
                <div className="p-3 mb-4 bg-green-50 text-green-600 rounded-xl text-sm font-medium">
                  {actionSuccess}
                </div>
              )}

              <form onSubmit={handleAddPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Amount (₹)</label>
                  <input 
                    type="number" 
                    value={paymentAmount} 
                    onChange={(e) => setPaymentAmount(e.target.value)} 
                    placeholder="Enter amount" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold" 
                    required 
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setSelectedStudent(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">Cancel</button>
                  <button type="submit" disabled={isProcessing} className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center gap-2">
                    {isProcessing ? 'Processing...' : 'Submit Payment'}
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4 font-bold">Student Details</th>
                    <th className="p-4 font-bold">Course</th>
                    <th className="p-4 font-bold text-right">Total Fees</th>
                    <th className="p-4 font-bold text-right">Paid</th>
                    <th className="p-4 font-bold text-right">Balance</th>
                    <th className="p-4 font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.map(student => {
                    const balance = student.feesTotal - student.feesPaid;
                    const isInactive = student.status === 'inactive';
                    const isFullyPaid = balance <= 0 || isInactive;
                    const progressPercent = Math.min(100, (student.feesPaid / (student.feesTotal || 1)) * 100);

                    return (
                      <tr key={student.id} className={`hover:bg-slate-50/50 transition-colors group ${isInactive ? 'opacity-75' : ''}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-800">{student.name}</div>
                            {isInactive && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase rounded border border-slate-200">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-500 mt-0.5">Roll: {student.rollNo} • Ph: {student.phone}</div>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            {student.course}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-700">
                          ₹{student.feesTotal.toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="font-bold text-green-600">₹{student.feesPaid.toLocaleString()}</div>
                          <div className="w-full max-w-[80px] ml-auto bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                            <div className="bg-green-500 h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-bold ${isFullyPaid ? 'text-slate-400' : 'text-red-500'}`}>
                            ₹{Math.max(0, balance).toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => openPaymentModal(student)}
                              disabled={isFullyPaid}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                isFullyPaid 
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm'
                              }`}
                            >
                              {isInactive ? 'Inactive' : isFullyPaid ? 'Cleared' : 'Pay'}
                            </button>
                            <button 
                              onClick={() => handlePrintStatus(student)}
                              className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                              title="Print Status Receipt"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                              </svg>
                              Print
                            </button>
                            {!isFullyPaid && student.phone && (
                              <button 
                                onClick={() => handleSendWhatsAppReminder(student)}
                                className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 border border-green-100"
                                title="Send WhatsApp Reminder"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                Reminder
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                        No students found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Modal & Printable Area */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:static print:bg-white print:block print:p-0">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:max-w-full print:max-h-none print:overflow-visible">
            
            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-end items-center gap-3 mb-6 print:hidden sticky top-0 bg-white pb-4 border-b border-slate-100">
              <button onClick={() => setReceiptData(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">Close</button>
              <button 
                onClick={handlePrint} 
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                </svg>
                Print Receipt
              </button>
            </div>

            {/* Printable Receipt Content */}
            <div id="printable-receipt" className="bg-white p-8 rounded-xl border border-slate-200 max-w-3xl mx-auto relative overflow-hidden print:border-none print:p-0">
              {/* Decorative top border */}
              <div className="absolute top-0 left-0 w-full h-2 bg-blue-600 print:bg-blue-600"></div>
              
              {/* Header */}
              <div className="flex justify-between items-start mb-6 mt-2">
                <div className="flex items-center gap-4">
                  {instituteSettings?.logoUrl && (
                    <img src={instituteSettings.logoUrl} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                  )}
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wider">{instituteSettings?.name || 'Institute of Technology'}</h2>
                    <p className="text-slate-500 mt-1 text-sm">{instituteSettings?.address || '123 Education Hub, Tech City, 400001'}</p>
                    <p className="text-slate-500 text-sm">
                      {instituteSettings?.phone ? `Phone: ${instituteSettings.phone}` : 'Phone: +91 98765 43210'} 
                      {instituteSettings?.directorName ? ` | Director: ${instituteSettings.directorName}` : ' | Email: info@institute.com'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-700 font-bold uppercase tracking-widest rounded-lg mb-2 border border-blue-100 print:border-blue-200 text-sm">
                    {receiptData.isStatusReport ? 'FEE STATUS' : 'RECEIPT'}
                  </div>
                  <p className="text-sm text-slate-500">Receipt No: <span className="font-bold text-slate-900">{receiptData.receiptNo}</span></p>
                  <p className="text-sm text-slate-500">Date: <span className="font-bold text-slate-900">{receiptData.date}</span></p>
                </div>
              </div>

              {/* Student Details */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 print:bg-slate-50">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Student Information</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Name</p>
                    <p className="font-bold text-slate-900 text-sm">{receiptData.studentName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Roll Number</p>
                    <p className="font-bold text-slate-900 text-sm">{receiptData.rollNo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Course</p>
                    <p className="font-bold text-slate-900 text-sm">{receiptData.course}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Phone</p>
                    <p className="font-bold text-slate-900 text-sm">{receiptData.phone}</p>
                  </div>
                </div>
              </div>

              {/* Payment Details Table */}
              <table className="w-full mb-6 border-collapse">
                <thead>
                  <tr className="bg-slate-100 print:bg-slate-100">
                    <th className="text-left py-2 px-4 text-slate-700 font-bold uppercase text-xs rounded-l-lg">Description</th>
                    <th className="text-right py-2 px-4 text-slate-700 font-bold uppercase text-xs rounded-r-lg">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {!receiptData.isStatusReport && (
                    <tr className="border-b border-slate-100">
                      <td className="py-3 px-4 text-slate-800 font-medium text-sm">Course Fee Installment</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">₹{receiptData.amountPaid.toLocaleString()}</td>
                    </tr>
                  )}
                  {receiptData.isStatusReport && (
                    <tr className="border-b border-slate-100">
                      <td className="py-3 px-4 text-slate-800 font-medium text-sm">Total Course Fee</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">₹{receiptData.totalFees.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Summary Section */}
              <div className="flex justify-end mb-6">
                <div className="w-72 bg-slate-50 p-4 rounded-lg border border-slate-200 print:bg-slate-50">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-500">Total Course Fees:</span>
                    <span className="font-semibold text-slate-800">₹{receiptData.totalFees.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-500">Previously Paid:</span>
                    <span className="font-semibold text-slate-800">₹{receiptData.previousPaid.toLocaleString()}</span>
                  </div>
                  
                  {!receiptData.isStatusReport && (
                    <div className="flex justify-between text-sm mb-1.5 pb-1.5 border-b border-slate-200">
                      <span className="text-slate-500">Current Payment:</span>
                      <span className="font-bold text-green-600">₹{receiptData.amountPaid.toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-base pt-1 mt-1">
                    <span className="font-bold text-slate-700">Balance Due:</span>
                    <span className="font-black text-red-600">₹{receiptData.balance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-end pt-4 mt-2 border-t border-slate-200">
                <div className="text-xs text-slate-500">
                  <p className="font-semibold text-slate-600 mb-1">Terms & Conditions:</p>
                  <p>1. Fees once paid are not refundable.</p>
                  <p>2. Keep this receipt safe for future reference.</p>
                  <p className="mt-2 text-[10px] italic">This is a computer-generated document.</p>
                </div>
                <div className="text-center">
                  <div className="w-40 border-b border-slate-400 mb-2"></div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
