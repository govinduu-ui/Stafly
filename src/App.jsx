import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { 
  Sun, Moon, Bell, Laptop, AlertCircle, RefreshCw, Menu, 
  Users, Calendar, Clock, CreditCard, User, FileText,
  LogOut, ShieldAlert, ArrowRight, X, Eye, EyeOff, RotateCw, Settings, HelpCircle, Camera
} from 'lucide-react';
import * as db from './db';

const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const EmployeeDashboard = lazy(() => import('./components/EmployeeDashboard'));
const FaceRecognitionTerminal = lazy(() => import('./components/FaceRecognitionTerminal'));
const Payslip = lazy(() => import('./components/Payslip'));
const CustomizationPage = lazy(() => import('./components/CustomizationPage'));

export default function App() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  const showToast = (title, message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Auth states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Workspace Settings
  const [settings, setSettings] = useState({
    companyName: 'Staffly',
    currency: '₹',
    overtimeRate: 150,
    subscriptionPlan: 'Pro'
  });

  // Login Form states (Workspace Login Style)
  const [usernameInput, setUsernameInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // CAPTCHA states - initialized with instant random code
  const [captchaCode, setCaptchaCode] = useState(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  });
  const [captchaInput, setCaptchaInput] = useState('');
  
  // Registration Form states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerRole, setRegisterRole] = useState('employee'); // 'employee' or 'admin'
  const [registerForm, setRegisterForm] = useState({
    companyName: '',
    name: '',
    email: '',
    password: '',
    phone: ''
  });

  // Demo Sign-In helper state
  const [selectedDemoEmail, setSelectedDemoEmail] = useState('rahul@staffly.com');

  // Sidebar states
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Drawer / Modal states
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activePayslip, setActivePayslip] = useState(null);

  // Multi-Organization state
  const [userOrgs, setUserOrgs] = useState([]);

  // Initialize DB, Load Session & Settings and Generate CAPTCHA
  useEffect(() => {
    async function init() {
      // 1. If no persistent token exists, show login screen immediately (0ms wait)
      if (!db.getAuthToken()) {
        setDbInitialized(true);
        db.initializeDB(); // prefetch cached workspace settings in background
        return;
      }

      // 2. If token exists, restore active session with timeout guard
      try {
        const [activeUser, orgs] = await Promise.all([
          db.fetchCurrentUser(),
          db.fetchMyOrganizations().catch(() => [])
        ]);

        if (activeUser) {
          setCurrentUser(activeUser);
          setIsLoggedIn(true);
          setUserOrgs(orgs || []);
          setSettings(db.getSettings());
        }
      } catch (err) {
        console.warn('Session restoration note:', err.message);
      } finally {
        setDbInitialized(true);
        // Refresh full workspace datasets in background
        db.initializeDB();
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      db.fetchMyOrganizations().then(orgs => setUserOrgs(orgs || []));
    }
  }, [isLoggedIn, currentUser]);

  const handleSwitchOrg = async (orgId) => {
    try {
      const res = await db.switchOrganization(orgId);
      setCurrentUser(res.user);
      setSettings(db.getSettings());
      showToast('Organization Switched', `Active workspace: ${res.user.organization_name}`);
    } catch (err) {
      alert(err.message || 'Failed to switch organization');
    }
  };

  // Update body class for dark mode
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  // Load notifications for active user
  useEffect(() => {
    let isMounted = true;
    if (currentUser && currentUser.employee_id) {
      db.getNotifications(currentUser.employee_id).then(notifs => {
        if (isMounted) setNotifications(notifs || []);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Generate random 6-character uppercase CAPTCHA code
  const generateCaptcha = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit ambiguous characters like O, 0, I, 1
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setCaptchaInput('');
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    
    // 1. CAPTCHA Validation Check
    if (captchaInput.trim().toUpperCase() !== captchaCode) {
      alert('Invalid CAPTCHA code. Please enter the correct code shown in the image.');
      generateCaptcha();
      return;
    }

    try {
      const res = await db.loginUser(usernameInput, loginPassword);
      setCurrentUser(res.user);
      setIsLoggedIn(true);
      setActiveTab('overview');
      setCaptchaInput('');
      showToast('Login Successful', `Welcome back, ${res.user.name}!`);
    } catch (err) {
      alert(err.message || 'Invalid Username or Password. Please check your credentials.');
      generateCaptcha();
    }
  };

  const handleSocialLogin = async (platform) => {
    try {
      // Perform Google/Social Sign-In with backend PostgreSQL
      const res = await db.googleLoginUser(null, 'admin@staffly.com', 'Owner Admin');
      setCurrentUser(res.user);
      setIsLoggedIn(true);
      setActiveTab('overview');
      showToast('Google Sign-In', `Signed in successfully as ${res.user.name}`);
    } catch (err) {
      alert('Google Sign-In failed: ' + err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      alert('Please fill out all required fields.');
      return;
    }

    if (registerRole === 'admin' && !registerForm.companyName) {
      alert('Please enter your Company Name.');
      return;
    }

    try {
      const res = await db.registerUser(registerForm, registerRole);
      setCurrentUser(res.user);
      setIsLoggedIn(true);
      setActiveTab('overview');
      setShowRegisterModal(false);
      showToast('Registration Complete', `Welcome, ${res.user.name}! Your workspace is ready.`);
    } catch (err) {
      alert(err.message || 'Registration failed.');
    }
  };

  const handleLogout = () => {
    db.setAuthToken(null);
    setIsLoggedIn(false);
    setCurrentUser(null);
    setNotifications([]);
    setUsernameInput('');
    setLoginPassword('');
    setActiveTab('overview');
    generateCaptcha();
  };

  // Sync quick login fields & pre-fill matching CAPTCHA for seamless testing
  const handleQuickLogin = async (usernameVal, passwordVal) => {
    setUsernameInput(usernameVal);
    setLoginPassword(passwordVal);
    setCaptchaInput(captchaCode); // Auto-fill matching CAPTCHA for developer convenience
    
    try {
      const res = await db.loginUser(usernameVal, passwordVal);
      setCurrentUser(res.user);
      setIsLoggedIn(true);
      setActiveTab('overview');
    } catch (err) {
      alert(err.message || 'Login failed.');
    }
  };

  const openRegisterModal = () => {
    setRegisterRole('employee');
    setRegisterForm({
      companyName: '',
      name: '',
      email: '',
      password: '',
      phone: ''
    });
    setShowRegisterModal(true);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    db.saveSettings(settings);
    alert('Workspace settings updated successfully!');
  };

  if (!dbInitialized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '16px', background: '#0f2d59', color: 'white' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: '#ffffff' }} />
        <span>Initializing Staffly Ecosystem...</span>
      </div>
    );
  }

  const unreadNotifications = notifications.filter(n => !n.read).length;

  // LOGIN PAGE RENDERING (Image 1 style)
  if (!isLoggedIn) {
    return (
      <div className="login-wrapper">
        <div className="login-title-section">
          <h1 style={{ color: '#0f2d59', fontWeight: 800 }}>Staffly Payout Hub</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Secure Access Portal</p>
        </div>

        {/* Workspace Login Card */}
        <div className="vtop-login-card">
          <div className="vtop-header" style={{ padding: '32px 32px 0 32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f2d59' }}>Workspace Login</h2>
          </div>
          
          <form onSubmit={handleLogin} className="vtop-body" style={{ padding: '24px 32px 20px 32px' }}>
            
            {/* USERNAME */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '10px', color: '#64748b' }}>USERNAME</label>
              <div className="vtop-input-group">
                <input 
                  type="text" 
                  className="vtop-control"
                  placeholder="Enter username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required
                />
                <div className="vtop-icon-box">
                  <User size={16} />
                </div>
              </div>
            </div>

            {/* PASSWORD */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '10px', color: '#64748b' }}>PASSWORD</label>
              <div className="vtop-input-group">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="vtop-control"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <div 
                  className="vtop-icon-box" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </div>
              </div>
            </div>

            {/* VERIFICATION */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontSize: '10px', color: '#64748b' }}>VERIFICATION</label>
              <div className="captcha-container">
                <div className="captcha-image-block" title="CAPTCHA Verification Code">
                  {captchaCode}
                  <div className="captcha-noise-overlay"></div>
                  <div className="captcha-strike-line"></div>
                </div>
                <button 
                  type="button" 
                  className="captcha-refresh-btn" 
                  onClick={generateCaptcha}
                  title="Refresh CAPTCHA"
                  aria-label="Refresh CAPTCHA"
                >
                  <RotateCw size={18} />
                </button>
                <input 
                  type="text" 
                  className="vtop-control"
                  placeholder="Enter code"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  style={{ flex: 1 }}
                  required
                />
              </div>
            </div>

            {/* Submit button matching Image 1 */}
            <div className="vtop-submit-row" style={{ marginTop: '16px' }}>
              <button type="submit" className="vtop-submit-btn" style={{ background: '#1d3b6c', fontWeight: 600, height: '42px', borderRadius: '4px' }}>
                Sign In Securely
              </button>
            </div>

          </form>

          {/* Footer links matching Image 1 */}
          <div className="vtop-footer" style={{ padding: '0 32px 32px 32px', fontSize: '12px' }}>
            <div className="vtop-footer-links-left" style={{ gap: '2px' }}>
              <span className="vtop-footer-link" onClick={() => alert('Password recovery link sent.')}>Forgot Password?</span>
              <span className="vtop-footer-link" onClick={() => alert('Forgot LoginId.')}>Forgot LoginId?</span>
            </div>
            <span className="vtop-footer-link" style={{ fontWeight: 600 }} onClick={openRegisterModal}>
              Register New User
            </span>
          </div>
        </div>

        {/* Separator and Social Sign-ins matching Image 1 */}
        <div style={{ width: '100%', maxWidth: '440px', margin: '16px 0 0 0' }}>
          <div className="login-separator" style={{ color: '#94a3b8' }}>Or Continue With</div>
          
          <button 
            type="button" 
            className="login-btn-apple"
            onClick={() => handleSocialLogin('Apple')}
            style={{ height: '42px', borderRadius: '4px', fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 170 170" fill="currentColor">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.13-1.92-14.37-6.17-3.66-3.05-7.61-7.85-11.85-14.41-8.59-13.43-15.02-28.77-19.3-46.04-3.17-12.65-4.76-24.89-4.76-36.71 0-16.71 4.2-30.77 12.6-42.17 6.87-9.28 15.42-14.07 25.65-14.36 4.79 0 10.37 1.74 16.75 5.22 6.38 3.48 10.72 5.22 13.01 5.22 1.79 0 5.86-1.5 12.21-4.5 6.35-3 11.66-4.43 15.93-4.28 11.53.59 20.89 4.76 28.08 12.53-15 18.17-22.18 39.4-21.56 63.7 1.09 13.88 6.2 25.68 15.34 35.4 6.13 6.64 12.87 11.29 20.21 13.97-2.68 7.3-5.83 14.15-9.45 20.55zM119.22 35.25c0-10.22 3.63-19.78 10.87-28.71.29-.36.65-.77 1.09-1.24 1.15 1.29 2.19 2.5 3.12 3.64 6.78 8.16 10.12 17.06 10.02 26.68-.09 1.41-.27 2.65-.54 3.71-.54.22-1.09.39-1.63.51-7.86.3-15.03-3.08-21.5-10.15-1.04-1.15-2.07-2.61-3.11-4.38-.85-1.44-1.32-2.18-1.32-2.18z"/>
            </svg>
            <span>Sign in with Apple</span>
          </button>

          <button 
            type="button" 
            className="login-btn-google"
            onClick={() => handleSocialLogin('Google')}
            style={{ height: '42px', borderRadius: '4px', fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24c0-1.55-.15-3.24-.47-4.77H24v9.03h12.75c-.53 2.87-2.13 5.33-4.57 6.96l7.13 5.53C43.47 36.52 46.5 30.93 46.5 24z"/>
              <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.13-5.53c-2.11 1.42-4.81 2.3-8.76 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>

        {/* Demo Prefill Helper Panel matching Image 1 */}
        <div className="login-demo-helper" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', marginTop: '24px', padding: '16px', borderRadius: '8px' }}>
          <div className="login-demo-helper-title" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#1e3b68', textAlign: 'center', marginBottom: '12px' }}>
            DEMO SCENARIOS ACCESS
          </div>
          <div className="login-demo-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button 
              type="button"
              className="login-demo-btn"
              onClick={() => handleQuickLogin('admin@staffly.com', 'admin')}
              style={{ padding: '8px', fontSize: '11.5px', borderRadius: '4px' }}
            >
              Scenario 2: Staffly CEO
            </button>
            <button 
              type="button"
              className="login-demo-btn"
              onClick={() => handleQuickLogin('owner@apex.com', 'password123')}
              style={{ padding: '8px', fontSize: '11.5px', borderRadius: '4px' }}
            >
              Scenario 1: 1 CEO + 1 Staff
            </button>
            <button 
              type="button"
              className="login-demo-btn"
              onClick={() => handleQuickLogin('ceo@globalcorp.com', 'password123')}
              style={{ padding: '8px', fontSize: '11.5px', borderRadius: '4px' }}
            >
              Scenario 3: 100+ Enterprise
            </button>
            <button 
              type="button"
              className="login-demo-btn"
              onClick={() => handleQuickLogin('lead@studiocraft.com', 'password123')}
              style={{ padding: '8px', fontSize: '11.5px', borderRadius: '4px' }}
            >
              Scenario 4: Studio (No HR)
            </button>
          </div>

          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <select 
              value={selectedDemoEmail} 
              onChange={(e) => setSelectedDemoEmail(e.target.value)}
              className="form-control"
              style={{ flex: 1, fontSize: '11px', height: '32px', padding: '2px 6px', borderRadius: '4px' }}
              aria-label="Select Demo Account"
            >
              <option value="rahul@staffly.com">Rahul Sharma (Staff)</option>
              <option value="priya@staffly.com">Priya Patel (HR Manager)</option>
              <option value="akhil@staffly.com">Akhil Nair (Finance Manager)</option>
              <option value="staff@apex.com">Rohan Associate (Apex Staff)</option>
            </select>
            <button 
              type="button"
              className="login-demo-btn"
              onClick={() => handleQuickLogin(selectedDemoEmail, 'password123')}
              style={{ padding: '0 12px', fontSize: '11.5px', borderRadius: '4px' }}
            >
              Sign In Selected
            </button>
          </div>
        </div>

        {/* Registration Modal (Image 4 style with blur overlay) */}
        {showRegisterModal && (
          <div className="gateway-overlay">
            <div className="gateway-container" style={{ maxWidth: '440px', padding: '0', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div className="gateway-header" style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="gateway-merchant-name" style={{ fontSize: '18px', fontWeight: 700, color: '#0f2d59' }}>Register</h3>
                <button className="gateway-close-btn" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => setShowRegisterModal(false)} aria-label="Close Registration Form">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleRegister} style={{ padding: '24px' }}>
                {/* ACCOUNT ROLE */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontSize: '10px', color: '#64748b' }}>ACCOUNT ROLE</label>
                  <select
                    id="rg-role"
                    className="form-control"
                    value={registerRole}
                    onChange={(e) => setRegisterRole(e.target.value)}
                    style={{ height: '38px', padding: '4px 8px', borderRadius: '4px' }}
                  >
                    <option value="employee">Staff / Employee</option>
                    <option value="admin">Business Owner / CEO</option>
                  </select>
                </div>

                {/* Conditional Company input for Admins */}
                {registerRole === 'admin' && (
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontSize: '10px', color: '#64748b' }}>COMPANY NAME</label>
                    <input 
                      id="rg-comp"
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Geeta Maid Services"
                      value={registerForm.companyName}
                      onChange={(e) => setRegisterForm({...registerForm, companyName: e.target.value})}
                      style={{ borderRadius: '4px' }}
                      required 
                    />
                  </div>
                )}
                
                {/* FULL NAME */}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '10px', color: '#64748b' }}>FULL NAME</label>
                  <input 
                    id="rg-owner"
                    type="text" 
                    className="form-control" 
                    placeholder="Jane Doe"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                    style={{ borderRadius: '4px' }}
                    required 
                  />
                </div>

                {/* Conditional Phone input for Employees */}
                {registerRole === 'employee' && (
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontSize: '10px', color: '#64748b' }}>PHONE NUMBER</label>
                    <input 
                      id="rg-phone"
                      type="tel" 
                      className="form-control" 
                      placeholder="+1 (555) 000-0000"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({...registerForm, phone: e.target.value})}
                      style={{ borderRadius: '4px' }}
                    />
                  </div>
                )}

                {/* EMAIL ADDRESS */}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '10px', color: '#64748b' }}>EMAIL ADDRESS</label>
                  <input 
                    id="rg-email"
                    type="email" 
                    className="form-control" 
                    placeholder="jane@example.com"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                    style={{ borderRadius: '4px' }}
                    required 
                  />
                </div>

                {/* PASSWORD */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontSize: '10px', color: '#64748b' }}>PASSWORD</label>
                  <input 
                    id="rg-pass"
                    type="password" 
                    className="form-control" 
                    placeholder="••••••••"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    style={{ borderRadius: '4px' }}
                    required 
                  />
                </div>

                <button 
                  type="submit" 
                  className="login-btn-submit"
                  style={{ height: '42px', background: '#0f2d59', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 700 }}
                >
                  {registerRole === 'admin' ? 'Register and Setup Workspace' : 'Create Staff Account'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DETERMINING PERMISSION SHIELDS
  const rawRole = currentUser?.role || 'employee';
  const userRole = (rawRole === 'CEO' || rawRole === 'admin') ? 'admin' 
    : (rawRole === 'HR' || rawRole === 'manager') ? 'manager' 
    : (rawRole === 'Finance' || rawRole === 'finance_manager') ? 'finance_manager' 
    : 'employee';
  
  // Real-time counts for Request Hub badges
  const leavesCount = db.getLeaves().filter(l => l.status === 'pending').length;
  const advancesCount = db.getAdvances().filter(a => a.status === 'pending').length;
  const otCount = db.getOvertime().filter(o => o.status === 'pending').length;

  const totalPendingRequests = userRole === 'admin' 
    ? (leavesCount + advancesCount + otCount)
    : (userRole === 'manager' ? (leavesCount + otCount) : advancesCount);

  // Sidebar item renderer matching Image 2 & 3 styles
  const renderSidebarItem = (tabId, icon, label) => {
    const isActive = activeTab === tabId;
    return (
      <button 
        className={`sidebar-item ${isActive ? 'active' : ''}`} 
        onClick={() => {
          setActiveTab(tabId);
        }}
        title={label}
        aria-label={label}
      >
        {icon}
        {sidebarExpanded && <span className="sidebar-item-text">{label}</span>}
      </button>
    );
  };

  // Determine whether to show the EmployeeDashboard (personal) or AdminDashboard (privileges tasks)
  const isPersonalTab = ['overview', 'leaves', 'requests', 'payslips', 'profile'].includes(activeTab);

  return (
    <div className="app-container">
      {/* 1. SIDEBAR (Full height top-left, matching Image 2 & 3) */}
      <aside className={`sidebar ${sidebarExpanded ? 'expanded' : ''}`}>
        
        {/* Sidebar Logo Section */}
        <div style={{ padding: '20px 20px', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
          <div style={{ background: '#0f2d59', color: '#ffffff', padding: '8px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Laptop size={18} />
          </div>
          {sidebarExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f2d59', lineHeight: 1.1 }}>{settings.companyName} Portal</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Workspace Hub</span>
            </div>
          )}
        </div>

        {/* Menu Items Container */}
        <div style={{ flex: 1, width: '100%', overflowY: 'auto' }}>
          
          <div className="sidebar-group-title">
            {sidebarExpanded && 'Main Menu'}
          </div>

          {/* Owner Menu options */}
          {userRole === 'admin' && (
            <>
              {renderSidebarItem('overview', <Laptop size={16} />, 'Dashboard')}
              {renderSidebarItem('attendance', <Calendar size={16} />, 'Attendance')}
              {renderSidebarItem('employees', <Users size={16} />, 'Employee')}
              {renderSidebarItem('payroll', <Clock size={16} />, 'Schedule')}
            </>
          )}

          {/* Staff Unified Menu options */}
          {userRole !== 'admin' && (
            <>
              {renderSidebarItem('overview', <Laptop size={16} />, 'Dashboard')}
              {renderSidebarItem('face_recognition', <Camera size={16} />, 'Face Check-In')}
              {renderSidebarItem('leaves', <Calendar size={16} />, 'Apply Leave')}
              {renderSidebarItem('requests', <Clock size={16} />, 'Overtime & Loans')}
              {renderSidebarItem('payslips', <FileText size={16} />, 'Payslips')}
            </>
          )}

          {/* Dynamic Administration sections inline inside Employee Portal */}
          {userRole === 'manager' && (
            <>
              <div className="sidebar-group-title">
                {sidebarExpanded && 'HR Administration'}
              </div>
              {renderSidebarItem('employees', <Users size={16} />, 'Employees Directory')}
              {renderSidebarItem('attendance', <Calendar size={16} />, 'Attendance Grid')}
              {renderSidebarItem('requests_hub', <AlertCircle size={16} />, `Request Hub (${totalPendingRequests})`)}
            </>
          )}

          {userRole === 'finance_manager' && (
            <>
              <div className="sidebar-group-title">
                {sidebarExpanded && 'Finance Administration'}
              </div>
              {renderSidebarItem('overtime', <Clock size={16} />, 'Add Extra Work')}
              {renderSidebarItem('bonuses', <Award size={16} />, 'Give Bonuses')}
              {renderSidebarItem('payroll', <CreditCard size={16} />, 'Payroll Center')}
            </>
          )}

          {/* Settings Section matching Image 2 & 3 */}
          <div className="sidebar-group-title">
            {sidebarExpanded && 'Settings'}
          </div>
          {userRole === 'admin' && renderSidebarItem('settings', <Settings size={16} />, 'Settings')}
          {renderSidebarItem('profile', <User size={16} />, 'Help Center')}

        </div>

        {/* Sidebar Footer Profile widget & Switch Button */}
        <div style={{ width: '100%', padding: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="user-avatar-mini" style={{ width: '36px', height: '36px', background: '#eff6ff', color: '#1e3b68', fontWeight: 700, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bfdbfe' }}>
                {currentUser.name.charAt(0)}
              </div>
              {sidebarExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{currentUser.name}</span>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    {userRole === 'admin' ? 'Admin HRD' : userRole === 'manager' ? 'HR Manager' : userRole === 'finance_manager' ? 'Finance Officer' : 'Staff'}
                  </span>
                </div>
              )}
            </div>
            {sidebarExpanded && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                  title="Toggle Theme"
                  aria-label="Toggle Theme"
                >
                  {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <button 
                  onClick={handleLogout} 
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Switch Button matching mockup footer switcher */}
          {sidebarExpanded && (userRole === 'manager' || userRole === 'finance_manager') && (
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                if (isPersonalTab) {
                  setActiveTab(userRole === 'manager' ? 'employees' : 'payroll');
                } else {
                  setActiveTab('overview');
                }
              }}
              style={{ width: '100%', height: '34px', fontSize: '12px', borderRadius: '4px', fontWeight: 600, background: '#ffffff', color: '#1e3b68', border: '1px solid #cbd5e1' }}
            >
              {isPersonalTab ? 'Switch to Admin' : 'Switch to Employee'}
            </button>
          )}
        </div>

      </aside>

      {/* 2. MAIN CONTENT VIEWPORT (Right side) */}
      <div className="main-content-column">
        
        {/* Header matching Image 2 & 3 */}
        <header className="main-header">
          {/* Breadcrumbs */}
          <div className="header-breadcrumb">
            <Laptop size={14} />
            <span>/</span>
            <span>Home</span>
            <span>/</span>
            <span className="header-breadcrumb-active">
              {activeTab === 'overview' ? 'Dashboard' : activeTab === 'settings' ? 'Settings' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </span>
          </div>

          {/* Actions */}
          <div className="header-actions">
            {/* Organization Selector */}
            {userOrgs.length > 0 && (
              <select
                value={currentUser?.organization_id || ''}
                onChange={(e) => handleSwitchOrg(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f2d59',
                  cursor: 'pointer'
                }}
                aria-label="Switch Active Organization"
                title="Switch Organization"
              >
                {userOrgs.map(o => (
                  <option key={o.id} value={o.id}>
                    🏢 {o.name} ({o.role})
                  </option>
                ))}
              </select>
            )}

            {/* Search Input */}
            <div className="header-search-box">
              <input type="text" className="header-search-input" placeholder="Search" />
              <div className="header-search-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
            </div>

            {/* Notification */}
            <button 
              className="icon-btn" 
              onClick={() => setShowNotifications(true)} 
              style={{ border: 'none', background: 'transparent', padding: '6px' }}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadNotifications > 0 && <span className="notification-dot"></span>}
            </button>

            {/* Export button */}
            <button className="btn btn-primary" style={{ background: '#0f2d59', height: '36px', padding: '0 16px', fontSize: '13px', borderRadius: '4px' }}>
              Export
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="main-content-wrapper">
          <Suspense fallback={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px', color: 'var(--text-secondary)' }}>
              <RefreshCw className="animate-spin" size={24} style={{ color: '#0f2d59' }} />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Loading workspace view...</span>
            </div>
          }>
            {activeTab === 'face_recognition' ? (
              <FaceRecognitionTerminal 
                userRole={userRole}
                settings={settings}
                showToast={showToast}
                currentUserEmpId={currentUser?.employee_id}
              />
            ) : activeTab === 'settings' ? (
              <CustomizationPage 
                settings={settings}
                onSaveSettings={async (updatedSettings) => {
                  await db.saveSettings(updatedSettings);
                  setSettings(updatedSettings);
                }}
                onResetData={async () => {
                  await db.resetWorkspaceData();
                  setSettings(db.getSettings());
                }}
                showToast={showToast}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
              />
            ) : (isPersonalTab && userRole !== 'admin') || userRole === 'employee' ? (
              <EmployeeDashboard 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                employeeId={currentUser.employee_id} 
                onSelectPayslip={(slip) => setActivePayslip(slip)}
                settings={settings}
                showToast={showToast}
              />
            ) : (
              <AdminDashboard 
                activeTab={activeTab === 'requests_hub' ? 'requests' : activeTab}
                setActiveTab={setActiveTab}
                userRole={userRole}
                currentUserEmpId={currentUser.employee_id}
                onSelectPayslip={(slip) => setActivePayslip(slip)} 
                settings={settings}
                showToast={showToast}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* In-app Notification Side Drawer */}
      {showNotifications && (
        <>
          <div className="drawer-overlay" onClick={() => setShowNotifications(false)}></div>
          <div className="drawer-content">
            <div className="drawer-header">
              <h3 className="card-title-v2">Notifications</h3>
              <button className="icon-btn" style={{ border: 'none', background: 'transparent' }} onClick={() => setShowNotifications(false)} aria-label="Close Notifications Drawer">
                <X size={16} />
              </button>
            </div>
            <div className="drawer-body">
              {notifications.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginTop: '40px' }}>
                  <AlertCircle size={24} />
                  <span>No notifications yet.</span>
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={`notification-item ${n.read ? 'read' : ''}`}>
                    <span className="notification-text">{n.text}</span>
                    <div className="notification-time">{n.date}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Payslip Overlay Modal */}
      {activePayslip && (
        <Suspense fallback={null}>
          <Payslip 
            data={activePayslip} 
            onClose={() => setActivePayslip(null)} 
            settings={settings}
          />
        </Suspense>
      )}

      {/* Toast Notifications Overlay Container */}
      <div className="toast-container" style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '12px', pointerEvents: 'none' }}>
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`toast-alert ${toast.type}`}
            style={{
              pointerEvents: 'auto',
              background: '#ffffff',
              borderLeft: `4px solid ${toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#f59e0b'}`,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              borderRadius: '6px',
              padding: '12px 18px',
              minWidth: '280px',
              maxWidth: '380px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              animation: 'toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{toast.title}</span>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
