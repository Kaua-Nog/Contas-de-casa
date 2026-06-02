import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const configPath = 'firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || undefined);

async function test() {
  try {
    console.log("Testing insert shopping item");
    const id = `shop-test-${Date.now()}`;
    await setDoc(doc(db, 'shopping_items', id), {
      id: id,
      name: 'Sabonete',
      quantity: 1,
      category: 'Higiene',
      checked: false,
      date: '2026-06-02',
      concluded: false
    });
    console.log("Shopping item insert ok");

    console.log("Testing insert bill");
    const billId = `bill-test-${Date.now()}`;
    await setDoc(doc(db, 'bills', billId), {
      id: billId,
      type: 'agua',
      customTitle: 'Sabesp',
      value: 10.5,
      dueDate: '2026-06-10',
      month: '2026-06',
      paid: false
    });
    console.log("Bill insert ok");

  } catch (e: any) {
    console.error("Insert fail:", e.message);
  }
  process.exit(0);
}
test();
