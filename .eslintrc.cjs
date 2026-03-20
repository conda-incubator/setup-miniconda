module.exports = {
  env: {
    es6: true,
    commonjs: true,
    node: true
  },
  root: true,
  extends: [
    "eslint:recommended"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: [
      "tsconfig.json",
      "tsconfig.eslint.json"
    ]
  },
  plugins: ["@typescript-eslint", "jsdoc"],
  settings: {
    jsdoc: {
      mode: "typescript"
    }
  },
  rules: {
    "jsdoc/require-jsdoc": ["error", {
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: true,
        FunctionExpression: true,
        ArrowFunctionExpression: false
      },
      contexts: [
        "TSInterfaceDeclaration",
        "TSTypeAliasDeclaration",
        "TSEnumDeclaration",
        "ExportNamedDeclaration:has(VariableDeclaration)"
      ],
      checkConstructors: false
    }],
    "jsdoc/require-description": ["error", {
      contexts: [
        "FunctionDeclaration",
        "MethodDefinition",
        "ClassDeclaration",
        "FunctionExpression",
        "TSInterfaceDeclaration",
        "TSTypeAliasDeclaration",
        "TSEnumDeclaration"
      ]
    }],
    "jsdoc/require-param": ["error", {
      contexts: [
        "FunctionDeclaration",
        "FunctionExpression",
        "TSInterfaceDeclaration"
      ]
    }],
    "jsdoc/require-param-description": "error",
    "jsdoc/check-param-names": "error",
    "jsdoc/require-returns": ["error", {
      contexts: [
        "FunctionDeclaration",
        "FunctionExpression",
        "TSInterfaceDeclaration"
      ]
    }],
    "jsdoc/require-returns-description": "error",
    "jsdoc/no-blank-blocks": "error",
    "jsdoc/require-description-complete-sentence": "error",
    "@typescript-eslint/ban-ts-comment": "warn",
    "@typescript-eslint/camelcase": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "interface",
        "format": ["PascalCase"],
        "custom": {
          "regex": "^I[A-Z]",
          "match": true
        }
      }
    ],
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/no-namespace": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { args: "none" }],
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/triple-slash-reference": "warn",
    "no-case-declarations": "warn",
    "no-control-regex": "warn",
    "no-inner-declarations": "off",
    "no-prototype-builtins": "off",
    "no-undef": "warn",
    "no-unused-vars": "off",
    "no-useless-escape": "off",
    "prefer-const": "off"
  },
  overrides: [
    {
      files: ["src/__tests__/**/*.ts"],
      rules: {
        "jsdoc/require-jsdoc": "off",
        "jsdoc/require-description": "off",
        "jsdoc/require-param": "off",
        "jsdoc/require-param-description": "off",
        "jsdoc/check-param-names": "off",
        "jsdoc/require-returns": "off",
        "jsdoc/require-returns-description": "off",
        "jsdoc/no-blank-blocks": "off",
        "jsdoc/require-description-complete-sentence": "off"
      }
    }
  ]
};
