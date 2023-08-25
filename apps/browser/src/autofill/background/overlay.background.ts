import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { WebsiteIconService } from "@bitwarden/common/services/website-icon.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import LockedVaultPendingNotificationsItem from "../../background/models/lockedVaultPendingNotificationsItem";
import { BrowserApi } from "../../platform/browser/browser-api";
import {
  AutofillOverlayElement,
  AutofillOverlayPort,
} from "../overlay/utils/autofill-overlay.enum";
import { AutofillService, PageDetail } from "../services/abstractions/autofill.service";

import {
  OverlayBackgroundExtensionMessageHandlers,
  OverlayButtonPortMessageHandlers,
  OverlayListPortMessageHandlers,
} from "./abstractions/overlay.background";

class OverlayBackground {
  private ciphers: any[] = [];
  private currentTabCiphers: any[] = [];
  private pageDetailsForTab: Record<number, PageDetail[]> = {};
  private overlayListSenderInfo: chrome.runtime.MessageSender;
  private userAuthStatus: AuthenticationStatus = AuthenticationStatus.LoggedOut;
  private overlayButtonPort: chrome.runtime.Port;
  private overlayListPort: chrome.runtime.Port;
  private focusedFieldData: {
    focusedFieldStyles: Partial<CSSStyleDeclaration>;
    focusedFieldRects: Partial<DOMRect>;
  };
  private overlayPageTranslations: Record<string, string>;
  private readonly iconsServerUrl: string;
  private readonly extensionMessageHandlers: OverlayBackgroundExtensionMessageHandlers = {
    openAutofillOverlay: () => this.openOverlay(),
    autofillOverlayElementClosed: ({ message }) => this.overlayElementClosed(message),
    autofillOverlayAddNewVaultItem: ({ message, sender }) => this.addNewVaultItem(message, sender),
    checkAutofillOverlayFocused: () => this.checkOverlayFocused(),
    focusAutofillOverlayList: () => this.focusOverlayList(),
    updateAutofillOverlayPosition: ({ message }) => this.updateOverlayPosition(message),
    updateAutofillOverlayHidden: ({ message }) => this.updateOverlayHidden(message),
    updateFocusedFieldData: ({ message }) => this.updateFocusedFieldData(message),
    collectPageDetailsResponse: ({ message, sender }) => this.storePageDetails(message, sender),
    unlockCompleted: () => this.openOverlay(true),
    addEditCipherSubmitted: () => this.updateCurrentTabCiphers(),
    deletedCipher: () => this.updateCurrentTabCiphers(),
  };
  private readonly overlayButtonPortMessageHandlers: OverlayButtonPortMessageHandlers = {
    overlayButtonClicked: ({ port }) => this.handleOverlayButtonClicked(port.sender),
    closeAutofillOverlay: ({ port }) => this.closeAutofillOverlay(port.sender),
    overlayButtonBlurred: () => this.checkOverlayListFocused(),
  };
  private readonly overlayListPortMessageHandlers: OverlayListPortMessageHandlers = {
    checkAutofillOverlayButtonFocused: () => this.checkAutofillOverlayButtonFocused(),
    unlockVault: ({ port }) => this.unlockVault(port.sender),
    autofillSelectedListItem: ({ message, port }) =>
      this.autofillOverlayListItem(message, port.sender),
    updateAutofillOverlayListHeight: ({ message }) => this.updateAutofillOverlayListHeight(message),
    addNewVaultItem: () => this.getNewVaultItemDetails(),
    viewSelectedCipher: ({ message, port }) => this.viewSelectedCipher(message, port.sender),
    redirectOverlayFocusOut: ({ message, port }) =>
      this.redirectOverlayFocusOut(message, port.sender),
  };

  constructor(
    private cipherService: CipherService,
    private autofillService: AutofillService,
    private authService: AuthService,
    private environmentService: EnvironmentService,
    private settingsService: SettingsService,
    private stateService: StateService,
    private i18nService: I18nService
  ) {
    this.iconsServerUrl = this.environmentService.getIconsUrl();
    this.getAuthStatus();
    this.setupExtensionMessageListeners();

    // TODO: CG - ENSURE THAT THE ENGINEERING TEAM HAS A DISCUSSION ABOUT THE IMPLICATIONS OF THE USAGE OF THIS METHOD.
    this.overrideUserAutofillSettings();
  }

