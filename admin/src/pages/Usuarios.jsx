import { useState } from 'react';
import { buscarUsuarios, banirUsuario, desbanirUsuario } from '../services/usuariosService';
import { useAuth } from '../AuthContext';

export default function Usuarios() {
  const { user } = useAuth();
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!termo.trim()) return;
    setLoading(true);
    const lista = await buscarUsuarios(termo);
    setResultados(lista);
    setLoading(false);
  };

  const handleBanir = async (uid, nome) => {
    const motivo = prompt(`Motivo para banir ${nome}:`);
    if (motivo === null) return;
    await banirUsuario(uid, user.uid, motivo);
    setResultados((prev) => prev.map((u) => u.uid === uid ? { ...u, status: 'banned' } : u));
  };

  const handleDesbanir = async (uid) => {
    if (!confirm('Desbanir este usuário?')) return;
    await desbanirUsuario(uid);
    setResultados((prev) => prev.map((u) => u.uid === uid ? { ...u, status: 'approved' } : u));
  };

  const statusLabel = (status) => {
    if (!status || status === 'approved') return <span className="badge badge-success">Ativo</span>;
    if (status === 'pending') return <span className="badge badge-warning">Pendente</span>;
    if (status === 'banned') return <span className="badge badge-danger">Banido</span>;
    return status;
  };

  return (
    <div>
      <h1 className="page-title">Usuários</h1>
      <form onSubmit={handleSearch} className="search-form">
        <input
          className="input"
          placeholder="Buscar por nome ou email..."
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {resultados.length > 0 && (
        <div className="table-container" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Status</th>
                <th>Intenção</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((u) => (
                <tr key={u.uid}>
                  <td>{u.displayName || '-'}</td>
                  <td>{u.email || '-'}</td>
                  <td>{statusLabel(u.status)}</td>
                  <td>{u.intention ? `${u.intention}` : '-'}</td>
                  <td>
                    {u.status === 'banned' ? (
                      <button className="btn btn-warning btn-sm" onClick={() => handleDesbanir(u.uid)}>
                        Desbanir
                      </button>
                    ) : (
                      <button className="btn btn-danger btn-sm" onClick={() => handleBanir(u.uid, u.displayName || u.email)}>
                        Banir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultados.length === 0 && termo && !loading && (
        <div className="empty-state"><p>Nenhum usuário encontrado</p></div>
      )}
    </div>
  );
}
