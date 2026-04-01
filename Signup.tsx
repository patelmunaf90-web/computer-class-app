import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  React.useEffect(() => {
    console.log("AdminLayout Auth Check:", { loading, user: user?.email, pathname: window.location.pathname });
    
    // Only redirect if we are sure the user is not logged in and loading is finished
    if (!loading && !user) {
      const publicPaths = ['/login', '/signup', '/'];
      if (!publicPaths.includes(window.location.pathname)) {
        console.log("No user found on protected route, redirecting to login...");
        navigate('/login');
      }
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      try {
        await signOut(auth);
        navigate('/login');
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Checking authentication...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-gray-100 print:bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:block print:hidden">
        <h2 className="text-2xl font-bold mb-8 italic">Institute Admin</h2>
        <nav className="space-y-4">
          <Link to="/admin" className="block hover:text-blue-400 transition-colors">Dashboard</Link>
          <Link to="/admin/add-student" className="block hover:text-blue-400 transition-colors">Add Student</Link>
          <Link to="/admin/student-list" className="block hover:text-blue-400 transition-colors">Student List</Link>
          <Link to="/admin/fees" className="block hover:text-blue-400 transition-colors">Fee Management</Link>
          <Link to="/admin/transactions" className="block hover:text-blue-400 transition-colors">Transactions & Revenue</Link>
          <Link to="/admin/document-center" className="block hover:text-blue-400 transition-colors font-bold text-blue-400">Document Center</Link>
          <Link to="/admin/settings" className="block hover:text-blue-400 transition-colors">Institute Settings</Link>
          <button onClick={handleLogout} className="block text-left w-full hover:text-red-400 transition-colors">Logout</button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col print:block">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center md:hidden print:hidden">
          <h2 className="text-xl font-bold">Institute Admin</h2>
          <button onClick={handleLogout} className="text-red-500 font-medium">Logout</button>
        </header>
        <div className="p-4 md:p-8 print:p-0">
          {children}
        </div>
      </main>
    </div>
  );
}
