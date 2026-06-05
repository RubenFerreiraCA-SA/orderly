export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function isFirebaseConfigured(config: FirebaseConfig): boolean {
  return (
    config.apiKey !== 'YOUR_API_KEY' &&
    config.projectId !== 'YOUR_PROJECT_ID' &&
    config.apiKey.length > 0 &&
    config.projectId.length > 0
  );
}
