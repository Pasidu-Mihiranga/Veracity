import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  {
    extends: [...next],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Common for theme/auth hydration; keep as warning so CI can enforce other errors.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
