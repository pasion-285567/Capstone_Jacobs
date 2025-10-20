import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc
} from 'firebase/firestore';

// 1. Get your Firestore instance
const db = getFirestore();

// Define your old and new collection paths
const oldCollectionPath = 'menu';
const newCollectionPath = 'inventory';

async function moveCollectionDocuments() {
  const oldCollectionRef = collection(db, oldCollectionPath);
  const newCollectionRef = collection(db, newCollectionPath);

  // Initialize a batch for atomic writes
  const batch = writeBatch(db);

  try {
    // 2. Fetch all documents from the old collection
    const querySnapshot = await getDocs(oldCollectionRef);

    if (querySnapshot.empty) {
      console.log('No documents found in the old collection.');
      return;
    }

    console.log(`Moving ${querySnapshot.size} documents...`);

    // 3. For each document, add operations to the batch
    querySnapshot.forEach((oldDoc) => {
      // Use the same document ID for the new document
      const newDocRef = doc(newCollectionRef, oldDoc.id);
      batch.set(newDocRef, oldDoc.data()); // Write to the new collection
      batch.delete(oldDoc.ref);             // Mark old document for deletion
    });

    // 4. Commit the batch to execute all operations
    await batch.commit();
    console.log('Documents successfully moved and old documents deleted!');

  } catch (error) {
    console.error('Error moving documents:', error);
    // If the batch fails, no documents are written or deleted, preserving data integrity.
  }
}

// Call the function to execute the move
// Uncomment the line below when you are ready to run this in your app:
// moveCollectionDocuments();
