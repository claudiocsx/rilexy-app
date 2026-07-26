import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Login() {
  const { user, isAdmin, login, authError, setAuthError, loading } = useAuth();
  const navigate = useNavigate();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && isAdmin) navigate('/', { replace: true });
  }, [user, isAdmin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = emailRef.current?.value.trim();
    const password = passwordRef.current?.value;
    console.log('Login submit:', { email: email ? 'present' : 'missing', password: password ? 'present' : 'missing' });
    if (!email || !password) return;
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      console.error('Login error:', err);
    }
    setSubmitting(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">♀♂</div>
        <h1 className="login-title">Rilaxy Admin</h1>
        <form onSubmit={handleSubmit}>
          <input
            ref={emailRef}
            className="input"
            type="email"
            placeholder="Email"
            onChange={() => setAuthError(null)}
            required
          />
          <input
            ref={passwordRef}
            className="input"
            type="password"
            placeholder="Senha"
            onChange={() => setAuthError(null)}
            required
          />
          {authError && <p className="error-text">{authError}</p>}
          <button className="btn btn-primary" type="submit" disabled={submitting || loading}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
