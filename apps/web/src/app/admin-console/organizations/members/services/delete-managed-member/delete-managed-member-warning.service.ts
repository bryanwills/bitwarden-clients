import { Injectable } from "@angular/core";

import {
  DELETE_MANAGED_USER_WARNING,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { DialogService } from "@bitwarden/components";

export const SHOW_WARNING_KEY = new UserKeyDefinition<boolean>(
  DELETE_MANAGED_USER_WARNING,
  "showDeleteManagedUserWarning",
  {
    deserializer: (b) => b,
    clearOn: [],
  },
);

@Injectable({ providedIn: "root" })
export class DeleteManagedUserWarningService {
  private _acknowledged = this.stateProvider.getActive(SHOW_WARNING_KEY);

  acknowledged$ = this._acknowledged.state$;

  constructor(
    private stateProvider: StateProvider,
    private dialogService: DialogService,
  ) {}

  async acknowledgeWarning() {
    await this._acknowledged.update(() => true);
  }

  async showWarning() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: {
        key: "deleteManagedUserWarning",
      },
      content: {
        key: "deleteManagedUserWarningDesc",
      },
      type: "danger",
      icon: "bwi-exclamation-circle",
      acceptButtonText: { key: "continue" },
      cancelButtonText: { key: "cancel" },
    });

    if (!confirmed) {
      return false;
    }

    return confirmed;
  }
}
