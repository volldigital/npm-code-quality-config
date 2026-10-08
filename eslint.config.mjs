import appConfig from './eslint.js';

// test/consumer is linted with its own config by the smoke test.
export default appConfig({ env: 'node', testRunner: 'none', ignores: ['test/consumer/**'] });