  removePageDetails(tabId: number) {
    delete this.pageDetailsForTab[tabId];
  }

  private storePageDetails(message: any, sender: chrome.runtime.MessageSender) {
    const pageDetails = {
      frameId: sender.frameId,
      tab: sender.tab,
      details: message.details,
    };
    if (this.pageDetailsForTab[sender.tab.id]?.length) {
      this.pageDetailsForTab[sender.tab.id].push(pageDetails);
      return;
    }

    this.pageDetailsForTab[sender.tab.id] = [pageDetails];
  }

  private async autofillOverlayListItem(message: any, sender: chrome.runtime.MessageSender) {
    if (!message.cipherId) {
      return;
    }

    const cipher = this.ciphers.find((c) => c.id === message.cipherId);

    // TODO: CG - Probably need to think of a less costly way of doing this. We're iterating multiple times over the found ciphers to reorder the most recently clicked element.
    const cipherIndex = this.currentTabCiphers.findIndex((c) => c.id === message.cipherId);
    this.currentTabCiphers.unshift(this.currentTabCiphers.splice(cipherIndex, 1)[0]);

    if (await this.autofillService.isPasswordRepromptRequired(cipher, sender.tab)) {
      return;
    }

    await this.autofillService.doAutoFill({
      tab: sender.tab,
      cipher: cipher,
      pageDetails: this.pageDetailsForTab[sender.tab.id],
      fillNewPassword: true,
      allowTotpAutofill: true,
    });
  }

  private checkOverlayFocused() {
    if (this.overlayListPort) {
      this.checkOverlayListFocused();

      return;
    }

    this.checkAutofillOverlayButtonFocused();
  }

  private checkAutofillOverlayButtonFocused() {
    this.overlayButtonPort?.postMessage({ command: "checkAutofillOverlayButtonFocused" });
  }

  private checkOverlayListFocused() {
    this.overlayListPort?.postMessage({ command: "checkOverlayListFocused" });
  }

  private closeAutofillOverlay(sender: chrome.runtime.MessageSender) {
    if (!sender) {
      return;
    }

    chrome.tabs.sendMessage(sender.tab.id, { command: "closeAutofillOverlay" });
  }

  private overlayElementClosed({ overlayElement }: { overlayElement: string }) {
    if (overlayElement === AutofillOverlayElement.Button) {
      this.overlayButtonPort?.disconnect();
      this.overlayButtonPort = null;

      return;
    }

    this.overlayListPort?.disconnect();
    this.overlayListPort = null;
  }

  private updateOverlayPosition({ overlayElement }: { overlayElement: string }) {
    if (overlayElement === AutofillOverlayElement.Button) {
      this.overlayButtonPort?.postMessage({
        command: "updateIframePosition",
        position: this.getOverlayButtonPosition(),
      });

      return;
    }

    this.overlayListPort?.postMessage({
      command: "updateIframePosition",
      position: this.getOverlayListPosition(),
    });
  }

  private getOverlayButtonPosition() {
    if (!this.focusedFieldData) {
      return;
    }

    const { top, left, width, height } = this.focusedFieldData.focusedFieldRects;
    const { paddingRight, paddingLeft } = this.focusedFieldData.focusedFieldStyles;
    const elementOffset = height * 0.37;
    const elementHeight = height - elementOffset;
    const elementTopPosition = top + elementOffset / 2;
    let elementLeftPosition = left + width - height + elementOffset / 2;

    const fieldPaddingRight = parseInt(paddingRight, 10);
    const fieldPaddingLeft = parseInt(paddingLeft, 10);
    if (fieldPaddingRight > fieldPaddingLeft) {
      elementLeftPosition = left + width - height - (fieldPaddingRight - elementOffset + 2);
    }

    return {
      top: `${elementTopPosition}px`,
      left: `${elementLeftPosition}px`,
      height: `${elementHeight}px`,
      width: `${elementHeight}px`,
    };
  }

  private getOverlayListPosition() {
    const { top, left, width, height } = this.focusedFieldData.focusedFieldRects;

    return {
      width: `${width}px`,
      top: `${top + height}px`,
      left: `${left}px`,
    };
  }

