import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function PrintCertificate() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const course = searchParams.get('course') || '';
  const grade = searchParams.get('grade') || '';
  const issueDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
  
  const [student, setStudent] = useState<any>(null);
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

  if (loading) return <div className="p-8 text-center">Loading certificate...</div>;
  if (!student) return <div className="p-8 text-center text-red-500">Student not found.</div>;

  const logoUrl = instituteSettings?.logoUrl || 'https://picsum.photos/seed/logo/200/200';
  const instituteName = instituteSettings?.name || "IKHAR COMPUTER ACADEMY";
  const instituteAddress = instituteSettings?.address || "123 Tech Street, Computer City";

  return (
    <div className="bg-white min-h-screen flex items-center justify-center p-0 m-0">
      <div className="w-[297mm] h-[210mm] bg-white p-12 relative overflow-hidden flex flex-col border-[16px] border-double border-slate-800">
        {/* Background Patterns */}
        <div className="absolute top-0 left-0 w-64 h-64 border-t-[40px] border-l-[40px] border-slate-200 opacity-50"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 border-b-[40px] border-r-[40px] border-slate-200 opacity-50"></div>
        
        {/* Corner Accents */}
        <div className="absolute top-8 left-8 w-16 h-16 border-t-4 border-l-4 border-slate-800"></div>
        <div className="absolute top-8 right-8 w-16 h-16 border-t-4 border-r-4 border-slate-800"></div>
        <div className="absolute bottom-8 left-8 w-16 h-16 border-b-4 border-l-4 border-slate-800"></div>
        <div className="absolute bottom-8 right-8 w-16 h-16 border-b-4 border-r-4 border-slate-800"></div>

        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none rotate-[-30deg]">
          <span className="text-[200px] font-black tracking-tighter">ICA</span>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-8 z-10">
          <img src={logoUrl} alt="Logo" className="w-24 h-24 object-contain" referrerPolicy="no-referrer" />
          <div className="text-right">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{instituteName}</h1>
            <p className="text-slate-500 text-sm font-medium">{instituteAddress}</p>
            <p className="text-slate-500 text-xs font-bold mt-1">Reg No: ICA/2024/001</p>
          </div>
        </div>
        
        {/* Certificate Body */}
        <div className="flex-grow flex flex-col items-center justify-center text-center z-10">
          <h1 className="font-serif text-[54px] font-bold text-slate-800 mb-1 tracking-wider" style={{ fontFamily: "'Playfair Display', serif" }}>Certificate of Excellence</h1>
          <p className="text-lg text-[#d4af37] uppercase tracking-[10px] font-bold mb-8">This is to certify that</p>
          
          <h2 className="font-cursive text-[64px] text-slate-800 mb-4 border-b-2 border-slate-200 inline-block min-w-[400px]" style={{ fontFamily: "'Great Vibes', cursive" }}>{student.name}</h2>
          
          <p className="text-lg text-slate-600 mb-2">has successfully completed the professional course in</p>
          <h3 className="font-sans font-bold text-[28px] text-blue-600 mb-4">{course}</h3>
          
          <p className="text-lg text-slate-600 mb-6">conducted by Ikhar Computer Academy.</p>
          
          <div className="mt-4 px-8 py-2 border-2 border-slate-800 inline-block font-bold text-xl">
            GRADE: {grade}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end mt-10 px-10 z-10">
          <div className="text-center">
            <div className="w-[200px] border-t-2 border-slate-800 mb-1"></div>
            <p className="text-xs font-bold uppercase text-slate-800">Director Signature</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800 mb-2">{new Date(issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <div className="w-[200px] border-t-2 border-slate-800 mb-1"></div>
            <p className="text-xs font-bold uppercase text-slate-800">Date of Issue</p>
          </div>
        </div>
      </div>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:wght@700&display=swap');
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4 landscape; margin: 0; }
        }
      `}</style>
    </div>
  );
}
