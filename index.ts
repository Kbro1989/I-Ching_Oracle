// POG2 Sovereign System - Main Export
// Exports all modules for easy consumption

export * from './constants';
export * from './interfaces';
export * from './integration';

export { default as POG2System } from './integration';
// Note: Actual implementation would require concrete classes implementing the interfaces