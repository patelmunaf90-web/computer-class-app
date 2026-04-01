import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export default function PrintStudentReport() {
  const { id } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [instituteSettings, setInstituteSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const studentDoc = await getDoc(doc(db, 'students', id));
        if (studentDoc.exists()) {
          setStudent(studentDoc.data());
        }

        const paymentsQuery = query(collection(db, 'payments'), where('studentId', '==', id));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        setPayments(paymentsSnapshot.docs.map(doc => doc.data()));

        const settingsDoc = await getDoc(doc(db, 'settings', 'institute'));
        if (settingsDoc.exists()) {
          setInstituteSettings(settingsDoc.data());
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!loading && student) {
      const timer = setTimeout(() => {
        window.print();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, student]);

  if (loading) return <div className="p-8 text-center">Loading report...</div>;
  if (!student) return <div className="p-8 text-center text-red-500">Student not found.</div>;

  return (
    <div className="bg-white p-8 min-h-screen">
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

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Personal Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-slate-500">Name:</span>
              <span className="font-bold text-slate-900">{student.name}</span>
              <span className="text-slate-500">Roll No:</span>
              <span className="font-bold text-slate-900">{student.rollNo}</span>
              <span className="text-slate-500">Course:</span>
              <span className="font-bold text-slate-900">{student.course}</span>
              <span className="text-slate-500">Phone:</span>
              <span className="font-bold text-slate-900">{student.phone}</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Fee Summary</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-slate-500">Total Fees:</span>
              <span className="font-bold text-slate-900">₹{student.feesTotal.toLocaleString()}</span>
              <span className="text-slate-500">Paid Amount:</span>
              <span className="font-bold text-green-600">₹{student.feesPaid.toLocaleString()}</span>
              <span className="text-slate-500">Balance:</span>
              <span className="font-bold text-red-600">₹{(student.feesTotal - student.feesPaid).toLocaleString()}</span>
              <span className="text-slate-500">Status:</span>
              <span className={`font-bold ${student.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                {student.status.toUpperCase()}
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
              {payments.length > 0 ? payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p, i) => (
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
  );
}