  private updateFocusedFieldData(message: any) {
    this.focusedFieldData = message.focusedFieldData;
  }

  private updateOverlayHidden(message: any) {
    if (!message.display) {
      return;
    }

    if (this.overlayButtonPort) {
      this.overlayButtonPort.postMessage({
        command: "updateOverlayHidden",
        display: message.display,
      });
    }

    if (this.overlayListPort) {
      this.overlayListPort.postMessage({
        command: "updateOverlayHidden",
        display: message.display,
      });
    }
  }

  private async openOverlay(focusFieldElement = false) {
    const currentTab = await BrowserApi.getTabFromCurrentWindowId();
    const authStatus = await this.getAuthStatus();
    chrome.tabs.sendMessage(currentTab.id, {
      command: "openAutofillOverlay",
      authStatus,
      focusFieldElement,
    });
  }

  async updateCurrentTabCiphers() {
    if (this.userAuthStatus !== AuthenticationStatus.Unlocked) {
      return;
    }

    // TODO: CG - Its possible that this isn't entirely effective, we need to consider and test how iframed forms react to this.
    const currentTab = await BrowserApi.getTabFromCurrentWindowId();
    if (!currentTab?.url) {
      return;
    }

    const unsortedCiphers = await this.cipherService.getAllDecryptedForUrl(currentTab.url);
    this.ciphers = unsortedCiphers.sort((a, b) =>
      this.cipherService.sortCiphersByLastUsedThenName(a, b)
    );
    const isFaviconDisabled = this.settingsService.getDisableFavicon();

    this.currentTabCiphers = this.ciphers.map((cipher) => ({
      id: cipher.id,
      name: cipher.name,
      type: cipher.type,
      reprompt: cipher.reprompt,
      favorite: cipher.favorite,
      // TODO: CG - Need to consider a better way to approach this. Each login cipher type will have the same icon so we don't need to re-build that value.
      icon: !isFaviconDisabled
        ? WebsiteIconService.buildCipherIconData(this.iconsServerUrl, cipher, isFaviconDisabled)
        : null,
      login: {
        username: this.getObscureName(cipher.login.username),
      },
      // card: {
      //   cardholderName: cipher.card.cardholderName,
      //   partialNumber: cipher.card.number?.slice(-4),
      //   expMonth: cipher.card.expMonth,
      //   expYear: cipher.card.expYear,
      // },
      // identity: {
      //   title: cipher.identity.title,
      //   firstName: cipher.identity.firstName,
      //   middleName: cipher.identity.middleName,
      //   lastName: cipher.identity.lastName,
      //   email: cipher.identity.email,
      //   company: cipher.identity.company,
      // },
    }));

    this.overlayListPort?.postMessage({
      command: "updateOverlayListCiphers",
      ciphers: this.currentTabCiphers,
    });
  }

  private getObscureName(name: string): string {
    const [username, domain] = name.split("@");
    const usernameLength = username?.length;
    if (!usernameLength) {
      return name;
    }

    const startingCharacters = username.slice(0, usernameLength > 4 ? 2 : 1);
    let numberStars = usernameLength;
    if (usernameLength > 4) {
      numberStars = usernameLength < 6 ? numberStars - 1 : numberStars - 2;
    }

    let obscureName = `${startingCharacters}${new Array(numberStars).join("*")}`;
    if (usernameLength >= 6) {
      obscureName = `${obscureName}${username.slice(-1)}`;
    }

    return domain ? `${obscureName}@${domain}` : obscureName;
  }

  private updateAutofillOverlayListHeight(message: any) {
    if (!this.overlayListSenderInfo) {
      return;
    }

    chrome.tabs.sendMessage(this.overlayListSenderInfo.tab.id, {
      command: "updateAutofillOverlayListHeight",
      height: message.height,
    });
  }

  private async getAuthStatus() {
    const authStatus = await this.authService.getAuthStatus();
    if (authStatus !== this.userAuthStatus && authStatus === AuthenticationStatus.Unlocked) {
      this.userAuthStatus = authStatus;
      this.updateAutofillOverlayButtonAuthStatus();
      await this.updateCurrentTabCiphers();
    }

    this.userAuthStatus = authStatus;
    return this.userAuthStatus;
  }

