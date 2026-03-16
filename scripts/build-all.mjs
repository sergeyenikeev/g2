import { spawnSync } from "node:child_process";
import process from "node:process";

const PLATFORMS = [
  "generic",
  "crazygames",
  "poki",
  "yandex",
  "vkplay",
  "rustore",
  "newgrounds",
  "itchio"
];

const args = process.argv.slice(2);
const useMock = args.includes("--mock");
const requestedTargets = args.filter((arg) => !arg.startsWith("--"));

const invalidTargets = requestedTargets.filter((target) => !PLATFORMS.includes(target));
if (invalidTargets.length > 0) {
  console.error(`Unknown target(s): ${invalidTargets.join(", ")}`);
  console.error(`Allowed targets: ${PLATFORMS.join(", ")}`);
  process.exit(1);
}

const targets = requestedTargets.length > 0 ? requestedTargets : PLATFORMS;
const sharedEnv = {
  ...process.env,
  VITE_USE_PLATFORM_MOCK: useMock ? "1" : "0"
};
const normalizedEnv = Object.fromEntries(
  Object.entries(sharedEnv).filter(([, value]) => typeof value === "string")
);

for (const target of targets) {
  console.log(`\n=== Building ${target}${useMock ? " [mock]" : ""} ===`);
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npm run build:${target}`], {
          stdio: "inherit",
          env: normalizedEnv
        })
      : spawnSync("npm", ["run", `build:${target}`], {
          stdio: "inherit",
          env: normalizedEnv
        });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nAll requested builds completed successfully.");
