#!/usr/bin/env node
// migrate-posts-media-urls.js
// Normaliza posts: garante que mediaUrls seja array, mediaUrl (singular) vira mediaUrls[0]

const admin = require('firebase-admin');
const path = require('path');

// Inicializa com service account
const serviceAccountPath = process.argv[2] || path.join(__dirname, 'service-account.json');
if (!require('fs').existsSync(serviceAccountPath)) {
  console.error('❌ service-account.json não encontrado. Passe como argumento: node migrate-posts-media-urls.js /path/to/service-account.json');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

const db = admin.firestore();

async function migrate() {
  console.log('🔍 Buscando posts...');
  const snapshot = await db.collection('posts').get();
  console.log(`📄 ${snapshot.size} posts encontrados`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    
    const hasMediaUrl = !!data.mediaUrl;
    const hasMediaUrls = Array.isArray(data.mediaUrls) && data.mediaUrls.length > 0;
    
    // Já está correto
    if (hasMediaUrls && !hasMediaUrl) {
      skipped++;
      continue;
    }

    // Tem mediaUrl singular mas não tem mediaUrls array
    if (hasMediaUrl && !hasMediaUrls) {
      try {
        await db.collection('posts').doc(id).update({
          mediaUrls: [data.mediaUrl],
          mediaKeys: data.mediaKey ? [data.mediaKey] : admin.firestore.FieldValue.delete(),
          mediaIvs: data.mediaIv ? [data.mediaIv] : admin.firestore.FieldValue.delete(),
        });
        console.log(`✅ ${id}: mediaUrl → mediaUrls[0]`);
        updated++;
      } catch (e) {
        console.error(`❌ ${id}:`, e.message);
        errors++;
      }
      continue;
    }

    // Tem mediaUrls mas vazio, e tem mediaUrl
    if (Array.isArray(data.mediaUrls) && data.mediaUrls.length === 0 && hasMediaUrl) {
      try {
        await db.collection('posts').doc(id).update({
          mediaUrls: [data.mediaUrl],
        });
        console.log(`✅ ${id}: mediaUrls vazio → [mediaUrl]`);
        updated++;
      } catch (e) {
        console.error(`❌ ${id}:`, e.message);
        errors++;
      }
      continue;
    }

    // Sem mídia nenhuma
    skipped++;
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Atualizados: ${updated}`);
  console.log(`   ⏭️  Pulados (já OK ou sem mídia): ${skipped}`);
  console.log(`   ❌ Erros: ${errors}`);
}

migrate().catch(console.error);