  private updateAutofillOverlayButtonAuthStatus() {
    if (!this.overlayButtonPort) {
      return;
    }

    this.overlayButtonPort.postMessage({
      command: "updateAutofillOverlayButtonAuthStatus",
      authStatus: this.userAuthStatus,
    });
  }

  private handleOverlayButtonClicked(sender: chrome.runtime.MessageSender) {
    if (this.userAuthStatus !== AuthenticationStatus.Unlocked) {
      this.unlockVault(sender);
      return;
    }

    this.openOverlay();
  }

  private async unlockVault(sender?: chrome.runtime.MessageSender) {
    if (!sender) {
      return;
    }

    this.closeAutofillOverlay(sender);
    const retryMessage: LockedVaultPendingNotificationsItem = {
      commandToRetry: {
        msg: {
          command: "openAutofillOverlay",
        },
        sender: sender,
      },
      target: "overlay.background",
    };
    await BrowserApi.tabSendMessageData(
      sender.tab,
      "addToLockedVaultPendingNotifications",
      retryMessage
    );
    await BrowserApi.tabSendMessageData(sender.tab, "promptForLogin", { skipNotification: true });
  }

  private setupExtensionMessageListeners() {
    chrome.runtime.onMessage.addListener(this.handleExtensionMessage);
    chrome.runtime.onConnect.addListener(this.handlePortOnConnect);
  }

  private handleExtensionMessage = (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    const command: string = message.command;
    const handler: CallableFunction | undefined = this.extensionMessageHandlers[command];
    if (!handler) {
      return false;
    }

    const messageResponse = handler({ message, sender });
    if (!messageResponse) {
      return false;
    }

    Promise.resolve(messageResponse).then((response) => sendResponse(response));
    return true;
  };

  private handlePortOnConnect = (port: chrome.runtime.Port) => {
    if (port.name === AutofillOverlayPort.Button) {
      this.setupOverlayButtonPort(port);
    }

    if (port.name === AutofillOverlayPort.List) {
      this.setupOverlayListPort(port);
    }
  };

  private setupOverlayButtonPort = async (port: chrome.runtime.Port) => {
    this.overlayButtonPort = port;
    this.overlayButtonPort.postMessage({
      command: "initAutofillOverlayButton",
      authStatus: this.userAuthStatus || (await this.getAuthStatus()),
      styleSheetUrl: chrome.runtime.getURL("overlay/button.css"),
      translations: this.getTranslations(),
    });
    this.updateOverlayPosition({ overlayElement: AutofillOverlayElement.Button });
    this.overlayButtonPort.onMessage.addListener(this.handleOverlayButtonPortMessage);
  };

  private handleOverlayButtonPortMessage = (message: any, port: chrome.runtime.Port) => {
    if (port.name !== AutofillOverlayPort.Button) {
      return;
    }

    const handler = this.overlayButtonPortMessageHandlers[message?.command];
    if (!handler) {
      return;
    }

    handler({ message, port });
  };

  private setupOverlayListPort = async (port: chrome.runtime.Port) => {
    if (port.sender) {
      this.overlayListSenderInfo = port.sender;
    }

    this.overlayListPort = port;
    this.overlayListPort.postMessage({
      command: "initAutofillOverlayList",
      authStatus: this.userAuthStatus || (await this.getAuthStatus()),
      ciphers: this.currentTabCiphers,
      styleSheetUrl: chrome.runtime.getURL("overlay/list.css"),
      translations: this.getTranslations(),
    });
    this.updateOverlayPosition({ overlayElement: AutofillOverlayElement.List });
    this.overlayListPort.onMessage.addListener(this.handleOverlayListPortMessage);
  };

  private handleOverlayListPortMessage = (message: any, port: chrome.runtime.Port) => {
    const command = message?.command;
    if (!command || port.name !== AutofillOverlayPort.List) {
      return;
    }

    const handler = this.overlayListPortMessageHandlers[command];
    if (!handler) {
      return;
    }

    handler({ message, port });
  };

  private async viewSelectedCipher(message: any, sender: chrome.runtime.MessageSender) {
    await BrowserApi.tabSendMessageData(sender.tab, "openViewCipher", {
      cipherId: message.cipherId,
      action: "show-autofill-button",
    });
  }

