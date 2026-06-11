const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function migrate() {
  const chatsSnap = await db.collection('chats').get();

  for (const chatDoc of chatsSnap.docs) {
    const chatData = chatDoc.data();
    if (!chatData.participants || chatData.participants.length === 0) continue;

    const messagesSnap = await chatDoc.ref.collection('messages').get();
    let batch = db.batch();
    let count = 0;

    messagesSnap.docs.forEach((msgDoc) => {
      const msgData = msgDoc.data();
      if (!msgData.participants) {
        batch.update(msgDoc.ref, { participants: chatData.participants });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Chat ${chatDoc.id}: ${count} messages migrated`);
    }
  }

  console.log('Migration complete.');
}

migrate().catch(console.error);
