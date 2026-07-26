import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';

export async function listarPosts() {
  try {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[postsService] query com orderBy falhou, tentando sem orderBy:', e.message);
    const snap = await getDocs(collection(db, 'posts'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

export async function deletarPost(postId) {
  await deleteDoc(doc(db, 'posts', postId));
}
