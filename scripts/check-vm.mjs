import { default as VM } from 'scratch-vm';
console.log('VM type:', typeof VM);
console.log('VM proto:', Object.getOwnPropertyNames(VM.prototype));
