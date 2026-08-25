import * as path from "node:path";

import type { DocWenClient } from "../docwen";
import { showNotice } from "../host/notices";
import { t } from "../i18n";
import { ActionRunner } from "./action-runner";

export class GuiActions {
  constructor(
    private readonly docwen: DocWenClient,
    private readonly runner: ActionRunner,
  ) {}

  async open(filePath?: string): Promise<void> {
    await this.runner.run({ key: "gui-control", kind: "gui-control" }, "noticeLaunchFailed", async ({ signal }) => {
      await this.docwen.guiOpen(filePath, signal);
      showNotice(
        filePath
          ? t("noticeFileAdded", { filename: path.basename(filePath) })
          : t("noticeWindowActivated"),
      );
    });
  }
}
