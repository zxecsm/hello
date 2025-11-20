import globals from 'globals';
export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: 'readonly',
        Intl: 'readonly',
        openInIframe: 'readonly',
        handleFontType: 'readonly',
      },
    },
    rules: {
      semi: [1, 'always'], // 分号
      'no-const-assign': 2, // const重复赋值
      'no-duplicate-imports': 2, // 重复导入
      'no-dupe-keys': 2, // 对象重复键
      'no-undef': 2, // 未声明变量
      'no-unused-vars': 1, // 未使用的变量
      'no-console': 1,
      'no-var': 1,
    },
  },
];
