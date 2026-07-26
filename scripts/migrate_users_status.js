/**
 * Script para adicionar status: 'approved' a todos os usuários existentes.
 * Roda uma vez antes de ativar o sistema de aprovação.
 *
 * Uso: node scripts/migrate_users_status.js <service-account.json>
 */
const admin = require('firebase-admin');
const serviceAccount = require(process.argv[2]);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function migrate() {
  const snapshot = await db.collection('users').get();
  let count = 0;
  const batch = db.batch();

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.status) {
      batch.update(doc.ref, { status: 'approved' });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`${count} usuários atualizados com status: 'approved'`);
  } else {
    console.log('Nenhum usuário precisa de migração.');
  }
}

migrate().catch(console.error);
