import appConfig from '@disphere/code-quality-config/eslint';

export default appConfig({
  env: 'node',
  tsconfigRootDir: import.meta.dirname,
});
