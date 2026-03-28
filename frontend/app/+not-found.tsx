import { Redirect } from 'expo-router';

// Catches unmatched deep-link paths (e.g. /-/ from Expo Go tunnel mode)
// and drops straight into the main screen so the app always opens correctly.
export default function NotFound() {
    return <Redirect href="/" />;
}
