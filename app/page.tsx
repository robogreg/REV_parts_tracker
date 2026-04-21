import { redirect } from 'next/navigation';

export default function RootPage() {
  // Actual redirect logic happens client-side in the (app) layout auth guard.
  // Server-side we just redirect to checkout; auth guard will bounce to login if needed.
  redirect('/checkout');
}
