import { Injectable } from "@angular/core";

import {
  ACCOUNT_DEPROVISIONING_BANNER_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";

export const SHOW_BANNER_KEY = new UserKeyDefinition<boolean>(
  ACCOUNT_DEPROVISIONING_BANNER_DISK,
  "accountDeprovisioningBanner",
  {
    deserializer: (b) => b,
    clearOn: [],
  },
);

@Injectable({ providedIn: "root" })
export class AccountDeprovisioningBannerService {
  private _showBanner = this.stateProvider.getActive(SHOW_BANNER_KEY);

  showBanner$ = this._showBanner.state$;

  constructor(private stateProvider: StateProvider) {}

  async hideBanner() {
    await this._showBanner.update(() => false);
  }
}
