// Sends the signed Smash Yard bundle in this branch to Google Play internal testing as a draft release.
// Writes every step's result to STATUS.txt so it can be read without the Actions API.
import fs from 'node:fs';
import { google } from 'googleapis';
const pkg = 'com.birco.smashyard';
const out = [];
const log = (s) => { out.push(s); console.log(s); };
try {
  const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.SA), scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const ap = google.androidpublisher({ version: 'v3', auth });
  const edit = (await ap.edits.insert({ packageName: pkg })).data;
  log('edit ' + edit.id);
  const file = fs.readdirSync('.').find((f) => f.endsWith('.aab'));
  const b = (await ap.edits.bundles.upload({ packageName: pkg, editId: edit.id, media: { mimeType: 'application/octet-stream', body: fs.createReadStream(file) } })).data;
  log('uploaded ' + file + ' versionCode ' + b.versionCode);
  await ap.edits.tracks.update({ packageName: pkg, editId: edit.id, track: 'internal', requestBody: { track: 'internal', releases: [{ name: '1.0.0 (' + b.versionCode + ')', status: 'draft', versionCodes: [String(b.versionCode)], releaseNotes: [{ language: 'en-US', text: fs.readFileSync('whatsnew-en-US', 'utf8').trim() }] }] } });
  log('internal track: draft release 1.0.0 (' + b.versionCode + ')');
  await ap.edits.commit({ packageName: pkg, editId: edit.id });
  log('result success');
} catch (e) {
  log('result failure');
  log('error ' + (e.response && JSON.stringify(e.response.data) || e.message));
}
fs.writeFileSync('/tmp/STATUS.txt', out.join('\n') + '\n');
