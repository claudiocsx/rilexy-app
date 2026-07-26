import { useEffect, useState } from 'react';
import { listarPendentes, aprovarUsuario } from '../services/usuariosService';

export default function Aprovacoes() {
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    try {
      const lista = await listarPendentes();
      console.log('Aprovacoes: pendentes encontrados:', lista.length, lista);
      setPendentes(lista);
    } catch (err) {
      console.error('Aprovacoes: erro ao carregar pendentes:', err);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const handleAprovar = async (uid) => {
    await aprovarUsuario(uid);
    setPendentes((prev) => prev.filter((u) => u.uid !== uid));
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div>
      <h1 className="page-title">Aprovações</h1>
      <p className="page-subtitle">Usuários aguardando aprovação</p>

      {pendentes.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum usuário pendente</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Data</th>
                <th>Código</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map((u) => (
                <tr key={u.uid}>
                  <td>{u.displayName || '-'}</td>
                  <td>{u.email || '-'}</td>
                  <td>{u.createdAt?.toDate?.().toLocaleDateString('pt-BR') || '-'}</td>
                  <td><code>{u.codigoConvite || '-'}</code></td>
                  <td>
                    <button className="btn btn-success btn-sm" onClick={() => handleAprovar(u.uid)}>
                      Aprovar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
