import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, updateDoc, query, orderBy, Timestamp } from 'firebase/firestore';

function gerarCodigo(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export async function gerarConvite(adminUid, maxUsos = 1, expiraEmDias = null) {
  const codigo = gerarCodigo();
  const data = {
    codigo,
    criadoPor: adminUid,
    criadoEm: Timestamp.now(),
    maxUsos,
    usosAtuais: 0,
    usadoPor: [],
    ativo: true,
  };
  if (expiraEmDias) data.expiraEm = Timestamp.fromDate(new Date(Date.now() + expiraEmDias * 86400000));
  await setDoc(doc(db, 'convites', codigo), data);
  return codigo;
}

export async function gerarLote(adminUid, quantidade, maxUsos, expiraEmDias) {
  const codigos = [];
  for (let i = 0; i < quantidade; i++) {
    codigos.push(await gerarConvite(adminUid, maxUsos, expiraEmDias));
  }
  return codigos;
}

export async function listarConvites() {
  const q = query(collection(db, 'convites'), orderBy('criadoEm', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function revogarConvite(codigo) {
  await updateDoc(doc(db, 'convites', codigo), { ativo: false });
}
