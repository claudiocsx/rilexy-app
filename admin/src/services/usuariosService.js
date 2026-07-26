import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, Timestamp, where } from 'firebase/firestore';

export async function listarUsuarios() {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
}

export async function buscarUsuarios(termo) {
  const lower = termo.toLowerCase();
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map((doc) => ({ uid: doc.id, ...doc.data() }))
    .filter((u) =>
      (u.displayName && u.displayName.toLowerCase().includes(lower)) ||
      (u.email && u.email.toLowerCase().includes(lower))
    );
}

export async function aprovarUsuario(uid) {
  await updateDoc(doc(db, 'users', uid), { approvalStatus: 'approved', status: 'approved' });
}

export async function banirUsuario(uid, adminUid, motivo) {
  await updateDoc(doc(db, 'users', uid), {
    approvalStatus: 'banned',
    status: 'banned',
    bannedAt: Timestamp.now(),
    bannedBy: adminUid,
    banMotivo: motivo || null,
  });
}

export async function desbanirUsuario(uid) {
  await updateDoc(doc(db, 'users', uid), {
    approvalStatus: 'approved',
    status: 'approved',
    bannedAt: null,
    bannedBy: null,
    banMotivo: null,
  });
}

export async function listarPendentes() {
  const snap = await getDocs(collection(db, 'users'));
  const results = snap.docs
    .map((doc) => ({ uid: doc.id, ...doc.data() }))
    .filter((u) => {
      if (!u.codigoConvite) return false;
      // Novo formato: approvalStatus gerencia aprovação
      if (u.approvalStatus) return u.approvalStatus === 'pending';
      // Formato antigo (status era usado para aprovação, mas pode ter sido sobrescrito por presença)
      return u.status !== 'approved' && u.status !== 'banned';
    });
  results.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
  return results;
}

export { doc, updateDoc, Timestamp };
