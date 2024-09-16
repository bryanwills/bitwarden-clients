import { Injectable, NgZone } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { BiometricStateService } from "@bitwarden/common/key-management/biometrics/biometric-state.service";
import { BiometricsService } from "@bitwarden/common/key-management/biometrics/biometric.service";
import { BiometricsCommands } from "@bitwarden/common/key-management/biometrics/biometrics-commands";
import { BiometricsStatus } from "@bitwarden/common/key-management/biometrics/biometrics-status";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { BrowserSyncVerificationDialogComponent } from "../app/components/browser-sync-verification-dialog.component";
import { LegacyMessage } from "../models/native-messaging/legacy-message";
import { LegacyMessageWrapper } from "../models/native-messaging/legacy-message-wrapper";
import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

const MessageValidTimeout = 10 * 1000;
const HashAlgorithmForAsymmetricEncryption = "sha1";

@Injectable()
export class BiometricMessageHandlerService {
  constructor(
    private cryptoFunctionService: CryptoFunctionService,
    private cryptoService: CryptoService,
    private logService: LogService,
    private messagingService: MessagingService,
    private desktopSettingService: DesktopSettingsService,
    private biometricStateService: BiometricStateService,
    private biometricsService: BiometricsService,
    private dialogService: DialogService,
    private accountService: AccountService,
    private authService: AuthService,
    private ngZone: NgZone,
  ) {}

