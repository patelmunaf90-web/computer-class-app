import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import AddStudent from './pages/AddStudent';
import StudentList from './pages/StudentList';
import Fees from './pages/Fees';
import Transactions from './pages/Transactions';
import InstituteSettings from './pages/InstituteSettings';
import StudentDashboard from './pages/StudentDashboard';
import Certificates from './pages/Certificates';
import StudentDocuments from './pages/StudentDocuments';
import DocumentCenter from './pages/DocumentCenter';
import PrintReceipt from './pages/PrintReceipt';
import PrintCertificate from './pages/PrintCertificate';
import PrintStudentReport from './pages/PrintStudentReport';
import PrintAll from './pages/PrintAll';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/add-student" element={<AddStudent />} />
          <Route path="/admin/student-list" element={<StudentList />} />
          <Route path="/admin/fees" element={<Fees />} />
          <Route path="/admin/transactions" element={<Transactions />} />
          <Route path="/admin/certificates" element={<Certificates />} />
          <Route path="/admin/document-center" element={<DocumentCenter />} />
          <Route path="/admin/documents/:id" element={<StudentDocuments />} />
          <Route path="/admin/print-receipt/:id" element={<PrintReceipt />} />
          <Route path="/admin/print-certificate/:id" element={<PrintCertificate />} />
          <Route path="/admin/print-report/:id" element={<PrintStudentReport />} />
          <Route path="/admin/print-all/:id" element={<PrintAll />} />
          <Route path="/admin/settings" element={<InstituteSettings />} />
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
