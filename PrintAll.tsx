import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface ReceiptData {
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

export default function PrintReceipt() {
  const { id } = useParams(); // This could be paymentId or studentId
  const [searchParams] = useSearchParams();
  const isStatusReport = searchParams.get('type') === 'status';
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [instituteSettings, setInstituteSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        // Fetch Institute Settings
        const settingsDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (settingsDoc.exists()) {
          setInstituteSettings(settingsDoc.data());
        }

        if (isStatusReport) {
          // Fetch Student for Status Report
          const studentDoc = await getDoc(doc(db, 'students', id));
          if (studentDoc.exists()) {
            const student = studentDoc.data();
            setReceiptData({
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
              receiptNo: `STAT-${id.slice(-6)}`,
              isStatusReport: true
            });
          }
        } else {
          // Fetch Payment for Receipt
          const paymentDoc = await getDoc(doc(db, 'payments', id));
          if (paymentDoc.exists()) {
            const payment = paymentDoc.data();
            setReceiptData({
              studentName: payment.studentName,
              rollNo: payment.rollNo,
              course: payment.course,
              phone: payment.phone || 'N/A',
              amountPaid: payment.amount,
              date: new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
              totalFees: 0, // We might need to fetch student for this, but for receipt it's okay
              previousPaid: 0,
              newTotalPaid: 0,
              balance: 0,
              receiptNo: payment.receiptNo
            });
          }
        }
      } catch (error) {
        console.error("Error fetching receipt data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isStatusReport]);

  useEffect(() => {
    if (!loading && receiptData) {
      const timer = setTimeout(() => {
        window.print();
        // Close the tab after printing (optional, but might be annoying if they want to save as PDF)
        // window.close(); 
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, receiptData]);

  if (loading) return <div className="p-8 text-center">Loading receipt...</div>;
  if (!receiptData) return <div className="p-8 text-center text-red-500">Receipt not found.</div>;

  return (
    <div className="bg-white p-8 min-h-screen">
      <div className="max-w-3xl mx-auto border border-slate-200 p-8 rounded-xl relative overflow-hidden">
        {/* Decorative top border */}
        <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
        
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
            <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-700 font-bold uppercase tracking-widest rounded-lg mb-2 border border-blue-100 text-sm">
              {receiptData.isStatusReport ? 'FEE STATUS' : 'RECEIPT'}
            </div>
            <p className="text-sm text-slate-500">Receipt No: <span className="font-bold text-slate-900">{receiptData.receiptNo}</span></p>
            <p className="text-sm text-slate-500">Date: <span className="font-bold text-slate-900">{receiptData.date}</span></p>
          </div>
        </div>

        {/* Student Details */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
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
            <tr className="bg-slate-100">
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
          <div className="w-72 bg-slate-50 p-4 rounded-lg border border-slate-200">
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
            
            <div className="flex justify-between text-base pt-1.5">
              <span className="font-bold text-slate-900">Balance Due:</span>
              <span className="font-black text-red-600">₹{receiptData.balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end pt-12">
          <div className="text-center">
            <div className="w-32 border-b border-slate-300 mb-1"></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Student Signature</p>
          </div>
          <div className="text-center">
            <div className="w-32 border-b border-slate-300 mb-1"></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Authorized Signatory</p>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">This is a computer generated receipt and does not require a physical signature.</p>
        </div>
      </div>
    </div>
  );
}
