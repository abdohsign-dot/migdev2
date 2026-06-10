const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf-8');
const lines = envFile.split('\n');
let url = '';
let key = '';
for (const line of lines) {
  if (line.startsWith('EXPO_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('EXPO_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

async function run() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const spec = await res.json();
  if (!spec.paths) {
    console.log("No paths in spec", spec);
    return;
  }
  const paths = Object.keys(spec.paths).filter(p => p.includes('driver_update_package'));
  for (const p of paths) {
    console.log(p);
    console.log(JSON.stringify(spec.paths[p], null, 2));
  }
}
run();
