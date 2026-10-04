import React, { useState } from 'react';
import { 
  Building2, Palette, Globe, CreditCard, Bell, Eye, ShieldAlert, 
  Check, RotateCw, Download, AlertTriangle, Moon, Sun, Monitor, Save
} from 'lucide-react';

export default function CustomizationPage({ 
  settings, 
  onSaveSettings, 
  onResetData, 
  showToast,
  darkMode,
  setDarkMode
}) {
  const [formData, setFormData] = useState({ ...settings });
  const [activeSection, setActiveSection] = useState('general');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleToggle = (field) => {
    setFormData(prev => {
      const nextVal = !prev[field];
      if (field === 'theme') {
        if (nextVal === 'dark') setDarkMode(true);
        else if (nextVal === 'light') setDarkMode(false);
      }
      return { ...prev, [field]: nextVal };
    });
    setIsSaved(false);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    onSaveSettings(formData);
    setIsSaved(true);
    if (showToast) {
      showToast('Settings Saved', 'Workspace customization preferences updated successfully.', 'success');
    }
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleExportConfig = () => {
    const configStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", configStr);
    downloadAnchor.setAttribute("download", `staffly_settings_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    if (showToast) {
      showToast('Configuration Exported', 'System settings JSON generated successfully.', 'success');
    }
  };

  const handleConfirmReset = () => {
    if (resetConfirmText.trim().toLowerCase() !== 'reset') {
      alert('Please type RESET in the confirmation box to confirm.');
      return;
    }
    onResetData();
    setShowResetModal(false);
    setResetConfirmText('');
    if (showToast) {
      showToast('Workspace Reset', 'All data and settings have been restored to factory defaults.', 'warning');
    }
  };

  const sections = [
    { id: 'general', label: 'General & Workspace', icon: <Building2 size={16} />, desc: 'Company profile, business email, and timezone' },
    { id: 'appearance', label: 'Appearance & Theme', icon: <Palette size={16} />, desc: 'Color palette, theme mode, and layout density' },
    { id: 'localization', label: 'Localization & Currency', icon: <Globe size={16} />, desc: 'Currency symbols, date formats, and calendar standards' },
    { id: 'payroll', label: 'Payroll & Work Rules', icon: <CreditCard size={16} />, desc: 'Overtime rates, daily hour limits, and pay schedules' },
    { id: 'notifications', label: 'Notifications & Alerts', icon: <Bell size={16} />, desc: 'Email digests, payout alerts, and sound chimes' },
    { id: 'accessibility', label: 'Accessibility & UX', icon: <Eye size={16} />, desc: 'Font sizes, high contrast, and reduced motion' },
    { id: 'advanced', label: 'Advanced & Safety', icon: <ShieldAlert size={16} />, desc: 'Subscription tier, config export, and system reset' },
  ];

  return (
    <div className="customization-container">
      
      {/* Page Header */}
      <div className="customization-header">
        <div>
          <h1 className="customization-title">Customization & Workspace Settings</h1>
          <p className="customization-subtitle">
            Configure system standards, design themes, localization rules, and operational thresholds across your organization.
          </p>
        </div>
        <button 
          type="button" 
          onClick={handleSubmit} 
          className="btn-custom-save"
        >
          {isSaved ? <Check size={16} /> : <Save size={16} />}
          <span>{isSaved ? 'Changes Saved' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Main Settings Body Grid: Sidebar Navigation + Active Form View */}
      <div className="customization-layout">
        
        {/* Section Navigation Column */}
        <nav className="customization-nav" aria-label="Settings categories">
          {sections.map(sec => (
            <button
              key={sec.id}
              type="button"
              className={`customization-nav-item ${activeSection === sec.id ? 'active' : ''}`}
              onClick={() => setActiveSection(sec.id)}
            >
              <div className="customization-nav-icon">{sec.icon}</div>
              <div className="customization-nav-text">
                <span className="customization-nav-label">{sec.label}</span>
                <span className="customization-nav-desc">{sec.desc}</span>
              </div>
            </button>
          ))}
        </nav>

        {/* Section Form Content Viewport */}
        <form onSubmit={handleSubmit} className="customization-content">
          
          {/* SECTION 1: GENERAL & WORKSPACE */}
          {activeSection === 'general' && (
            <div className="settings-section-block">
              <div className="settings-section-header">
                <h3>General & Workspace Settings</h3>
                <p>Manage basic corporate identifiers, contact details, and organization timezone defaults.</p>
              </div>

              <div className="settings-field-group">
                <label className="settings-label" htmlFor="companyName">Company / Business Name</label>
                <p className="settings-hint">Appears in header breadcrumbs, generated payslips, and staff login portal.</p>
                <input 
                  id="companyName"
                  type="text" 
                  className="settings-input" 
                  value={formData.companyName}
                  onChange={(e) => handleFieldChange('companyName', e.target.value)}
                  placeholder="e.g. Staffly Global Technologies"
                  required
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-label" htmlFor="businessEmail">Official Business Email</label>
                <p className="settings-hint">Primary administrative contact used for system alerts and payroll receipts.</p>
                <input 
                  id="businessEmail"
                  type="email" 
                  className="settings-input" 
                  value={formData.businessEmail}
                  onChange={(e) => handleFieldChange('businessEmail', e.target.value)}
                  placeholder="admin@company.com"
                  required
                />
              </div>

              <div className="settings-grid-2">
                <div className="settings-field-group">
                  <label className="settings-label" htmlFor="industry">Industry Category</label>
                  <select 
                    id="industry"
                    className="settings-select"
                    value={formData.industry}
                    onChange={(e) => handleFieldChange('industry', e.target.value)}
                  >
                    <option value="Technology & SaaS">Technology & SaaS</option>
                    <option value="Healthcare & Nursing">Healthcare & Nursing</option>
                    <option value="Retail & E-commerce">Retail & E-commerce</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Logistics & Transport">Logistics & Transport</option>
                    <option value="Hospitality & Services">Hospitality & Services</option>
                  </select>
                </div>

                <div className="settings-field-group">
                  <label className="settings-label" htmlFor="timezone">Default Timezone</label>
                  <select 
                    id="timezone"
                    className="settings-select"
                    value={formData.timezone}
                    onChange={(e) => handleFieldChange('timezone', e.target.value)}
                  >
                    <option value="Asia/Kolkata (GMT+5:30)">Asia/Kolkata (GMT+5:30)</option>
                    <option value="UTC (GMT+0:00)">UTC (GMT+0:00)</option>
                    <option value="America/New_York (GMT-5:00)">America/New_York (GMT-5:00)</option>
                    <option value="Europe/London (GMT+0:00)">Europe/London (GMT+0:00)</option>
                    <option value="Asia/Singapore (GMT+8:00)">Asia/Singapore (GMT+8:00)</option>
                  </select>
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-label" htmlFor="fiscalYearStart">Fiscal Year Start Month</label>
                <select 
                  id="fiscalYearStart"
                  className="settings-select"
                  value={formData.fiscalYearStart}
                  onChange={(e) => handleFieldChange('fiscalYearStart', e.target.value)}
                >
                  <option value="January">January</option>
                  <option value="April">April (Standard India/UK)</option>
                  <option value="October">October</option>
                </select>
              </div>
            </div>
          )}

          {/* SECTION 2: APPEARANCE & THEME */}
          {activeSection === 'appearance' && (
            <div className="settings-section-block">
              <div className="settings-section-header">
                <h3>Appearance & Theme Customization</h3>
                <p>Control visual aesthetic mode, brand accent color schemes, and sidebar navigation layout.</p>
              </div>

              {/* Theme Mode Choice (Radio Visual Cards) */}
              <div className="settings-field-group">
                <label className="settings-label">Theme Mode</label>
                <p className="settings-hint">Select preferred contrast mode across all workspace dashboards.</p>
                <div className="settings-radio-group">
                  <button
                    type="button"
                    className={`settings-radio-card ${formData.theme === 'light' ? 'active' : ''}`}
                    onClick={() => {
                      handleFieldChange('theme', 'light');
                      setDarkMode(false);
                    }}
                  >
                    <Sun size={18} />
                    <span className="radio-card-title">Light Mode</span>
                    <span className="radio-card-sub">Clean high contrast white</span>
                  </button>

                  <button
                    type="button"
                    className={`settings-radio-card ${formData.theme === 'dark' ? 'active' : ''}`}
                    onClick={() => {
                      handleFieldChange('theme', 'dark');
                      setDarkMode(true);
                    }}
                  >
                    <Moon size={18} />
                    <span className="radio-card-title">Dark Mode</span>
                    <span className="radio-card-sub">Reduced eye strain dark</span>
                  </button>

                  <button
                    type="button"
                    className={`settings-radio-card ${formData.theme === 'system' ? 'active' : ''}`}
                    onClick={() => handleFieldChange('theme', 'system')}
                  >
                    <Monitor size={18} />
                    <span className="radio-card-title">System Auto</span>
                    <span className="radio-card-sub">Matches OS preferences</span>
                  </button>
                </div>
              </div>

              {/* Accent Color Selection */}
              <div className="settings-field-group">
                <label className="settings-label">Brand Accent Color</label>
                <p className="settings-hint">Primary color standard for buttons, badges, and active state highlights.</p>
                <div className="color-swatch-list">
                  {[
                    { hex: '#1e3b68', name: 'Enterprise Navy' },
                    { hex: '#0f766e', name: 'Deep Teal' },
                    { hex: '#334155', name: 'Slate Gray' },
                    { hex: '#4338ca', name: 'Royal Indigo' },
                    { hex: '#0284c7', name: 'Azure Blue' }
                  ].map(swatch => (
                    <button
                      key={swatch.hex}
                      type="button"
                      className={`color-swatch-btn ${formData.accentColor === swatch.hex ? 'active' : ''}`}
                      style={{ backgroundColor: swatch.hex }}
                      onClick={() => handleFieldChange('accentColor', swatch.hex)}
                      title={swatch.name}
                      aria-label={`Select ${swatch.name}`}
                    >
                      {formData.accentColor === swatch.hex && <Check size={14} color="#ffffff" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact Navigation Toggle */}
              <div className="settings-toggle-row">
                <div className="toggle-text">
                  <span className="toggle-title">Compact Navigation Sidebar</span>
                  <span className="toggle-desc">Collapse sidebar automatically on start to maximize screen area.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.compactSidebar}
                  className={`toggle-switch ${formData.compactSidebar ? 'checked' : ''}`}
                  onClick={() => handleToggle('compactSidebar')}
                >
                  <span className="toggle-knob" />
                </button>
              </div>
            </div>
          )}

          {/* SECTION 3: LOCALIZATION & CURRENCY */}
          {activeSection === 'localization' && (
            <div className="settings-section-block">
              <div className="settings-section-header">
                <h3>Localization & Regional Standards</h3>
                <p>Define monetary currency formats, date representation styles, and calendar conventions.</p>
              </div>

              <div className="settings-field-group">
                <label className="settings-label" htmlFor="currency">Active Currency Symbol</label>
                <p className="settings-hint">Determines symbol prefix across payroll runs, advance loans, and overtime bonuses.</p>
                <select 
                  id="currency"
                  className="settings-select"
                  value={formData.currency}
                  onChange={(e) => handleFieldChange('currency', e.target.value)}
                >
                  <option value="₹">₹ (INR - Indian Rupee)</option>
                  <option value="$">$ (USD - US Dollar)</option>
                  <option value="€">€ (EUR - Euro)</option>
                  <option value="£">£ (GBP - British Pound)</option>
                  <option value="¥">¥ (JPY - Japanese Yen)</option>
                  <option value="A$">A$ (AUD - Australian Dollar)</option>
                </select>
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Date Format Pattern</label>
                <p className="settings-hint">Used in attendance grids, leave schedules, and export documents.</p>
                <div className="settings-pill-selector">
                  {['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'].map(fmt => (
                    <button
                      key={fmt}
                      type="button"
                      className={`settings-pill-btn ${formData.dateFormat === fmt ? 'active' : ''}`}
                      onClick={() => handleFieldChange('dateFormat', fmt)}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-label" htmlFor="firstDayOfWeek">First Day of Calendar Week</label>
                <select 
                  id="firstDayOfWeek"
                  className="settings-select"
                  value={formData.firstDayOfWeek}
                  onChange={(e) => handleFieldChange('firstDayOfWeek', e.target.value)}
                >
                  <option value="Monday">Monday</option>
                  <option value="Sunday">Sunday</option>
                  <option value="Saturday">Saturday</option>
                </select>
              </div>
            </div>
          )}

          {/* SECTION 4: PAYROLL & WORK RULES */}
          {activeSection === 'payroll' && (
            <div className="settings-section-block">
              <div className="settings-section-header">
                <h3>Payroll Rules & Overtime Thresholds</h3>
                <p>Configure automated hourly rates, daily shifts baseline, and overtime approval criteria.</p>
              </div>

              <div className="settings-grid-2">
                <div className="settings-field-group">
                  <label className="settings-label" htmlFor="overtimeRate">Standard Overtime Hourly Rate ({formData.currency})</label>
                  <p className="settings-hint">Base calculation rate per approved overtime hour.</p>
                  <input 
                    id="overtimeRate"
                    type="number" 
                    min="50"
                    max="5000"
                    className="settings-input" 
                    value={formData.overtimeRate}
                    onChange={(e) => handleFieldChange('overtimeRate', Number(e.target.value))}
                    required
                  />
                </div>

                <div className="settings-field-group">
                  <label className="settings-label" htmlFor="standardWorkHours">Daily Shift Baseline (Hours)</label>
                  <p className="settings-hint">Standard daily shift target before overtime accumulates.</p>
                  <select 
                    id="standardWorkHours"
                    className="settings-select"
                    value={formData.standardWorkHours}
                    onChange={(e) => handleFieldChange('standardWorkHours', Number(e.target.value))}
                  >
                    <option value={7}>7 Hours per day</option>
                    <option value={8}>8 Hours per day (Standard)</option>
                    <option value={9}>9 Hours per day</option>
                  </select>
                </div>
              </div>

              {/* Slider Control for Auto Approve Limit */}
              <div className="settings-field-group">
                <div className="settings-label-row">
                  <label className="settings-label" htmlFor="autoApproveOtLimit">Overtime Auto-Approval Threshold</label>
                  <span className="settings-badge">{formData.autoApproveOtLimit} Hours / Day</span>
                </div>
                <p className="settings-hint">Overtime submissions up to this limit skip manual manager review.</p>
                <input 
                  id="autoApproveOtLimit"
                  type="range"
                  min="0"
                  max="8"
                  step="1"
                  className="settings-range-slider"
                  value={formData.autoApproveOtLimit}
                  onChange={(e) => handleFieldChange('autoApproveOtLimit', Number(e.target.value))}
                />
                <div className="range-slider-labels">
                  <span>0h (Strict Review)</span>
                  <span>4h</span>
                  <span>8h (Auto Approve All)</span>
                </div>
              </div>

              <div className="settings-field-group">
                <label className="settings-label" htmlFor="payFrequency">Salary Processing Schedule</label>
                <select 
                  id="payFrequency"
                  className="settings-select"
                  value={formData.payFrequency}
                  onChange={(e) => handleFieldChange('payFrequency', e.target.value)}
                >
                  <option value="Monthly">Monthly (End of Month)</option>
                  <option value="Bi-weekly">Bi-weekly (Every 2 Weeks)</option>
                  <option value="Semi-monthly">Semi-monthly (15th and 30th)</option>
                </select>
              </div>
            </div>
          )}

          {/* SECTION 5: NOTIFICATIONS & ALERTS */}
          {activeSection === 'notifications' && (
            <div className="settings-section-block">
              <div className="settings-section-header">
                <h3>Notifications & Alert Channels</h3>
                <p>Control automated alerts, email updates, and sound feedback triggers.</p>
              </div>

              <div className="settings-toggle-row">
                <div className="toggle-text">
                  <span className="toggle-title">Email Notification Alerts</span>
                  <span className="toggle-desc">Receive email confirmations for leave approvals, payroll payouts, and ticket updates.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.emailNotifications}
                  className={`toggle-switch ${formData.emailNotifications ? 'checked' : ''}`}
                  onClick={() => handleToggle('emailNotifications')}
                >
                  <span className="toggle-knob" />
                </button>
              </div>

              <div className="settings-toggle-row">
                <div className="toggle-text">
                  <span className="toggle-title">Instant Payout Push Alerts</span>
                  <span className="toggle-desc">Trigger in-app notification toasts whenever salary transfers are processed.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.payoutAlerts}
                  className={`toggle-switch ${formData.payoutAlerts ? 'checked' : ''}`}
                  onClick={() => handleToggle('payoutAlerts')}
                >
                  <span className="toggle-knob" />
                </button>
              </div>

              <div className="settings-toggle-row">
                <div className="toggle-text">
                  <span className="toggle-title">Weekly Attendance Digest</span>
                  <span className="toggle-desc">Send weekly summary email reports on Monday morning.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.weeklyDigest}
                  className={`toggle-switch ${formData.weeklyDigest ? 'checked' : ''}`}
                  onClick={() => handleToggle('weeklyDigest')}
                >
                  <span className="toggle-knob" />
                </button>
              </div>

              <div className="settings-toggle-row">
                <div className="toggle-text">
                  <span className="toggle-title">Audio Alert Sound Effects</span>
                  <span className="toggle-desc">Play subtle audio chime when biometric check-in completes.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.soundAlerts}
                  className={`toggle-switch ${formData.soundAlerts ? 'checked' : ''}`}
                  onClick={() => handleToggle('soundAlerts')}
                >
                  <span className="toggle-knob" />
                </button>
              </div>
            </div>
          )}

          {/* SECTION 6: ACCESSIBILITY & UX */}
          {activeSection === 'accessibility' && (
            <div className="settings-section-block">
              <div className="settings-section-header">
                <h3>Accessibility & Ergonomic UX</h3>
                <p>Customize typography sizing, visual contrast, and motion preferences for maximum comfort.</p>
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Interface Font Sizing</label>
                <p className="settings-hint">Adjust baseline body text sizing across the application interface.</p>
                <div className="settings-radio-group">
                  {[
                    { id: 'compact', title: 'Compact (13px)', sub: 'Higher information density' },
                    { id: 'standard', title: 'Standard (14px)', sub: 'Default enterprise sizing' },
                    { id: 'comfortable', title: 'Large (16px)', sub: 'Enhanced legibility' }
                  ].map(sizeOpt => (
                    <button
                      key={sizeOpt.id}
                      type="button"
                      className={`settings-radio-card ${formData.fontSize === sizeOpt.id ? 'active' : ''}`}
                      onClick={() => handleFieldChange('fontSize', sizeOpt.id)}
                    >
                      <span className="radio-card-title">{sizeOpt.title}</span>
                      <span className="radio-card-sub">{sizeOpt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-toggle-row">
                <div className="toggle-text">
                  <span className="toggle-title">High Contrast Mode</span>
                  <span className="toggle-desc">Enhance element border visibility and icon contrast for low-vision support.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.highContrast}
                  className={`toggle-switch ${formData.highContrast ? 'checked' : ''}`}
                  onClick={() => handleToggle('highContrast')}
                >
                  <span className="toggle-knob" />
                </button>
              </div>

              <div className="settings-toggle-row">
                <div className="toggle-text">
                  <span className="toggle-title">Reduced Motion Preference</span>
                  <span className="toggle-desc">Disable smooth animations and transitional movements.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.reducedMotion}
                  className={`toggle-switch ${formData.reducedMotion ? 'checked' : ''}`}
                  onClick={() => handleToggle('reducedMotion')}
                >
                  <span className="toggle-knob" />
                </button>
              </div>
            </div>
          )}

          {/* SECTION 7: ADVANCED & DANGER ZONE */}
          {activeSection === 'advanced' && (
            <div className="settings-section-block">
              <div className="settings-section-header">
                <h3>Advanced System & Safety Zone</h3>
                <p>Manage SaaS plan license tier, export system configuration, and execute system reset.</p>
              </div>

              <div className="settings-field-group">
                <label className="settings-label" htmlFor="subscriptionPlan">Subscription License Plan</label>
                <p className="settings-hint">Current tier governs active employee seat limits and analytics access.</p>
                <select 
                  id="subscriptionPlan"
                  className="settings-select"
                  value={formData.subscriptionPlan}
                  onChange={(e) => handleFieldChange('subscriptionPlan', e.target.value)}
                >
                  <option value="Free">Free Starter Plan (Up to 10 Seats)</option>
                  <option value="Pro">Staffly Pro License (Active - Unlimited Seats)</option>
                  <option value="Enterprise">Enterprise Dedicated Suite</option>
                </select>
              </div>

              <div className="settings-field-group" style={{ marginTop: '24px' }}>
                <label className="settings-label">Export System Configuration</label>
                <p className="settings-hint">Download active workspace parameters as a structured JSON backup file.</p>
                <button
                  type="button"
                  className="btn-settings-outline"
                  onClick={handleExportConfig}
                >
                  <Download size={16} />
                  <span>Download Configuration JSON</span>
                </button>
              </div>

              {/* Separate Danger Zone Container */}
              <div className="settings-danger-card" style={{ marginTop: '36px' }}>
                <div className="danger-card-header">
                  <AlertTriangle size={20} color="#dc2626" />
                  <div>
                    <h4 className="danger-card-title">Danger Zone: System Data Reset</h4>
                    <p className="danger-card-desc">
                      Restores all employee records, attendance history, payroll sheets, and settings to original factory defaults.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-danger-action"
                  onClick={() => setShowResetModal(true)}
                >
                  <RotateCw size={16} />
                  <span>Reset Workspace Data</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer Form Action Bar */}
          <div className="customization-footer-bar">
            <span className="footer-status-text">
              {isSaved ? 'All changes saved to database.' : 'Unsaved changes in workspace configuration.'}
            </span>
            <button
              type="submit"
              className="btn-custom-save"
            >
              {isSaved ? <Check size={16} /> : <Save size={16} />}
              <span>{isSaved ? 'Changes Saved' : 'Save Changes'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* Confirmation Dialog Modal for High Risk Reset Action */}
      {showResetModal && (
        <div className="gateway-overlay">
          <div className="modal-danger-box">
            <div className="modal-danger-header">
              <AlertTriangle size={24} color="#dc2626" />
              <h3>Confirm Workspace Data Reset</h3>
            </div>
            <div className="modal-danger-body">
              <p>
                This action will completely wipe all custom employee profiles, attendance logs, and overtime entries created during this session.
              </p>
              <p style={{ marginTop: '12px', fontWeight: 600, color: '#0f172a' }}>
                Type <span style={{ color: '#dc2626', fontFamily: 'monospace' }}>RESET</span> below to confirm:
              </p>
              <input
                type="text"
                className="settings-input"
                style={{ marginTop: '8px', textTransform: 'uppercase' }}
                placeholder="Type RESET"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
              />
            </div>
            <div className="modal-danger-footer">
              <button
                type="button"
                className="btn-custom-cancel"
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-confirm"
                onClick={handleConfirmReset}
              >
                Yes, Reset All Data
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
