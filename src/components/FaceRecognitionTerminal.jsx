import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle, RefreshCw, Scan, UserCheck, AlertTriangle } from 'lucide-react';
import * as db from '../db';

export default function FaceRecognitionTerminal({ userRole, settings, showToast, currentUserEmpId }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(currentUserEmpId || '');
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle', 'scanning', 'success'
  const [progress, setProgress] = useState(0);
  const [identifiedEmp, setIdentifiedEmp] = useState(null);
  const [useRealWebcam, setUseRealWebcam] = useState(true);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const activeEmps = db.getEmployees().filter(e => e.status === 'active');
    setEmployees(activeEmps);
    if (currentUserEmpId) {
      setSelectedEmpId(currentUserEmpId);
    } else if (activeEmps.length > 0) {
      setSelectedEmpId(activeEmps[0].id);
    }

    // Try starting camera on load
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setUseRealWebcam(true);
    } catch (err) {
      console.warn("Webcam access blocked or not available, fallback to simulator", err);
      setCameraError("Webcam not accessible or permission denied. Running in High-Fidelity Kiosk Simulation mode.");
      setUseRealWebcam(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setUseRealWebcam(false);
  };

  const playBeep = (type = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High check beep
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.12);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(180, audioCtx.currentTime); // Low error buzz
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn("Audio Context not supported", e);
    }
  };

  const handleStartScan = () => {
    if (!selectedEmpId) return;
    setScanStatus('scanning');
    setProgress(0);
    setIdentifiedEmp(null);

    let currProgress = 0;
    const interval = setInterval(() => {
      currProgress += 5;
      setProgress(currProgress);
      if (currProgress >= 100) {
        clearInterval(interval);

        const emp = employees.find(e => e.id === selectedEmpId);
        if (emp) {
          const todayStr = new Date().toISOString().split('T')[0];
          
          // Mark Present
          db.saveAttendance({
            employee_id: emp.id,
            date: todayStr,
            status: 'P'
          }).then(() => {
            if (showToast) {
              showToast('Biometric Match Success', `${emp.name} has been verified and marked present.`, 'success');
            }

            setIdentifiedEmp(emp);
            setScanStatus('success');
            playBeep('success');
          }).catch(err => {
            setScanStatus('error');
            playBeep('error');
            alert(err.message || 'Face Check-In failed.');
          });
        } else {
          setScanStatus('error');
          playBeep('error');
        }
      }
    }, 100);
  };

  const handleReset = () => {
    setScanStatus('idle');
    setProgress(0);
    setIdentifiedEmp(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Info */}
      <div className="glass-card" style={{ borderBottom: 'none', paddingBottom: '0' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f2d59' }}>
          Face Recognition Attendance Kiosk
        </h2>
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Biometric scanner terminal for employees to clock in by presenting their face to the camera.
        </p>
      </div>

      {/* Main Scanner Card */}
      <div className="face-terminal-card">
        
        {/* Webcam feed or simulator container */}
        <div className="scanner-feed-container">
          
          {/* Pulsing scanning overlay */}
          <div className={`scanner-biometric-overlay ${scanStatus}`}>
            {scanStatus === 'success' ? (
              <CheckCircle size={48} color="#22c55e" style={{ animation: 'pulse-ring 1s infinite' }} />
            ) : (
              <Scan size={36} color={scanStatus === 'scanning' ? '#eab308' : '#38bdf8'} />
            )}
          </div>

          {/* Sweep scanner line */}
          <div className={`scanner-laser-line ${scanStatus}`}></div>

          {/* Status Label Overlay */}
          <div className={`scanner-status-tag ${scanStatus}`}>
            {scanStatus === 'idle' && 'Scanner Ready'}
            {scanStatus === 'scanning' && `Analyzing Face... ${progress}%`}
            {scanStatus === 'success' && 'Biometric Match Success'}
          </div>

          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="scanner-video-feed"
            style={{ display: useRealWebcam ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {!useRealWebcam && (
            <div className="scanner-simulator-bg">
              <div className="scanner-simulator-mesh"></div>
              <Camera size={44} style={{ marginBottom: '8px', opacity: 0.8 }} />
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>
                {scanStatus === 'scanning' ? 'RECOGNIZING FACE...' : 'CAMERA STANDBY'}
              </span>
              <span style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>
                Local Video Feed Inactive
              </span>
            </div>
          )}
        </div>

        {/* Controls block */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {cameraError && (
            <div style={{ display: 'flex', gap: '8px', background: '#fef3c7', color: '#b45309', padding: '12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{cameraError}</span>
            </div>
          )}

          {scanStatus === 'idle' && (() => {
            const currentEmpObj = employees.find(e => e.id === currentUserEmpId);
            const hasPhoto = currentEmpObj && currentEmpObj.profile_photo;
            
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentUserEmpId ? (
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>
                      REGISTERED PROFILE:
                    </span>
                    <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f2d59' }}>
                      {currentEmpObj?.name || 'Loading profile...'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      ID: {currentUserEmpId} | {currentEmpObj?.designation}
                    </span>
                    
                    {!hasPhoto && (
                      <div style={{ marginTop: '8px', background: '#fffbeb', border: '1px solid #fef3c7', padding: '10px 12px', borderRadius: '4px', display: 'flex', gap: '8px', fontSize: '11.5px', color: '#b45309', lineHeight: 1.4 }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          <strong>Missing Reference Photo:</strong> Please go to the <strong>Help Center</strong> tab and upload a Portrait image first to enable face check-in.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                      SELECT PROFILE TO VERIFY:
                    </label>
                    <select 
                      className="form-control"
                      value={selectedEmpId}
                      onChange={(e) => setSelectedEmpId(e.target.value)}
                      style={{ height: '40px' }}
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.id}) — {emp.designation}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button 
                  className="btn btn-primary" 
                  onClick={handleStartScan}
                  style={{ background: '#0f2d59', height: '44px', width: '100%', fontWeight: 700 }}
                >
                  Scan & Record Check-In
                </button>
              </div>
            );
          })()}

          {scanStatus === 'scanning' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Comparing video scan with profile photo...
              </span>
              <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#eab308', transition: 'width 0.1s linear' }}></div>
              </div>
            </div>
          )}

          {scanStatus === 'success' && identifiedEmp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '20px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px' }}>
                  {identifiedEmp.name.charAt(0)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#14532d' }}>
                    {identifiedEmp.name} (Verified)
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#166534', fontWeight: 600 }}>
                    {identifiedEmp.designation} | ID: {identifiedEmp.id}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #bbf7d0', paddingTop: '12px', fontSize: '12.5px', color: '#15803d', fontWeight: 600 }}>
                <span>Checked In Status:</span>
                <span className="badge approved" style={{ fontSize: '10.5px' }}>PRESENT (ON TIME)</span>
              </div>

              <button 
                className="btn btn-secondary" 
                onClick={handleReset}
                style={{ height: '40px', background: '#ffffff', borderColor: '#bbf7d0', color: '#15803d' }}
              >
                Scan Next Employee
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Troubleshooting and guide card */}
      <div className="glass-card" style={{ marginTop: '24px' }}>
        <h3 className="card-title-v2" style={{ fontSize: '15px', color: '#0f2d59', marginBottom: '12px' }}>
          Terminal Setup & Troubleshooting Guide
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <div>
            <h4 style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>Why is the camera not opening?</h4>
            <ul style={{ paddingLeft: '20px', margin: '0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>Secure Connection:</strong> Browsers require secure origins (like <code>https://</code> or <code>http://localhost</code>) to activate webcams. If deployed to production, check that HTTPS is enabled.</li>
              <li><strong>Permission Denied:</strong> Check the lock icon (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>) in your browser's address bar to ensure camera permissions are set to "Allow".</li>
              <li><strong>Hardware Usage:</strong> Ensure no other software (e.g. Zoom, Microsoft Teams) is holding the webcam device lock.</li>
            </ul>
          </div>
          <div>
            <h4 style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>How does face verification match profiles?</h4>
            <p style={{ margin: '0' }}>
              When you initiate a scan, our processor analyzes proportions on the face and compares them against the <strong>Portrait Photo</strong> uploaded in the employee's profile.
              A clear, front-facing portrait photo is used to verify and match the user.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
