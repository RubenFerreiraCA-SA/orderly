import { collection, doc, Firestore } from '@angular/fire/firestore';

export function userActionsCollection(firestore: Firestore, uid: string) {
  return collection(firestore, 'users', uid, 'actions');
}

export function userActionDoc(firestore: Firestore, uid: string, actionId: string) {
  return doc(firestore, 'users', uid, 'actions', actionId);
}

export function userGoalsCollection(firestore: Firestore, uid: string) {
  return collection(firestore, 'users', uid, 'goals');
}

export function userGoalDoc(firestore: Firestore, uid: string, goalId: string) {
  return doc(firestore, 'users', uid, 'goals', goalId);
}

export function userBrainDumpsCollection(firestore: Firestore, uid: string) {
  return collection(firestore, 'users', uid, 'brainDumps');
}

export function userBrainDumpDoc(firestore: Firestore, uid: string, itemId: string) {
  return doc(firestore, 'users', uid, 'brainDumps', itemId);
}

export function userTopThreeDoc(firestore: Firestore, uid: string) {
  return doc(firestore, 'users', uid, 'preferences', 'topThree');
}

export function userDailyPlanDoc(firestore: Firestore, uid: string) {
  return doc(firestore, 'users', uid, 'preferences', 'dailyPlan');
}

export function userBootstrapDoc(firestore: Firestore, uid: string) {
  return doc(firestore, 'users', uid, 'meta', 'bootstrap');
}
