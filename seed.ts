import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './src/lib/firebase';

const MOCK_RESOURCES = [
  { name: 'City Community Center', type: 'shelter', status: 'open', address: '123 Main St', location: { lat: 40.7150, lng: -74.0080 } },
  { name: 'St. Mary\'s Hospital', type: 'medical', status: 'limited', address: '456 Health Ave', location: { lat: 40.7100, lng: -74.0020 }, phone: '(555) 123-4567', specialties: ['Emergency', 'Trauma'], waitingTime: '45 mins' },
  { name: 'Water Distribution Point A', type: 'water', status: 'open', address: '789 River Rd', location: { lat: 40.7180, lng: -74.0100 } },
  { name: 'Food Bank Central', type: 'food', status: 'open', address: '101 Market St', location: { lat: 40.7050, lng: -73.9950 } },
];

async function seed() {
  const resourcesRef = collection(db, 'resources');
  const snapshot = await getDocs(resourcesRef);
  
  if (snapshot.empty) {
    console.log('Seeding initial resources...');
    for (const res of MOCK_RESOURCES) {
      await addDoc(resourcesRef, res);
    }
    console.log('Seeding complete.');
  } else {
    console.log('Database already has data. Skipping seed.');
  }
}

seed().catch(console.error);
