module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' }, modules: 'auto' }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [
    function replaceViteEnvironment({ types: t }) {
      return {
        name: 'replace-vite-environment-in-jest',
        visitor: {
          MemberExpression(path) {
            const { node } = path;
            if (
              !node.computed
              && node.property.name === 'env'
              && t.isMetaProperty(node.object)
              && node.object.meta.name === 'import'
              && node.object.property.name === 'meta'
            ) {
              path.replaceWith(
                t.memberExpression(
                  t.identifier('globalThis'),
                  t.identifier('__VITE_TEST_ENV__'),
                ),
              );
            }
          },
        },
      };
    },
  ],
};
