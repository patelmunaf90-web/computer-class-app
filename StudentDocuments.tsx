import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import AdminLayout from '../components/AdminLayout';
import { Link } from 'react-router-dom';

interface Student {
  id: string;
  name: string;
  rollNo: string;
  course: string;
  photoURL?: string;
}

export default function AdminDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [courseStats, setCourseStats] = useState({ DCA: 0, CCC: 0, DICA: 0 });
  const [totalFeesExpected, setTotalFeesExpected] = useState(0);
  const [totalFeesCollected, setTotalFeesCollected] = useState(0);
  const [instituteSettings, setInstituteSettings] = useState<any>(null);

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
        ...doc.data()
      })) as any[];
      
      setStudents(studentData.slice(0, 5)); // Show only 5 recent students
      setTotalStudents(studentData.length);

      const stats = { DCA: 0, CCC: 0, DICA: 0 };
      let expected = 0;
      let collected = 0;

      studentData.forEach(s => {
        if (s.course === 'DCA') stats.DCA++;
        else if (s.course === 'CCC') stats.CCC++;
        else if (s.course === 'DICA') stats.DICA++;

        expected += Number(s.feesTotal) || 0;
        collected += Number(s.feesPaid) || 0;
      });

      setCourseStats(stats);
      setTotalFeesExpected(expected);
      setTotalFeesCollected(collected);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-4 mb-6">
          {instituteSettings?.logoUrl && (
            <img src={instituteSettings.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-slate-200" />
          )}
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{instituteSettings?.name || 'Dashboard'}</h1>
            <p className="text-slate-500">Overview of your computer institute</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3">
            <Link to="/admin/add-student" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Student
            </Link>
            <Link to="/admin/document-center" className="px-5 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all font-bold shadow-lg shadow-amber-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
              </svg>
              Document Center
            </Link>
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-all">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Students</p>
            <h3 className="text-3xl font-black mt-2 text-slate-900">{totalStudents}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs text-green-600 font-bold">
              <span className="p-1 bg-green-50 rounded-md">↑ Active</span>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-green-200 transition-all relative group">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fees Collected</p>
            <h3 className="text-3xl font-black mt-2 text-green-600">₹{totalFeesCollected.toLocaleString()}</h3>
            <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-green-500 h-full rounded-full" 
                style={{ width: `${Math.min(100, (totalFeesCollected / (totalFeesExpected || 1)) * 100)}%` }}
              ></div>
            </div>
            <Link to="/admin/transactions" className="absolute inset-0 z-10" aria-label="View Transactions"></Link>
            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-orange-200 transition-all">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Fees</p>
            <h3 className="text-3xl font-black mt-2 text-orange-600">₹{(Number(totalFeesExpected) - Number(totalFeesCollected)).toLocaleString()}</h3>
            <p className="mt-4 text-[10px] text-slate-400 font-medium">From {totalStudents} students</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-purple-200 transition-all">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Top Course</p>
            <h3 className="text-3xl font-black mt-2 text-slate-900">
              {Object.entries(courseStats).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0]}
            </h3>
            <p className="mt-4 text-[10px] text-slate-400 font-medium">Most popular choice</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Students */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Recent Admissions</h2>
              <Link to="/admin/student-list" className="text-sm font-bold text-blue-600 hover:text-blue-700">View All</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-widest">
                    <th className="p-4 font-bold">Student</th>
                    <th className="p-4 font-bold">Roll No</th>
                    <th className="p-4 font-bold">Course</th>
                    <th className="p-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {students.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4 flex items-center gap-3">
                        {student.photoURL ? (
                          <img 
                            src={student.photoURL} 
                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm">
                            {(student.name || '?')[0]}
                          </div>
                        )}
                        <span className="font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{student.name}</span>
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-xs font-bold">{student.rollNo}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          {student.course}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-600">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 text-sm">No recent students found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Course Distribution */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Course Distribution</h2>
            <div className="space-y-4">
              {Object.entries(courseStats).map(([course, count]) => (
                <div key={course} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-600">{course}</span>
                    <span className="font-black text-slate-900">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${(Number(count) / (totalStudents || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
