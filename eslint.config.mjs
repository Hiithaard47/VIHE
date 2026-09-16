import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["node_modules/**", ".next/**", ".next-e2e/**", "prisma/seed.ts"],
  },
];

export default eslintConfig;
