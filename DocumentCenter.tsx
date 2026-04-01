import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { printElement } from '../lib/PrintService';
import { IDCard, AdmissionForm } from '../components/PrintableDocuments';

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
  createdAt?: any;
}

export default function StudentDocuments() {
  const { id } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [instituteSettings, setInstituteSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<'id-card' | 'admission-form' | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const studentDoc = await getDoc(doc(db, 'students', id));
        if (studentDoc.exists()) {
          setStudent({ id: studentDoc.id, ...studentDoc.data() } as Student);
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

  return (
    <div className="p-8">
      {loading ? (
        <div>Loading...</div>
      ) : student ? (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Student Documents</h1>
          <div className="space-x-4">
            <button 
              onClick={() => setViewType('id-card')}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Print ID Card
            </button>
            <button 
              onClick={() => setViewType('admission-form')}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Print Admission Form
            </button>
          </div>
          {viewType && (
            <div className="space-y-4 mt-8">
              <button 
                onClick={() => printElement(printRef.current!, viewType === 'id-card' ? 'Student ID Card' : 'Admission Form')}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Print Now
              </button>
              <div ref={printRef} className="flex justify-center">
                {viewType === 'id-card' ? (
                  <IDCard student={student} instituteSettings={instituteSettings} />
                ) : (
                  <AdmissionForm student={student} instituteSettings={instituteSettings} />
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>Student not found</div>
      )}
    </div>
  );
}
