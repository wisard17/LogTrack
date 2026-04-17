import { Timestamp } from 'firebase/firestore';

/**
 * Fungsi untuk mengonversi berbagai tipe data tanggal ke objek Date secara aman.
 * Mendukung Firestore Timestamp, ISO string, atau Date object.
 */
export function toDate(timestamp: any): Date | null {
  if (!timestamp) return null;

  // Jika sudah instance Date
  if (timestamp instanceof Date) return timestamp;

  // Jika Firestore Timestamp (memiliki metode toDate)
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }

  // Jika objek mock Firestore {seconds, nanoseconds}
  if (typeof timestamp.seconds === 'number') {
    return new Date(timestamp.seconds * 1000);
  }

  // Jika string ISO atau format lainnya
  const date = new Date(timestamp);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
}

/**
 * Memformat tanggal ke string lokal Indonesia.
 */
export function formatDate(timestamp: any, options: Intl.DateTimeFormatOptions = { 
  day: 'numeric', 
  month: 'long', 
  year: 'numeric' 
}): string {
  const date = toDate(timestamp);
  if (!date) return '-';
  return date.toLocaleDateString('id-ID', options);
}
