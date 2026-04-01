import { useState, useEffect } from 'react';
import React from 'react';
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';

export default function AddStudent() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [course, setCourse] = useState('DCA');
  const [address, setAddress] = useState('');
  const [feesTotal, setFeesTotal] = useState('');
  const [feesPaid, setFeesPaid] = useState('');
  const [batch, setBatch] = useState('A');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [newStudentId, setNewStudentId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLatestRollNo = async () => {
      try {
        const q = query(collection(db, 'students'), orderBy('rollNo', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const lastRollNo = querySnapshot.docs[0].data().rollNo;
          console.log("Last roll number found:", lastRollNo);
          const nextNumber = parseInt(lastRollNo, 10) + 1;
          if (isNaN(nextNumber)) {
            console.error("Failed to parse last roll number, defaulting to 001");
            setRollNo('001');
          } else {
            const nextRollNo = nextNumber.toString().padStart(3, '0');
            console.log("Next roll number generated:", nextRollNo);
            setRollNo(nextRollNo);
          }
        } else {
          console.log("No students found, starting with 001");
          setRollNo('001');
        }
      } catch (err) {
        console.error("Error fetching roll number:", err);
        setRollNo('001'); // Fallback
      }
    };

    fetchLatestRollNo();
  }, []);

  const compressImageToBase64 = (file: File): Promise<string> => {
    console.log("Starting compression for Base64:", file.name, "size:", (file.size / 1024).toFixed(2), "KB");
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error("Compression timed out after 30 seconds");
        reject(new Error("Image compression timed out. The file might be too large or the device is busy. Please try a smaller image or refresh."));
      }, 30000);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        console.log("File read as DataURL for compression");
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          console.log("Image loaded for compression, dimensions:", img.width, "x", img.height);
          const canvas = document.createElement('canvas');
          // Keep dimensions small to ensure the Base64 string fits in Firestore (1MB limit)
          const MAX_WIDTH = 300; 
          const MAX_HEIGHT = 300; 
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          console.log("Drawing image to canvas and converting to Base64...");
          const base64String = canvas.toDataURL('image/jpeg', 0.6); // 0.6 quality for good compression
          clearTimeout(timeout);
          console.log("Base64 conversion successful, approximate size:", (base64String.length / 1024).toFixed(2), "KB");
          resolve(base64String);
        };
        img.onerror = (err) => {
          clearTimeout(timeout);
          console.error("Image load error during compression:", err);
          reject(new Error("Failed to load image for compression. The file might not be a valid image."));
        };
      };
      reader.onerror = (err) => {
        clearTimeout(timeout);
        console.error("FileReader error during compression:", err);
        reject(new Error("Failed to read file for compression."));
      };
    });
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Starting student registration...");
    
    if (!name.trim()) {
      setError("Please enter student name.");
      return;
    }

    if (!auth.currentUser) {
      setError("You must be logged in to add a student.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    setUploadProgress(0);
    
    try {
      if (!rollNo) {
        console.error("Roll number missing");
        throw new Error("Roll number not generated yet. Please refresh the page.");
      }

      console.log("Current Auth User:", auth.currentUser?.uid);
      
      let photoURL = '';
      if (photo) {
        setIsCompressing(true);
        console.log("Photo processing starting. Auth UID:", auth.currentUser?.uid);
        console.log("Photo selected:", photo.name, "type:", photo.type, "original size:", (photo.size / 1024).toFixed(2), "KB");
        
        try {
          // Compress image and get Base64 string directly
          photoURL = await compressImageToBase64(photo);
          console.log("Photo successfully converted to Base64.");
        } catch (compressErr: any) {
          console.error("Compression error:", compressErr);
          throw new Error("Failed to process the image. Please try another photo.");
        } finally {
          setIsCompressing(false);
        }
      } else {
        console.log("No photo provided, skipping upload.");
      }

      console.log("Preparing student data for Firestore...");
      const studentData = {
        name: name.trim(),
        phone: phone.trim(),
        rollNo,
        course,
        batch,
        address: address.trim(),
        photoURL, // This is now a Base64 string or empty
        feesPaid: Number(feesPaid) || 0,
        feesTotal: Number(feesTotal) || 0,
        createdAt: serverTimestamp(),
        adminUid: auth.currentUser.uid,
      };
      
      console.log("Student data to be added:");
      // Don't log the full Base64 string in console.table to avoid clutter
      console.table({ ...studentData, photoURL: photoURL ? '[BASE64_IMAGE_DATA]' : '' });
      
      console.log("Adding document to Firestore collection 'students'...");
      
      // Add a timeout for the Firestore operation
      const addDocPromise = addDoc(collection(db, 'students'), studentData);
      const dbTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database operation timed out. Your student might have been added, but we couldn't confirm. Please check the list.")), 45000)
      );

      const docRef = await Promise.race([addDocPromise, dbTimeoutPromise]) as any;
      console.log("Student added successfully with ID:", docRef.id);
      
      setNewStudentId(docRef.id);
      setSuccess(true);
      // Removed automatic redirect to allow user to print documents
    } catch (err: any) {
      console.error("Caught error in handleAddStudent:", err);
      
      let errorMessage = "An unexpected error occurred.";
      
      if (err.code === 'permission-denied') {
        errorMessage = "Database Permission Denied: You don't have permission to save student data.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <div className="p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Add New Student</h1>
            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full uppercase tracking-wider">
              Registration
            </span>
          </div>
          
          {error && (
            <div className="p-4 mb-6 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Registration Successful!</h2>
                <p className="text-slate-500 mb-8 font-medium">Student <strong>{name}</strong> has been registered with Roll No: <strong>{rollNo}</strong></p>
                
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => navigate(`/admin/documents/${newStudentId}?type=id-card&print=true`)}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9z" clipRule="evenodd" />
                    </svg>
                    Print ID Card
                  </button>
                  <button 
                    onClick={() => navigate(`/admin/documents/${newStudentId}?type=admission-form&print=true`)}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    Print Admission Form
                  </button>
                  <button 
                    onClick={() => navigate('/admin/student-list')}
                    className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Go to Student List
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleAddStudent} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Roll Number */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Roll Number</label>
                <input 
                  type="text" 
                  value={rollNo} 
                  readOnly 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-mono focus:outline-none" 
                />
                <p className="mt-1 text-[10px] text-slate-400">Auto-generated based on last entry</p>
              </div>

              {/* Course */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Course</label>
                <select 
                  value={course} 
                  onChange={(e) => setCourse(e.target.value)} 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="DCA">DCA</option>
                  <option value="CCC">CCC</option>
                  <option value="DICA">DICA</option>
                </select>
              </div>

              {/* Batch */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Batch</label>
                <select 
                  value={batch} 
                  onChange={(e) => setBatch(e.target.value)} 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="A">Batch A</option>
                  <option value="B">Batch B</option>
                  <option value="C">Batch C</option>
                  <option value="D">Batch D</option>
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Student Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Enter full name" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                  required 
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="Enter mobile number" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                />
              </div>

              {/* Fees Total */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Total Fees (₹)</label>
                <input 
                  type="number" 
                  value={feesTotal} 
                  onChange={(e) => setFeesTotal(e.target.value)} 
                  placeholder="e.g. 5000" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                />
              </div>

              {/* Fees Paid */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Advance Paid (₹)</label>
                <input 
                  type="number" 
                  value={feesPaid} 
                  onChange={(e) => setFeesPaid(e.target.value)} 
                  placeholder="e.g. 1000" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Address</label>
              <textarea 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                placeholder="Enter complete address" 
                rows={3}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none" 
              />
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Student Photo</label>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* Preview Area */}
                <div className="w-32 h-32 flex-shrink-0 bg-slate-100 rounded-xl border-2 border-slate-200 overflow-hidden flex items-center justify-center relative group">
                  {photoPreview ? (
                    <>
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <div className="text-slate-400 flex flex-col items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[10px] font-bold uppercase">No Photo</span>
                    </div>
                  )}
                </div>

                <div className="flex-grow w-full">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                        <p className="mb-2 text-sm text-slate-500">
                          <span className="font-semibold">{photo ? photo.name : 'Click to upload'}</span> or drag and drop
                        </p>
                        <p className="text-xs text-slate-400">PNG, JPG or JPEG (MAX. 2MB)</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files ? e.target.files[0] : null;
                          if (file) {
                            console.log("File selected:", file.name, "size:", (file.size / 1024 / 1024).toFixed(2), "MB");
                            if (file.size > 5 * 1024 * 1024) { // 5MB limit for selection
                              setError("File is too large. Please select an image smaller than 5MB.");
                              setPhoto(null);
                              setPhotoPreview(null);
                              return;
                            }
                            setError("");
                            setPhoto(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setPhotoPreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          } else {
                            setPhoto(null);
                            setPhotoPreview(null);
                          }
                        }} 
                      />
                    </label>
                  </div>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-3">
                      <div 
                        className="bg-blue-600 h-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={loading}
                className={`w-full p-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700 active:scale-[0.98]'}`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isCompressing ? 'Compressing Photo...' : 'Processing...'}
                  </>
                ) : (
                  'Register Student'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
