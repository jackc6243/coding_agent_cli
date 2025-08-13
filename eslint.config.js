
import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


export default [
  {
    ignores: ["dist/**"],
  },
  {languageOptions: { globals: {
      ...globals.node,
      "process": "readonly"
  } }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];
