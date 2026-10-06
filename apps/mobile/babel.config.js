module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
          extensions: [
            '.ios.tsx', '.android.tsx', '.web.tsx', '.tsx',
            '.ios.ts', '.android.ts', '.web.ts', '.ts',
            '.ios.jsx', '.android.jsx', '.web.jsx', '.jsx',
            '.ios.js', '.android.js', '.web.js', '.js',
            '.json',
          ],
        },
      ],
    ],
  };
};
