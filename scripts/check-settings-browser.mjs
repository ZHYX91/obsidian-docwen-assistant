import { execFileSync } from "node:child_process";

const fixture = new URL("../tests/browser/settings-dropdown.html", import.meta.url);
const html = execFileSync(process.env.CHROME_BIN ?? "google-chrome", [
  "--headless", "--disable-gpu", "--dump-dom", fixture.href,
], { encoding: "utf8", timeout: 30_000 });
if (!/<html\b[^>]*\bdata-result="passed"/u.test(html)) {
  throw new Error(`Settings dropdown layout failed: ${/<pre id="report">([^<]*)/u.exec(html)?.[1] ?? "fixture did not run"}`);
}
console.log("Settings dropdown layout passed in LTR and RTL at 260, 320 and 760 CSS pixels.");
