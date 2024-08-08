import { AutofillInlineMenuContentService } from "../overlay/inline-menu/content/autofill-inline-menu-content.service";
import { OverlayNotificationsContentService } from "../overlay/notifications/content/overlay-notifications-content.service";
import { AutofillOverlayContentService } from "../services/autofill-overlay-content.service";
import { InlineMenuFieldQualificationService } from "../services/inline-menu-field-qualification.service";
import { setupAutofillInitDisconnectAction } from "../utils";

import AutofillInit from "./autofill-init";

(function (windowContext) {
  if (!windowContext.bitwardenAutofillInit) {
    const inlineMenuFieldQualificationService = new InlineMenuFieldQualificationService();
    const autofillOverlayContentService = new AutofillOverlayContentService(
      inlineMenuFieldQualificationService,
    );
    const overlayNotificationsContentService = new OverlayNotificationsContentService();
    let inlineMenuElements: AutofillInlineMenuContentService;
    if (globalThis.self === globalThis.top) {
      inlineMenuElements = new AutofillInlineMenuContentService();
    }

    windowContext.bitwardenAutofillInit = new AutofillInit(
      autofillOverlayContentService,
      inlineMenuElements,
      overlayNotificationsContentService,
    );
    setupAutofillInitDisconnectAction(windowContext);

    windowContext.bitwardenAutofillInit.init();
  }
})(window);
