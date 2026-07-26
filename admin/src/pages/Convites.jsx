import { useEffect, useState } from 'react';
import { gerarLote, listarConvites, revogarConvite } from '../services/convitesService';
import { useAuth } from '../AuthContext';

export default function Convites() {
  const { user } = useAuth();
  const [quantidade, setQuantidade] = useState(1);
  const [maxUsos, setMaxUsos] = useState(1);
  const [expiraDias, setExpiraDias] = useState('');
  const [gerando, setGerando] = useState(false);
  const [gerados, setGerados] = useState([]);
  const [convites, setConvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const lista = await listarConvites();
      setConvites(lista);
    } catch (err) {
      console.error('Erro ao carregar convites:', err);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const handleGerar = async () => {
    setGerando(true);
    try {
      const codigos = await gerarLote(user.uid, quantidade, maxUsos, expiraDias ? parseInt(expiraDias) : null);
      setGerados(codigos);
    } catch (err) {
      console.error('Erro ao gerar convites:', err);
    }
    setGerando(false);
    carregar();
  };

  const handleRevogar = async (codigo) => {
    if (!confirm(`Revogar código ${codigo}?`)) return;
    await revogarConvite(codigo);
    carregar();
  };

  const copiar = (codigo) => {
    navigator.clipboard.writeText(codigo);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 2000);
  };

  const statusConvite = (c) => {
    if (!c.ativo) return <span className="badge badge-danger">Revogado</span>;
    if (c.expiraEm && c.expiraEm.toDate() < new Date()) return <span className="badge badge-warning">Expirado</span>;
    if (c.usosAtuais >= c.maxUsos) return <span className="badge badge-secondary">Esgotado</span>;
    return <span className="badge badge-success">Ativo</span>;
  };

  return (
    <div>
      <h1 className="page-title">Convites</h1>

      <div className="card">
        <h2 className="card-title">Gerar Convites</h2>
        <div className="form-row">
          <div className="form-group">
            <label>Quantidade</label>
            <input className="input" type="number" min="1" max="50" value={quantidade} onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)} />
          </div>
          <div className="form-group">
            <label>Máx. usos por código</label>
            <input className="input" type="number" min="1" value={maxUsos} onChange={(e) => setMaxUsos(parseInt(e.target.value) || 1)} />
          </div>
          <div className="form-group">
            <label>Expira em (dias, opcional)</label>
            <input className="input" type="number" min="1" value={expiraDias} onChange={(e) => setExpiraDias(e.target.value)} placeholder="Não expira" />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleGerar} disabled={gerando} style={{ marginTop: 12 }}>
          {gerando ? 'Gerando...' : 'Gerar Convites'}
        </button>

        {gerados.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ color: '#94a3b8', marginBottom: 8 }}>{gerados.length} código(s) gerado(s):</p>
            <div className="codes-list">
              {gerados.map((codigo) => (
                <div key={codigo} className="code-item">
                  <code>{codigo}</code>
                  <button className="btn btn-sm btn-ghost" onClick={() => copiar(codigo)}>
                    {copiado === codigo ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2 className="card-title">Convites Existentes</h2>
        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : convites.length === 0 ? (
          <div className="empty-state"><p>Nenhum convite gerado ainda</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Status</th>
                  <th>Usos</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {convites.map((c) => (
                  <tr key={c.codigo}>
                    <td><code>{c.codigo}</code></td>
                    <td>{statusConvite(c)}</td>
                    <td>{c.usosAtuais}/{c.maxUsos}</td>
                    <td>{c.criadoEm?.toDate?.().toLocaleDateString('pt-BR') || '-'}</td>
                    <td>
                      {c.ativo && c.usosAtuais < c.maxUsos ? (
                        <button className="btn btn-danger btn-sm" onClick={() => handleRevogar(c.codigo)}>
                          Revogar
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
