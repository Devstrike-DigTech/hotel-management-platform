import { test as setup } from "@playwright/test";
import { STATE } from "../playwright.config";
import { signIn } from "./helpers";

setup("sign in once for the console tests", async ({ page }) => {
  await signIn(page);
  await page.context().storageState({ path: STATE });
});
