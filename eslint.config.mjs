import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    
    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  // The impeccable live-mode helper injects a dev-only sync <script src>
  // into src/app/layout.tsx (removed by `impeccable live-server stop`).
  files: ["src/app/layout.tsx"],
  rules: { "@next/next/no-sync-scripts": "off" },
}, {
  ignores: [
    "node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills",
    // Vendored react-bits registry components (upstream animation code reads
    // refs during render and sets state in effects by design).
    "src/components/GradientWaves.tsx", "src/components/GradientText.tsx",
    "src/components/ScrollVelocity.tsx", "src/components/ScrollFloat.tsx",
    "src/components/ScrollReveal.tsx", "src/components/SpotlightCard.tsx",
    "src/components/Aurora.tsx", "src/components/CountUp.tsx",
  ]
}];

export default eslintConfig;