  async handleMessage(msg: LegacyMessageWrapper) {
    const { appId, message: rawMessage } = msg as LegacyMessageWrapper;

    // Request to setup secure encryption
    if ("command" in rawMessage && rawMessage.command === "setupEncryption") {
      const remotePublicKey = Utils.fromB64ToArray(rawMessage.publicKey);

      // Validate the UserId to ensure we are logged into the same account.
      const accounts = await firstValueFrom(this.accountService.accounts$);
      const userIds = Object.keys(accounts);
      if (!userIds.includes(rawMessage.userId)) {
        this.logService.info(
          "[Native Messaging IPC] Received message for user that is not logged into the desktop app.",
        );
        ipc.platform.nativeMessaging.sendMessage({
          command: "wrongUserId",
          appId: appId,
        });
        return;
      }

      if (await firstValueFrom(this.desktopSettingService.browserIntegrationFingerprintEnabled$)) {
        this.logService.info("[Native Messaging IPC] Requesting fingerprint verification.");
        ipc.platform.nativeMessaging.sendMessage({
          command: "verifyFingerprint",
          appId: appId,
        });

        const fingerprint = await this.cryptoService.getFingerprint(
          rawMessage.userId,
          remotePublicKey,
        );

        this.messagingService.send("setFocus");

        const dialogRef = this.ngZone.run(() =>
          BrowserSyncVerificationDialogComponent.open(this.dialogService, { fingerprint }),
        );

        const browserSyncVerified = await firstValueFrom(dialogRef.closed);

        if (browserSyncVerified !== true) {
          this.logService.info("[Native Messaging IPC] Fingerprint verification failed.");
          return;
        }
      }

      await this.secureCommunication(remotePublicKey, appId);
      return;
    }

    if ((await ipc.platform.ephemeralStore.getEphemeralValue(appId)) == null) {
      this.logService.info(
        "[Native Messaging IPC] Epheremal secret for secure channel is missing. Invalidating encryption...",
      );
      ipc.platform.nativeMessaging.sendMessage({
        command: "invalidateEncryption",
        appId: appId,
      });
      return;
    }

    const message: LegacyMessage = JSON.parse(
      await this.cryptoService.decryptToUtf8(
        rawMessage as EncString,
        SymmetricCryptoKey.fromString(await ipc.platform.ephemeralStore.getEphemeralValue(appId)),
      ),
    );

    // Shared secret is invalidated, force re-authentication
    if (message == null) {
      this.logService.info(
        "[Native Messaging IPC] Secure channel failed to decrypt message. Invalidating encryption...",
      );
      ipc.platform.nativeMessaging.sendMessage({
        command: "invalidateEncryption",
        appId: appId,
      });
      return;
    }

    if (Math.abs(message.timestamp - Date.now()) > MessageValidTimeout) {
      this.logService.info("[Native Messaging IPC] Received a too old message. Ignoring.");
      return;
    }

    const messageId = message.messageId;

    switch (message.command) {
      case BiometricsCommands.UnlockWithBiometricsForUser: {
        const userId = message.userId as UserId;
        try {
          const userKey = await this.biometricsService.unlockWithBiometricsForUser(userId);
          if (userKey != null) {
            this.logService.info("[Native Messaging IPC] Biometric unlock for user: " + userId);
            await this.send(
              {
                command: BiometricsCommands.UnlockWithBiometricsForUser,
                response: true,
                messageId,
                userKeyB64: userKey.keyB64,
              },
              appId,
            );

            const currentlyActiveAccountId = (
              await firstValueFrom(this.accountService.activeAccount$)
            ).id;
            const isCurrentlyActiveAccountUnlocked =
              (await firstValueFrom(this.authService.authStatusFor$(userId))) ==
              AuthenticationStatus.Unlocked;

            // prevent proc reloading an active account, when it is the same as the browser
            if (currentlyActiveAccountId != message.userId || !isCurrentlyActiveAccountUnlocked) {
              if (!ipc.platform.isDev) {
                ipc.platform.reloadProcess();
              }
            }
          } else {
            await this.send(
              {
                command: BiometricsCommands.UnlockWithBiometricsForUser,
                messageId,
                response: false,
              },
              appId,
            );
          }
        } catch (e) {
          await this.send(
            { command: BiometricsCommands.UnlockWithBiometricsForUser, messageId, response: false },
            appId,
          );
        }

        break;
      }
      case BiometricsCommands.AuthenticateWithBiometrics: {
        try {
          const unlocked = await this.biometricsService.authenticateWithBiometrics();
          await this.send(
            {
              command: BiometricsCommands.AuthenticateWithBiometrics,
              messageId,
              response: unlocked,
            },
            appId,
          );
        } catch (e) {
          await this.send(
            { command: BiometricsCommands.AuthenticateWithBiometrics, messageId, response: false },
            appId,
          );
        }
        break;
      }
      case BiometricsCommands.GetBiometricsStatus: {
        const status = await this.biometricsService.getBiometricsStatus();
        return this.send(
          {
            command: BiometricsCommands.GetBiometricsStatus,
            messageId,
            response: status,
          },
          appId,
        );
      }
      case BiometricsCommands.GetBiometricsStatusForUser: {
        let status = await this.biometricsService.getBiometricsStatusForUser(
          message.userId as UserId,
        );
        if (status == BiometricsStatus.NotEnabledLocally) {
          status = BiometricsStatus.NotEnabledInConnectedDesktopApp;
        }
        return this.send(
          {
            command: BiometricsCommands.GetBiometricsStatusForUser,
            messageId,
            response: status,
          },
          appId,
        );
      }
      default:
        this.logService.error("NativeMessage, got unknown command: " + message.command);
        break;
    }
  }

  private async send(message: any, appId: string) {
    message.timestamp = Date.now();

    const encrypted = await this.cryptoService.encrypt(
      JSON.stringify(message),
      SymmetricCryptoKey.fromString(await ipc.platform.ephemeralStore.getEphemeralValue(appId)),
    );

    ipc.platform.nativeMessaging.sendMessage({
      appId: appId,
      messageId: message.messageId,
      message: encrypted,
    });
  }

  private async secureCommunication(remotePublicKey: Uint8Array, appId: string) {
    const secret = await this.cryptoFunctionService.randomBytes(64);
    await ipc.platform.ephemeralStore.setEphemeralValue(
      appId,
      new SymmetricCryptoKey(secret).keyB64,
    );

    this.logService.info("[Native Messaging IPC] Setting up secure channel");
    const encryptedSecret = await this.cryptoFunctionService.rsaEncrypt(
      secret,
      remotePublicKey,
      HashAlgorithmForAsymmetricEncryption,
    );
    ipc.platform.nativeMessaging.sendMessage({
      appId: appId,
      command: "setupEncryption",
      sharedSecret: Utils.fromBufferToB64(encryptedSecret),
    });
  }
}
