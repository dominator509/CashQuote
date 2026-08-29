// Jest must exercise application modules in test mode even when the caller
// invokes the validation gate with production deployment variables. Production
// readiness remains covered by the dedicated smoke/readiness checks.
process.env.NODE_ENV = 'test';
