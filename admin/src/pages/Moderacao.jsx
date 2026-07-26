import { useEffect, useState } from 'react';
import { listarPosts, deletarPost } from '../services/postsService';

export default function Moderacao() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const lista = await listarPosts();
      setPosts(lista);
    } catch (err) {
      console.error('[Moderacao] erro ao listar posts:', err.code, err.message);
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const handleDeletar = async (postId) => {
    if (!confirm('Excluir este post permanentemente?')) return;
    await deletarPost(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div>
      <h1 className="page-title">Moderação</h1>
      <p className="page-subtitle">Feed de posts — visualize e remova conteúdo impróprio</p>

      {error ? (
        <div className="empty-state"><p className="error-text">Erro: {error}</p></div>
      ) : posts.length === 0 ? (
        <div className="empty-state"><p>Nenhum post encontrado</p></div>
      ) : (
        <div className="posts-list">
          {posts.map((p) => (
            <div key={p.id} className="post-card">
              <div className="post-header">
                <span className="post-author">{p.senderName || 'Anônimo'}</span>
                <span className="post-date">{p.timestamp?.toDate?.().toLocaleString('pt-BR') || '-'}</span>
              </div>
              <p className="post-text">{p.text || '(sem texto)'}</p>
              {p.mediaUrl && (
                <div className="post-media">
                  <p className="post-media-url" style={{fontSize:11,wordBreak:'break-all',marginBottom:4}}>
                    URL: {p.mediaUrl.substring(0, 100)}...
                  </p>
                  {p.mediaType?.startsWith('video') ? (
                    <video src={p.mediaUrl} controls className="post-media-video"
                      onError={(e) => console.error('[Moderacao] video error', p.mediaUrl, e.currentTarget.error)}
                    />
                  ) : (
                    <img src={p.mediaUrl} alt="Mídia do post" className="post-media-img"
                      onError={(e) => console.error('[Moderacao] img error', p.mediaUrl, e.currentTarget.error)}
                    />
                  )}
                </div>
              )}
              <div className="post-meta">
                <span>❤️ {p.likesCount || 0}</span>
                <span>💬 {p.commentsCount || 0}</span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => handleDeletar(p.id)}>
                Excluir Post
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
