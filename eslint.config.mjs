import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  {
    extends: [...next],
    rules: {
      // Common for theme/auth hydration; keep as warning so CI can enforce other errors.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
