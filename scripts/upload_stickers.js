const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://kojmnryyhzxuyxarlvse.supabase.co';
const supabaseKey = 'sb_publishable_PCdhN3oTOmWZE8W0reQbag_3EtZ-UDz';
const bucket = 'rilaxy-media';

const client = createClient(supabaseUrl, supabaseKey);

async function upload() {
  const stickersDir = path.join(__dirname, '..', 'assets', 'stickers');
  const files = fs.readdirSync(stickersDir).filter(f => f.endsWith('.json'));

  const results = [];
  for (const file of files) {
    const filePath = path.join(stickersDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const buffer = Buffer.from(content, 'utf-8');
    const remotePath = `stickers/${file}`;

    const { error } = await client.storage
      .from(bucket)
      .upload(remotePath, buffer, {
        contentType: 'application/json',
        upsert: true,
      });

    if (error) {
      console.error(`Failed to upload ${file}:`, error.message);
      continue;
    }

    const { data } = client.storage.from(bucket).getPublicUrl(remotePath);
    results.push({ file, url: data.publicUrl });
    console.log(`Uploaded ${file} -> ${data.publicUrl}`);
  }

  console.log('\nAll uploaded. Sticker URLs:');
  console.log(JSON.stringify(results, null, 2));
}

upload().catch(console.error);
