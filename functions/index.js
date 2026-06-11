const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const STORIES_COLLECTION = 'stories';

exports.deleteExpiredStories = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async () => {
    const now = new Date();
    const snapshot = await admin
      .firestore()
      .collection(STORIES_COLLECTION)
      .where('expiresAt', '<', now)
      .get();

    if (snapshot.empty) {
      console.log('No expired stories found');
      return;
    }

    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`Deleted ${snapshot.size} expired stories`);
  });
