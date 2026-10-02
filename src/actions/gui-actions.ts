import * as path from "node:path";

import type { DocWenGuiControlClient } from "../docwen";
import { showNotice } from "../host/notices";
import { t } from "../i18n";
import { ActionRunner } from "./action-runner";

export class GuiActions {
  constructor(
    private readonly guiControl: DocWenGuiControlClient,
    private readonly runner: ActionRunner,
  ) {}

  async open(filePath?: string): Promise<void> {
    await this.runner.run({ key: "gui-control", kind: "gui-control" }, "noticeLaunchFailed", async ({ signal }) => {
      await this.guiControl.open(filePath, signal);
      showNotice(
        filePath
          ? t("noticeFileAdded", { filename: path.basename(filePath) })
          : t("noticeWindowActivated"),
      );
    });
  }
}
