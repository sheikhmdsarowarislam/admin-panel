"use client";

import { useState, useEffect } from 'react';

const API_URL = '/api/api';
const SESSION_KEY = 'cookie_manager_auth';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [apiConnected, setApiConnected] = useState(false);
  const [apiStatusText, setApiStatusText] = useState('🔴 Connecting to API...');
  const [extensionStatusText, setExtensionStatusText] = useState('🔍 Checking Extension...');
  const [extensionStatusClass, setExtensionStatusClass] = useState('status checking');
  const [extensionInstalled, setExtensionInstalled] = useState(false);

  const [domainInput, setDomainInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [cookiesInput, setCookiesInput] = useState('');
  const [editingCookieId, setEditingCookieId] = useState<number | null>(null);

  const [allCookies, setAllCookies] = useState<any[]>([]);
  const [filteredCookies, setFilteredCookies] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [loadingCookies, setLoadingCookies] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const savedAuth = sessionStorage.getItem(SESSION_KEY);
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth);
        if (auth.username && auth.timestamp) {
          const hoursPassed = (Date.now() - auth.timestamp) / (1000 * 60 * 60);
          if (hoursPassed < 720) {
            setIsAuthenticated(true);
          }
        }
      } catch (e) {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      testAPI();
      loadCookies();

      const handleMessage = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data.type === 'EXTENSION_STATUS') {
          if (event.data.installed) {
            setExtensionInstalled(true);
            setExtensionStatusText('✅ Extension Ready');
            setExtensionStatusClass('status active');
          } else {
            setExtensionInstalled(false);
            setExtensionStatusText('❌ Extension Error');
            setExtensionStatusClass('status error');
            if (event.data.error) showToast('⚠️ ' + event.data.error, 'error');
          }
        }
        if (event.data.type === 'SETUP_RESPONSE') {
          if (event.data.response?.success) {
            showToast('✅ Session injected! Opening in new tab...', 'success');
          } else {
            showToast('❌ Failed: ' + (event.data.response?.error || 'Unknown error'), 'error');
          }
        }
      };

      window.addEventListener('message', handleMessage);
      window.postMessage({ type: 'CHECK_EXTENSION' }, '*');

      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await fetch(`${API_URL}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();

      if (result.success) {
        if (rememberMe) {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            username,
            timestamp: Date.now()
          }));
        }
        setIsAuthenticated(true);
      } else {
        setLoginError('❌ ' + (result.error || 'Invalid credentials'));
      }
    } catch (err) {
      setLoginError('❌ Connection error!');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => {
    if (confirm('Are you sure you want to logout?')) {
      sessionStorage.removeItem(SESSION_KEY);
      setIsAuthenticated(false);
      showToast('✅ Logged out successfully', 'success');
    }
  };

  const testAPI = async () => {
    try {
      const res = await fetch(`${API_URL}?action=test`);
      const result = await res.json();
      if (result.success) {
        setApiConnected(true);
        setApiStatusText('🟢 API Connected: ' + result.database);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setApiConnected(false);
      setApiStatusText('🔴 API Error: ' + err.message);
    }
  };

  const loadCookies = async () => {
    setLoadingCookies(true);
    try {
      const res = await fetch(`${API_URL}?action=list`);
      const result = await res.json();
      if (result.success && result.data) {
        setAllCookies(result.data);
        setFilteredCookies(result.data);
      } else {
        setAllCookies([]);
        setFilteredCookies([]);
      }
    } catch (err) {
      setAllCookies([]);
      setFilteredCookies([]);
    } finally {
      setLoadingCookies(false);
    }
  };

  const saveCookie = async () => {
    if (!domainInput || !urlInput || !cookiesInput) {
      showToast('❌ Please fill all fields', 'error');
      return;
    }

    try {
      JSON.parse(cookiesInput);
      const action = editingCookieId ? 'update' : 'add';
      const payload: any = { domain: domainInput, url: urlInput, cookies: cookiesInput };
      if (editingCookieId) payload.id = editingCookieId;

      const res = await fetch(`${API_URL}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (result.success) {
        showToast(editingCookieId ? '✅ Cookie updated!' : '✅ Cookie saved!', 'success');
        clearForm();
        loadCookies();
      } else {
        showToast('❌ Error: ' + result.error, 'error');
      }
    } catch (err: any) {
      showToast('❌ Error: Invalid JSON or Server Error', 'error');
    }
  };

  const editCookie = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}?action=get&id=${id}`);
      const result = await res.json();
      if (result.success) {
        setDomainInput(result.domain);
        setUrlInput(result.url);
        try {
          setCookiesInput(JSON.stringify(JSON.parse(result.cookies), null, 2));
        } catch {
          setCookiesInput(result.cookies);
        }
        setEditingCookieId(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('📝 Cookie loaded for editing', 'success');
      }
    } catch (err: any) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };

  const deleteCookie = async (id: number) => {
    if (!confirm('Are you sure you want to delete this cookie?')) return;
    try {
      const res = await fetch(`${API_URL}?action=delete&id=${id}`);
      const result = await res.json();
      if (result.success) {
        showToast('✅ Cookie deleted', 'success');
        if (editingCookieId === id) clearForm();
        loadCookies();
      }
    } catch (err: any) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };

  const injectCookie = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}?action=get&id=${id}`);
      const result = await res.json();
      if (result.success) {
        window.postMessage({
          type: 'SETUP_SESSION',
          sessionData: { url: result.url, cookies: result.cookies }
        }, '*');
      }
    } catch (err: any) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };

  const copyHTMLCode = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}?action=gethtml&id=${id}`);
      const result = await res.json();
      if (result.success && result.html) {
        await navigator.clipboard.writeText(result.html);
        showToast('✅ HTML Code copied! Paste in Elementor HTML widget', 'success');
      }
    } catch (err: any) {
      showToast('❌ Failed to copy code: ' + err.message, 'error');
    }
  };

  const clearForm = () => {
    setDomainInput('');
    setUrlInput('');
    setCookiesInput('');
    setEditingCookieId(null);
  };

  const handleSearch = (term: string) => {
    setSearchInput(term);
    if (!term.trim()) {
      setFilteredCookies(allCookies);
    } else {
      setFilteredCookies(allCookies.filter(item => item.domain.toLowerCase().includes(term.toLowerCase())));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="lock-icon">🔒</div>
          <h1>🍪 Cookie Manager</h1>
          {loginError && <div className="error-message">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="login-form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="login-form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="remember-me">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe">Remember me for 30 days</label>
            </div>
            <button type="submit" className="login-btn" disabled={isLoggingIn}>
              {isLoggingIn ? '⏳ Verifying...' : '🚀 Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {toast && (
        <div className={`toast ${toast.type}`}>
          <span className="toast-icon">{toast.type === 'success' ? '✅' : '❌'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="header">
        <h1>🍪 Cookie Manager Panel</h1>
        <div className="header-actions">
          <div className={extensionStatusClass} onClick={() => window.postMessage({ type: 'CHECK_EXTENSION' }, '*')}>
            {extensionStatusText}
          </div>
          <button className="btn btn-danger logout-btn" onClick={logout}>🚪 Logout</button>
        </div>
      </div>

      <div className="panel">
        <div className={`api-status ${apiConnected ? 'connected' : 'disconnected'}`}>{apiStatusText}</div>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>
          {editingCookieId ? '✏️ Edit Cookie Session' : 'Add New Cookie Session'}
        </h2>
        <div className="form-group">
          <label>Domain *</label>
          <input
            type="text"
            placeholder="example.com"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Target URL *</label>
          <input
            type="url"
            placeholder="https://example.com"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Cookies (JSON Array) *</label>
          <textarea
            placeholder='[{"name": "session", "value": "abc123", "domain": "example.com"}]'
            value={cookiesInput}
            onChange={(e) => setCookiesInput(e.target.value)}
          ></textarea>
          <small style={{ color: '#666' }}>Format: Array of objects with name, value, and domain</small>
        </div>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={saveCookie}>
            {editingCookieId ? '💾 Update Cookie' : '💾 Save to Database'}
          </button>
          <button className="btn btn-danger" onClick={clearForm}>🗑️ Clear Form</button>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#333' }}>Database Cookies</h2>
          <button className="btn btn-primary" onClick={loadCookies}>🔄 Refresh</button>
        </div>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by domain..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="cookies-list">
          {loadingCookies ? (
            <div className="loading">⏳ Loading cookies...</div>
          ) : filteredCookies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p>No cookies found</p>
            </div>
          ) : (
            filteredCookies.map((item) => (
              <div key={item.id} className={`cookie-item ${editingCookieId === item.id ? 'editing' : ''}`}>
                <div className="cookie-header">
                  <span className="cookie-domain">🌐 {item.domain}</span>
                  <span style={{ color: '#999', fontSize: '12px' }}>{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <div className="cookie-url">🔗 {item.target_url}</div>
                <div className="cookie-preview">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(item.cookies_json), null, 2);
                    } catch {
                      return item.cookies_json;
                    }
                  })()}
                </div>
                <div className="cookie-actions">
                  <button className="btn btn-success" onClick={() => injectCookie(item.id)}>🚀 Inject & Login</button>
                  <button className="btn btn-primary" onClick={() => editCookie(item.id)}>✏️ Edit</button>
                  <button className="btn btn-danger" onClick={() => deleteCookie(item.id)}>🗑️ Delete</button>
                  <button className="btn btn-warning" onClick={() => copyHTMLCode(item.id)}>📋 Copy HTML Code</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}