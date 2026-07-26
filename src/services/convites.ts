import { db } from './firebase';
import firebase from 'firebase/compat/app';

export const validarCodigo = async (codigo: string): Promise<{ valido: boolean; mensagem?: string }> => {
  const trimmed = codigo.trim().toUpperCase();
  if (!trimmed) return { valido: false, mensagem: 'Código de convite é obrigatório' };

  const doc = await db.collection('convites').doc(trimmed).get();
  if (!doc.exists) return { valido: false, mensagem: 'Código de convite inválido' };

  const data = doc.data()!;
  if (!data.ativo) return { valido: false, mensagem: 'Código de convite já foi desativado' };

  if (data.expiraEm) {
    const expira = data.expiraEm.toDate ? data.expiraEm.toDate() : new Date(data.expiraEm);
    if (expira < new Date()) return { valido: false, mensagem: 'Código de convite expirou' };
  }

  if (data.usosAtuais >= data.maxUsos) return { valido: false, mensagem: 'Código de convite já atingiu o limite de usos' };

  return { valido: true };
};

export const consumirCodigo = async (codigo: string, uid: string): Promise<void> => {
  const trimmed = codigo.trim().toUpperCase();
  const ref = db.collection('convites').doc(trimmed);

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists) throw new Error('Código de convite inválido');
    const data = doc.data()!;
    if (data.usosAtuais >= data.maxUsos) throw new Error('Código de convite já foi usado');
    transaction.update(ref, {
      usosAtuais: data.usosAtuais + 1,
      usadoPor: firebase.firestore.FieldValue.arrayUnion(uid),
    });
  });
};
