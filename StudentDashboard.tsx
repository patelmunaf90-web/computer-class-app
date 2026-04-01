import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';
import AdminLayout from '../components/AdminLayout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  course: string;
  amount: number;
  receiptNo: string;
  date: string;
  timestamp: any;
}

export default function Transactions() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [newAmount, setNewAmount] = useState<number>(0);
  const [confirmingDelete, setConfirmingDelete] = useState<Payment | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'payments'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsData: Payment[] = [];
      const monthsSet = new Set<string>();

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<Payment, 'id'>;
        paymentsData.push({ id: doc.id, ...data });
        
        const date = new Date(data.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthsSet.add(monthYear);
      });

      setPayments(paymentsData);
      
      const sortedMonths = Array.from(monthsSet).sort().reverse();
      setAvailableMonths(sortedMonths);
      
      if (sortedMonths.length > 0 && !selectedMonth) {
        setSelectedMonth(sortedMonths[0]);
      }
      
      setLoading(false);
    }, (error) => {
      console.error("Error fetching payments:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedMonth]);

  const handleFirestoreError = (error: unknown, operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write', path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path,
      authInfo: {
        userId: auth.currentUser?.uid || '',
        email: auth.currentUser?.email || '',
        emailVerified: auth.currentUser?.emailVerified || false,
        isAnonymous: auth.currentUser?.isAnonymous || false,
        tenantId: auth.currentUser?.tenantId || '',
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName || '',
          email: provider.email || '',
          photoUrl: provider.photoURL || ''
        })) || []
      }
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setActionError(error instanceof Error ? error.message : 'An error occurred with Firestore');
  };

  const handleDelete = (payment: Payment) => {
    setConfirmingDelete(payment);
  };

  const confirmDelete = async () => {
    if (!confirmingDelete) return;
    
    setIsProcessing(true);
    setActionError('');
    setActionSuccess('');

    try {
      if (!confirmingDelete.studentId) {
        throw new Error('Student ID is missing from this transaction.');
      }
      
      await deleteDoc(doc(db, 'payments', confirmingDelete.id)).catch(e => handleFirestoreError(e, 'delete', 'payments/' + confirmingDelete.id));
      
      const studentRef = doc(db, 'students', confirmingDelete.studentId);
      await updateDoc(studentRef, {
        feesPaid: increment(-confirmingDelete.amount)
      }).catch(e => handleFirestoreError(e, 'update', 'students/' + confirmingDelete.studentId));
      
      setActionSuccess('Transaction deleted successfully');
      setConfirmingDelete(null);
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setNewAmount(payment.amount);
  };

  const saveEdit = async () => {
    if (!editingPayment) return;
    
    setIsProcessing(true);
    setActionError('');
    setActionSuccess('');

    try {
      const oldAmount = editingPayment.amount;
      const diff = newAmount - oldAmount;

      await updateDoc(doc(db, 'payments', editingPayment.id), {
        amount: newAmount
      }).catch(e => handleFirestoreError(e, 'update', 'payments/' + editingPayment.id));

      const studentRef = doc(db, 'students', editingPayment.studentId);
      await updateDoc(studentRef, {
        feesPaid: increment(diff)
      }).catch(e => handleFirestoreError(e, 'update', 'students/' + editingPayment.studentId));

      setEditingPayment(null);
      setActionSuccess('Transaction updated successfully');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating transaction:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatMonthDisplay = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const filteredPayments = payments.filter(p => {
    if (!selectedMonth) return true;
    const date = new Date(p.date);
    const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return monthYear === selectedMonth;
  });

  const totalRevenue = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const chartData = availableMonths.slice(0, 6).reverse().map(monthStr => {
    const monthPayments = payments.filter(p => {
      const date = new Date(p.date);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === monthStr;
    });
    return {
      name: formatMonthDisplay(monthStr).split(' ')[0],
      revenue: monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
    };
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Revenue & Transactions</h1>
            <p className="text-slate-500 mt-1">Track monthly fee collections and payment history</p>
          </div>
          <div className="flex items-center gap-3">
            {actionError && (
              <div className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 animate-fade-in">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-sm font-medium border border-green-100 animate-fade-in">
                {actionSuccess}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total Revenue</h3>
            <p className="text-slate-500 text-sm mb-1">For {formatMonthDisplay(selectedMonth)}</p>
            <p className="text-5xl font-black text-green-600">₹{totalRevenue.toLocaleString()}</p>
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-sm text-slate-600">
                <span className="font-bold text-slate-900">{filteredPayments.length}</span> transactions recorded this month.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Revenue Trend (Last 6 Months)</h3>
            <div className="h-64 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `₹${value}`} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Not enough data for chart
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800">Transaction History</h2>
            
            <div className="flex items-center gap-2">
              <label htmlFor="month-filter" className="text-sm font-medium text-slate-600">Filter by Month:</label>
              <select
                id="month-filter"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableMonths.length === 0 && <option value="">No data available</option>}
                {availableMonths.map(month => (
                  <option key={month} value={month}>
                    {formatMonthDisplay(month)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-600 text-sm">Date</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm">Receipt No</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm">Student Name</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm">Course</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm text-right">Amount</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No transactions found for {formatMonthDisplay(selectedMonth)}.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-sm text-slate-600">
                        {new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-4 text-sm font-mono text-slate-500">
                        {payment.receiptNo}
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-slate-900">{payment.studentName}</p>
                        <p className="text-xs text-slate-500">Roll: {payment.rollNo || 'N/A'}</p>
                      </td>
                      <td className="p-4 text-sm text-slate-600">
                        {payment.course}
                      </td>
                      <td className="p-4 text-right font-bold text-green-600">
                        ₹{payment.amount.toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleEdit(payment)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                          <button onClick={() => handleDelete(payment)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingPayment && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Edit Transaction</h2>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Amount (₹)</label>
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditingPayment(null)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button 
                onClick={saveEdit} 
                disabled={isProcessing}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                {isProcessing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Transaction?</h2>
            <p className="text-slate-500 text-sm mb-6">
              Are you sure you want to delete the payment of <span className="font-bold text-slate-700">₹{confirmingDelete.amount.toLocaleString()}</span> for <span className="font-bold text-slate-700">{confirmingDelete.studentName}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmingDelete(null)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
              <button 
                onClick={confirmDelete} 
                disabled={isProcessing}
                className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50"
              >
                {isProcessing ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
