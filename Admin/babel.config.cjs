module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [function replaceViteEnv({ types }) {
    return {
      name: 'replace-vite-env-for-jest',
      visitor: {
        MemberExpression(path) {
          const { object, property, computed } = path.node;
          if (
            object.type === 'MetaProperty'
            && object.meta.name === 'import'
            && object.property.name === 'meta'
            && !computed
            && property.name === 'env'
          ) {
            path.replaceWith(types.memberExpression(
              types.identifier('globalThis'),
              types.identifier('__VITE_TEST_ENV__'),
            ));
          }
        },
      },
    };
  }],
};