  private focusOverlayList() {
    if (!this.overlayListPort) {
      return;
    }

    this.overlayListPort.postMessage({ command: "focusOverlayList" });
  }

  private getTranslations() {
    if (!this.overlayPageTranslations) {
      this.overlayPageTranslations = {
        locale: BrowserApi.getUILanguage(),
        opensInANewWindow: this.i18nService.translate("opensInANewWindow"),
        buttonPageTitle: this.i18nService.translate("bitwardenOverlayButton"),
        listPageTitle: this.i18nService.translate("bitwardenVault"),
        unlockYourAccount: this.i18nService.translate("unlockYourAccountToViewMatchingLogins"),
        unlockAccount: this.i18nService.translate("unlockAccount"),
        fillCredentialsFor: this.i18nService.translate("fillCredentialsFor"),
        partialUsername: this.i18nService.translate("partialUsername"),
        view: this.i18nService.translate("view"),
        noItemsToShow: this.i18nService.translate("noItemsToShow"),
        newItem: this.i18nService.translate("newItem"),
        addNewVaultItem: this.i18nService.translate("addNewVaultItem"),
      };
    }

    return this.overlayPageTranslations;
  }

  private redirectOverlayFocusOut(message: any, sender: chrome.runtime.MessageSender) {
    chrome.tabs.sendMessage(sender.tab.id, {
      command: "redirectOverlayFocusOut",
      direction: message.direction,
    });
  }

  // TODO: CG - Need to go through and refactor this implementation to be more robust.
  private getNewVaultItemDetails() {
    chrome.tabs.sendMessage(this.overlayListSenderInfo.tab.id, {
      command: "addNewVaultItemFromOverlay",
    });
  }

  private async addNewVaultItem(message: any, sender: chrome.runtime.MessageSender) {
    // TODO: CG - This is an exact implementation of AddLoginQueueMessage.toCipherView. Need to find a way to abstract this logic.
    const uriView = new LoginUriView();
    uriView.uri = message.login.uri;

    const loginView = new LoginView();
    loginView.uris = [uriView];
    loginView.username = message.login.username || "";
    loginView.password = message.login.password || "";

    const cipherView = new CipherView();
    cipherView.name = (Utils.getHostname(message.login.uri) || message.login.hostname).replace(
      /^www\./,
      ""
    );
    cipherView.folderId = null;
    cipherView.type = CipherType.Login;
    cipherView.login = loginView;

    await this.stateService.setAddEditCipherInfo({
      cipher: cipherView,
      collectionIds: cipherView.collectionIds,
    });

    await BrowserApi.tabSendMessageData(sender.tab, "openAddEditCipher", {
      cipherId: cipherView.id,
    });
  }

  // TODO: CG - ENSURE THAT THE ENGINEERING TEAM HAS A DISCUSSION ABOUT THE IMPLICATIONS OF THIS MODIFICATION.
  // Other password managers leverage this privacy API to force autofill settings to be disabled.
  // This helps with the user experience when using a third party password manager.
  // However, it overrides the users settings and can be considered a privacy concern.
  // If we approach using this API, we need to ensure that it is strictly an opt-in experience and
  // convey why a user might want to disable autofill in their browser.
  // Also worth noting that this API is only available in Chrome.
  private overrideUserAutofillSettings() {
    if (
      !chrome?.privacy?.services?.autofillAddressEnabled ||
      !chrome.privacy.services.autofillCreditCardEnabled
    ) {
      return;
    }

    chrome.privacy.services.autofillAddressEnabled.get({}, (details) => {
      const { levelOfControl, value } = details;
      if (
        levelOfControl === "controllable_by_this_extension" ||
        (levelOfControl === "controlled_by_this_extension" && value === true)
      ) {
        chrome.privacy.services.autofillAddressEnabled.set({ value: false });
      }
    });
    chrome.privacy.services.autofillCreditCardEnabled.get({}, function (details) {
      const { levelOfControl, value } = details;
      if (
        levelOfControl === "controllable_by_this_extension" ||
        (levelOfControl === "controlled_by_this_extension" && value === true)
      ) {
        chrome.privacy.services.autofillCreditCardEnabled.set({ value: false });
      }
    });
  }
}

export default OverlayBackground;
