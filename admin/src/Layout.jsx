import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Layout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) => isActive ? 'nav-link active' : 'nav-link';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">♀♂</span>
          <span className="sidebar-title">Rilaxy Admin</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={linkClass}>📊 Dashboard</NavLink>
          <NavLink to="/aprovacoes" className={linkClass}>👥 Aprovações</NavLink>
          <NavLink to="/usuarios" className={linkClass}>👤 Usuários</NavLink>
          <NavLink to="/convites" className={linkClass}>🔗 Convites</NavLink>
          <NavLink to="/moderacao" className={linkClass}>📝 Moderação</NavLink>
          <NavLink to="/alcance" className={linkClass}>📍 Alcance</NavLink>
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.email}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>Sair</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
