import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["node_modules/**", ".next/**", "prisma/seed.ts"],
  },
];

export default eslintConfig;
