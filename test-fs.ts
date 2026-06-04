import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const fbConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(fbConfig);
const db = getFirestore(app, fbConfig.firestoreDatabaseId);

async function test() {
  const s = await getDocs(collection(db, 'shopping_items'));
  console.log("Total items:", s.size);
  s.forEach(doc => {
     if (doc.data().name.toLowerCase().includes('coca')) {
         console.log(doc.id, " - ", doc.data().name);
     }
  });
}
test();
